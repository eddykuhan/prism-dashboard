import { Injectable, Inject, Optional } from '@angular/core';
import { BehaviorSubject, Observable, filter, map } from 'rxjs';
import { MsalService, MsalBroadcastService, MSAL_GUARD_CONFIG, MsalGuardConfiguration } from '@azure/msal-angular';
import { InteractionStatus, AccountInfo, RedirectRequest, PopupRequest } from '@azure/msal-browser';
import { AppConfigService } from './app-config.service';

/**
 * Authentication service that wraps MSAL functionality.
 * Provides login/logout and authentication state management.
 * Only active when auth is enabled in configuration.
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private userSubject = new BehaviorSubject<AccountInfo | null>(null);
  private isInitializedSubject = new BehaviorSubject<boolean>(false);

  isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  user$ = this.userSubject.asObservable();
  isInitialized$ = this.isInitializedSubject.asObservable();

  constructor(
    private configService: AppConfigService,
    @Optional() private msalService: MsalService | null,
    @Optional() private msalBroadcastService: MsalBroadcastService | null,
    @Optional() @Inject(MSAL_GUARD_CONFIG) private msalGuardConfig: MsalGuardConfiguration | null
  ) {
    this.initialize();
  }

  private initialize(): void {
    if (!this.configService.isLoaded()) {
      console.warn('AuthService: Config not loaded, skipping initialization');
      this.isInitializedSubject.next(true);
      return;
    }

    const config = this.configService.getConfig();
    
    if (!config.authEnabled || !this.msalService || !this.msalBroadcastService) {
      console.log('AuthService: Auth not enabled or MSAL not available');
      this.isInitializedSubject.next(true);
      return;
    }

    // Subscribe to MSAL events
    this.msalBroadcastService.inProgress$
      .pipe(
        filter((status: InteractionStatus) => status === InteractionStatus.None)
      )
      .subscribe(() => {
        this.checkAndSetActiveAccount();
      });

    // Handle redirect callback
    this.msalService.handleRedirectObservable().subscribe({
      next: (result) => {
        if (result) {
          console.log('Login redirect successful:', result.account?.username);
          this.msalService!.instance.setActiveAccount(result.account);
          this.checkAndSetActiveAccount();
        }
      },
      error: (error) => {
        console.error('Login redirect error:', error);
      }
    });

    this.checkAndSetActiveAccount();
    this.isInitializedSubject.next(true);
  }

  /**
   * Check if auth is enabled in configuration.
   */
  isAuthEnabled(): boolean {
    return this.configService.isLoaded() && this.configService.getConfig().authEnabled;
  }

  /**
   * Check if copilot is enabled in configuration.
   */
  isCopilotEnabled(): boolean {
    return this.configService.isLoaded() && this.configService.getConfig().copilotEnabled;
  }

  /**
   * Get the current authenticated user.
   */
  getUser(): AccountInfo | null {
    return this.userSubject.getValue();
  }

  /**
   * Get the user's display name.
   */
  getUserDisplayName(): string {
    const user = this.getUser();
    if (!user) return '';
    return user.name || user.username || '';
  }

  /**
   * Initiate login flow (redirect).
   */
  login(): void {
    if (!this.msalService || !this.isAuthEnabled()) {
      console.warn('Login called but MSAL not available or auth not enabled');
      return;
    }

    const config = this.configService.getConfig();
    const loginRequest: RedirectRequest = {
      scopes: config.azureAd?.scopes || [],
      redirectUri: config.azureAd?.redirectUri
    };

    this.msalService.loginRedirect(loginRequest);
  }

  /**
   * Initiate login flow (popup).
   */
  loginPopup(): void {
    if (!this.msalService || !this.isAuthEnabled()) {
      console.warn('Login called but MSAL not available or auth not enabled');
      return;
    }

    const config = this.configService.getConfig();
    const loginRequest: PopupRequest = {
      scopes: config.azureAd?.scopes || []
    };

    this.msalService.loginPopup(loginRequest).subscribe({
      next: (result) => {
        console.log('Login popup successful:', result.account?.username);
        this.msalService!.instance.setActiveAccount(result.account);
        this.checkAndSetActiveAccount();
      },
      error: (error) => {
        console.error('Login popup error:', error);
      }
    });
  }

  /**
   * Logout the current user.
   */
  logout(): void {
    if (!this.msalService || !this.isAuthEnabled()) {
      return;
    }

    this.msalService.logoutRedirect({
      postLogoutRedirectUri: window.location.origin
    });
  }

  /**
   * Get access token for API calls.
   */
  async getAccessToken(): Promise<string | null> {
    if (!this.msalService || !this.isAuthEnabled()) {
      return null;
    }

    const config = this.configService.getConfig();
    const account = this.msalService.instance.getActiveAccount();
    
    if (!account) {
      return null;
    }

    try {
      const result = await this.msalService.instance.acquireTokenSilent({
        scopes: config.azureAd?.scopes || [],
        account
      });
      return result.accessToken;
    } catch (error) {
      console.error('Failed to acquire token silently:', error);
      // Could trigger interactive login here if needed
      return null;
    }
  }

  /**
   * Check for active account and update state.
   */
  private checkAndSetActiveAccount(): void {
    if (!this.msalService) return;

    const accounts = this.msalService.instance.getAllAccounts();
    
    if (accounts.length > 0) {
      // Set first account as active if none set
      if (!this.msalService.instance.getActiveAccount()) {
        this.msalService.instance.setActiveAccount(accounts[0]);
      }
      
      const activeAccount = this.msalService.instance.getActiveAccount();
      this.userSubject.next(activeAccount);
      this.isAuthenticatedSubject.next(true);
    } else {
      this.userSubject.next(null);
      this.isAuthenticatedSubject.next(false);
    }
  }
}
