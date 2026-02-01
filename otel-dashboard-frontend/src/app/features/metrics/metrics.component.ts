import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { MetricStreamService } from '../../core/services/metric-stream.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { MetricEntry, MetricType } from '../../core/models/otel.models';
import { NgxEchartsModule } from 'ngx-echarts';
import { EChartsOption, SeriesOption } from 'echarts';
import { Subscription } from 'rxjs';

interface EndpointData {
  endpoint: string;
  requests: number;
  avgLatency: number;
  errorRate: number;
}

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule, FormsModule],
  template: `
    <div class="flex h-full overflow-hidden bg-slate-50 dark:bg-[#0b1016]">
     
      <aside class="w-72 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] hidden lg:flex flex-col p-4 shrink-0 overflow-y-auto">
        <div class="mb-6">
           <h2 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Instruments</h2>
           <div class="space-y-1">
             @for (name of instrumentNames; track name) {
               <button 
                 (click)="selectInstrument(name)"
                 class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all text-left group"
                 [ngClass]="{
                    'bg-primary-50 dark:bg-primary/10 text-primary': selectedMetricName === name,
                    'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800': selectedMetricName !== name
                 }">
                 <span class="truncate" [title]="name">{{ name }}</span>
                 <span *ngIf="selectedMetricName === name" class="material-symbols-outlined text-sm">check_circle</span>
               </button>
             }
           </div>
        </div>
        <div class="bg-white dark:bg-[#101922] border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Attributes</h3>
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase">Status Code</label>
              <select [(ngModel)]="selectedStatusCode" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded py-1.5 px-2 text-xs focus:ring-1 focus:ring-primary mt-1">
                <option value="">All (2xx, 4xx, 5xx)</option>
                <option value="2xx">Success (2xx)</option>
                <option value="5xx">Error (5xx)</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-bold text-slate-400 uppercase">Host</label>
              <select [(ngModel)]="selectedHost" class="w-full bg-slate-50 dark:bg-slate-800 border-none rounded py-1.5 px-2 text-xs focus:ring-1 focus:ring-primary mt-1">
                <option value="">All Instances</option>
                <option *ngFor="let host of hosts" [value]="host">{{ host }}</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto custom-scrollbar">
        <!-- Page Header -->
        <header class="flex flex-wrap items-center justify-between gap-4 p-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922]/50 sticky top-0 z-10 backdrop-blur">
          <div class="min-w-72">
            <div class="flex items-center gap-2 mb-1">
              <h1 class="text-slate-900 dark:text-white text-3xl font-black tracking-tight">Metrics</h1>
              <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider" *ngIf="connectionStatus === 'connected'">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live
              </span>
              <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-wider" *ngIf="connectionStatus === 'connecting'">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Connecting
              </span>
              <span class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-wider" *ngIf="connectionStatus === 'disconnected'">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                Offline
              </span>
            </div>
            <p class="text-slate-500 dark:text-slate-400 text-sm">Real-time telemetry visualization.</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                *ngFor="let range of timeRanges"
                (click)="selectTimeRange(range)"
                class="px-3 py-1 text-xs font-semibold rounded-md transition-all"
                [ngClass]="{
                  'bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm': selectedTimeRange === range,
                  'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700': selectedTimeRange !== range
                }">
                {{ range }}
              </button>
            </div>
            <button (click)="exportMetrics()" class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 h-9 rounded-lg text-sm font-bold transition-colors">
              <span class="material-symbols-outlined text-lg">download</span>
              Export
            </button>
            <button (click)="clearMetrics()" class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-4 h-9 rounded-lg text-sm font-bold transition-colors">
              <span class="material-symbols-outlined text-lg">delete_sweep</span>
              Clear
            </button>
          </div>
        </header>

        <!-- Content Grid -->
        <div class="p-6 space-y-6">
          <!-- Main Selected Chart -->
          <div class="bg-white dark:bg-[#101922] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
             <div class="flex items-start justify-between mb-6">
               <div>
                 <h2 class="text-lg font-bold text-slate-900 dark:text-white">{{ selectedMetricName || 'Select an instrument' }}</h2>
                 <p class="text-slate-500 text-sm">Visualizing values over time per service</p>
               </div>
               <div class="text-right" *ngIf="currentMetricValue">
                 <span class="text-2xl font-black text-primary">{{ currentMetricValue }}</span>
                 <div class="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                   <span class="material-symbols-outlined text-xs">trending_down</span>
                   12% vs last hour
                 </div>
               </div>
             </div>
             <div class="h-80">
               <div echarts [options]="mainChartOptions" class="h-full w-full"></div>
             </div>
          </div>


           <!-- Data Table / Details -->
           <div class="bg-white dark:bg-[#101922] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
             <div class="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
               <h3 class="text-sm font-bold">Active Tags Breakdown</h3>
               <span class="text-slate-400 text-xs" *ngIf="endpointData.length > 0">{{ endpointData.length }} endpoints</span>
             </div>
             <div *ngIf="endpointData.length === 0" class="p-8 text-center text-slate-400">
               <span class="material-symbols-outlined text-3xl mb-2 block">monitoring</span>
               <p class="text-sm">No HTTP endpoint data available</p>
               <p class="text-xs mt-1">Endpoint breakdown will appear when HTTP metrics are received</p>
             </div>
             <table *ngIf="endpointData.length > 0" class="w-full text-left text-sm">
               <thead class="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                 <tr>
                   <th class="px-4 py-3">Endpoint</th>
                   <th class="px-4 py-3">Requests</th>
                   <th class="px-4 py-3">Avg Latency</th>
                   <th class="px-4 py-3">Error Rate</th>
                 </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                 <tr *ngFor="let endpoint of endpointData" class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                   <td class="px-4 py-3 font-medium">{{ endpoint.endpoint }}</td>
                   <td class="px-4 py-3 text-slate-500">{{ endpoint.requests | number }}</td>
                   <td class="px-4 py-3">{{ endpoint.avgLatency }}ms</td>
                   <td class="px-4 py-3">
                     <span class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                       [ngClass]="{
                         'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400': endpoint.errorRate < 1,
                         'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400': endpoint.errorRate >= 1 && endpoint.errorRate < 5,
                         'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400': endpoint.errorRate >= 5
                       }">
                       {{ endpoint.errorRate | number:'1.1-2' }}%
                     </span>
                   </td>
                 </tr>
               </tbody>
             </table>
           </div>
        </div>
      </main>
    </div>

    <!-- Global Footer / Status Bar -->
    <footer class="h-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922] px-4 flex items-center justify-between text-[10px] font-medium text-slate-500 fixed bottom-0 w-full z-50">
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5">
          <span class="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>OTLP Endpoint: Connected</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[14px]">sensors</span>
          <span>Telemetry: Active</span>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <span>Prism v1.0.0</span>
        <span class="text-slate-400">Last Refresh: {{ lastRefreshTime }}</span>
      </div>
    </footer>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #2e2e4d; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    footer { position: fixed; bottom: 0; left: 0; right: 0; }
    main { margin-bottom: 32px; }
  `]
})
export class MetricsComponent implements OnInit, OnDestroy {
  rawMetrics: MetricEntry[] = [];
  instrumentNames: string[] = [];
  selectedMetricName: string = '';
  selectedService: string = '';
  selectedStatusCode: string = '';
  selectedHost: string = '';
  selectedTimeRange: string = '1h';
  timeRanges: string[] = ['5m', '1h', '6h', '24h'];
  services: string[] = ['webfrontend', 'apiservice', 'orders-db'];
  hosts: string[] = ['pod-xyz-123', 'pod-abc-456'];
  connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  
  mainChartOptions: EChartsOption = {};
  cpuChartOptions: EChartsOption = {};
  memoryChartOptions: EChartsOption = {};
  
  currentMetricValue: string = '';
  cpuUsage: number = 0;
  avgCpuUsage: number = 0;
  memoryUsage: number = 0;
  peakMemoryUsage: number = 0;
  
  endpointData: EndpointData[] = [];
  
  lastRefreshTime: string = '';

  private subscriptions: Subscription[] = [];

  constructor(
    private apiService: ApiService,
    private metricStreamService: MetricStreamService,
    private wsService: WebSocketService
  ) { }

  ngOnInit(): void {
    this.updateLastRefreshTime();
    
    // Subscribe to real-time metric updates
    this.subscriptions.push(
      this.metricStreamService.metrics$.subscribe(metrics => {
        this.rawMetrics = metrics;
        this.processMetrics();
        this.updateLastRefreshTime();
      })
    );
    
    this.subscriptions.push(
      this.wsService.status$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
    
    // Load initial data from API
    this.loadMetrics();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  updateLastRefreshTime(): void {
    const now = new Date();
    this.lastRefreshTime = now.toLocaleTimeString('en-US', { hour12: false });
  }

  loadMetrics(): void {
    this.apiService.getMetrics({ 
      limit: 2000,
      serviceName: this.selectedService || undefined
    }).subscribe({
      next: (metrics) => {
        this.metricStreamService.addHistory(metrics);
      },
      error: (err) => {
        console.error('Failed to load metrics:', err);
        // Use mock data when API is not available
        this.loadMockData();
      }
    });
  }

  clearMetrics(): void {
    this.metricStreamService.clearMetrics();
    this.rawMetrics = [];
    this.instrumentNames = [];
    this.selectedMetricName = '';
    this.processMetrics();
  }

  private loadMockData(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    this.rawMetrics = [
      // HTTP Server Duration
      ...this.generateMockMetrics('http.server.duration', 'webfrontend', now, oneHour, 50, 200),
      ...this.generateMockMetrics('http.server.duration', 'apiservice', now, oneHour, 80, 250),
      // CPU Usage
      ...this.generateMockMetrics('system.cpu.usage', 'webfrontend', now, oneHour, 0.1, 0.4),
      ...this.generateMockMetrics('system.cpu.usage', 'apiservice', now, oneHour, 0.2, 0.5),
      // Memory Usage
      ...this.generateMockMetrics('system.memory.usage', 'webfrontend', now, oneHour, 500000000, 800000000),
      ...this.generateMockMetrics('system.memory.usage', 'apiservice', now, oneHour, 300000000, 600000000),
    ];
    
    this.instrumentNames = ['http.server.duration', 'system.cpu.usage', 'system.memory.usage'];
    this.selectedMetricName = 'http.server.duration';
    this.processMetrics();
  }

  private generateMockMetrics(name: string, serviceName: string, endTime: number, duration: number, minValue: number, maxValue: number): MetricEntry[] {
    const metrics: MetricEntry[] = [];
    const points = 20;
    const interval = duration / points;
    
    for (let i = 0; i < points; i++) {
      const timestamp = new Date(endTime - (i * interval)).toISOString();
      const value = minValue + Math.random() * (maxValue - minValue);
      
      metrics.push({
        id: i,
        name,
        value: value,
        type: MetricType.Gauge,
        timestamp,
        serviceName,
        attributes: {}
      });
    }
    
    return metrics.reverse();
  }

  selectTimeRange(range: string): void {
    this.selectedTimeRange = range;
    this.loadMetrics();
  }

  exportMetrics(): void {
    const dataStr = JSON.stringify(this.rawMetrics, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metrics-${new Date().toISOString()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  private processMetrics(): void {
    // Extract unique names
    const names = new Set(this.rawMetrics.map(m => m.name));
    this.instrumentNames = Array.from(names).sort();

    // Default selection
    if (!this.selectedMetricName && this.instrumentNames.length > 0) {
      this.selectedMetricName = this.instrumentNames.find(n => n.includes('http.request.duration')) || this.instrumentNames[0];
    }

    // Update Main Chart
    if (this.selectedMetricName) {
      this.updateMainChart(this.selectedMetricName);
    }

    // Update Secondary Charts
    this.updateCpuChart();
    this.updateMemoryChart();
    
    // Update endpoint breakdown from HTTP metrics
    this.updateEndpointData();
  }

  private updateEndpointData(): void {
    // Look for HTTP request/duration metrics that have endpoint/route attributes
    const httpMetrics = this.rawMetrics.filter(m => 
      m.name.includes('http') && 
      (m.name.includes('request') || m.name.includes('duration') || m.name.includes('server'))
    );

    if (httpMetrics.length === 0) {
      this.endpointData = [];
      return;
    }

    // Group metrics by endpoint (route/path/url)
    const endpointMap = new Map<string, { 
      requests: number; 
      totalLatency: number; 
      errors: number; 
      latencies: number[];
    }>();

    httpMetrics.forEach(metric => {
      const attrs = metric.attributes || {};
      const endpoint = attrs['http.route'] || attrs['url.path'] || attrs['http.target'] || attrs['http.url'] || 'unknown';
      const statusCode = attrs['http.status_code'] || attrs['http.response.status_code'] || '';
      
      if (!endpointMap.has(endpoint)) {
        endpointMap.set(endpoint, { requests: 0, totalLatency: 0, errors: 0, latencies: [] });
      }
      
      const data = endpointMap.get(endpoint)!;
      data.requests++;
      
      // Handle latency/duration value
      if (metric.name.includes('duration') || metric.name.includes('latency')) {
        const latencyMs = metric.value > 1000 ? metric.value : metric.value; // Assume already in ms or convert
        data.totalLatency += latencyMs;
        data.latencies.push(latencyMs);
      }
      
      // Count errors (5xx status codes)
      if (statusCode.toString().startsWith('5') || statusCode.toString().startsWith('4')) {
        data.errors++;
      }
    });

    // Convert to endpoint data array
    this.endpointData = Array.from(endpointMap.entries())
      .map(([endpoint, data]) => ({
        endpoint,
        requests: data.requests,
        avgLatency: data.latencies.length > 0 
          ? Math.round(data.totalLatency / data.latencies.length) 
          : 0,
        errorRate: data.requests > 0 
          ? Math.round((data.errors / data.requests) * 10000) / 100 
          : 0
      }))
      .filter(e => e.endpoint !== 'unknown')
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10); // Show top 10 endpoints
  }

  selectInstrument(name: string): void {
    this.selectedMetricName = name;
    this.updateMainChart(name);
  }

  private updateMainChart(metricName: string): void {
    let filtered = this.rawMetrics.filter(m => m.name === metricName);
    
    // Apply filters
    if (this.selectedStatusCode) {
      filtered = filtered.filter(m => m.attributes?.['status_code']?.startsWith(this.selectedStatusCode));
    }
    if (this.selectedHost) {
      filtered = filtered.filter(m => m.attributes?.['host'] === this.selectedHost);
    }
    if (this.selectedService) {
      filtered = filtered.filter(m => m.serviceName === this.selectedService);
    }
    
    filtered = filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const seriesData = this.groupDataByService(filtered);

    // Calculate current value
    if (filtered.length > 0) {
      const latest = filtered[filtered.length - 1];
      this.currentMetricValue = this.formatMetricValue(latest.value, metricName);
    }

    this.mainChartOptions = {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, textStyle: { color: '#94a3b8' } },
      grid: { top: 20, right: 20, bottom: 40, left: 60 },
      xAxis: { type: 'time', axisLabel: { color: '#94a3b8' }, splitLine: { show: false } },
      yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: '#1e293b' } } },
      series: seriesData
    };
  }

  private updateCpuChart(): void {
    const filtered = this.rawMetrics.filter(m => m.name === 'system.cpu.usage' || m.name === 'process.cpu.utilization')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const seriesData = this.groupDataByService(filtered, true);

    // Calculate CPU usage
    if (filtered.length > 0) {
      const latest = filtered[filtered.length - 1];
      this.cpuUsage = Math.round(Number(latest.value) * 100) / 100;
    }

    this.cpuChartOptions = {
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 20, left: 40 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', min: 0, max: 100, splitLine: { show: false } },
      series: seriesData.map(s => ({ ...s, showSymbol: false, lineStyle: { width: 2 } }))
    };
  }

  private updateMemoryChart(): void {
    const filtered = this.rawMetrics.filter(m => m.name === 'system.memory.usage')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const seriesData = this.groupDataByService(filtered, true);

    // Calculate memory usage
    if (filtered.length > 0) {
      const latest = filtered[filtered.length - 1];
      this.memoryUsage = Math.round(Number(latest.value) / 1024 / 1024); // Convert to MB
      this.peakMemoryUsage = Math.round(Math.max(...filtered.map(m => Number(m.value))) / 1024 / 1024);
    }

    this.memoryChartOptions = {
      tooltip: { trigger: 'axis' },
      grid: { top: 10, right: 10, bottom: 20, left: 60 },
      xAxis: { type: 'time', show: false },
      yAxis: { type: 'value', splitLine: { show: false } },
      series: seriesData.map(s => ({ ...s, showSymbol: false, lineStyle: { width: 2 } }))
    };
  }

  private groupDataByService(metrics: MetricEntry[], areaEffect: boolean = false): SeriesOption[] {
    const services = new Set(metrics.map(m => m.serviceName));
    const series: SeriesOption[] = [];

    services.forEach(service => {
      const serviceMetrics = metrics.filter(m => m.serviceName === service);
      const data = serviceMetrics.map(m => [m.timestamp, Number(m.value)]);

      series.push({
        name: service,
        type: 'line',
        smooth: true,
        data: data,
        areaStyle: areaEffect ? { opacity: 0.1 } : undefined
      });
    });

    return series;
  }

  private formatMetricValue(value: number, metricName: string): string {
    if (metricName.includes('duration') || metricName.includes('latency')) {
      return `${Math.round(value)}ms`;
    }
    if (metricName.includes('memory')) {
      return `${Math.round(value / 1024 / 1024)} MB`;
    }
    if (metricName.includes('cpu')) {
      return `${Math.round(value * 100)}%`;
    }
    return value.toFixed(2);
  }
}
