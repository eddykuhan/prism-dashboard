import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';

type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'otel-dashboard-theme';
  private readonly themeSubject = new BehaviorSubject<Theme>(this.getInitialTheme());
  private isBrowser: boolean;

  theme$: Observable<Theme> = this.themeSubject.asObservable();

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      this.applyTheme(this.themeSubject.value);
    }
  }

  private getInitialTheme(): Theme {
    if (typeof window === 'undefined') {
      return 'light';
    }

    // Check localStorage first
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch (e) {
      // localStorage might not be available
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    if (this.isBrowser) {
      try {
        localStorage.setItem(this.STORAGE_KEY, theme);
      } catch (e) {
        // localStorage might not be available
      }
      this.applyTheme(theme);
    }
  }

  toggleTheme(): void {
    const current = this.themeSubject.value;
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next);
  }

  getTheme(): Theme {
    return this.themeSubject.value;
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined') {
      return;
    }

    const html = document.documentElement;
    // Remove all theme classes first
    html.classList.remove('dark', 'light');
    // Add the current theme class
    html.classList.add(theme);
    // Update data attribute for CSS selectors
    html.setAttribute('data-theme', theme);
  }
}
