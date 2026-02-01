import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { TraceStreamService } from '../../core/services/trace-stream.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AIAssistantService } from '../../core/services/ai-assistant.service';
import { AuthService } from '../../core/services/auth.service';
import { TraceSpan, SpanKind, SpanStatus } from '../../core/models/otel.models';
import { Subscription } from 'rxjs';

interface TraceGroup {
  traceId: string;
  httpMethod: string;
  endpoint: string;
  statusCode: number;
  serviceName: string;
  startTime: string;
  durationMs: number;
  spanCount: number;
  rootSpan: TraceSpan;
  hasError: boolean;
}

@Component({
  selector: 'app-traces',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './traces.component.html',
  styles: [`
    :host { display: block; height: 100%; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #3b3b5c; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .rotate-90 { transform: rotate(90deg); }
    .trace-grid { display: grid; grid-template-columns: 40px 180px 1fr 80px 160px; }
  `]
})
export class TracesComponent implements OnInit, OnDestroy {
  traces: TraceGroup[] = [];
  filteredTraces: TraceGroup[] = [];
  traceSpans: TraceSpan[] = [];
  spanTree: TraceSpan[] = [];
  
  selectedTraceId: string | null = null;
  selectedSpanId: string | null = null;
  loadingDetails = false;
  
  searchQuery = '';
  statusFilter = '';
  
  maxDuration = 0;
  expandedSpans: Set<string> = new Set();
  connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  
  private subscriptions: Subscription[] = [];
  protected readonly SpanKind = SpanKind;

  constructor(
    private apiService: ApiService,
    private traceStreamService: TraceStreamService,
    private wsService: WebSocketService,
    private aiService: AIAssistantService,
    public authService: AuthService
  ) { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.traceStreamService.traces$.subscribe(spans => {
        this.processSpansIntoTraces(spans);
      })
    );
    
    this.subscriptions.push(
      this.wsService.status$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
    
    this.loadInitialTraces();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }

  private processSpansIntoTraces(spans: TraceSpan[]): void {
    const traceMap = new Map<string, TraceSpan[]>();
    spans.forEach(span => {
      const existing = traceMap.get(span.traceId) || [];
      existing.push(span);
      traceMap.set(span.traceId, existing);
    });

    this.traces = Array.from(traceMap.entries()).map(([traceId, traceSpans]) => {
      const rootSpan = traceSpans.find(s => !s.parentSpanId) || 
                       traceSpans.reduce((min, s) => new Date(s.startTime) < new Date(min.startTime) ? s : min);
      
      const httpMethod = this.extractHttpMethod(rootSpan);
      const endpoint = this.extractEndpoint(rootSpan);
      const statusCode = this.extractStatusCode(rootSpan);
      const hasError = rootSpan.status === SpanStatus.Error || (statusCode >= 400);

      return {
        traceId,
        httpMethod,
        endpoint,
        statusCode,
        serviceName: rootSpan.serviceName,
        startTime: rootSpan.startTime,
        durationMs: rootSpan.durationMs,
        spanCount: traceSpans.length,
        rootSpan,
        hasError
      };
    }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    this.maxDuration = Math.max(...this.traces.map(t => t.durationMs), 100);
    this.filterTraces();
  }

  private extractHttpMethod(span: TraceSpan): string {
    const attrs = span.attributes || {};
    return (attrs['http.request.method'] || attrs['http.method'] || '') as string;
  }

  private extractEndpoint(span: TraceSpan): string {
    const attrs = span.attributes || {};
    const route = attrs['http.route'] || attrs['url.path'] || attrs['http.target'] || attrs['http.url'];
    if (route) return route as string;
    return span.operationName;
  }

  private extractStatusCode(span: TraceSpan): number {
    const attrs = span.attributes || {};
    const code = attrs['http.response.status_code'] || attrs['http.status_code'];
    return code ? Number(code) : 0;
  }

  private loadInitialTraces(): void {
    this.apiService.getTraces({ limit: 100 }).subscribe({
      next: (traces) => {
        const apiSpans = traces.map(t => t.rootSpan);
        this.traceStreamService.addHistory(apiSpans);
      },
      error: (err) => console.error('Failed to load traces:', err)
    });
  }

  filterTraces(): void {
    let filtered = [...this.traces];
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.endpoint.toLowerCase().includes(query) ||
        t.serviceName.toLowerCase().includes(query) ||
        t.traceId.toLowerCase().includes(query)
      );
    }
    
    if (this.statusFilter === 'success') {
      filtered = filtered.filter(t => !t.hasError);
    } else if (this.statusFilter === 'error') {
      filtered = filtered.filter(t => t.hasError);
    }
    
    this.filteredTraces = filtered;
  }

  toggleTraceDetails(trace: TraceGroup): void {
    if (this.selectedTraceId === trace.traceId) {
      this.selectedTraceId = null;
      this.traceSpans = [];
      this.spanTree = [];
      return;
    }

    this.selectedTraceId = trace.traceId;
    this.loadingDetails = true;
    this.traceSpans = [];
    this.spanTree = [];
    this.expandedSpans.clear();
    this.selectedSpanId = null;

    this.apiService.getTrace(trace.traceId).subscribe({
      next: (details) => {
        this.traceSpans = details.spans.sort((a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
        this.traceSpans.filter(s => !s.parentSpanId).forEach(s => this.expandedSpans.add(s.spanId));
        this.buildSpanTree();
        this.loadingDetails = false;
      },
      error: (err) => {
        console.error('Failed to load trace details:', err);
        this.loadingDetails = false;
      }
    });
  }

  private buildSpanTree(): void {
    const childrenMap = new Map<string, TraceSpan[]>();

    this.traceSpans.forEach(span => {
      const parentId = span.parentSpanId || '';
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(span);
    });

    const buildTree = (parentId: string, depth: number = 0): TraceSpan[] => {
      const children = childrenMap.get(parentId) || [];
      const result: TraceSpan[] = [];
      children.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      
      children.forEach(child => {
        (child as any).depth = depth;
        result.push(child);
        // Always show children (expanded by default) or if explicitly expanded
        result.push(...buildTree(child.spanId, depth + 1));
      });
      return result;
    };

    // Find root spans (no parent or parent not in this trace)
    const spanIds = new Set(this.traceSpans.map(s => s.spanId));
    const rootSpans = this.traceSpans.filter(s => !s.parentSpanId || !spanIds.has(s.parentSpanId));
    
    // Build tree starting from root spans
    if (rootSpans.length > 0) {
      // Mark roots with empty parentSpanId for tree building
      rootSpans.forEach(s => {
        if (!childrenMap.has('')) {
          childrenMap.set('', []);
        }
        if (!childrenMap.get('')!.includes(s)) {
          childrenMap.get('')!.push(s);
        }
      });
    }
    
    this.spanTree = buildTree('');
  }

  toggleExpand(spanId: string): void {
    if (this.expandedSpans.has(spanId)) {
      this.expandedSpans.delete(spanId);
    } else {
      this.expandedSpans.add(spanId);
    }
    this.buildSpanTree();
  }

  toggleSpanDetails(spanId: string): void {
    this.selectedSpanId = this.selectedSpanId === spanId ? null : spanId;
  }

  clearTraces(): void {
    this.traceStreamService.clearTraces();
    this.selectedTraceId = null;
    this.traceSpans = [];
    this.spanTree = [];
  }

  formatDuration(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  getDurationPercentage(duration: number): number {
    return Math.min((duration / this.maxDuration) * 100, 100);
  }

  getMethodClass(method: string): string {
    const classes: Record<string, string> = {
      'GET': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      'POST': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      'PUT': 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      'PATCH': 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
      'DELETE': 'bg-red-500/15 text-red-600 dark:text-red-400',
    };
    return classes[method?.toUpperCase()] || 'bg-slate-500/15 text-slate-600 dark:text-slate-400';
  }

  getStatusClass(status: number): string {
    if (status >= 500) return 'bg-red-500/15 text-red-600 dark:text-red-400';
    if (status >= 400) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    return 'bg-slate-500/15 text-slate-600 dark:text-slate-400';
  }

  getTimelineMarkers(): number[] {
    if (!this.selectedTraceId) return [];
    const selectedTrace = this.traces.find(t => t.traceId === this.selectedTraceId);
    if (!selectedTrace) return [];
    
    const duration = selectedTrace.durationMs;
    const steps = 5;
    return Array.from({ length: steps + 1 }, (_, i) => Math.round((duration / steps) * i));
  }

  getSpanOffset(span: TraceSpan): number {
    const selectedTrace = this.traces.find(t => t.traceId === this.selectedTraceId);
    if (!selectedTrace) return 0;
    
    const rootStart = new Date(selectedTrace.startTime).getTime();
    const spanStart = new Date(span.startTime).getTime();
    const offsetMs = spanStart - rootStart;
    return Math.max(0, Math.min((offsetMs / selectedTrace.durationMs) * 100, 99));
  }

  getSpanWidth(span: TraceSpan): number {
    const selectedTrace = this.traces.find(t => t.traceId === this.selectedTraceId);
    if (!selectedTrace) return 0;
    
    const width = (span.durationMs / selectedTrace.durationMs) * 100;
    return Math.max(0.5, Math.min(width, 100 - this.getSpanOffset(span)));
  }

  getDepth(span: TraceSpan): number {
    return (span as any).depth || 0;
  }

  hasChildren(spanId: string): boolean {
    return this.traceSpans.some(span => span.parentSpanId === spanId);
  }

  getSpanKindIcon(span: TraceSpan): string {
    const attrs = span.attributes || {};
    const opName = (span.operationName || '').toLowerCase();
    if (attrs['db.system'] || attrs['db.name'] || opName.includes('query')) {
      return 'storage';
    }
    if (span.kind === SpanKind.Client) {
      return 'language';
    }
    if (span.kind === SpanKind.Producer || span.kind === SpanKind.Consumer) {
      return 'send';
    }
    if (span.kind === SpanKind.Server) {
      return 'dns';
    }
    return 'code';
  }

  getSpanKindIconClass(span: TraceSpan): string {
    const icon = this.getSpanKindIcon(span);
    const classes: Record<string, string> = {
      'storage': 'text-violet-500',
      'language': 'text-emerald-500',
      'send': 'text-amber-500',
      'dns': 'text-blue-500',
      'code': 'text-slate-400'
    };
    return classes[icon] || 'text-slate-400';
  }

  getSpanBarClass(span: TraceSpan): string {
    if (span.status === SpanStatus.Error) {
      return 'bg-red-500';
    }
    
    const icon = this.getSpanKindIcon(span);
    const classes: Record<string, string> = {
      'storage': 'bg-violet-500',
      'language': 'bg-emerald-500',
      'send': 'bg-amber-500',
      'dns': 'bg-blue-500',
      'code': 'bg-slate-500'
    };
    return classes[icon] || 'bg-slate-500';
  }

  getSpanDisplayName(span: TraceSpan): string {
    const attrs = span.attributes || {};
    
    if (attrs['db.system']) {
      const operation = attrs['db.operation'] || '';
      const table = attrs['db.sql.table'] || attrs['db.collection.name'] || '';
      if (operation && table) return `${operation} ${table}`;
    }
    
    if (span.kind === SpanKind.Client && attrs['http.request.method']) {
      const method = attrs['http.request.method'] || attrs['http.method'] || '';
      const path = attrs['url.path'] || attrs['http.route'] || '';
      if (method && path) return `${method} ${path}`;
    }
    
    return span.operationName;
  }

  hasAttributes(attrs: any): boolean {
    return attrs && Object.keys(attrs).length > 0;
  }

  getAttributeKeys(attrs: any): string[] {
    return attrs ? Object.keys(attrs).sort() : [];
  }

  trackByTraceId(index: number, trace: TraceGroup): string {
    return trace.traceId;
  }

  trackBySpanId(index: number, span: TraceSpan): string {
    return span.spanId;
  }

  explainTrace(trace: TraceGroup): void {
    // Pass the trace data including span count
    this.aiService.explainTrace({
      ...trace.rootSpan,
      spanCount: trace.spanCount,
      hasError: trace.hasError,
      httpMethod: trace.httpMethod,
      endpoint: trace.endpoint,
      statusCode: trace.statusCode
    });
  }

  explainSpan(span: TraceSpan): void {
    this.aiService.explainSpan(span);
  }
}
