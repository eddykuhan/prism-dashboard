import { ApplicationConfig, provideZoneChangeDetection, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';
import { 
  MsalModule, 
  MsalService, 
  MsalGuard, 
  MsalBroadcastService,
  MsalInterceptor,
  MSAL_INSTANCE,
  MSAL_GUARD_CONFIG,
  MSAL_INTERCEPTOR_CONFIG,
  MsalInterceptorConfiguration,
  MsalGuardConfiguration
} from '@azure/msal-angular';
import { 
  IPublicClientApplication, 
  PublicClientApplication, 
  InteractionType,
  BrowserCacheLocation,
  LogLevel
} from '@azure/msal-browser';

import { routes } from './app.routes';
import { AppConfig, APP_CONFIG } from './core/services/app-config.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';

/**
 * Create MSAL instance from runtime configuration.
 */
function MSALInstanceFactory(config: AppConfig): IPublicClientApplication {
  if (!config.authEnabled || !config.azureAd) {
    // Return a minimal instance that won't be used
    return new PublicClientApplication({
      auth: {
        clientId: 'disabled',
        authority: 'https://login.microsoftonline.com/common'
      }
    });
  }

  return new PublicClientApplication({
    auth: {
      clientId: config.azureAd.clientId,
      authority: config.azureAd.authority,
      redirectUri: config.azureAd.redirectUri,
      postLogoutRedirectUri: config.azureAd.redirectUri,
      navigateToLoginRequestUrl: true
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
      storeAuthStateInCookie: false
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              break;
            case LogLevel.Warning:
              console.warn(message);
              break;
            case LogLevel.Info:
              // console.info(message);
              break;
            case LogLevel.Verbose:
              // console.debug(message);
              break;
          }
        },
        logLevel: LogLevel.Warning
      }
    }
  });
}

/**
 * Create MSAL Guard configuration from runtime configuration.
 */
function MSALGuardConfigFactory(config: AppConfig): MsalGuardConfiguration {
  return {
    interactionType: InteractionType.Redirect,
    authRequest: config.authEnabled && config.azureAd ? {
      scopes: config.azureAd.scopes
    } : undefined
  };
}

/**
 * Create MSAL Interceptor configuration from runtime configuration.
 */
function MSALInterceptorConfigFactory(config: AppConfig): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, string[]>();
  
  if (config.authEnabled && config.azureAd) {
    // Protect AI endpoints with the API scope
    protectedResourceMap.set('*/api/v1/ai/*', config.azureAd.scopes);
  }

  return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap
  };
}

/**
 * Create application configuration dynamically based on runtime config.
 */
export function createAppConfig(config: AppConfig): ApplicationConfig {
  const providers: any[] = [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: NGX_ECHARTS_CONFIG, useValue: { echarts: () => import('echarts') } },
    { provide: APP_CONFIG, useValue: config }
  ];

  if (config.authEnabled && config.azureAd) {
    // Full MSAL setup when auth is enabled
    providers.push(
      provideHttpClient(withInterceptors([authInterceptor])),
      {
        provide: MSAL_INSTANCE,
        useFactory: () => MSALInstanceFactory(config)
      },
      {
        provide: MSAL_GUARD_CONFIG,
        useFactory: () => MSALGuardConfigFactory(config)
      },
      {
        provide: MSAL_INTERCEPTOR_CONFIG,
        useFactory: () => MSALInterceptorConfigFactory(config)
      },
      MsalService,
      MsalGuard,
      MsalBroadcastService
    );
  } else {
    // Minimal setup without auth
    providers.push(provideHttpClient(withInterceptors([authInterceptor])));
  }

  return { providers };
}

// Legacy export for backwards compatibility (will use minimal config)
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    { provide: NGX_ECHARTS_CONFIG, useValue: { echarts: () => import('echarts') } }
  ]
};

