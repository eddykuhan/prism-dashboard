import { Injectable, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable } from 'rxjs';
import { WebSocketMessage } from '../models/otel.models';

@Injectable({
    providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
    private socket: WebSocket | null = null;
    private messagesSubject = new Subject<WebSocketMessage<unknown>>();
    private connectionStatus = new BehaviorSubject<'disconnected' | 'connecting' | 'connected'>('disconnected');

    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private reconnectInterval = 3000;
    private subscriptions: Set<string> = new Set();

    private readonly wsUrl: string;

    public messages$ = this.messagesSubject.asObservable();
    public status$ = this.connectionStatus.asObservable();

    constructor() {
        this.wsUrl = 'ws://localhost:5003/ws/stream';
    }

    connect(): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return;
        }

        this.connectionStatus.next('connecting');

        try {
            this.socket = new WebSocket(this.wsUrl);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
                this.connectionStatus.next('connected');
                this.reconnectAttempts = 0;

                // Re-subscribe to previous channels
                this.subscriptions.forEach(channel => {
                    this.sendSubscription('subscribe', channel);
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data) as WebSocketMessage<unknown>;
                    if (message.type === 'data') {
                        this.messagesSubject.next(message);
                    }
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            this.socket.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                this.connectionStatus.next('disconnected');
                this.handleReconnect();
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (e) {
            console.error('Failed to create WebSocket:', e);
            this.handleReconnect();
        }
    }

    subscribe(channel: string): void {
        this.subscriptions.add(channel);
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.sendSubscription('subscribe', channel);
        }
    }

    unsubscribe(channel: string): void {
        this.subscriptions.delete(channel);
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.sendSubscription('unsubscribe', channel);
        }
    }

    private sendSubscription(type: 'subscribe' | 'unsubscribe', channel: string): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            // If we're not fully open yet, skip send; onopen will replay subscriptions.
            return;
        }

        const message = { type, channel };
        this.socket.send(JSON.stringify(message));
    }

    private handleReconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1));
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    disconnect(): void {
        this.socket?.close();
        this.socket = null;
    }

    ngOnDestroy(): void {
        this.disconnect();
        this.messagesSubject.complete();
        this.connectionStatus.complete();
    }
}
