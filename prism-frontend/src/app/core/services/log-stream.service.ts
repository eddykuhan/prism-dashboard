import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Observable, Subscription } from 'rxjs';
import { filter, bufferTime } from 'rxjs/operators';
import { WebSocketService } from './websocket.service';
import { LogEntry, WebSocketMessage } from '../models/prism.models';
import { RingBuffer } from '../utils/ring-buffer';

@Injectable({
    providedIn: 'root'
})
export class LogStreamService implements OnDestroy {
    private logBuffer = new RingBuffer<LogEntry>(10000);
    private logsSubject = new BehaviorSubject<LogEntry[]>([]);
    private newLogSubject = new Subject<LogEntry>();
    private subscription: Subscription;
    private batchSubscription: Subscription;
    private isStreaming = false;

    public logs$ = this.logsSubject.asObservable();
    public newLog$ = this.newLogSubject.asObservable();

    constructor(private wsService: WebSocketService) {
        // Batch incoming messages at 60fps (16ms) for smooth rendering
        this.batchSubscription = this.newLogSubject.pipe(
            bufferTime(16),
            filter(batch => batch.length > 0)
        ).subscribe(batch => {
            this.logBuffer.pushMany(batch);
            this.logsSubject.next(this.logBuffer.toArray());
        });

        // Subscribe to WebSocket messages
        this.subscription = this.wsService.messages$.pipe(
            filter((msg): msg is WebSocketMessage<LogEntry> => msg.channel === 'logs')
        ).subscribe(message => {
            this.newLogSubject.next(message.payload);
        });
        
        // Auto-start streaming
        this.startStreaming();
    }

    startStreaming(): void {
        if (this.isStreaming) return;

        this.isStreaming = true;
        this.wsService.connect();
        this.wsService.subscribe('logs');
    }

    stopStreaming(): void {
        this.isStreaming = false;
        this.wsService.unsubscribe('logs');
    }

    addHistory(logs: LogEntry[]): void {
        if (!logs || logs.length === 0) return;
        this.logBuffer.pushMany(logs);
        this.logsSubject.next(this.logBuffer.toArray());
    }

    getVisibleLogs(start: number, count: number): LogEntry[] {
        return this.logBuffer.getRange(start, count);
    }

    getTotalCount(): number {
        return this.logBuffer.size;
    }

    clearLogs(): void {
        this.logBuffer.clear();
        this.logsSubject.next([]);
    }

    ngOnDestroy(): void {
        this.subscription?.unsubscribe();
        this.batchSubscription?.unsubscribe();
        this.stopStreaming();
    }
}
