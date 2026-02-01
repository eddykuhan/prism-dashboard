import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ThemeService } from './core/services/theme.service';
import { AIAssistantService } from './core/services/ai-assistant.service';
import { AuthService } from './core/services/auth.service';
import { AIPanelComponent } from './shared/components/ai-panel/ai-panel.component';
import { PrismLogoComponent } from './shared/components/prism-logo/prism-logo.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AIPanelComponent, PrismLogoComponent],
  template: `
    <div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <!-- Sidebar Navigation -->
      <aside [class.w-64]="!sidebarCollapsed" [class.w-20]="sidebarCollapsed" 
             class="border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen sticky top-0 bg-white dark:bg-[#0b1219] transition-all duration-300">
        <div class="p-6 flex items-center gap-3" [class.justify-center]="sidebarCollapsed">
          <app-prism-logo [size]="48" class="text-white flex-shrink-0"></app-prism-logo>
          @if (!sidebarCollapsed) {
            <div>
              <h1 class="text-base font-bold leading-none">Prism</h1>
              <p class="text-xs text-slate-500 dark:text-[#92adc9] mt-1">Telemetry Dashboard</p>
            </div>
          }
        </div>
        <nav class="flex-1 px-3 space-y-1 mt-4">
          <a routerLink="/" routerLinkActive="bg-primary text-black" [routerLinkActiveOptions]="{ exact: true }"
             [title]="sidebarCollapsed ? 'Home' : ''"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black"
             [class.justify-center]="sidebarCollapsed">
             <span class="material-symbols-outlined flex-shrink-0" routerLinkActive="fill-icon">home</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Home</span>
            }
          </a>
          <a routerLink="/logs" routerLinkActive="bg-primary text-black"
             [title]="sidebarCollapsed ? 'Logs' : ''"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black"
             [class.justify-center]="sidebarCollapsed">
             <span class="material-symbols-outlined flex-shrink-0" routerLinkActive="fill-icon">list_alt</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Logs</span>
            }
          </a>
          <a routerLink="/traces" routerLinkActive="bg-primary text-black"
             [title]="sidebarCollapsed ? 'Traces' : ''"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black"
             [class.justify-center]="sidebarCollapsed">
             <span class="material-symbols-outlined flex-shrink-0" routerLinkActive="fill-icon">account_tree</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Traces</span>
            }
          </a>
          <a routerLink="/metrics" routerLinkActive="bg-primary text-black"
             [title]="sidebarCollapsed ? 'Metrics' : ''"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black"
             [class.justify-center]="sidebarCollapsed">
             <span class="material-symbols-outlined flex-shrink-0" routerLinkActive="fill-icon">monitoring</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Metrics</span>
            }
          </a>
          <a routerLink="/guide" routerLinkActive="bg-primary text-black"
             [title]="sidebarCollapsed ? 'Guide' : ''"
             class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors group [&.router-link-active]:hover:bg-primary [&.router-link-active]:text-black"
             [class.justify-center]="sidebarCollapsed">
             <span class="material-symbols-outlined flex-shrink-0" routerLinkActive="fill-icon">menu_book</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Guide</span>
            }
          </a>
          
          <!-- Copilot Button - Only show when copilot is enabled -->
          @if (authService.isCopilotEnabled()) {
            <button 
              (click)="openCopilot()"
              [disabled]="!isAuthenticated"
              [class.opacity-50]="!isAuthenticated"
              [class.cursor-not-allowed]="!isAuthenticated"
              [title]="sidebarCollapsed ? 'Copilot' : ''"
              class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors mt-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 dark:border-blue-800"
              [class.justify-center]="sidebarCollapsed"
              [class.w-full]="!sidebarCollapsed">
              <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 flex-shrink-0">auto_awesome</span>
              @if (!sidebarCollapsed) {
                <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Copilot</span>
                @if (isAuthenticated) {
                  <span class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300">AI</span>
                } @else {
                  <span class="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Sign in</span>
                }
              }
            </button>
          }
        </nav>
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <!-- Collapse Toggle Button -->
          <button 
            (click)="toggleSidebar()"
            [title]="sidebarCollapsed ? 'Expand' : 'Collapse'"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors"
            [class.justify-center]="sidebarCollapsed"
            [class.w-full]="!sidebarCollapsed">
            <span class="material-symbols-outlined flex-shrink-0">{{ sidebarCollapsed ? 'menu_open' : 'menu' }}</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">Collapse</span>
            }
          </button>
          
          <button 
            (click)="toggleTheme()"
            [title]="sidebarCollapsed ? 'Theme' : ''"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 dark:text-[#92adc9] hover:bg-slate-100 dark:hover:bg-[#233648] transition-colors"
            [class.justify-center]="sidebarCollapsed"
            [class.w-full]="!sidebarCollapsed">
            <span class="material-symbols-outlined flex-shrink-0">{{ (theme$ | async) === 'dark' ? 'light_mode' : 'dark_mode' }}</span>
            @if (!sidebarCollapsed) {
              <span class="text-sm font-medium">{{ (theme$ | async) === 'dark' ? 'Light' : 'Dark' }} Mode</span>
            }
          </button>
          
          <!-- Auth Section -->
          @if (authService.isAuthEnabled()) {
            @if (isAuthenticated) {
              <!-- Logged in user -->
              <div class="flex items-center gap-3 p-2" [class.justify-center]="sidebarCollapsed">
                <div class="size-8 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {{ getUserInitials() }}
                </div>
                @if (!sidebarCollapsed) {
                  <div class="flex-1 overflow-hidden">
                    <p class="text-xs font-medium truncate">{{ authService.getUserDisplayName() }}</p>
                    <button (click)="logout()" class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline">
                      Sign out
                    </button>
                  </div>
                }
              </div>
            } @else {
              <!-- Login button -->
              <button 
                (click)="login()"
                class="flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                [class.justify-center]="sidebarCollapsed"
                [class.w-full]="!sidebarCollapsed">
                <span class="material-symbols-outlined flex-shrink-0">login</span>
                @if (!sidebarCollapsed) {
                  <span class="text-sm font-medium">Sign in</span>
                }
              </button>
            }
          } @else {
            <!-- No auth - show dev environment info -->
            <div class="flex items-center gap-3 p-2" [class.justify-center]="sidebarCollapsed">
              <div class="size-8 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                <div class="w-full h-full bg-slate-500 flex items-center justify-center text-white text-xs">DE</div>
              </div>
              @if (!sidebarCollapsed) {
                <div class="flex-1 overflow-hidden">
                  <p class="text-xs font-medium truncate">Dev Environment</p>
                  <p class="text-[10px] text-slate-500 dark:text-[#92adc9]">v1.0.0</p>
                </div>
              }
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
  sidebarCollapsed = false;

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
  
  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
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
