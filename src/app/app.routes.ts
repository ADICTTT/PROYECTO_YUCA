import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { ArtistRegisterComponent } from './features/public/artist-register/artist-register.component/artist-register.component';
import { HomeComponent } from './features/public/home/home.component';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'registro-artista', component: ArtistRegisterComponent },
  { path: 'login', component: LoginComponent },
  
  
  {
  path: 'admin/postulaciones',
  loadComponent: () =>
    import('./dashboard/dashboard-main/dashboard-main.component').then(m => m.DashboardMainComponent),
  canActivate: [authGuard, roleGuard],
  data: { roles: ['ADMIN'] },
},
{
  path: 'mi-panel',
  loadComponent: () =>
    import('./features/expositor/mi-panel/mi-panel.component').then(m => m.MiPanelComponent),
  canActivate: [authGuard, roleGuard],
  data: { roles: ['EXPOSITOR'] },
},

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];