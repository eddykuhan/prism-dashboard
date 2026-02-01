import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { filter, bufferTime } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';
import { TraceSpan, WebSocketMessage } from '../models/prism.models';
import { RingBuffer } from '../utils/ring-buffer';

@Injectable({
    providedIn: 'root'
})
export class TraceStreamService implements OnDestroy {
    private traceBuffer = new RingBuffer<TraceSpan>(5000);
    private tracesSubject = new BehaviorSubject<TraceSpan[]>([]);
    private newTraceSubject = new Subject<TraceSpan>();
    private subscription: Subscription;
    private batchSubscription: Subscription;
    private isStreaming = false;

    public traces$ = this.tracesSubject.asObservable();
    public newTrace$ = this.newTraceSubject.asObservable();

    constructor(private wsService: WebSocketService) {
        // Batch incoming messages at 60fps (16ms) for smooth rendering
        this.batchSubscription = this.newTraceSubject.pipe(
            bufferTime(16),
            filter(batch => batch.length > 0)
        ).subscribe(batch => {
            this.traceBuffer.pushMany(batch);
            this.tracesSubject.next(this.traceBuffer.toArray());
        });

        // Subscribe to WebSocket messages
        this.subscription = this.wsService.messages$.pipe(
            filter((msg): msg is WebSocketMessage<TraceSpan> => msg.channel === 'traces')
        ).subscribe(message => {
            this.newTraceSubject.next(message.payload);
        });
        
        // Auto-start streaming
        this.startStreaming();
    }

    startStreaming(): void {
        if (this.isStreaming) return;

        this.isStreaming = true;
        this.wsService.connect();
        this.wsService.subscribe('traces');
    }

    stopStreaming(): void {
        this.isStreaming = false;
        this.wsService.unsubscribe('traces');
    }

    addHistory(traces: TraceSpan[]): void {
        if (!traces || traces.length === 0) return;
        this.traceBuffer.pushMany(traces);
        this.tracesSubject.next(this.traceBuffer.toArray());
    }

    getVisibleTraces(start: number, count: number): TraceSpan[] {
        return this.traceBuffer.getRange(start, count);
    }

    getTotalCount(): number {
        return this.traceBuffer.size;
    }

    clearTraces(): void {
        this.traceBuffer.clear();
        this.tracesSubject.next([]);
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.batchSubscription?.unsubscribe();
        this.stopStreaming();
    }
}
