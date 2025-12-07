import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { filter, map, take } from 'rxjs/operators';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth state to be resolved (not undefined/loading)
  return authService.user$.pipe(
    filter(user => user !== undefined),
    take(1),
    map(user => {
      if (user) {
        return true;
      }

      // Redirect to home page if not authenticated
      router.navigate(['/']);
      return false;
    })
  );
};
