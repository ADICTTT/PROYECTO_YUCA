import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);

  // URL base para los endpoints generales de perfiles
  private readonly baseUrl = 'http://localhost:3000/perfiles';
  
  // URL específica que ya usas para el registro público
  private readonly apiUrl = 'http://localhost:3000/perfiles/publico/registro';

  // --- MÉTODO EXISTENTE (FUNCIONANDO) ---
  registerProfile(perfilData: CreatePerfileDto): Observable<any> {
    return this.http.post(this.apiUrl, perfilData);
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

  cambiarEstado(id: number, estado: string): Observable<Perfil> {
    return this.http.patch<Perfil>(`${this.baseUrl}/${id}/estado`, { estado });
  }
}