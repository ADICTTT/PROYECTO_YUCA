import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface CreatePerfileDto {
  nombreReal: string;
  celular: string;
  nombreComercial: string;
  categoria: string;
  instagram: string;
  descripcion?: string;
  portafolioUrl?: string;
  usuarioId?: string;
}

// Interfaz para representar el Perfil completo devuelto por el backend en el panel de admin
export interface Perfil {
  id: number;
  nombreReal: string;
  celular: string;
  nombreComercial: string;
  categoria: string;
  instagram: string;
  descripcion?: string;
  portafolioUrl?: string;
  estado: string; // 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  usuarioId?: string | null;
  fotoUrl?: string;
  credenciales?: { usuario: string; password: string } | null;
  mesa?: MesaReserva | null;
}

export interface MesaReserva {
  numero: string;
  expiraEn: string; // fecha límite de pago (ISO)
  pagada: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);

  // URL base usando el environment (cambiará solo entre local y producción)
  private readonly baseUrl = `${environment.apiUrl}/perfiles`;
  
  // URL específica para el registro público
  private readonly apiUrl = `${environment.apiUrl}/perfiles/publico/registro`;

  mio() {
    return this.http.get<Perfil>(`${this.baseUrl}/mio`);
  }
  // --- MÉTODO EXISTENTE (FUNCIONANDO) ---
  registerProfile(formData: FormData ): Observable<any> {
    return this.http.post(this.apiUrl, formData);
  }

  // --- NUEVOS MÉTODOS PARA EL PANEL DE ADMINISTRACIÓN ---

  // 1. Listar todos los perfiles (opcionalmente filtrados por estado: PENDIENTE, APROBADA, RECHAZADA)
  getPerfiles(estado?: string): Observable<Perfil[]> {
    let params = new HttpParams();
    if (estado) {
      params = params.set('estado', estado);
    }
    return this.http.get<Perfil[]>(this.baseUrl, { params });
  }

  // 2. Obtener un perfil específico por su ID
  getPerfilById(id: number): Observable<Perfil> {
    return this.http.get<Perfil>(`${this.baseUrl}/${id}`);
  }

  // 3. Actualizar datos generales del perfil (PATCH /perfiles/:id)
  updatePerfil(id: number, data: Partial<Perfil>): Observable<Perfil> {
    return this.http.patch<Perfil>(`${this.baseUrl}/${id}`, data);
  }

  // 4. Actualizar perfil con archivo (FormData) en el panel de administración
  updatePerfilWithFile(id: number, formData: FormData): Observable<Perfil> {
    return this.http.put<Perfil>(`${this.baseUrl}/${id}`, formData);
  }

  cambiarEstado(id: number, estado: string): Observable<Perfil> {
    return this.http.patch<Perfil>(`${this.baseUrl}/${id}/estado`, { estado });
  }
}