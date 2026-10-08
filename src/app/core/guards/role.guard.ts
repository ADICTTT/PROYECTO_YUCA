import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const permitidos = (route.data['roles'] as string[]) ?? [];
  const rol = authService.getRol();

  if (rol && permitidos.includes(rol)) return true;

  // Si tiene sesión pero no el rol correcto, mándalo a su zona
  if (rol === 'EXPOSITOR') return router.createUrlTree(['/mi-panel']);
  if (rol === 'ADMIN') return router.createUrlTree(['/admin/postulaciones']);
  return router.createUrlTree(['/login']);
};