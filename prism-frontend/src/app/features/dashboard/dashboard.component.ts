import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { LogStreamService } from '../../core/services/log-stream.service';
import { TraceStreamService } from '../../core/services/trace-stream.service';
import { MetricStreamService } from '../../core/services/metric-stream.service';
import { HealthStats } from '../../core/models/prism.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Top Navigation Bar -->
    <header class="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] flex items-center justify-between px-8 sticky top-0 z-10">
      <div class="flex items-center gap-4">
        <h2 class="text-lg font-semibold tracking-tight">Resources</h2>
      </div>
      <div class="flex items-center gap-4 flex-1 max-w-2xl justify-end">
        <div class="relative w-full max-w-md">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            class="w-full bg-slate-100 dark:bg-[#233648] border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary placeholder:text-slate-500 dark:placeholder-[#92adc9] text-slate-900 dark:text-slate-100"
            placeholder="Search resources..." type="text" />
        </div>
        <button class="p-2 text-slate-500 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] rounded-lg transition-colors">
          <span class="material-symbols-outlined">help</span>
        </button>
        <button class="p-2 text-slate-500 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] rounded-lg transition-colors">
          <span class="material-symbols-outlined">settings</span>
        </button>
      </div>
    </header>

    <!-- Content Container -->
    <div class="p-8 max-w-[1400px] w-full mx-auto space-y-6">
      <!-- Filters & Search Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="relative w-full sm:w-80">
          <div class="flex w-full items-stretch rounded-lg h-10 border border-slate-200 dark:border-[#324d67] bg-white dark:bg-[#111a22]">
            <div class="text-[#92adc9] flex items-center justify-center pl-3">
              <span class="material-symbols-outlined text-xl">filter_list</span>
            </div>
            <input
              class="w-full border-none bg-transparent focus:ring-0 text-sm placeholder:text-slate-400 dark:placeholder-[#92adc9] px-3 text-slate-900 dark:text-slate-100"
              placeholder="Filter resources..." value="" />
          </div>
        </div>
        <p class="text-slate-500 dark:text-[#92adc9] text-sm font-normal">Showing components</p>
      </div>

      <!-- Table Section -->
      <div class="bg-white dark:bg-[#111a22] rounded-xl border border-slate-200 dark:border-[#324d67] overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-[#192633] border-b border-slate-200 dark:border-[#324d67]">
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Type</th>
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Name</th>
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">State</th>
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Source</th>
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">Endpoints</th>
                <th class="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300 text-right">Logs</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 dark:divide-[#324d67]">
              <!-- Mock Row 1 -->
              <tr class="hover:bg-slate-50 dark:hover:bg-[#16232f] transition-colors">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-xl">layers</span>
                    <span class="text-sm">Project</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-sm font-medium">otel-dashboard-api</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Running
                  </span>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 dark:text-[#92adc9] font-mono">dotnet run</td>
                <td class="px-6 py-4 text-sm">
                  <a class="text-primary hover:underline font-medium" href="#">localhost:5003</a>
                </td>
                <td class="px-6 py-4 text-right">
                  <button class="text-slate-400 hover:text-primary transition-colors">
                    <span class="material-symbols-outlined">segment</span>
                  </button>
                </td>
              </tr>
              
              <!-- Mock Row 2 -->
              <tr class="hover:bg-slate-50 dark:hover:bg-[#16232f] transition-colors">
                <td class="px-6 py-4">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-xl">layers</span>
                    <span class="text-sm">Project</span>
                  </div>
                </td>
                <td class="px-6 py-4 text-sm font-medium">otel-dashboard-frontend</td>
                <td class="px-6 py-4">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Running
                  </span>
                </td>
                <td class="px-6 py-4 text-xs text-slate-500 dark:text-[#92adc9] font-mono">npm start</td>
                <td class="px-6 py-4 text-sm">
                  <a class="text-primary hover:underline font-medium" href="#">localhost:4200</a>
                </td>
                <td class="px-6 py-4 text-right">
                  <button class="text-slate-400 hover:text-primary transition-colors">
                    <span class="material-symbols-outlined">segment</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail Cards (mapped to stats) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-[#111a22] border border-slate-200 dark:border-[#324d67] p-5 rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500 dark:text-[#92adc9] font-medium uppercase">Total Logs</span>
            <span class="material-symbols-outlined text-primary">segment</span>
          </div>
          <div class="text-2xl font-bold">{{ logCount || stats?.stats?.logs || 0 }}</div>
           <div class="mt-2 text-xs flex items-center gap-1" [ngClass]="connectionStatus === 'connected' ? 'text-emerald-500' : 'text-slate-400'">
             <span class="material-symbols-outlined text-sm">{{ connectionStatus === 'connected' ? 'wifi' : 'wifi_off' }}</span>
             <span>{{ connectionStatus === 'connected' ? 'Live Streaming' : 'Connecting...' }}</span>
           </div>
        </div>
        <div class="bg-white dark:bg-[#111a22] border border-slate-200 dark:border-[#324d67] p-5 rounded-xl">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-slate-500 dark:text-[#92adc9] font-medium uppercase">Active Traces</span>
            <span class="material-symbols-outlined text-orange-400">account_tree</span>
          </div>
          <div class="text-2xl font-bold">{{ traceCount || stats?.stats?.traces || 0 }}</div>
          <div class="mt-2 text-xs flex items-center gap-1" [ngClass]="connectionStatus === 'connected' ? 'text-emerald-500' : 'text-slate-400'">
            <span class="material-symbols-outlined text-sm">{{ connectionStatus === 'connected' ? 'wifi' : 'wifi_off' }}</span>
            <span>{{ connectionStatus === 'connected' ? 'Live Streaming' : 'Connecting...' }}</span>
          </div>
        </div>
        <div class="bg-white dark:bg-[#111a22] border border-slate-200 dark:border-[#324d67] p-5 rounded-xl">
          <div class="flex items-center justify-between mb-2">
             <span class="text-xs text-slate-500 dark:text-[#92adc9] font-medium uppercase">Metrics Count</span>
             <span class="material-symbols-outlined text-indigo-400">monitoring</span>
          </div>
          <div class="text-2xl font-bold">{{ metricCount || stats?.stats?.metrics || 0 }}</div>
          <div class="mt-2 text-xs flex items-center gap-1" [ngClass]="connectionStatus === 'connected' ? 'text-emerald-500' : 'text-slate-400'">
            <span class="material-symbols-outlined text-sm">{{ connectionStatus === 'connected' ? 'wifi' : 'wifi_off' }}</span>
            <span>{{ connectionStatus === 'connected' ? 'Live Streaming' : 'Connecting...' }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `]
})
export class DashboardComponent implements OnInit, OnDestroy {
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
    private metricStreamService: MetricStreamService
  ) { }

  ngOnInit(): void {
    // Subscribe to connection status
    this.subscriptions.push(
      this.wsService.status$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
    
    // Subscribe to real-time updates and increment counts
    this.subscriptions.push(
      this.logStreamService.newLog$.subscribe(() => {
        this.logCount++;
      })
    );
    
    this.subscriptions.push(
      this.traceStreamService.newTrace$.subscribe(() => {
        this.traceCount++;
      })
    );
    
    this.subscriptions.push(
      this.metricStreamService.newMetric$.subscribe(() => {
        this.metricCount++;
      })
    );
    
    // Load initial stats from API
    this.loadStats();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private loadStats(): void {
    this.apiService.getHealth().subscribe({
      next: (stats) => {
        this.stats = stats;
        // Initialize counts with backend values
        if (stats.stats) {
          this.logCount = stats.stats.logs;
          this.traceCount = stats.stats.traces;
          this.metricCount = stats.stats.metrics;
        }
      },
      error: (err) => console.error('Failed to load health stats:', err)
    });
  }
}
