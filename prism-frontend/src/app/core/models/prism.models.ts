export interface LogEntry {
    id: number;
    traceId: string;
    spanId: string;
    timestamp: string;
    level: LogLevel;
    serviceName: string;
    message: string;
    attributes: Record<string, unknown>;
    resource?: ResourceInfo;
}

export enum LogLevel {
    Debug = 'Debug',
    Info = 'Info',
    Warn = 'Warn',
    Error = 'Error',
    Fatal = 'Fatal'
}

export interface MetricEntry {
    id: number;
    name: string;
    description?: string;
    unit?: string;
    value: number;
    type: MetricType;
    timestamp: string;
    serviceName: string;
    attributes: Record<string, string>;
}

export enum MetricType {
    Counter = 'Counter',
    Gauge = 'Gauge',
    Histogram = 'Histogram',
    Sum = 'Sum'
}

export interface TraceSpan {
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    operationName: string;
    startTime: string;
    endTime: string;
    durationMs: number;
    status: SpanStatus;
    kind: SpanKind;
    serviceName: string;
    attributes: Record<string, unknown>;
    events: SpanEvent[];
}

export enum SpanStatus {
    Ok = 'Ok',
    Error = 'Error',
    Unset = 'Unset'
}

export enum SpanKind {
    Server = 'Server',
    Client = 'Client',
    Producer = 'Producer',
    Consumer = 'Consumer',
    Internal = 'Internal'
}

export interface SpanEvent {
    name: string;
    timestamp: string;
    attributes: Record<string, unknown>;
}

export interface ResourceInfo {
    serviceName: string;
    serviceVersion?: string;
    deploymentEnvironment?: string;
}

export interface WebSocketMessage<T> {
    type: string;
    channel: string;
    payload: T;
    timestamp: string;
}

export interface HealthStats {
    status: string;
    timestamp: string;
    stats: {
        logs: number;
        metrics: number;
        traces: number;
    };
    websocket: {
        connections: number;
        subscriptions: Record<string, number>;
    };
}
