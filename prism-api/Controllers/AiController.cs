using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Web;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace PrismDashboard.Api.Controllers;

/// <summary>
/// AI endpoint that proxies requests to Azure OpenAI using OBO flow.
/// Requires user authentication - uses the user's identity to call Azure OpenAI.
/// </summary>
[ApiController]
[Route("api/v1/ai")]
[Authorize]
public class AiController : ControllerBase
{
    private readonly ITokenAcquisition _tokenAcquisition;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AiController> _logger;
    private readonly IHttpClientFactory _httpClientFactory;

    private const string AzureOpenAiScope = "https://cognitiveservices.azure.com/.default";

    public AiController(
        ITokenAcquisition tokenAcquisition,
        IConfiguration configuration,
        ILogger<AiController> logger,
        IHttpClientFactory httpClientFactory)
    {
        _tokenAcquisition = tokenAcquisition;
        _configuration = configuration;
        _logger = logger;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Chat endpoint that forwards requests to Azure OpenAI.
    /// Uses On-Behalf-Of flow to call Azure OpenAI with user's identity.
    /// </summary>
    [HttpPost("chat")]
    public async Task<IActionResult> Chat([FromBody] ChatRequest request, CancellationToken cancellationToken)
    {
        var endpoint = _configuration["AZURE_OPENAI_ENDPOINT"] ?? _configuration["AzureOpenAI:Endpoint"];
        var deployment = _configuration["AZURE_OPENAI_DEPLOYMENT"] ?? _configuration["AzureOpenAI:Deployment"];
        var apiVersion = _configuration["AZURE_OPENAI_API_VERSION"] ?? "2024-08-01-preview";

        if (string.IsNullOrEmpty(endpoint) || string.IsNullOrEmpty(deployment))
        {
            _logger.LogError("Azure OpenAI endpoint or deployment not configured");
            return StatusCode(500, new { error = "AI service not configured" });
        }

        try
        {
            // Get OBO token for Azure OpenAI
            var accessToken = await _tokenAcquisition.GetAccessTokenForUserAsync(
                new[] { AzureOpenAiScope },
                tokenAcquisitionOptions: new TokenAcquisitionOptions { ForceRefresh = false }
            );

            var userName = User.Identity?.Name ?? "Unknown";
            _logger.LogInformation("User {User} requesting AI chat", userName);

            // Build Azure OpenAI request
            var openAiRequest = new
            {
                messages = BuildMessages(request),
                max_tokens = request.MaxTokens ?? 2000,
                temperature = request.Temperature ?? 0.7,
                top_p = 0.95,
                frequency_penalty = 0,
                presence_penalty = 0,
                stop = (string[]?)null
            };

            var url = $"{endpoint.TrimEnd('/')}/openai/deployments/{deployment}/chat/completions?api-version={apiVersion}";
            
            using var httpClient = _httpClientFactory.CreateClient();
            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            var content = new StringContent(
                JsonSerializer.Serialize(openAiRequest),
                Encoding.UTF8,
                "application/json"
            );

            var response = await httpClient.PostAsync(url, content, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                _logger.LogWarning("Azure OpenAI returned {StatusCode}: {Error}", response.StatusCode, errorContent);
                
                if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    return StatusCode(403, new { 
                        error = "Access denied to AI service",
                        detail = "You may not have the required role assignment on the Azure OpenAI resource."
                    });
                }
                
                return StatusCode((int)response.StatusCode, new { error = "AI service error", detail = errorContent });
            }

            var result = await response.Content.ReadAsStringAsync(cancellationToken);
            var openAiResponse = JsonSerializer.Deserialize<JsonElement>(result);

            // Extract the assistant message
            var assistantMessage = openAiResponse
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            return Ok(new ChatResponse
            {
                Message = assistantMessage ?? "",
                Usage = new UsageInfo
                {
                    PromptTokens = openAiResponse.GetProperty("usage").GetProperty("prompt_tokens").GetInt32(),
                    CompletionTokens = openAiResponse.GetProperty("usage").GetProperty("completion_tokens").GetInt32(),
                    TotalTokens = openAiResponse.GetProperty("usage").GetProperty("total_tokens").GetInt32()
                }
            });
        }
        catch (MicrosoftIdentityWebChallengeUserException ex)
        {
            _logger.LogWarning(ex, "User needs to re-authenticate");
            return StatusCode(401, new { error = "Authentication required", detail = "Please sign in again." });
        }
        catch (Exception ex) when (ex.Message.Contains("AADSTS") || ex.Message.Contains("consent"))
        {
            _logger.LogWarning(ex, "OBO token acquisition failed - likely missing consent or role");
            return StatusCode(403, new { 
                error = "Access denied",
                detail = "You do not have permission to use the AI service. Contact your administrator."
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calling Azure OpenAI");
            return StatusCode(500, new { error = "Internal error", detail = ex.Message });
        }
    }

    private object[] BuildMessages(ChatRequest request)
    {
        var messages = new List<object>
        {
            new
            {
                role = "system",
                content = GetSystemPrompt(request.Context)
            }
        };

        // Add conversation history if provided
        if (request.History != null)
        {
            foreach (var msg in request.History)
            {
                messages.Add(new { role = msg.Role, content = msg.Content });
            }
        }

        // Add current user message
        messages.Add(new { role = "user", content = request.Message });

        return messages.ToArray();
    }

    private string GetSystemPrompt(TelemetryContext? context)
    {
        var basePrompt = @"You are Prism Copilot, an AI assistant specialized in analyzing OpenTelemetry data including logs, traces, and metrics. 
You help developers understand their application's behavior, diagnose issues, and optimize performance.

When analyzing telemetry data:
1. Identify patterns and anomalies
2. Explain error messages and their likely causes
3. Suggest troubleshooting steps
4. Recommend best practices
5. Be concise but thorough

Format your responses using markdown for better readability.";

        if (context == null)
            return basePrompt;

        var contextPrompt = context.Type switch
        {
            "log" => $@"

The user is asking about a specific log entry:
- Service: {context.Data?.GetProperty("serviceName").GetString() ?? "Unknown"}
- Level: {context.Data?.GetProperty("level").GetString() ?? context.Data?.GetProperty("severityText").GetString() ?? "Unknown"}
- Message: {context.Data?.GetProperty("message").GetString() ?? context.Data?.GetProperty("body").GetString() ?? "Unknown"}
- Timestamp: {context.Data?.GetProperty("timestamp").GetString() ?? "Unknown"}
- Attributes: {context.Data?.GetProperty("attributes").ToString() ?? "{}"}",

            "trace" => $@"

The user is asking about a trace:
- Trace ID: {context.Data?.GetProperty("traceId").GetString() ?? "Unknown"}
- Service: {context.Data?.GetProperty("serviceName").GetString() ?? "Unknown"}  
- Operation: {context.Data?.GetProperty("operationName").GetString() ?? "Unknown"}
- Duration: {context.Data?.GetProperty("durationMs").GetDouble() ?? 0}ms
- Status: {context.Data?.GetProperty("status").GetInt32() ?? 0}
- Has Error: {(context.Data?.TryGetProperty("hasError", out var hasErr) == true && hasErr.GetBoolean())}
- Span Count: {(context.Data?.TryGetProperty("spanCount", out var sc) == true ? sc.GetInt32() : 1)}",

            "span" => $@"

The user is asking about a specific span:
- Span ID: {context.Data?.GetProperty("spanId").GetString() ?? "Unknown"}
- Service: {context.Data?.GetProperty("serviceName").GetString() ?? "Unknown"}
- Operation: {context.Data?.GetProperty("operationName").GetString() ?? "Unknown"}
- Kind: {context.Data?.GetProperty("kind").GetInt32() ?? 0}
- Duration: {context.Data?.GetProperty("durationMs").GetDouble() ?? 0}ms
- Status: {context.Data?.GetProperty("status").GetInt32() ?? 0}
- Attributes: {context.Data?.GetProperty("attributes").ToString() ?? "{}"}",

            _ => ""
        };

        return basePrompt + contextPrompt;
    }
}

public class ChatRequest
{
    public string Message { get; set; } = "";
    public TelemetryContext? Context { get; set; }
    public List<ChatMessage>? History { get; set; }
    public int? MaxTokens { get; set; }
    public double? Temperature { get; set; }
}

public class TelemetryContext
{
    public string Type { get; set; } = "general";
    public JsonElement? Data { get; set; }
}

public class ChatMessage
{
    public string Role { get; set; } = "";
    public string Content { get; set; } = "";
}

public class ChatResponse
{
    public string Message { get; set; } = "";
    public UsageInfo? Usage { get; set; }
}

public class UsageInfo
{
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
}
