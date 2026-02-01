import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { LogStreamService } from '../../core/services/log-stream.service';
import { TraceStreamService } from '../../core/services/trace-stream.service';
import { MetricStreamService } from '../../core/services/metric-stream.service';
import { AuthService } from '../../core/services/auth.service';
import { HealthStats } from '../../core/models/otel.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100">
      <div class="mx-auto max-w-6xl px-6 py-10 space-y-8">
        <!-- Hero -->
        <section class="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-8 shadow-xl">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div class="space-y-3">
              <p class="text-xs uppercase tracking-[0.2em] text-blue-100">Prism OTEL</p>
              <h1 class="text-3xl lg:text-4xl font-bold leading-tight">Unified telemetry for logs, traces, and metrics</h1>
              <p class="text-sm text-blue-100/90 max-w-2xl">
                Stream observability data into Prism, inspect issues faster, and keep a live pulse on system health. Auth and Copilot remain optional and follow runtime flags.
              </p>
              <div class="flex flex-wrap gap-3">
                <a routerLink="/metrics" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-blue-700 font-semibold shadow-sm hover:shadow transition">
                  <span class="material-symbols-outlined text-base">monitoring</span>
                  View Metrics
                </a>
                <a routerLink="/logs" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 text-white border border-white/30 font-semibold hover:bg-white/10 transition">
                  <span class="material-symbols-outlined text-base">list_alt</span>
                  View Logs
                </a>
                <a routerLink="/guide" class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white border border-white/20 font-semibold hover:bg-white/20 transition">
                  <span class="material-symbols-outlined text-base">menu_book</span>
                  Setup Guide
                </a>
              </div>
            </div>
            <div class="bg-white/10 rounded-xl p-4 border border-white/20 w-full max-w-xs">
              <div class="flex items-center justify-between text-sm mb-2">
                <span class="text-blue-100/90">Live connection</span>
                <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                      [ngClass]="connectionStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-700'">
                  <span class="material-symbols-outlined text-sm">{{ connectionStatus === 'connected' ? 'wifi' : 'wifi_off' }}</span>
                  {{ connectionStatus === 'connected' ? 'Connected' : 'Connecting' }}
                </span>
              </div>
              <div class="space-y-3 text-sm text-blue-50">
                <div class="flex items-center justify-between"><span>Logs</span><span class="font-semibold">{{ displayCount(logCount, stats?.stats?.logs) }}</span></div>
                <div class="flex items-center justify-between"><span>Traces</span><span class="font-semibold">{{ displayCount(traceCount, stats?.stats?.traces) }}</span></div>
                <div class="flex items-center justify-between"><span>Metrics</span><span class="font-semibold">{{ displayCount(metricCount, stats?.stats?.metrics) }}</span></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Live stats -->
        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-4">
            <div class="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Total logs</span>
              <span class="material-symbols-outlined text-blue-500">segment</span>
            </div>
            <p class="text-3xl font-bold mt-2">{{ displayCount(logCount, stats?.stats?.logs) }}</p>
            <p class="text-xs mt-1 text-slate-500 dark:text-slate-400">Updates live from the log stream</p>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-4">
            <div class="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Active traces</span>
              <span class="material-symbols-outlined text-orange-500">account_tree</span>
            </div>
            <p class="text-3xl font-bold mt-2">{{ displayCount(traceCount, stats?.stats?.traces) }}</p>
            <p class="text-xs mt-1 text-slate-500 dark:text-slate-400">New traces increment in real time</p>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-4">
            <div class="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Metrics samples</span>
              <span class="material-symbols-outlined text-indigo-500">monitoring</span>
            </div>
            <p class="text-3xl font-bold mt-2">{{ displayCount(metricCount, stats?.stats?.metrics) }}</p>
            <p class="text-xs mt-1 text-slate-500 dark:text-slate-400">Counts reflect received OTLP data</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: []
})
export class HomeComponent implements OnInit, OnDestroy {
  stats: HealthStats | null = null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  logCount = 0;
  traceCount = 0;
  metricCount = 0;
  private subscriptions: Subscription[] = [];

  constructor(
    private apiService: ApiService,
    private wsService: WebSocketService,
    private logStreamService: LogStreamService,
    private traceStreamService: TraceStreamService,
    private metricStreamService: MetricStreamService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.wsService.status$.subscribe((status) => this.connectionStatus = status)
    );

    this.subscriptions.push(this.logStreamService.newLog$.subscribe(() => this.logCount++));
    this.subscriptions.push(this.traceStreamService.newTrace$.subscribe(() => this.traceCount++));
    this.subscriptions.push(this.metricStreamService.newMetric$.subscribe(() => this.metricCount++));

    this.loadStats();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
  }

  private loadStats(): void {
    this.apiService.getHealth().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.logCount = stats.stats.logs;
        this.traceCount = stats.stats.traces;
        this.metricCount = stats.stats.metrics;
      },
      error: () => {
        // Keep defaults on failure
      }
    });
  }

  displayCount(localCount: number, apiCount?: number): number {
    if (localCount > 0) return localCount;
    return apiCount ?? 0;
  }
}
