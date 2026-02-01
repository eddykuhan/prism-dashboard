using System.Text.Json.Serialization;
using Grpc.AspNetCore.Server;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Identity.Web;
using PrismDashboard.Api.Services;

// Configure WebApplication with explicit web root
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = Directory.GetCurrentDirectory(),
    WebRootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot")
});

// Read auth configuration from environment variables or appsettings
var tenantId = builder.Configuration["AZURE_AD_TENANT_ID"] ?? builder.Configuration["AzureAd:TenantId"];
var clientIdApi = builder.Configuration["AZURE_AD_CLIENT_ID_API"] ?? builder.Configuration["AzureAd:ClientId"];
var clientIdSpa = builder.Configuration["AZURE_AD_CLIENT_ID_SPA"] ?? builder.Configuration["AzureAd:ClientIdSpa"];
var openAiEnabled = (builder.Configuration["AZURE_OPENAI_ENABLED"] ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);

var authEnabled = !string.IsNullOrEmpty(tenantId) && 
                  !string.IsNullOrEmpty(clientIdApi) && 
                  !string.IsNullOrEmpty(clientIdSpa);

// Validate: If OpenAI is enabled, auth must also be enabled (OBO flow required)
if (openAiEnabled && !authEnabled)
{
    throw new InvalidOperationException(
        "AZURE_OPENAI_ENABLED=true requires AZURE_AD_TENANT_ID, AZURE_AD_CLIENT_ID_API, and AZURE_AD_CLIENT_ID_SPA to be set. " +
        "The AI Copilot uses On-Behalf-Of flow for authentication."
    );
}

// Add services to the container
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() 
    { 
        Title = "Prism Developers Dashboard API", 
        Version = "v1",
        Description = "Unified developer dashboard API with real-time OpenTelemetry data, Kubernetes pod monitoring, ServiceNow incident tracking, and GitHub PR insights. WebSocket streaming with gRPC OTLP support."
    });
});

// Register custom services as singletons for shared state
builder.Services.AddSingleton<InMemoryStore>();
builder.Services.AddSingleton<WebSocketStreamService>();

// Configure gRPC for OTLP receiver (Traces, Metrics, Logs)
builder.Services.AddGrpc(options =>
{
    options.MaxReceiveMessageSize = 64 * 1024 * 1024; // 64MB for large batches
    options.MaxSendMessageSize = 16 * 1024 * 1024; // 16MB
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

// Add HttpClient factory for Azure OpenAI calls
builder.Services.AddHttpClient();

// Conditionally add Azure AD authentication with OBO support
if (authEnabled)
{
    builder.Services.AddMicrosoftIdentityWebApiAuthentication(builder.Configuration, "AzureAd")
        .EnableTokenAcquisitionToCallDownstreamApi()
        .AddInMemoryTokenCaches();
    
    // Override AzureAd config from environment variables if present
    builder.Services.Configure<Microsoft.Identity.Web.MicrosoftIdentityOptions>("AzureAd", options =>
    {
        if (!string.IsNullOrEmpty(tenantId)) options.TenantId = tenantId;
        if (!string.IsNullOrEmpty(clientIdApi)) options.ClientId = clientIdApi;
    });
    
    Console.WriteLine("INFO: Azure AD authentication enabled (OBO flow)");
}
else
{
    Console.WriteLine("INFO: Running in minimal mode - no authentication");
}

// Configure Kestrel to support both HTTP/1.1 (for REST/JSON) and HTTP/2 (for gRPC)
// Use ListenAnyIP for Docker compatibility (binds to 0.0.0.0)
builder.WebHost.ConfigureKestrel(options =>
{
    // Primary endpoint: HTTP/1.1 + HTTP/2 on port 5003
    // Supports: REST API, OTLP HTTP/JSON, gRPC (without TLS via HTTP/2 prior knowledge)
    options.ListenAnyIP(5003, o => o.Protocols = HttpProtocols.Http1AndHttp2);
    
    // Alternative: HTTP/2 only on port 4317 (standard OTLP gRPC port)
    options.ListenAnyIP(4317, o => o.Protocols = HttpProtocols.Http2);
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:4200", "http://localhost:5200", "http://localhost:5003")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
    
    // Allow any origin in production (served from same host)
    options.AddPolicy("AllowSameOrigin", policy =>
    {
        policy
            .SetIsOriginAllowed(_ => true)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// Debug: Log all requests to see what's hitting the server
app.Use(async (context, next) =>
{
    app.Logger.LogDebug("Request: {Method} {Path}", context.Request.Method, context.Request.Path);
    await next();
    app.Logger.LogDebug("Response: {StatusCode} for {Path}", context.Response.StatusCode, context.Request.Path);
});

// Serve static files (Angular frontend)
var webRootPath = app.Environment.WebRootPath;
if (!string.IsNullOrEmpty(webRootPath) && Directory.Exists(webRootPath))
{
    app.Logger.LogInformation("Serving static files from: {WebRootPath}", webRootPath);
    app.UseDefaultFiles();
    app.UseStaticFiles();
}
else
{
    app.Logger.LogWarning("No wwwroot found at: {WebRootPath} - static files will not be served", webRootPath);
}

// Always enable Swagger (useful for debugging in any environment)
app.UseSwagger();
app.UseSwaggerUI();

if (app.Environment.IsDevelopment())
{
    app.UseCors("AllowFrontend");
}
else
{
    app.UseCors("AllowSameOrigin");
}

// Enable gRPC services for OTLP receiver (Traces, Metrics, Logs)
app.MapGrpcService<OtlpTraceGrpcService>();
app.MapGrpcService<OtlpMetricsGrpcService>();
app.MapGrpcService<OtlpLogsGrpcService>();

// OTLP HTTP/JSON endpoint for traces
app.MapPost("/v1/traces", async (HttpContext context) =>
{
    try
    {
        var inMemoryStore = context.RequestServices.GetRequiredService<InMemoryStore>();
        var wsService = context.RequestServices.GetRequiredService<WebSocketStreamService>();
        
        // Read the request body as JSON
        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync();
        
        // Parse the JSON and add to in-memory store
        await inMemoryStore.AddTracesJsonAsync(json, context.RequestAborted);
        
        // Return standard OTLP response
        return Results.Ok(new { partialSuccess = (object?)null });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing OTLP traces");
        return Results.Json(new { partialSuccess = new { rejectedSpans = 1, errorMessage = ex.Message } }, statusCode: 200);
    }
});

// OTLP HTTP/JSON endpoint for metrics
app.MapPost("/v1/metrics", async (HttpContext context) =>
{
    try
    {
        var inMemoryStore = context.RequestServices.GetRequiredService<InMemoryStore>();
        var wsService = context.RequestServices.GetRequiredService<WebSocketStreamService>();
        
        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync();
        
        await inMemoryStore.AddMetricsJsonAsync(json, context.RequestAborted);
        
        return Results.Ok(new { partialSuccess = (object?)null });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing OTLP metrics");
        return Results.Json(new { partialSuccess = new { rejectedDataPoints = 1, errorMessage = ex.Message } }, statusCode: 200);
    }
});

// OTLP HTTP/JSON endpoint for logs
app.MapPost("/v1/logs", async (HttpContext context) =>
{
    try
    {
        var inMemoryStore = context.RequestServices.GetRequiredService<InMemoryStore>();
        var wsService = context.RequestServices.GetRequiredService<WebSocketStreamService>();
        
        using var reader = new StreamReader(context.Request.Body);
        var json = await reader.ReadToEndAsync();
        
        await inMemoryStore.AddLogsJsonAsync(json, context.RequestAborted);
        
        return Results.Ok(new { partialSuccess = (object?)null });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Error processing OTLP logs");
        return Results.Json(new { partialSuccess = new { rejectedLogRecords = 1, errorMessage = ex.Message } }, statusCode: 200);
    }
});

// WebSocket middleware
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

// WebSocket endpoint
app.Map("/ws/stream", async context =>
{
    if (!context.WebSockets.IsWebSocketRequest)
    {
        context.Response.StatusCode = 400;
        await context.Response.WriteAsync("WebSocket requests only");
        return;
    }

    var wsService = context.RequestServices.GetRequiredService<WebSocketStreamService>();
    var webSocket = await context.WebSockets.AcceptWebSocketAsync();
    var connectionId = Guid.NewGuid().ToString();
    
    await wsService.HandleConnectionAsync(webSocket, connectionId, context.RequestAborted);
});

// Conditionally require authentication
if (authEnabled)
{
    app.UseAuthentication();
}
app.UseAuthorization();
app.MapControllers();

// SPA fallback for Angular routing
if (!string.IsNullOrEmpty(webRootPath) && Directory.Exists(webRootPath))
{
    app.MapFallbackToFile("index.html");
}

// Log startup info
app.Logger.LogInformation("=== OTEL Dashboard API (Prism) Started ===");
app.Logger.LogInformation("");
app.Logger.LogInformation("Mode: {Mode}", authEnabled ? "Full (Auth + AI)" : "Minimal (Telemetry Only)");
app.Logger.LogInformation("Auth Enabled: {AuthEnabled}", authEnabled);
app.Logger.LogInformation("Copilot Enabled: {CopilotEnabled}", authEnabled && openAiEnabled);
app.Logger.LogInformation("");
app.Logger.LogInformation("OTLP Endpoints (configure your apps/collectors to send here):");
app.Logger.LogInformation("  gRPC: http://localhost:4317 (standard OTLP port)");
app.Logger.LogInformation("  gRPC: http://localhost:5003 (alternative)");
app.Logger.LogInformation("  HTTP: http://localhost:5003/v1/traces");
app.Logger.LogInformation("  HTTP: http://localhost:5003/v1/metrics");
app.Logger.LogInformation("  HTTP: http://localhost:5003/v1/logs");
app.Logger.LogInformation("");
app.Logger.LogInformation("Dashboard Endpoints:");
app.Logger.LogInformation("  REST API: http://localhost:5003/api/v1/*");
app.Logger.LogInformation("  Config: http://localhost:5003/api/v1/config");
app.Logger.LogInformation("  WebSocket: ws://localhost:5003/ws/stream");
if (app.Environment.IsDevelopment())
{
    app.Logger.LogInformation("  Swagger: http://localhost:5003/swagger");
}
app.Logger.LogInformation("");

app.Run();
