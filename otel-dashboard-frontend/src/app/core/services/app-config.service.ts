import { Injectable, InjectionToken } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Runtime configuration fetched from the API at startup.
 * Determines auth and copilot availability.
 */
export interface AppConfig {
  authEnabled: boolean;
  copilotEnabled: boolean;
  azureAd: AzureAdConfig | null;
}

export interface AzureAdConfig {
  clientId: string;
  tenantId: string;
  authority: string;
  redirectUri: string;
  scopes: string[];
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

/**
 * Service to load and provide runtime configuration.
 * Config is fetched from /api/v1/config before Angular bootstrap.
 */
@Injectable({
  providedIn: 'root'
})
export class AppConfigService {
  private config: AppConfig | null = null;

  constructor(private http: HttpClient) {}

  /**
   * Load configuration from API. Called before Angular bootstrap.
   */
  async loadConfig(): Promise<AppConfig> {
    try {
      // Determine API base URL - in production it's same origin, in dev it's localhost:5003
      const baseUrl = this.getApiBaseUrl();
      this.config = await firstValueFrom(
        this.http.get<AppConfig>(`${baseUrl}/api/v1/config`)
      );
      console.log('App config loaded:', this.config);
      return this.config;
    } catch (error) {
      console.warn('Failed to load config from API, using defaults:', error);
      // Default to minimal mode if API is unavailable
      this.config = {
        authEnabled: false,
        copilotEnabled: false,
        azureAd: null
      };
      return this.config;
    }
  }

  /**
   * Get the loaded configuration. Throws if not yet loaded.
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('AppConfig not loaded. Call loadConfig() first.');
    }
    return this.config;
  }

  /**
   * Check if config has been loaded.
   */
  isLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Get API base URL based on current environment.
   */
  getApiBaseUrl(): string {
    // In production (served from .NET API), use same origin
    // In development, use localhost:5003
    if (window.location.port === '4200') {
      return 'http://localhost:5003';
    }
    return window.location.origin;
  }
}

/**
 * Factory function to load config during app initialization.
 */
export async function loadAppConfig(configService: AppConfigService): Promise<AppConfig> {
  return configService.loadConfig();
}
