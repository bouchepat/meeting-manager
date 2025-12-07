import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { from, switchMap, catchError, throwError } from 'rxjs';

/**
 * HTTP Interceptor that adds JWT token to all outgoing requests
 * Automatically refreshes token if needed
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  // Skip token for auth endpoints (login, create user, get user by firebase UID)
  if (req.url.includes('/auth/login') ||
      (req.url.includes('/users') && req.method === 'POST') ||
      (req.url.includes('/users/firebase/') && req.method === 'GET')) {
    return next(req);
  }

  // Get token and add to request
  return from(authService.getToken()).pipe(
    switchMap(token => {
      if (token) {
        // Clone request and add Authorization header
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
        return next(authReq);
      }

      // No token available, proceed without authorization
      console.warn('No auth token available for request:', req.url);
      return next(req);
    }),
    catchError(error => {
      console.error('Error in auth interceptor:', error);
      return throwError(() => error);
    })
  );
};
