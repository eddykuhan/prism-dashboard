import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { LogStreamService } from '../../core/services/log-stream.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { AIAssistantService } from '../../core/services/ai-assistant.service';
import { AuthService } from '../../core/services/auth.service';
import { LogEntry, LogLevel } from '../../core/models/prism.models';
import { Subscription } from 'rxjs';
import { formatDistanceToNow } from 'date-fns';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0b1016]">
      <!-- Header -->
      <header class="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101922]/50">
        <div class="px-8 pt-6 pb-2">
           <div class="flex items-center gap-2">
            <a class="text-slate-500 dark:text-[#9393c8] text-sm font-medium hover:text-primary transition-colors" href="#">Home</a>
            <span class="text-slate-400 dark:text-[#9393c8] text-sm font-medium">/</span>
            <span class="text-slate-900 dark:text-white text-sm font-medium">Logs</span>
          </div>
        </div>
        <div class="px-8 pb-6 flex flex-wrap justify-between items-end gap-3">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <h1 class="text-slate-900 dark:text-white text-3xl font-black leading-tight tracking-tight">Logs</h1>
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
            <p class="text-slate-500 dark:text-[#9393c8] text-sm font-normal">Real-time structured log streaming.</p>
          </div>
          <div class="flex gap-2">
            <button (click)="clearLogs()" class="flex items-center gap-2 rounded-lg h-10 px-4 bg-slate-200 dark:bg-[#242447] text-slate-700 dark:text-white text-sm font-bold hover:opacity-90 transition-opacity">
              <span class="material-symbols-outlined text-xl">delete_sweep</span>
              <span>Clear</span>
            </button>
          </div>
        </div>
      </header>

      <!-- Logs Content -->
      <div class="flex-1 flex overflow-hidden">
        <!-- Log List -->
        <div class="flex-1 overflow-auto custom-scrollbar p-4 space-y-1">
          <div class="bg-white dark:bg-[#101922] rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
             <table class="w-full text-left text-sm border-collapse">
               <thead class="bg-slate-50 dark:bg-[#1a1a2e] text-slate-500 dark:text-[#9393c8] text-xs uppercase font-bold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
                 <tr>
                   <th class="px-4 py-3 w-32">Timestamp</th>
                   <th class="px-4 py-3 w-24">Level</th>
                   <th class="px-4 py-3 w-40">Service</th>
                   <th class="px-4 py-3">Message</th>
                 </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                 @for (log of logs; track log.id) {
                   <tr class="hover:bg-slate-50 dark:hover:bg-[#1a1a35] cursor-pointer transition-colors"
                       [class.bg-primary-50]="selectedLog?.id === log.id"
                       [class.dark:bg-slate-800]="selectedLog?.id === log.id"
                       (click)="selectLog(log)">
                     <td class="px-4 py-2 text-slate-500 whitespace-nowrap">{{ log.timestamp | date:'HH:mm:ss.SSS' }}</td>
                     <td class="px-4 py-2">
                       <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider" [ngClass]="getLevelClass(log.level)">
                         {{ log.level }}
                       </span>
                     </td>
                     <td class="px-4 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{{ log.serviceName }}</td>
                     <td class="px-4 py-2 text-slate-800 dark:text-slate-300 truncate">{{ log.message }}</td>
                   </tr>
                 }
                 @if (logs.length === 0) {
                   <tr>
                     <td colspan="4" class="px-4 py-12 text-center text-slate-400">
                       <p class="text-base font-medium">No logs available</p>
                       <p class="mt-1">Waiting for incoming telemetry...</p>
                     </td>
                   </tr>
                 }
               </tbody>
             </table>
          </div>
        </div>

        <!-- Details Panel -->
        <aside *ngIf="selectedLog" class="w-96 bg-white dark:bg-[#101922] border-l border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar p-6 shadow-xl z-20">
          <div class="flex justify-between items-start mb-4">
            <h3 class="text-lg font-bold text-slate-900 dark:text-white">Log Details</h3>
            <button (click)="selectedLog = null" class="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
          
          <!-- AI Explain Button -->
          <button 
            *ngIf="authService.isCopilotEnabled()"
            (click)="explainLog(selectedLog)"
            class="w-full mb-6 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium text-sm hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg">
            <span class="material-symbols-outlined text-lg">auto_awesome</span>
            <span>Explain with Copilot</span>
          </button>

          <div class="space-y-6">
            <div>
               <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Message</label>
               <p class="mt-1 text-sm text-slate-900 dark:text-slate-200 font-mono bg-slate-50 dark:bg-slate-900 p-3 rounded-lg">{{ selectedLog.message }}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Level</label>
                <div class="mt-1">
                  <span class="px-2 py-0.5 rounded text-xs font-bold uppercase" [ngClass]="getLevelClass(selectedLog.level)">{{ selectedLog.level }}</span>
                </div>
              </div>
              <div>
                <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</label>
                <p class="mt-1 text-sm text-slate-700 dark:text-slate-300 font-mono">{{ selectedLog.timestamp }}</p>
              </div>
            </div>

            <div>
              <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Service</label>
              <div class="mt-1 flex items-center gap-2">
                <span class="material-symbols-outlined text-slate-400 text-sm">dns</span>
                <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ selectedLog.serviceName }}</span>
              </div>
            </div>

             <div>
               <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Trace Context</label>
               <div class="mt-1 space-y-2">
                 <div class="flex flex-col">
                   <span class="text-[10px] text-slate-400">Trace ID</span>
                   <span class="text-xs font-mono text-primary cursor-pointer hover:underline truncate">{{ selectedLog.traceId }}</span>
                 </div>
                 <div class="flex flex-col">
                   <span class="text-[10px] text-slate-400">Span ID</span>
                   <span class="text-xs font-mono text-slate-600 dark:text-slate-400 truncate">{{ selectedLog.spanId }}</span>
                 </div>
               </div>
             </div>

             <div *ngIf="selectedLog.attributes && hasAttributes(selectedLog.attributes)">
               <label class="text-xs font-bold text-slate-500 uppercase tracking-wider">Attributes</label>
               <div class="mt-2 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
                 <div *ngFor="let key of getAttributeKeys(selectedLog.attributes)" class="flex flex-col">
                   <span class="text-[10px] text-slate-400 font-medium">{{ key }}</span>
                   <span class="text-xs text-slate-700 dark:text-slate-300 font-mono break-all">{{ selectedLog.attributes[key] }}</span>
                 </div>
               </div>
             </div>
          </div>
        </aside>
      </div>
      
      <!-- Footer -->
      <footer class="h-8 bg-slate-100 dark:bg-[#16162a] border-t border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0">
        <div class="flex items-center gap-4">
           <span>Total: {{ logs.length }}</span>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #2e2e4d; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  `]
})
export class LogsComponent implements OnInit, OnDestroy {
  logs: LogEntry[] = [];
  selectedLog: LogEntry | null = null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';
  private subscriptions: Subscription[] = [];

  constructor(
    private apiService: ApiService,
    private logStreamService: LogStreamService,
    private wsService: WebSocketService,
    private aiService: AIAssistantService,
    public authService: AuthService
  ) { }

  ngOnInit(): void {
    this.subscriptions.push(
      this.logStreamService.logs$.subscribe(logs => {
        this.logs = logs;
      })
    );
    this.subscriptions.push(
      this.wsService.status$.subscribe(status => {
        this.connectionStatus = status;
      })
    );
    this.loadInitialLogs();
  }

  private loadInitialLogs(): void {
    this.apiService.getLogs({ limit: 1000 }).subscribe({
      next: (logs) => {
        this.logStreamService.addHistory(logs);
      },
      error: (err) => console.error('Failed to load logs:', err)
    });
  }

  clearLogs(): void {
    this.logStreamService.clearLogs();
    this.selectedLog = null;
  }

  selectLog(log: LogEntry): void {
    this.selectedLog = log;
  }

  getLevelClass(level: LogLevel): string {
    const classes: any = {
      'Debug': 'bg-slate-500/10 text-slate-500',
      'Info': 'bg-blue-500/10 text-blue-500',
      'Warn': 'bg-amber-500/10 text-amber-500',
      'Error': 'bg-red-500/10 text-red-500',
      'Fatal': 'bg-purple-500/10 text-purple-500'
    };
    return classes[level] || 'bg-slate-500/10 text-slate-500';
  }

  hasAttributes(attributes: any): boolean {
    return attributes && Object.keys(attributes).length > 0;
  }

  getAttributeKeys(attributes: any): string[] {
    return attributes ? Object.keys(attributes) : [];
  }

  explainLog(log: LogEntry): void {
    this.aiService.explainLog(log);
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
  }
}
