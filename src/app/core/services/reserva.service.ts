import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

// ───────────── Tipos comunes ─────────────

export type CategoriaTipo = 'ILUSTRADORES' | 'EMPRENDEDORES' | 'COMIDA';
export type EstadoMesa = 'DISPONIBLE' | 'OCUPADO' | 'MIA';
export type EstadoReserva = 'PENDIENTE_PAGO' | 'CONFIRMADA' | 'VENCIDA' | 'CANCELADA';
export type EstadoPerfilPublico = 'SIN_PERFIL' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO';

export type CodigoError =
  | 'MESA_TOMADA'
  | 'YA_TIENES_RESERVA'
  | 'CATEGORIA_NO_PERMITIDA'
  | 'SELECCION_CERRADA'
  | 'REGLAS_NO_ACEPTADAS'
  | 'COMPANERO_INVALIDO'
  | 'COMPANERO_NO_PERMITIDO'
  | 'PERFIL_NO_APROBADO'
  | 'MESA_NO_DISPONIBLE'
  | 'RESERVA_NO_EXISTE'
  | 'YA_PAGADA';

export interface ApiError {
  statusCode: number;
  code?: CodigoError | string;
  message: string;
}

// ───────────── Expositor ─────────────

export interface MesaMapa {
  id: number;
  codigo: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  rotacion: number;
  precio: number;
  categoria: CategoriaTipo;
  estado: EstadoMesa;
  medidas: string | null;
  sillas: number | null;
  incluyeMerienda: boolean;
  bajoTecho: boolean;
  descripcion: string | null;
}

export interface SectorMapa {
  id: number;
  nombre: string;
  stands: MesaMapa[];
}

export interface MapaReservas {
  ahora: string;
  evento: {
    id: number;
    nombre: string;
    seleccionAbreEn: string | null;
    abierta: boolean;
    whatsappCanal: string | null;
  };
  categoria: CategoriaTipo | null;
  sectores: SectorMapa[];
}

export interface ReglasReservas {
  texto: string;
  version: number;
  horasPago: number;
  aceptadas: boolean;
}

export interface CompaneroBusqueda {
  id: number;
  nombreComercial: string;
  instagram: string;
}

export interface ParticipanteReserva {
  perfilId: number;
  tipo: 'TITULAR' | 'COMPANERO';
  nombreComercial: string;
  instagram: string;
}

export interface MiReserva {
  id: number;
  codigo: string;
  estado: EstadoReserva;
  precio: number;
  reservadoEn: string;
  venceEn: string;
  segundosRestantes: number;
  soyTitular: boolean;
  evento: { id: number; nombre: string };
  stand: { id: number; codigo: string; sector: string; categoria: CategoriaTipo };
  participantes: ParticipanteReserva[];
  whatsappPagosUrl: string | null;
  whatsappCanal: string | null;
}

export interface CrearReservaBody {
  standId: number;
  companeroPerfilId?: number;
}

// ───────────── Admin ─────────────

export interface PersonaReserva {
  perfilId: number;
  nombreComercial: string;
  instagram: string;
  celular: string;
}

export interface ReservaAdmin {
  id: number;
  codigo: string;
  estado: EstadoReserva;
  precio: number;
  reservadoEn: string;
  venceEn: string;
  pagadoEn: string | null;
  motivoLiberacion: string | null;
  segundosRestantes: number;
  stand: { id: number; codigo: string; sector: string; categoria: CategoriaTipo };
  titular?: PersonaReserva;
  companero?: PersonaReserva;
}

export interface CrearReservaManualBody {
  standId: number;
  titularPerfilId: number;
  companeroPerfilId?: number;
  pagada?: boolean;
}

// ───────────── Servicio ─────────────

@Injectable({ providedIn: 'root' })
export class ReservasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reservas`;

  // Expositor
  getMapa(): Observable<MapaReservas> {
    return this.http.get<MapaReservas>(`${this.apiUrl}/mapa`);
  }

  getReglas(): Observable<ReglasReservas> {
    return this.http.get<ReglasReservas>(`${this.apiUrl}/reglas`);
  }

  aceptarReglas(): Observable<{ aceptadas: boolean; version: number }> {
    return this.http.post<{ aceptadas: boolean; version: number }>(`${this.apiUrl}/aceptar-reglas`, {});
  }

  buscarCompaneros(q: string): Observable<CompaneroBusqueda[]> {
    return this.http.get<CompaneroBusqueda[]>(`${this.apiUrl}/companeros`, { params: { q } });
  }

  getMiReserva(): Observable<MiReserva | null> {
    return this.http.get<MiReserva | null>(`${this.apiUrl}/mia`);
  }

  reservar(body: CrearReservaBody): Observable<MiReserva> {
    return this.http.post<MiReserva>(this.apiUrl, body);
  }

  // Público (sin token): estado del perfil por celular
  getEstadoPerfil(celular: string): Observable<{ estado: EstadoPerfilPublico }> {
    return this.http.get<{ estado: EstadoPerfilPublico }>(`${environment.apiUrl}/perfiles/estado`, {
      params: { celular },
    });
  }

  // Admin
  listarAdmin(estado?: EstadoReserva | '', q?: string): Observable<ReservaAdmin[]> {
    const params: Record<string, string> = {};
    if (estado) params['estado'] = estado;
    if (q && q.trim()) params['q'] = q.trim();
    return this.http.get<ReservaAdmin[]>(this.apiUrl, { params });
  }

  marcarPagada(id: number): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.apiUrl}/${id}/pagar`, {});
  }

  liberar(id: number, motivo: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.apiUrl}/${id}/liberar`, { motivo });
  }

  extender(id: number, horas: number): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.apiUrl}/${id}/extender`, { horas });
  }

  crearManual(body: CrearReservaManualBody): Observable<{ ok: boolean; id: number }> {
    return this.http.post<{ ok: boolean; id: number }>(`${this.apiUrl}/manual`, body);
  }
}

// Lee el error de la API ({statusCode, code, message}) desde un HttpErrorResponse
export function leerErrorApi(err: unknown): ApiError {
  const e = err as HttpErrorResponse;
  const cuerpo = e?.error;
  if (cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo) {
    const msg = Array.isArray(cuerpo.message) ? cuerpo.message.join(', ') : String(cuerpo.message);
    return { statusCode: cuerpo.statusCode ?? e.status, code: cuerpo.code, message: msg };
  }
  return { statusCode: e?.status ?? 0, message: 'No se pudo conectar con el servidor' };
}