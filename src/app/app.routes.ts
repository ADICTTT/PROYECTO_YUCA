import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { ArtistRegisterComponent } from './features/public/artist-register/artist-register.component/artist-register.component';
import { HomeComponent } from './features/public/home/home.component';
import { roleGuard } from './core/guards/role.guard';
import { credencialesGuard } from './core/guards/credenciales.guard';
import { MapaSvg } from './features/admin/mapa-svg/mapa-svg';

export const routes: Routes = [
  // Rutas públicas
  { path: '', component: HomeComponent },
  { path: 'registro-artista', component: ArtistRegisterComponent },
  { path: 'login', component: LoginComponent },
  {
    // Pública y sin login: solo arma el mensaje de WhatsApp, no guarda nada en base de datos
    path: 'meet-greet',
    loadComponent: () =>
      import('./features/public/meet-greet-publico/meet-greet-publico.component').then(
        m => m.MeetGreetPublicoComponent
      ),
  },
  {
    // Pública: el propio componente decide qué mostrar (visitante, expositor, cerrado, mapa)
    path: 'mesas',
    loadComponent: () =>
      import('./features/expositor/mesas/mesas.component').then(m => m.MesasComponent),
  },

  // Rutas del Administrador (Protegidas)
  {
    path: 'admin/postulaciones',
    loadComponent: () =>
      import('./dashboard/dashboard-main/dashboard-main.component').then(m => m.DashboardMainComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  {
    path: 'admin/mapa',
    component: MapaSvg,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },
  {
    path: 'admin/reservas',
    loadComponent: () =>
      import('./features/admin/reservas/reservas-admin.component').then(m => m.ReservasAdminComponent),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
  },

  // Rutas del Expositor (Protegidas)
  {
    path: 'mi-cuenta',
    loadComponent: () =>
      import('./features/expositor/mi-cuenta/mi-cuenta.component').then(m => m.MiCuentaComponent),
    canActivate: [authGuard],
  },
  {
    path: 'mi-panel',
    loadComponent: () =>
      import('./features/expositor/mi-panel/mi-panel.component').then(m => m.MiPanelComponent),
    canActivate: [authGuard, roleGuard, credencialesGuard],
    data: { roles: ['EXPOSITOR'] },
  },

  // Comodín para rutas no encontradas (debe ir siempre al final)
  { path: '**', redirectTo: '' },
];
