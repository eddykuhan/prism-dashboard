import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { createAppConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { AppConfig } from './app/core/services/app-config.service';

/**
 * Load runtime configuration from API before bootstrapping Angular.
 * This enables dynamic MSAL configuration based on environment variables.
 */
async function loadConfig(): Promise<AppConfig> {
  try {
    // Determine API base URL
    const baseUrl = window.location.port === '4200' 
      ? 'http://localhost:5003' 
      : window.location.origin;
    
    const response = await fetch(`${baseUrl}/api/v1/config`);
    if (!response.ok) {
      throw new Error(`Config fetch failed: ${response.status}`);
    }
    const config = await response.json();
    console.log('Runtime config loaded:', config);
    return config;
  } catch (error) {
    console.warn('Failed to load config, using minimal mode:', error);
    return {
      authEnabled: false,
      copilotEnabled: false,
      azureAd: null
    };
  }
}

// Load config first, then bootstrap with appropriate configuration
loadConfig()
  .then(config => {
    const appConfig = createAppConfig(config);
    return bootstrapApplication(AppComponent, appConfig);
  })
  .catch((err) => console.error('Bootstrap failed:', err));

