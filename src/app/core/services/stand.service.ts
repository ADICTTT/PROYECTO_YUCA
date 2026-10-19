// src/app/services/stand.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Stand {
  id: number;
  pisoId: number;
  sectorId?: number;
  codigo: string;
  precio: number;
  posicionX: number;
  posicionY: number;
  ancho: number;
  alto: number;
  rotacion: number;
  categoria: 'ILUSTRADORES' | 'EMPRENDEDORES' | 'COMIDA';
  estado: string;
  medidas?: string | null;
  sillas?: number | null;
  incluyeMerienda?: boolean;
  bajoTecho?: boolean;
  descripcion?: string | null;
  reservas?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class StandService {
  private readonly apiUrl = `${environment.apiUrl}/stands`; // Ajusta tu URL base si es necesario

  constructor(private http: HttpClient) {}

  getStandsBySector(sectorId: number): Observable<Stand[]> {
    return this.http.get<Stand[]>(`${this.apiUrl}?sectorId=${sectorId}`);
  }

  updateLayout(sectorId: number, stands: any[]): Observable<any> {
    return this.http.patch(`${this.apiUrl}/sectores/${sectorId}/layout`, { stands });
  }

  updateStand(id: number, data: Partial<Stand>): Observable<Stand> {
    return this.http.patch<Stand>(`${this.apiUrl}/${id}`, data);
  }

  createStand(data: Partial<Stand>): Observable<Stand> {
    return this.http.post<Stand>(this.apiUrl, data);
  }

  deleteStand(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}