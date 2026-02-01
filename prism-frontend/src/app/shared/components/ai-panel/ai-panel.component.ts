import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AIAssistantService, AIState, AIMessage } from '../../../core/services/ai-assistant.service';
import { MarkdownPipe } from '../../pipes/markdown.pipe';

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownPipe],
  template: `
    <div 
      class="fixed inset-y-0 right-0 w-[420px] bg-white dark:bg-[#0f1629] border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out"
      [class.translate-x-full]="!state.isOpen"
      [class.translate-x-0]="state.isOpen">
      
      <!-- Header -->
      <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-lg">auto_awesome</span>
          </div>
          <div>
            <h2 class="text-white font-bold text-sm">Prism Copilot</h2>
            <p class="text-blue-100 text-[10px]">AI-powered analysis</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button 
            (click)="clearChat()"
            class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white"
            title="Clear conversation">
            <span class="material-symbols-outlined text-lg">refresh</span>
          </button>
          <button 
            (click)="close()"
            class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/80 hover:text-white">
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      </header>

      <!-- Context Banner -->
      <div *ngIf="state.currentContext" class="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-sm">
            {{ getContextIcon(state.currentContext.type) }}
          </span>
          <span class="text-xs font-medium text-blue-700 dark:text-blue-300">
            {{ state.currentContext.title }}
          </span>
        </div>
      </div>

      <!-- Messages -->
      <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        <!-- Welcome message if empty -->
        <div *ngIf="state.messages.length === 0" class="flex flex-col items-center justify-center h-full text-center px-6">
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
            <span class="material-symbols-outlined text-white text-3xl">auto_awesome</span>
          </div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-white mb-2">Prism Copilot</h3>
          <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
            I can help you understand your telemetry data. Click "Explain" on any log or trace, or ask me a question.
          </p>
          <div class="grid gap-2 w-full">
            <button 
              (click)="askQuestion('What errors occurred in the last hour?')"
              class="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">What errors occurred recently?</span>
            </button>
            <button 
              (click)="askQuestion('Why are some requests slow?')"
              class="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Why are some requests slow?</span>
            </button>
            <button 
              (click)="askQuestion('Show me a summary of system health')"
              class="text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Summarize system health</span>
            </button>
          </div>
        </div>

        <!-- Message list -->
        <ng-container *ngFor="let message of state.messages; trackBy: trackByMessageId">
          <!-- User message -->
          <div *ngIf="message.role === 'user'" class="flex justify-end">
            <div class="max-w-[85%] bg-blue-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 shadow-sm">
              <p class="text-sm">{{ message.content }}</p>
            </div>
          </div>

          <!-- Assistant message -->
          <div *ngIf="message.role === 'assistant'" class="flex gap-3">
            <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span class="material-symbols-outlined text-white text-sm">auto_awesome</span>
            </div>
            <div class="flex-1 min-w-0">
              <!-- Loading state -->
              <div *ngIf="message.isLoading" class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="flex gap-1">
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                    <span class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
                  </div>
                  <span class="text-xs text-slate-500 dark:text-slate-400">Analyzing...</span>
                </div>
              </div>
              
              <!-- Actual message -->
              <div *ngIf="!message.isLoading" class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                <div class="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 ai-content" [innerHTML]="message.content | markdown"></div>
              </div>
              
              <!-- Timestamp -->
              <p class="text-[10px] text-slate-400 mt-1 ml-1">{{ message.timestamp | date:'shortTime' }}</p>
            </div>
          </div>
        </ng-container>
      </div>

      <!-- Input -->
      <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
        <form (ngSubmit)="sendMessage()" class="flex gap-2">
          <input 
            [(ngModel)]="inputMessage"
            name="message"
            type="text"
            placeholder="Ask about your telemetry..."
            class="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
            [disabled]="isLoading" />
          <button 
            type="submit"
            [disabled]="!inputMessage.trim() || isLoading"
            class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl transition-colors flex items-center justify-center">
            <span class="material-symbols-outlined text-lg">send</span>
          </button>
        </form>
        <p class="text-[10px] text-slate-400 text-center mt-2">Prism Copilot can make mistakes. Verify important information.</p>
      </div>
    </div>

    <!-- Backdrop -->
    <div 
      *ngIf="state.isOpen"
      (click)="close()"
      class="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
      [class.opacity-100]="state.isOpen"
      [class.opacity-0]="!state.isOpen">
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
    
    .ai-content :deep(h2) { font-size: 1rem; font-weight: 700; margin-top: 1rem; margin-bottom: 0.5rem; }
    .ai-content :deep(h3) { font-size: 0.875rem; font-weight: 600; margin-top: 0.75rem; margin-bottom: 0.25rem; }
    .ai-content :deep(p) { margin-bottom: 0.5rem; }
    .ai-content :deep(ul), .ai-content :deep(ol) { margin-left: 1rem; margin-bottom: 0.5rem; }
    .ai-content :deep(li) { margin-bottom: 0.25rem; }
    .ai-content :deep(strong) { font-weight: 600; }
    .ai-content :deep(code) { background: rgba(0,0,0,0.1); padding: 0.125rem 0.25rem; border-radius: 0.25rem; font-size: 0.75rem; }
    :host-context(.dark) .ai-content :deep(code) { background: rgba(255,255,255,0.1); }
  `]
})
export class AIPanelComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
  
  state: AIState = {
    isOpen: false,
    messages: [],
    currentContext: null
  };
  
  inputMessage = '';
  isLoading = false;
  
  private subscription!: Subscription;
  private shouldScrollToBottom = false;

  constructor(private aiService: AIAssistantService) {}

  ngOnInit(): void {
    this.subscription = this.aiService.state$.subscribe((state: AIState) => {
      const wasOpen = this.state.isOpen;
      const hadMessages = this.state.messages.length;
      
      this.state = state;
      this.isLoading = state.messages.some((m: AIMessage) => m.isLoading);
      
      // Scroll to bottom when new messages arrive
      if (state.messages.length > hadMessages || (!wasOpen && state.isOpen)) {
        this.shouldScrollToBottom = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  close(): void {
    this.aiService.close();
  }

  clearChat(): void {
    this.aiService.clearMessages();
  }

  sendMessage(): void {
    if (!this.inputMessage.trim() || this.isLoading) return;
    
    this.aiService.sendMessage(this.inputMessage.trim());
    this.inputMessage = '';
  }

  askQuestion(question: string): void {
    this.aiService.sendMessage(question);
  }

  getContextIcon(type: string): string {
    switch (type) {
      case 'log': return 'list_alt';
      case 'trace': return 'account_tree';
      case 'span': return 'linear_scale';
      case 'metric': return 'monitoring';
      default: return 'help';
    }
  }

  trackByMessageId(index: number, message: AIMessage): string {
    return message.id;
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch (err) {}
  }
}
