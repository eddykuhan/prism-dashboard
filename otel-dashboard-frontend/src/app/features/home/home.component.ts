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
      <div class="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <!-- Header -->
        <header class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold">Dashboard</h1>
            <p class="text-sm text-slate-500 dark:text-slate-400">Real-time telemetry overview</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                  [ngClass]="connectionStatus === 'connected' 
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'">
              <span class="size-2 rounded-full" [ngClass]="connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"></span>
              {{ connectionStatus === 'connected' ? 'Live' : 'Connecting' }}
            </span>
            <a routerLink="/guide" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              <span class="material-symbols-outlined text-sm">menu_book</span>
              Setup Guide
            </a>
          </div>
        </header>

        <!-- Main Stats -->
        <section class="grid gap-4 lg:grid-cols-3">
          <a routerLink="/logs" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 hover:border-blue-400 dark:hover:border-blue-600 transition-all group">
            <div class="flex items-center justify-between">
              <div class="size-10 rounded-lg bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">segment</span>
              </div>
              <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors">arrow_forward</span>
            </div>
            <p class="text-4xl font-bold mt-4 tabular-nums">{{ displayCount(logCount, stats?.stats?.logs) | number }}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Log Records</p>
            <!-- Mini bar chart -->
            <div class="flex items-end gap-1 h-8 mt-4">
              @for (bar of logBars; track $index) {
                <div class="flex-1 rounded-sm bg-blue-200 dark:bg-blue-500/20 transition-all" [style.height.%]="bar"></div>
              }
            </div>
          </a>

          <a routerLink="/traces" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 hover:border-orange-400 dark:hover:border-orange-600 transition-all group">
            <div class="flex items-center justify-between">
              <div class="size-10 rounded-lg bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-orange-600 dark:text-orange-400">account_tree</span>
              </div>
              <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-orange-500 transition-colors">arrow_forward</span>
            </div>
            <p class="text-4xl font-bold mt-4 tabular-nums">{{ displayCount(traceCount, stats?.stats?.traces) | number }}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Trace Spans</p>
            <!-- Mini bar chart -->
            <div class="flex items-end gap-1 h-8 mt-4">
              @for (bar of traceBars; track $index) {
                <div class="flex-1 rounded-sm bg-orange-200 dark:bg-orange-500/20 transition-all" [style.height.%]="bar"></div>
              }
            </div>
          </a>

          <a routerLink="/metrics" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all group">
            <div class="flex items-center justify-between">
              <div class="size-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                <span class="material-symbols-outlined text-indigo-600 dark:text-indigo-400">monitoring</span>
              </div>
              <span class="material-symbols-outlined text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition-colors">arrow_forward</span>
            </div>
            <p class="text-4xl font-bold mt-4 tabular-nums">{{ displayCount(metricCount, stats?.stats?.metrics) | number }}</p>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Metric Samples</p>
            <!-- Mini bar chart -->
            <div class="flex items-end gap-1 h-8 mt-4">
              @for (bar of metricBars; track $index) {
                <div class="flex-1 rounded-sm bg-indigo-200 dark:bg-indigo-500/20 transition-all" [style.height.%]="bar"></div>
              }
            </div>
          </a>
        </section>

        <!-- Activity Line Chart -->
        <section class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="font-semibold">Ingestion Activity</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Real-time throughput</p>
            </div>
            <div class="flex items-center gap-4 text-xs">
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-blue-500"></span> Logs</span>
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-orange-500"></span> Traces</span>
              <span class="flex items-center gap-1.5"><span class="size-2 rounded-full bg-indigo-500"></span> Metrics</span>
            </div>
          </div>
          <svg class="w-full h-40 mb-2" viewBox="0 0 500 120" preserveAspectRatio="none" style="display: block;">
            <!-- Grid lines -->
            <line x1="0" y1="30" x2="500" y2="30" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
            <line x1="0" y1="60" x2="500" y2="60" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
            <line x1="0" y1="90" x2="500" y2="90" stroke="currentColor" stroke-width="0.5" opacity="0.1"/>
            
            <!-- Metrics line -->
            <polyline [attr.points]="metricsPath" 
                      fill="none" 
                      stroke="#818cf8" 
                      stroke-width="2" 
                      vector-effect="non-scaling-stroke"
                      style="transition: d 0.3s ease;"/>
            
            <!-- Traces line -->
            <polyline [attr.points]="tracesPath" 
                      fill="none" 
                      stroke="#f97316" 
                      stroke-width="2" 
                      vector-effect="non-scaling-stroke"
                      style="transition: d 0.3s ease;"/>
            
            <!-- Logs line -->
            <polyline [attr.points]="logsPath" 
                      fill="none" 
                      stroke="#3b82f6" 
                      stroke-width="2" 
                      vector-effect="non-scaling-stroke"
                      style="transition: d 0.3s ease;"/>
          </svg>
          <div class="flex justify-between text-[10px] text-slate-400">
            <span>60s ago</span>
            <span>Now</span>
          </div>
        </section>

        <!-- Bottom Row -->
        <section class="grid gap-4 lg:grid-cols-2">
          <!-- Throughput -->
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5">
            <h2 class="font-semibold mb-4">Throughput</h2>
            <div class="space-y-4">
              <div>
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="text-slate-500 dark:text-slate-400">Logs/sec</span>
                  <span class="font-semibold tabular-nums">{{ logsPerSec | number:'1.1-1' }}</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full rounded-full bg-blue-500 transition-all duration-500" [style.width.%]="Math.min(logsPerSec * 10, 100)"></div>
                </div>
              </div>
              <div>
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="text-slate-500 dark:text-slate-400">Traces/sec</span>
                  <span class="font-semibold tabular-nums">{{ tracesPerSec | number:'1.1-1' }}</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full rounded-full bg-orange-500 transition-all duration-500" [style.width.%]="Math.min(tracesPerSec * 10, 100)"></div>
                </div>
              </div>
              <div>
                <div class="flex items-center justify-between text-sm mb-1">
                  <span class="text-slate-500 dark:text-slate-400">Metrics/sec</span>
                  <span class="font-semibold tabular-nums">{{ metricsPerSec | number:'1.1-1' }}</span>
                </div>
                <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full rounded-full bg-indigo-500 transition-all duration-500" [style.width.%]="Math.min(metricsPerSec * 10, 100)"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Endpoints -->
          <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f1629] p-5">
            <h2 class="font-semibold mb-4">Endpoints</h2>
            <div class="space-y-3">
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <div>
                    <p class="text-sm font-medium">OTLP gRPC</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Receiving telemetry</p>
                  </div>
                </div>
                <code class="text-xs font-mono text-slate-600 dark:text-slate-300">:4317</code>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
                  <div>
                    <p class="text-sm font-medium">REST API</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Query interface</p>
                  </div>
                </div>
                <code class="text-xs font-mono text-slate-600 dark:text-slate-300">:5003</code>
              </div>
              <div class="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-lg" [ngClass]="connectionStatus === 'connected' ? 'text-emerald-500' : 'text-amber-500'">
                    {{ connectionStatus === 'connected' ? 'check_circle' : 'pending' }}
                  </span>
                  <div>
                    <p class="text-sm font-medium">WebSocket</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400">Live streaming</p>
                  </div>
                </div>
                <code class="text-xs font-mono text-slate-600 dark:text-slate-300">/ws</code>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: []
})
export class HomeComponent implements OnInit, OnDestroy {
  Math = Math;
  stats: HealthStats | null = null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  logCount = 0;
  traceCount = 0;
  metricCount = 0;
  
  // For mini bar charts
  logBars: number[] = [];
  traceBars: number[] = [];
  metricBars: number[] = [];
  
  // Activity chart data (60 ticks for 60 seconds)
  activityData: { logs: number; traces: number; metrics: number }[] = [];
  
  // SVG path strings for line chart
  logsPath = '';
  tracesPath = '';
  metricsPath = '';
  
  // Throughput
  logsPerSec = 0;
  tracesPerSec = 0;
  metricsPerSec = 0;
  
  private subscriptions: Subscription[] = [];
  private activityInterval: any;
  private prevLogCount = 0;
  private prevTraceCount = 0;
  private prevMetricCount = 0;

  constructor(
    private apiService: ApiService,
    private wsService: WebSocketService,
    private logStreamService: LogStreamService,
    private traceStreamService: TraceStreamService,
    private metricStreamService: MetricStreamService,
    public authService: AuthService
  ) {
    // Initialize charts with random-ish data for visual appeal
    this.logBars = Array.from({ length: 12 }, () => Math.random() * 60 + 20);
    this.traceBars = Array.from({ length: 12 }, () => Math.random() * 60 + 20);
    this.metricBars = Array.from({ length: 12 }, () => Math.random() * 60 + 20);
    this.activityData = Array.from({ length: 60 }, () => ({
      logs: Math.random() * 15,
      traces: Math.random() * 10,
      metrics: Math.random() * 12
    }));
    this.updateChartPaths();
  }

  ngOnInit(): void {
    this.subscriptions.push(
      this.wsService.status$.subscribe((status) => this.connectionStatus = status)
    );

    this.subscriptions.push(this.logStreamService.newLog$.subscribe(() => {
      this.logCount++;
      this.updateBars('logs');
    }));
    this.subscriptions.push(this.traceStreamService.newTrace$.subscribe(() => {
      this.traceCount++;
      this.updateBars('traces');
    }));
    this.subscriptions.push(this.metricStreamService.newMetric$.subscribe(() => {
      this.metricCount++;
      this.updateBars('metrics');
    }));

    this.loadStats();
    
    // Update activity chart and throughput every second
    this.activityInterval = setInterval(() => {
      this.updateActivityChart();
      this.updateThroughput();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((s) => s.unsubscribe());
    if (this.activityInterval) {
      clearInterval(this.activityInterval);
    }
  }

  private loadStats(): void {
    this.apiService.getHealth().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.logCount = stats.stats.logs;
        this.traceCount = stats.stats.traces;
        this.metricCount = stats.stats.metrics;
        this.prevLogCount = this.logCount;
        this.prevTraceCount = this.traceCount;
        this.prevMetricCount = this.metricCount;
      },
      error: () => {
        // Keep defaults on failure
      }
    });
  }
  
  private updateBars(type: 'logs' | 'traces' | 'metrics'): void {
    const bars = type === 'logs' ? this.logBars : type === 'traces' ? this.traceBars : this.metricBars;
    bars.shift();
    bars.push(Math.random() * 40 + 60); // Higher value for new data
  }
  
  private updateActivityChart(): void {
    const logsNew = Math.max(0, this.logCount - this.prevLogCount);
    const tracesNew = Math.max(0, this.traceCount - this.prevTraceCount);
    const metricsNew = Math.max(0, this.metricCount - this.prevMetricCount);
    
    this.activityData.shift();
    this.activityData.push({
      logs: Math.min(logsNew * 8, 40),
      traces: Math.min(tracesNew * 8, 30),
      metrics: Math.min(metricsNew * 8, 35)
    });
    
    this.updateChartPaths();
    
    this.prevLogCount = this.logCount;
    this.prevTraceCount = this.traceCount;
    this.prevMetricCount = this.metricCount;
  }
  
  private updateChartPaths(): void {
    // SVG dimensions: viewBox="0 0 500 120"
    const width = 500;
    const height = 120;
    const maxValue = 50; // Max scale
    
    // Generate paths for each line
    this.logsPath = this.generatePath(this.activityData.map(d => d.logs), width, height, maxValue);
    this.tracesPath = this.generatePath(this.activityData.map(d => d.traces), width, height, maxValue);
    this.metricsPath = this.generatePath(this.activityData.map(d => d.metrics), width, height, maxValue);
  }
  
  private generatePath(values: number[], width: number, height: number, maxValue: number): string {
    const step = width / (values.length - 1 || 1);
    const points = values.map((val, idx) => {
      const x = idx * step;
      const y = height - (val / maxValue) * height * 0.9 - 10; // 10px padding at bottom
      return `${x},${y}`;
    });
    return points.join(' ');
  }
  
  private updateThroughput(): void {
    // Simple moving average approximation from last 5 seconds
    const recentLogs = this.activityData.slice(-5).reduce((sum, d) => sum + d.logs, 0) / 5 / 8;
    const recentTraces = this.activityData.slice(-5).reduce((sum, d) => sum + d.traces, 0) / 5 / 8;
    const recentMetrics = this.activityData.slice(-5).reduce((sum, d) => sum + d.metrics, 0) / 5 / 8;
    
    this.logsPerSec = Math.max(0, recentLogs);
    this.tracesPerSec = Math.max(0, recentTraces);
    this.metricsPerSec = Math.max(0, recentMetrics);
  }

  displayCount(localCount: number, apiCount?: number): number {
    if (localCount > 0) return localCount;
    return apiCount ?? 0;
  }
}
