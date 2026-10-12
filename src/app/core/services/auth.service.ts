import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: any;
  debeCambiarPassword: boolean;
}

export interface CambiarCredencialesDto {
  passwordActual: string;
  nuevoNombreUsuario?: string;
  nuevaPassword: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'yuca_access_token';
  private readonly FLAG_KEY = 'yuca_debe_cambiar';

  getRol(): string | null {
    const token = this.getToken();
    if (!token) return null;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64));
      return payload.rol ?? null;
    } catch {
      return null;
    }
  }

  login(credentials: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => {
        if (response?.access_token) {
          this.setToken(response.access_token);
          localStorage.setItem(this.FLAG_KEY, String(!!response.debeCambiarPassword));
        }
      })
    );
  }

  debeCambiarPassword(): boolean {
    return localStorage.getItem(this.FLAG_KEY) === 'true';
  }

  cambiarCredenciales(data: CambiarCredencialesDto) {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/cambiar-credenciales`, data);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.FLAG_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const { exp } = JSON.parse(atob(base64));
      if (exp && Date.now() / 1000 > exp) {
        this.logout();
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  restablecerCredenciales(perfilId: number) {
    return this.http.post<{ nombre: string; usuario: string; password: string }>(
      `${this.apiUrl}/restablecer-credenciales/${perfilId}`,
      {},
    );
  }
}