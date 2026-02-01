import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogEntry, MetricEntry, TraceSpan, HealthStats } from '../models/otel.models';

@Injectable({
    providedIn: 'root'
})
export class ApiService {
    private readonly baseUrl = 'http://localhost:5003/api/v1';

    constructor(private http: HttpClient) { }

    // Logs
    getLogs(params?: {
        serviceName?: string;
        level?: string;
        startTime?: string;
        endTime?: string;
        traceId?: string;
        limit?: number;
    }): Observable<LogEntry[]> {
        return this.http.get<LogEntry[]>(`${this.baseUrl}/logs`, { params: params as any });
    }

    // Metrics
    getMetrics(params?: {
        name?: string;
        serviceName?: string;
        startTime?: string;
        endTime?: string;
        limit?: number;
    }): Observable<MetricEntry[]> {
        return this.http.get<MetricEntry[]>(`${this.baseUrl}/metrics`, { params: params as any });
    }

    // Traces
    getTraces(params?: {
        serviceName?: string;
        minDuration?: number;
        startTime?: string;
        endTime?: string;
        limit?: number;
    }): Observable<{ traceId: string; rootSpan: TraceSpan }[]> {
        return this.http.get<{ traceId: string; rootSpan: TraceSpan }[]>(`${this.baseUrl}/traces`, { params: params as any });
    }

    getTrace(traceId: string): Observable<{ traceId: string; spans: TraceSpan[]; spanCount: number }> {
        return this.http.get<{ traceId: string; spans: TraceSpan[]; spanCount: number }>(`${this.baseUrl}/traces/${traceId}`);
    }

    // Health
    getHealth(): Observable<HealthStats> {
        return this.http.get<HealthStats>(`${this.baseUrl}/health`);
    }
}
