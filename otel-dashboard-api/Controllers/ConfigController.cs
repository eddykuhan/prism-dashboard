using Microsoft.AspNetCore.Mvc;

namespace OtelDashboardApi.Controllers;

/// <summary>
/// Provides runtime configuration to the Angular frontend.
/// Configuration is read from environment variables at startup.
/// </summary>
[ApiController]
[Route("api/v1/config")]
public class ConfigController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<ConfigController> _logger;

    public ConfigController(IConfiguration configuration, ILogger<ConfigController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Returns runtime configuration for the Angular SPA.
    /// This endpoint is called before Angular bootstrap to determine auth/copilot settings.
    /// </summary>
    [HttpGet]
    public IActionResult GetConfig()
    {
        var tenantId = _configuration["AZURE_AD_TENANT_ID"] ?? _configuration["AzureAd:TenantId"];
        var clientIdApi = _configuration["AZURE_AD_CLIENT_ID_API"] ?? _configuration["AzureAd:ClientId"];
        var clientIdSpa = _configuration["AZURE_AD_CLIENT_ID_SPA"] ?? _configuration["AzureAd:ClientIdSpa"];
        var openAiEnabled = (_configuration["AZURE_OPENAI_ENABLED"] ?? "false").Equals("true", StringComparison.OrdinalIgnoreCase);

        var authEnabled = !string.IsNullOrEmpty(tenantId) && 
                          !string.IsNullOrEmpty(clientIdApi) && 
                          !string.IsNullOrEmpty(clientIdSpa);

        // Copilot requires both auth and OpenAI to be enabled
        var copilotEnabled = authEnabled && openAiEnabled;

        _logger.LogInformation("Config requested. AuthEnabled: {AuthEnabled}, CopilotEnabled: {CopilotEnabled}", 
            authEnabled, copilotEnabled);

        var config = new
        {
            authEnabled,
            copilotEnabled,
            azureAd = authEnabled ? new
            {
                clientId = clientIdSpa,
                tenantId,
                authority = $"https://login.microsoftonline.com/{tenantId}",
                redirectUri = GetRedirectUri(),
                scopes = new[] { $"api://{clientIdApi}/access_as_user" }
            } : null
        };

        return Ok(config);
    }

    private string GetRedirectUri()
    {
        // In production, this should come from configuration
        // For now, use the request origin or a default
        var origin = $"{Request.Scheme}://{Request.Host}";
        return _configuration["AZURE_AD_REDIRECT_URI"] ?? origin;
    }
}
