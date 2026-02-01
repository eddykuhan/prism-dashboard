import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { filter, bufferTime } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';
import { MetricEntry, WebSocketMessage } from '../models/prism.models';
import { RingBuffer } from '../utils/ring-buffer';

@Injectable({
    providedIn: 'root'
})
export class MetricStreamService implements OnDestroy {
    private metricBuffer = new RingBuffer<MetricEntry>(10000);
    private metricsSubject = new BehaviorSubject<MetricEntry[]>([]);
    private newMetricSubject = new Subject<MetricEntry>();
    private subscription: Subscription;
    private batchSubscription: Subscription;
    private isStreaming = false;

    public metrics$ = this.metricsSubject.asObservable();
    public newMetric$ = this.newMetricSubject.asObservable();

    constructor(private wsService: WebSocketService) {
        // Batch incoming messages at 60fps (16ms) for smooth rendering
        this.batchSubscription = this.newMetricSubject.pipe(
            bufferTime(16),
            filter(batch => batch.length > 0)
        ).subscribe(batch => {
            this.metricBuffer.pushMany(batch);
            this.metricsSubject.next(this.metricBuffer.toArray());
        });

        // Subscribe to WebSocket messages
        this.subscription = this.wsService.messages$.pipe(
            filter((msg): msg is WebSocketMessage<MetricEntry> => msg.channel === 'metrics')
        ).subscribe(message => {
            this.newMetricSubject.next(message.payload);
        });
        
        // Auto-start streaming
        this.startStreaming();
    }

    startStreaming(): void {
        if (this.isStreaming) return;

        this.isStreaming = true;
        this.wsService.connect();
        this.wsService.subscribe('metrics');
    }

    stopStreaming(): void {
        this.isStreaming = false;
        this.wsService.unsubscribe('metrics');
    }

    addHistory(metrics: MetricEntry[]): void {
        if (!metrics || metrics.length === 0) return;
        this.metricBuffer.pushMany(metrics);
        this.metricsSubject.next(this.metricBuffer.toArray());
    }

    getVisibleMetrics(start: number, count: number): MetricEntry[] {
        return this.metricBuffer.getRange(start, count);
    }

    getTotalCount(): number {
        return this.metricBuffer.size;
    }

    clearMetrics(): void {
        this.metricBuffer.clear();
        this.metricsSubject.next([]);
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.batchSubscription?.unsubscribe();
        this.stopStreaming();
    }
}
