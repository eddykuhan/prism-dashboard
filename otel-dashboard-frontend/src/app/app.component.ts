import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './core/services/theme.service';
import { AIAssistantService } from './core/services/ai-assistant.service';
import { AuthService } from './core/services/auth.service';
import { AIPanelComponent } from './shared/components/ai-panel/ai-panel.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AIPanelComponent],
  template: `
    <div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <!-- Sidebar Navigation -->
      <aside class="w-64 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 bg-white dark:bg-[#0b1219]">
        <div class="p-6 flex items-center gap-3">
          <div class="size-8 bg-primary rounded-lg flex items-center justify-center text-white">
            <span class="material-symbols-outlined">hub</span>
          </div>
          <div>
            <h1 class="text-base font-bold leading-none">Prism</h1>
            <p class="text-xs text-slate-500 dark:text-[#92adc9] mt-1">Telemetry Dashboard</p>
          </div>
        </div>
        <nav class="flex-1 px-3 space-y-1 mt-4">
          <!-- Resources link removed -->
          <a routerLink="/logs" routerLinkActive="bg-primary text-black"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black">
             <span class="material-symbols-outlined" routerLinkActive="fill-icon">list_alt</span>
            <span class="text-sm font-medium">Logs</span>
          </a>
          <a routerLink="/traces" routerLinkActive="bg-primary text-black"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black">
             <span class="material-symbols-outlined" routerLinkActive="fill-icon">account_tree</span>
            <span class="text-sm font-medium">Traces</span>
          </a>
          <a routerLink="/metrics" routerLinkActive="bg-primary text-black"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black">
             <span class="material-symbols-outlined" routerLinkActive="fill-icon">monitoring</span>
            <span class="text-sm font-medium">Metrics</span>
          </a>
          
          <!-- Copilot Button - Only show when copilot is enabled -->
          @if (authService.isCopilotEnabled()) {
            <button 
              (click)="openCopilot()"
              [disabled]="!isAuthenticated"
              [class.opacity-50]="!isAuthenticated"
              [class.cursor-not-allowed]="!isAuthenticated"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors mt-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 dark:border-blue-800"
              [title]="isAuthenticated ? 'Open AI Copilot' : 'Sign in to use Copilot'">
              <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">auto_awesome</span>
              <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Copilot</span>
              @if (isAuthenticated) {
                <span class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">AI</span>
              } @else {
                <span class="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Sign in</span>
              }
            </button>
          }
        </nav>
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button 
            (click)="toggleTheme()"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors">
            <span class="material-symbols-outlined">{{ (theme$ | async) === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
            <span class="text-sm font-medium">{{ (theme$ | async) === 'dark' ? 'Light' : 'Dark' }} Mode</span>
          </button>
          
          <!-- Auth Section -->
          @if (authService.isAuthEnabled()) {
            @if (isAuthenticated) {
              <!-- Logged in user -->
              <div class="flex items-center gap-3 p-2">
                <div class="size-8 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                  {{ getUserInitials() }}
                </div>
                <div class="flex-1 overflow-hidden">
                  <p class="text-xs font-medium truncate">{{ authService.getUserDisplayName() }}</p>
                  <button (click)="logout()" class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                    Sign out
                  </button>
                </div>
              </div>
            } @else {
              <!-- Login button -->
              <button 
                (click)="login()"
                class="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                <span class="material-symbols-outlined">login</span>
                <span class="text-sm font-medium">Sign in</span>
              </button>
            }
          } @else {
            <!-- No auth - show dev environment info -->
            <div class="flex items-center gap-3 p-2">
              <div class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div class="w-full h-full bg-slate-500 flex items-center justify-center text-white text-xs">DE</div>
              </div>
              <div class="flex-1 overflow-hidden">
                <p class="text-xs font-medium truncate">Dev Environment</p>
                <p class="text-[10px] text-slate-500 dark:text-[#92adc9]">v1.0.0</p>
              </div>
            </div>
          }
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark">
        <router-outlet></router-outlet>
      </main>
    </div>
    
    <!-- AI Panel - Only render when copilot is enabled -->
    @if (authService.isCopilotEnabled()) {
      <app-ai-panel></app-ai-panel>
    }
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'Prism - Telemetry Dashboard';
  isAuthenticated = false;

  constructor(
    public themeService: ThemeService,
    private aiService: AIAssistantService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Subscribe to auth state changes
    this.authService.isAuthenticated$.subscribe(isAuth => {
      this.isAuthenticated = isAuth;
    });
  }

  get theme$() {
    return this.themeService.theme$;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  openCopilot(): void {
    if (!this.isAuthenticated && this.authService.isAuthEnabled()) {
      // Prompt to login if not authenticated
      this.authService.login();
      return;
    }
    this.aiService.open();
  }

  login(): void {
    this.authService.login();
  }

  logout(): void {
    this.authService.logout();
  }

  getUserInitials(): string {
    const name = this.authService.getUserDisplayName();
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
}
