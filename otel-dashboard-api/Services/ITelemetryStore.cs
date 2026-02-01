namespace OtelDashboardApi.Services;

using OtelDashboardApi.Models;

/// <summary>
/// Interface for telemetry data storage.
/// Implementations can be in-memory, DynamoDB, or other backends.
/// </summary>
public interface ITelemetryStore
{
    #region Log Operations
    
    /// <summary>
    /// Adds a log entry and returns the assigned ID.
    /// </summary>
    Task<long> AddLogAsync(LogEntry log, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets logs since a specific ID (for SSE streaming).
    /// </summary>
    Task<List<LogEntry>> GetLogsSinceAsync(long sinceId, int limit = 100, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Queries logs with optional filters.
    /// </summary>
    Task<List<LogEntry>> QueryLogsAsync(
        string? serviceName = null,
        LogLevel? level = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        string? traceId = null,
        int limit = 100,
        CancellationToken cancellationToken = default);
    
    #endregion

    #region Metric Operations
    
    /// <summary>
    /// Adds a metric entry and returns the assigned ID.
    /// </summary>
    Task<long> AddMetricAsync(MetricEntry metric, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Queries metrics with optional filters.
    /// </summary>
    Task<List<MetricEntry>> QueryMetricsAsync(
        string? name = null,
        string? serviceName = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        int limit = 100,
        CancellationToken cancellationToken = default);
    
    #endregion

    #region Trace Operations
    
    /// <summary>
    /// Adds a trace span.
    /// </summary>
    Task AddSpanAsync(TraceSpan span, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Gets all spans for a specific trace.
    /// </summary>
    Task<List<TraceSpan>?> GetTraceAsync(string traceId, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Queries traces with optional filters.
    /// </summary>
    Task<List<(string TraceId, TraceSpan RootSpan)>> QueryTracesAsync(
        string? serviceName = null,
        long? minDurationMs = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        int limit = 50,
        CancellationToken cancellationToken = default);
    
    #endregion

    #region Statistics
    
    /// <summary>
    /// Gets storage statistics.
    /// </summary>
    Task<(int LogCount, int MetricCount, int TraceCount)> GetStatsAsync(CancellationToken cancellationToken = default);
    
    #endregion

    #region JSON OTLP Import
    
    /// <summary>
    /// Adds traces from JSON OTLP format.
    /// </summary>
    Task AddTracesJsonAsync(string json, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Adds metrics from JSON OTLP format.
    /// </summary>
    Task AddMetricsJsonAsync(string json, CancellationToken cancellationToken = default);
    
    /// <summary>
    /// Adds logs from JSON OTLP format.
    /// </summary>
    Task AddLogsJsonAsync(string json, CancellationToken cancellationToken = default);
    
    #endregion
}
