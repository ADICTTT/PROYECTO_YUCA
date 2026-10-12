import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const credencialesGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.debeCambiarPassword()) {
    return router.createUrlTree(['/mi-cuenta']);
  }
  return true;
};