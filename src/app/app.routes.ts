import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { ArtistRegisterComponent } from './features/public/artist-register/artist-register.component/artist-register.component';

export const routes: Routes = [
  { path: 'registro-artista', component: ArtistRegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'registro-artista', pathMatch: 'full' },
  { path: '**', redirectTo: 'registro-artista' },
];