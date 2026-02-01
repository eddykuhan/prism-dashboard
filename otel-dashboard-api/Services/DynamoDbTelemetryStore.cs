using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.DataModel;
using Amazon.DynamoDBv2.DocumentModel;
using Amazon.DynamoDBv2.Model;
using OtelDashboardApi.Models;

namespace OtelDashboardApi.Services;

/// <summary>
/// DynamoDB-backed telemetry storage for persistent, scalable telemetry data.
/// Uses partition key (service name) + sort key (timestamp) for efficient time-range queries.
/// Supports automatic TTL for data expiration.
/// </summary>
public class DynamoDbTelemetryStore : ITelemetryStore
{
    private readonly IAmazonDynamoDB _dynamoDb;
    private readonly IDynamoDBContext _context;
    private readonly ILogger<DynamoDbTelemetryStore> _logger;
    private readonly string _logsTable;
    private readonly string _metricsTable;
    private readonly string _tracesTable;
    private readonly int _ttlDays;
    
    // Thread-safe counters for ID generation (local only, not globally unique)
    private long _logIdCounter = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    private long _metricIdCounter = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public DynamoDbTelemetryStore(
        IAmazonDynamoDB dynamoDb,
        IConfiguration configuration,
        ILogger<DynamoDbTelemetryStore> logger)
    {
        _dynamoDb = dynamoDb;
        _context = new DynamoDBContext(dynamoDb);
        _logger = logger;
        
        _logsTable = configuration["DYNAMODB_LOGS_TABLE"] ?? "prism-logs";
        _metricsTable = configuration["DYNAMODB_METRICS_TABLE"] ?? "prism-metrics";
        _tracesTable = configuration["DYNAMODB_TRACES_TABLE"] ?? "prism-traces";
        _ttlDays = int.TryParse(configuration["DYNAMODB_TTL_DAYS"], out var days) ? days : 30;
        
        _logger.LogInformation("DynamoDB store initialized. Tables: {Logs}, {Metrics}, {Traces}. TTL: {Days} days",
            _logsTable, _metricsTable, _tracesTable, _ttlDays);
    }

    #region Log Operations

    public async Task<long> AddLogAsync(LogEntry log, CancellationToken cancellationToken = default)
    {
        var id = Interlocked.Increment(ref _logIdCounter);
        var ttl = DateTimeOffset.UtcNow.AddDays(_ttlDays).ToUnixTimeSeconds();
        
        var item = new Dictionary<string, AttributeValue>
        {
            ["ServiceName"] = new AttributeValue { S = log.ServiceName },
            ["TimestampNs"] = new AttributeValue { N = log.Timestamp.Ticks.ToString() },
            ["Id"] = new AttributeValue { N = id.ToString() },
            ["TraceId"] = new AttributeValue { S = log.TraceId ?? "" },
            ["SpanId"] = new AttributeValue { S = log.SpanId ?? "" },
            ["Level"] = new AttributeValue { S = log.Level.ToString() },
            ["Message"] = new AttributeValue { S = log.Message },
            ["Attributes"] = new AttributeValue { S = JsonSerializer.Serialize(log.Attributes) },
            ["TTL"] = new AttributeValue { N = ttl.ToString() }
        };

        await _dynamoDb.PutItemAsync(new PutItemRequest
        {
            TableName = _logsTable,
            Item = item
        }, cancellationToken);

        return id;
    }

    public async Task<List<LogEntry>> GetLogsSinceAsync(long sinceId, int limit = 100, CancellationToken cancellationToken = default)
    {
        // For streaming, scan recent logs across all services
        var request = new ScanRequest
        {
            TableName = _logsTable,
            FilterExpression = "Id > :sinceId",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":sinceId"] = new AttributeValue { N = sinceId.ToString() }
            },
            Limit = limit
        };

        var response = await _dynamoDb.ScanAsync(request, cancellationToken);
        return response.Items.Select(ParseLogEntry).OrderBy(l => l.Id).Take(limit).ToList();
    }

    public async Task<List<LogEntry>> QueryLogsAsync(
        string? serviceName = null,
        SeverityLevel? level = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        string? traceId = null,
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        if (!string.IsNullOrEmpty(serviceName))
        {
            // Use Query with partition key for efficiency
            var keyCondition = "ServiceName = :svc";
            var expressionValues = new Dictionary<string, AttributeValue>
            {
                [":svc"] = new AttributeValue { S = serviceName }
            };

            if (startTime.HasValue && endTime.HasValue)
            {
                keyCondition += " AND TimestampNs BETWEEN :start AND :end";
                expressionValues[":start"] = new AttributeValue { N = startTime.Value.Ticks.ToString() };
                expressionValues[":end"] = new AttributeValue { N = endTime.Value.Ticks.ToString() };
            }

            var filterExpressions = new List<string>();
            if (level.HasValue)
            {
                filterExpressions.Add("#lvl = :level");
                expressionValues[":level"] = new AttributeValue { S = level.Value.ToString() };
            }
            if (!string.IsNullOrEmpty(traceId))
            {
                filterExpressions.Add("TraceId = :traceId");
                expressionValues[":traceId"] = new AttributeValue { S = traceId };
            }

            var request = new QueryRequest
            {
                TableName = _logsTable,
                KeyConditionExpression = keyCondition,
                ExpressionAttributeValues = expressionValues,
                ScanIndexForward = false, // Descending order
                Limit = limit
            };

            if (filterExpressions.Count > 0)
            {
                request.FilterExpression = string.Join(" AND ", filterExpressions);
                request.ExpressionAttributeNames = new Dictionary<string, string>
                {
                    ["#lvl"] = "Level"
                };
            }

            var response = await _dynamoDb.QueryAsync(request, cancellationToken);
            return response.Items.Select(ParseLogEntry).ToList();
        }
        else
        {
            // Scan (less efficient, but works for cross-service queries)
            var filterExpressions = new List<string>();
            var expressionValues = new Dictionary<string, AttributeValue>();

            if (level.HasValue)
            {
                filterExpressions.Add("#lvl = :level");
                expressionValues[":level"] = new AttributeValue { S = level.Value.ToString() };
            }
            if (startTime.HasValue)
            {
                filterExpressions.Add("TimestampNs >= :start");
                expressionValues[":start"] = new AttributeValue { N = startTime.Value.Ticks.ToString() };
            }
            if (endTime.HasValue)
            {
                filterExpressions.Add("TimestampNs <= :end");
                expressionValues[":end"] = new AttributeValue { N = endTime.Value.Ticks.ToString() };
            }
            if (!string.IsNullOrEmpty(traceId))
            {
                filterExpressions.Add("TraceId = :traceId");
                expressionValues[":traceId"] = new AttributeValue { S = traceId };
            }

            var request = new ScanRequest
            {
                TableName = _logsTable,
                Limit = limit
            };

            if (filterExpressions.Count > 0)
            {
                request.FilterExpression = string.Join(" AND ", filterExpressions);
                request.ExpressionAttributeValues = expressionValues;
                request.ExpressionAttributeNames = new Dictionary<string, string>
                {
                    ["#lvl"] = "Level"
                };
            }

            var response = await _dynamoDb.ScanAsync(request, cancellationToken);
            return response.Items.Select(ParseLogEntry).OrderByDescending(l => l.Timestamp).Take(limit).ToList();
        }
    }

    private LogEntry ParseLogEntry(Dictionary<string, AttributeValue> item)
    {
        return new LogEntry
        {
            Id = long.Parse(item.GetValueOrDefault("Id")?.N ?? "0"),
            ServiceName = item.GetValueOrDefault("ServiceName")?.S ?? "unknown",
            Timestamp = new DateTime(long.Parse(item.GetValueOrDefault("TimestampNs")?.N ?? "0")),
            TraceId = item.GetValueOrDefault("TraceId")?.S ?? "",
            SpanId = item.GetValueOrDefault("SpanId")?.S ?? "",
            Level = Enum.TryParse<SeverityLevel>(item.GetValueOrDefault("Level")?.S, out var lvl) ? lvl : SeverityLevel.Info,
            Message = item.GetValueOrDefault("Message")?.S ?? "",
            Attributes = JsonSerializer.Deserialize<Dictionary<string, object>>(
                item.GetValueOrDefault("Attributes")?.S ?? "{}") ?? new()
        };
    }

    #endregion

    #region Metric Operations

    public async Task<long> AddMetricAsync(MetricEntry metric, CancellationToken cancellationToken = default)
    {
        var id = Interlocked.Increment(ref _metricIdCounter);
        var ttl = DateTimeOffset.UtcNow.AddDays(_ttlDays).ToUnixTimeSeconds();
        
        var item = new Dictionary<string, AttributeValue>
        {
            ["ServiceName"] = new AttributeValue { S = metric.ServiceName },
            ["TimestampNs"] = new AttributeValue { N = metric.Timestamp.Ticks.ToString() },
            ["Id"] = new AttributeValue { N = id.ToString() },
            ["Name"] = new AttributeValue { S = metric.Name },
            ["Description"] = new AttributeValue { S = metric.Description ?? "" },
            ["Unit"] = new AttributeValue { S = metric.Unit ?? "" },
            ["Value"] = new AttributeValue { N = metric.Value.ToString() },
            ["Type"] = new AttributeValue { S = metric.Type.ToString() },
            ["Attributes"] = new AttributeValue { S = JsonSerializer.Serialize(metric.Attributes) },
            ["TTL"] = new AttributeValue { N = ttl.ToString() }
        };

        await _dynamoDb.PutItemAsync(new PutItemRequest
        {
            TableName = _metricsTable,
            Item = item
        }, cancellationToken);

        return id;
    }

    public async Task<List<MetricEntry>> QueryMetricsAsync(
        string? name = null,
        string? serviceName = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var filterExpressions = new List<string>();
        var expressionValues = new Dictionary<string, AttributeValue>();

        if (!string.IsNullOrEmpty(serviceName))
        {
            filterExpressions.Add("ServiceName = :svc");
            expressionValues[":svc"] = new AttributeValue { S = serviceName };
        }
        if (!string.IsNullOrEmpty(name))
        {
            filterExpressions.Add("#name = :name");
            expressionValues[":name"] = new AttributeValue { S = name };
        }
        if (startTime.HasValue)
        {
            filterExpressions.Add("TimestampNs >= :start");
            expressionValues[":start"] = new AttributeValue { N = startTime.Value.Ticks.ToString() };
        }
        if (endTime.HasValue)
        {
            filterExpressions.Add("TimestampNs <= :end");
            expressionValues[":end"] = new AttributeValue { N = endTime.Value.Ticks.ToString() };
        }

        var request = new ScanRequest
        {
            TableName = _metricsTable,
            Limit = limit
        };

        if (filterExpressions.Count > 0)
        {
            request.FilterExpression = string.Join(" AND ", filterExpressions);
            request.ExpressionAttributeValues = expressionValues;
            request.ExpressionAttributeNames = new Dictionary<string, string>
            {
                ["#name"] = "Name"
            };
        }

        var response = await _dynamoDb.ScanAsync(request, cancellationToken);
        return response.Items.Select(ParseMetricEntry).OrderByDescending(m => m.Timestamp).Take(limit).ToList();
    }

    private MetricEntry ParseMetricEntry(Dictionary<string, AttributeValue> item)
    {
        return new MetricEntry
        {
            Id = long.Parse(item.GetValueOrDefault("Id")?.N ?? "0"),
            ServiceName = item.GetValueOrDefault("ServiceName")?.S ?? "unknown",
            Timestamp = new DateTime(long.Parse(item.GetValueOrDefault("TimestampNs")?.N ?? "0")),
            Name = item.GetValueOrDefault("Name")?.S ?? "",
            Description = item.GetValueOrDefault("Description")?.S,
            Unit = item.GetValueOrDefault("Unit")?.S,
            Value = double.Parse(item.GetValueOrDefault("Value")?.N ?? "0"),
            Type = Enum.TryParse<MetricType>(item.GetValueOrDefault("Type")?.S, out var t) ? t : MetricType.Gauge,
            Attributes = JsonSerializer.Deserialize<Dictionary<string, string>>(
                item.GetValueOrDefault("Attributes")?.S ?? "{}") ?? new()
        };
    }

    #endregion

    #region Trace Operations

    public async Task AddSpanAsync(TraceSpan span, CancellationToken cancellationToken = default)
    {
        var ttl = DateTimeOffset.UtcNow.AddDays(_ttlDays).ToUnixTimeSeconds();
        
        var item = new Dictionary<string, AttributeValue>
        {
            ["TraceId"] = new AttributeValue { S = span.TraceId },
            ["SpanId"] = new AttributeValue { S = span.SpanId },
            ["ParentSpanId"] = new AttributeValue { S = span.ParentSpanId ?? "" },
            ["Name"] = new AttributeValue { S = span.Name },
            ["ServiceName"] = new AttributeValue { S = span.ServiceName },
            ["StartTimeNs"] = new AttributeValue { N = span.StartTime.Ticks.ToString() },
            ["EndTimeNs"] = new AttributeValue { N = span.EndTime.Ticks.ToString() },
            ["DurationMs"] = new AttributeValue { N = span.DurationMs.ToString() },
            ["StatusCode"] = new AttributeValue { N = span.StatusCode.ToString() },
            ["StatusMessage"] = new AttributeValue { S = span.StatusMessage ?? "" },
            ["Kind"] = new AttributeValue { N = span.Kind.ToString() },
            ["Attributes"] = new AttributeValue { S = JsonSerializer.Serialize(span.Attributes) },
            ["Events"] = new AttributeValue { S = JsonSerializer.Serialize(span.Events) },
            ["Links"] = new AttributeValue { S = JsonSerializer.Serialize(span.Links) },
            ["TTL"] = new AttributeValue { N = ttl.ToString() }
        };

        await _dynamoDb.PutItemAsync(new PutItemRequest
        {
            TableName = _tracesTable,
            Item = item
        }, cancellationToken);
    }

    public async Task<List<TraceSpan>?> GetTraceAsync(string traceId, CancellationToken cancellationToken = default)
    {
        var request = new QueryRequest
        {
            TableName = _tracesTable,
            KeyConditionExpression = "TraceId = :traceId",
            ExpressionAttributeValues = new Dictionary<string, AttributeValue>
            {
                [":traceId"] = new AttributeValue { S = traceId }
            }
        };

        var response = await _dynamoDb.QueryAsync(request, cancellationToken);
        
        if (response.Items.Count == 0)
            return null;
            
        return response.Items.Select(ParseTraceSpan).OrderBy(s => s.StartTime).ToList();
    }

    public async Task<List<(string TraceId, TraceSpan RootSpan)>> QueryTracesAsync(
        string? serviceName = null,
        long? minDurationMs = null,
        DateTime? startTime = null,
        DateTime? endTime = null,
        int limit = 50,
        CancellationToken cancellationToken = default)
    {
        var filterExpressions = new List<string>();
        var expressionValues = new Dictionary<string, AttributeValue>();

        // Filter for root spans (no parent)
        filterExpressions.Add("ParentSpanId = :empty");
        expressionValues[":empty"] = new AttributeValue { S = "" };

        if (!string.IsNullOrEmpty(serviceName))
        {
            filterExpressions.Add("ServiceName = :svc");
            expressionValues[":svc"] = new AttributeValue { S = serviceName };
        }
        if (minDurationMs.HasValue)
        {
            filterExpressions.Add("DurationMs >= :minDur");
            expressionValues[":minDur"] = new AttributeValue { N = minDurationMs.Value.ToString() };
        }
        if (startTime.HasValue)
        {
            filterExpressions.Add("StartTimeNs >= :start");
            expressionValues[":start"] = new AttributeValue { N = startTime.Value.Ticks.ToString() };
        }
        if (endTime.HasValue)
        {
            filterExpressions.Add("EndTimeNs <= :end");
            expressionValues[":end"] = new AttributeValue { N = endTime.Value.Ticks.ToString() };
        }

        var request = new ScanRequest
        {
            TableName = _tracesTable,
            FilterExpression = string.Join(" AND ", filterExpressions),
            ExpressionAttributeValues = expressionValues,
            Limit = limit * 2 // Get more to account for non-root spans
        };

        var response = await _dynamoDb.ScanAsync(request, cancellationToken);
        
        return response.Items
            .Select(ParseTraceSpan)
            .OrderByDescending(s => s.StartTime)
            .Take(limit)
            .Select(s => (s.TraceId, s))
            .ToList();
    }

    private TraceSpan ParseTraceSpan(Dictionary<string, AttributeValue> item)
    {
        return new TraceSpan
        {
            TraceId = item.GetValueOrDefault("TraceId")?.S ?? "",
            SpanId = item.GetValueOrDefault("SpanId")?.S ?? "",
            ParentSpanId = string.IsNullOrEmpty(item.GetValueOrDefault("ParentSpanId")?.S) 
                ? null : item.GetValueOrDefault("ParentSpanId")?.S,
            Name = item.GetValueOrDefault("Name")?.S ?? "",
            ServiceName = item.GetValueOrDefault("ServiceName")?.S ?? "unknown",
            StartTime = new DateTime(long.Parse(item.GetValueOrDefault("StartTimeNs")?.N ?? "0")),
            EndTime = new DateTime(long.Parse(item.GetValueOrDefault("EndTimeNs")?.N ?? "0")),
            DurationMs = double.Parse(item.GetValueOrDefault("DurationMs")?.N ?? "0"),
            StatusCode = int.Parse(item.GetValueOrDefault("StatusCode")?.N ?? "0"),
            StatusMessage = item.GetValueOrDefault("StatusMessage")?.S,
            Kind = int.Parse(item.GetValueOrDefault("Kind")?.N ?? "0"),
            Attributes = JsonSerializer.Deserialize<Dictionary<string, string>>(
                item.GetValueOrDefault("Attributes")?.S ?? "{}") ?? new(),
            Events = JsonSerializer.Deserialize<List<SpanEvent>>(
                item.GetValueOrDefault("Events")?.S ?? "[]") ?? new(),
            Links = JsonSerializer.Deserialize<List<SpanLink>>(
                item.GetValueOrDefault("Links")?.S ?? "[]") ?? new()
        };
    }

    #endregion

    #region Statistics

    public async Task<(int LogCount, int MetricCount, int TraceCount)> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        // Use DescribeTable for approximate counts (efficient)
        var logCount = await GetTableItemCountAsync(_logsTable, cancellationToken);
        var metricCount = await GetTableItemCountAsync(_metricsTable, cancellationToken);
        var traceCount = await GetTableItemCountAsync(_tracesTable, cancellationToken);
        
        return (logCount, metricCount, traceCount);
    }

    private async Task<int> GetTableItemCountAsync(string tableName, CancellationToken cancellationToken)
    {
        try
        {
            var response = await _dynamoDb.DescribeTableAsync(tableName, cancellationToken);
            return (int)(response.Table.ItemCount);
        }
        catch
        {
            return 0;
        }
    }

    #endregion

    #region JSON OTLP Import

    public async Task AddTracesJsonAsync(string json, CancellationToken cancellationToken = default)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            
            var resourceSpans = root.TryGetProperty("resourceSpans", out var rs) ? rs : root;
            
            foreach (var resourceSpan in resourceSpans.EnumerateArray())
            {
                var resource = GetPropertyOrDefault(resourceSpan, "resource");
                var scopeSpans = GetPropertyOrDefault(resourceSpan, "scopeSpans");
                var serviceName = GetAttributeValue(resource, "service.name") ?? "unknown";
                
                foreach (var scopeSpan in scopeSpans.EnumerateArray())
                {
                    var spans = GetPropertyOrDefault(scopeSpan, "spans");
                    
                    foreach (var span in spans.EnumerateArray())
                    {
                        var traceSpan = ParseOtlpSpan(span, serviceName);
                        if (traceSpan != null)
                        {
                            await AddSpanAsync(traceSpan, cancellationToken);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing OTLP traces JSON");
            throw;
        }
    }

    public async Task AddMetricsJsonAsync(string json, CancellationToken cancellationToken = default)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            
            var resourceMetrics = root.TryGetProperty("resourceMetrics", out var rm) ? rm : root;
            
            foreach (var resourceMetric in resourceMetrics.EnumerateArray())
            {
                var resource = GetPropertyOrDefault(resourceMetric, "resource");
                var scopeMetrics = GetPropertyOrDefault(resourceMetric, "scopeMetrics");
                var serviceName = GetAttributeValue(resource, "service.name") ?? "unknown";
                
                foreach (var scopeMetric in scopeMetrics.EnumerateArray())
                {
                    var metrics = GetPropertyOrDefault(scopeMetric, "metrics");
                    
                    foreach (var metric in metrics.EnumerateArray())
                    {
                        var metricEntry = ParseOtlpMetric(metric, serviceName);
                        if (metricEntry != null)
                        {
                            await AddMetricAsync(metricEntry, cancellationToken);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing OTLP metrics JSON");
            throw;
        }
    }

    public async Task AddLogsJsonAsync(string json, CancellationToken cancellationToken = default)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            
            var resourceLogs = root.TryGetProperty("resourceLogs", out var rl) ? rl : root;
            
            foreach (var resourceLog in resourceLogs.EnumerateArray())
            {
                var resource = GetPropertyOrDefault(resourceLog, "resource");
                var scopeLogs = GetPropertyOrDefault(resourceLog, "scopeLogs");
                var serviceName = GetAttributeValue(resource, "service.name") ?? "unknown";
                
                foreach (var scopeLog in scopeLogs.EnumerateArray())
                {
                    var logRecords = GetPropertyOrDefault(scopeLog, "logRecords");
                    
                    foreach (var logRecord in logRecords.EnumerateArray())
                    {
                        var logEntry = ParseOtlpLog(logRecord, serviceName);
                        if (logEntry != null)
                        {
                            await AddLogAsync(logEntry, cancellationToken);
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing OTLP logs JSON");
            throw;
        }
    }

    #region OTLP Parsing Helpers

    private JsonElement GetPropertyOrDefault(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop))
            return prop;
        return JsonDocument.Parse("[]").RootElement;
    }

    private string? GetAttributeValue(JsonElement resource, string key)
    {
        if (resource.TryGetProperty("attributes", out var attrs))
        {
            foreach (var attr in attrs.EnumerateArray())
            {
                if (attr.TryGetProperty("key", out var k) && k.GetString() == key)
                {
                    if (attr.TryGetProperty("value", out var v))
                    {
                        if (v.TryGetProperty("stringValue", out var sv))
                            return sv.GetString();
                    }
                }
            }
        }
        return null;
    }

    private TraceSpan? ParseOtlpSpan(JsonElement span, string serviceName)
    {
        try
        {
            var traceId = span.GetProperty("traceId").GetString() ?? "";
            var spanId = span.GetProperty("spanId").GetString() ?? "";
            var name = span.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            
            var startTimeNanos = span.TryGetProperty("startTimeUnixNano", out var st) 
                ? long.Parse(st.GetString() ?? "0") : 0;
            var endTimeNanos = span.TryGetProperty("endTimeUnixNano", out var et) 
                ? long.Parse(et.GetString() ?? "0") : 0;
            
            var startTime = DateTimeOffset.FromUnixTimeMilliseconds(startTimeNanos / 1_000_000).UtcDateTime;
            var endTime = DateTimeOffset.FromUnixTimeMilliseconds(endTimeNanos / 1_000_000).UtcDateTime;
            var durationMs = (endTimeNanos - startTimeNanos) / 1_000_000.0;

            string? parentSpanId = null;
            if (span.TryGetProperty("parentSpanId", out var ps))
            {
                var psVal = ps.GetString();
                if (!string.IsNullOrEmpty(psVal))
                    parentSpanId = psVal;
            }

            return new TraceSpan
            {
                TraceId = traceId,
                SpanId = spanId,
                ParentSpanId = parentSpanId,
                Name = name,
                ServiceName = serviceName,
                StartTime = startTime,
                EndTime = endTime,
                DurationMs = durationMs,
                StatusCode = span.TryGetProperty("status", out var status) && status.TryGetProperty("code", out var code) 
                    ? code.GetInt32() : 0,
                Kind = span.TryGetProperty("kind", out var kind) ? kind.GetInt32() : 0,
                Attributes = ParseAttributes(span)
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse OTLP span");
            return null;
        }
    }

    private MetricEntry? ParseOtlpMetric(JsonElement metric, string serviceName)
    {
        try
        {
            var name = metric.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
            var description = metric.TryGetProperty("description", out var d) ? d.GetString() : null;
            var unit = metric.TryGetProperty("unit", out var u) ? u.GetString() : null;
            
            double value = 0;
            DateTime timestamp = DateTime.UtcNow;
            MetricType type = MetricType.Gauge;

            // Handle different metric types
            if (metric.TryGetProperty("gauge", out var gauge))
            {
                type = MetricType.Gauge;
                (value, timestamp) = ExtractDataPoint(gauge);
            }
            else if (metric.TryGetProperty("sum", out var sum))
            {
                type = MetricType.Sum;
                (value, timestamp) = ExtractDataPoint(sum);
            }
            else if (metric.TryGetProperty("histogram", out var histogram))
            {
                type = MetricType.Histogram;
                (value, timestamp) = ExtractDataPoint(histogram);
            }

            return new MetricEntry
            {
                Name = name,
                Description = description,
                Unit = unit,
                Value = value,
                Type = type,
                Timestamp = timestamp,
                ServiceName = serviceName
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse OTLP metric");
            return null;
        }
    }

    private (double value, DateTime timestamp) ExtractDataPoint(JsonElement dataType)
    {
        if (dataType.TryGetProperty("dataPoints", out var dataPoints))
        {
            foreach (var dp in dataPoints.EnumerateArray())
            {
                double val = 0;
                if (dp.TryGetProperty("asDouble", out var dbl))
                    val = dbl.GetDouble();
                else if (dp.TryGetProperty("asInt", out var intVal))
                    val = intVal.GetInt64();

                var ts = DateTime.UtcNow;
                if (dp.TryGetProperty("timeUnixNano", out var timeNano))
                {
                    var nanos = long.Parse(timeNano.GetString() ?? "0");
                    ts = DateTimeOffset.FromUnixTimeMilliseconds(nanos / 1_000_000).UtcDateTime;
                }

                return (val, ts);
            }
        }
        return (0, DateTime.UtcNow);
    }

    private LogEntry? ParseOtlpLog(JsonElement logRecord, string serviceName)
    {
        try
        {
            var traceId = logRecord.TryGetProperty("traceId", out var ti) ? ti.GetString() ?? "" : "";
            var spanId = logRecord.TryGetProperty("spanId", out var si) ? si.GetString() ?? "" : "";
            
            var timeNanos = logRecord.TryGetProperty("timeUnixNano", out var t) 
                ? long.Parse(t.GetString() ?? "0") : 0;
            var timestamp = timeNanos > 0 
                ? DateTimeOffset.FromUnixTimeMilliseconds(timeNanos / 1_000_000).UtcDateTime 
                : DateTime.UtcNow;

            var severityNumber = logRecord.TryGetProperty("severityNumber", out var sn) ? sn.GetInt32() : 9;
            var level = severityNumber switch
            {
                <= 4 => SeverityLevel.Debug,
                <= 8 => SeverityLevel.Debug,
                <= 12 => SeverityLevel.Info,
                <= 16 => SeverityLevel.Warn,
                <= 20 => SeverityLevel.Error,
                _ => SeverityLevel.Fatal
            };

            var message = "";
            if (logRecord.TryGetProperty("body", out var body))
            {
                if (body.TryGetProperty("stringValue", out var sv))
                    message = sv.GetString() ?? "";
            }

            return new LogEntry
            {
                TraceId = traceId,
                SpanId = spanId,
                Timestamp = timestamp,
                Level = level,
                ServiceName = serviceName,
                Message = message,
                Attributes = ParseAttributesAsObjects(logRecord)
            };
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to parse OTLP log");
            return null;
        }
    }

    private Dictionary<string, string> ParseAttributes(JsonElement element)
    {
        var result = new Dictionary<string, string>();
        if (element.TryGetProperty("attributes", out var attrs))
        {
            foreach (var attr in attrs.EnumerateArray())
            {
                if (attr.TryGetProperty("key", out var k) && attr.TryGetProperty("value", out var v))
                {
                    var key = k.GetString() ?? "";
                    var value = v.TryGetProperty("stringValue", out var sv) ? sv.GetString() ?? "" : v.ToString();
                    result[key] = value;
                }
            }
        }
        return result;
    }

    private Dictionary<string, object> ParseAttributesAsObjects(JsonElement element)
    {
        var result = new Dictionary<string, object>();
        if (element.TryGetProperty("attributes", out var attrs))
        {
            foreach (var attr in attrs.EnumerateArray())
            {
                if (attr.TryGetProperty("key", out var k) && attr.TryGetProperty("value", out var v))
                {
                    var key = k.GetString() ?? "";
                    object value = v.TryGetProperty("stringValue", out var sv) ? sv.GetString() ?? "" : v.ToString();
                    result[key] = value;
                }
            }
        }
        return result;
    }

    #endregion

    #endregion
}
