import { HttpClient } from '@angular/common/http';
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

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);

  // Ajusta esta URL según lo que indica la sección "Request URL" en Swagger:
  private readonly apiUrl = 'http://localhost:3000/perfiles/publico/registro';

  registerProfile(perfilData: CreatePerfileDto): Observable<any> {
    return this.http.post(this.apiUrl, perfilData);
  }
}