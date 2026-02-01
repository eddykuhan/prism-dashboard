import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP interceptor that adds bearer token for authenticated AI API requests.
 * Only attaches token when:
 * 1. Auth is enabled
 * 2. User is authenticated
 * 3. Request is to /api/v1/ai/* endpoints
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Only intercept AI API requests
  if (!req.url.includes('/api/v1/ai/')) {
    return next(req);
  }

  // Check if auth is enabled
  if (!authService.isAuthEnabled()) {
    return next(req);
  }

  // Get token and add to request
  return from(authService.getAccessToken()).pipe(
    switchMap(token => {
      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authReq);
      }
      return next(req);
    }),
    catchError(error => {
      console.error('Auth interceptor error:', error);
      return next(req);
    })
  );
};
