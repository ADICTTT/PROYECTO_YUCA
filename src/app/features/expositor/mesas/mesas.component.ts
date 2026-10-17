import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EVENTO_ACTUAL } from '../../../core/config/evento.config';
import { MapaMesasComponent } from '../../../core/components/mapa-mesas.component';
import { CompaneroSelectorComponent } from '../../../core/components/companero-selector/companero-selector.component';
import {
  CompaneroBusqueda,
  EstadoPerfilPublico,
  MapaReservas,
  MesaMapa,
  MiReserva,
  ReglasReservas,
  ReservasService,
  leerErrorApi,
} from '../../../core/services/reserva.service';

type Vista = 'cargando' | 'visitante' | 'otro_rol' | 'error' | 'cerrado' | 'reglas' | 'mapa' | 'reserva';

@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, MapaMesasComponent, CompaneroSelectorComponent],
  templateUrl: './mesas.component.html',
})
export class MesasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reservas = inject(ReservasService);

  readonly vista = signal<Vista>('cargando');
  readonly mensajeError = signal('');
  readonly aviso = signal('');

  // Visitante (sin sesión)
  celular = '';
  readonly consultando = signal(false);
  readonly estadoPerfil = signal<EstadoPerfilPublico | null>(null);
  readonly errorConsulta = signal('');

  // Expositor
  readonly mapa = signal<MapaReservas | null>(null);
  readonly reglas = signal<ReglasReservas | null>(null);
  readonly miReserva = signal<MiReserva | null>(null);
  readonly aceptando = signal(false);

  // Mesa elegida y compañero
  readonly mesa = signal<MesaMapa | null>(null);
  readonly companero = signal<CompaneroBusqueda | null>(null);
  readonly enviando = signal(false);

  // Solo es true justo después de confirmar la reserva (no al recargar la página)
  readonly recienReservada = signal(false);

  readonly esArtista = computed(() => this.mesa()?.categoria === 'ILUSTRADORES');

  readonly canalUrl = computed(
    () => this.miReserva()?.whatsappCanal || this.mapa()?.evento.whatsappCanal || EVENTO_ACTUAL.whatsappCanal,
  );
  readonly canalPublico = EVENTO_ACTUAL.whatsappCanal;

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.vista.set('visitante');
      return;
    }
    if (this.auth.debeCambiarPassword()) {
      this.router.navigate(['/mi-cuenta']);
      return;
    }
    if (this.auth.getRol() !== 'EXPOSITOR') {
      this.vista.set('otro_rol');
      return;
    }
    this.cargar();
  }

  // ───────────── Visitante ─────────────

  consultarEstado(): void {
    const celular = this.celular.trim();
    this.errorConsulta.set('');
    this.estadoPerfil.set(null);
    if (!celular) {
      this.errorConsulta.set('Escribe tu número de celular.');
      return;
    }
    this.consultando.set(true);
    this.reservas.getEstadoPerfil(celular).subscribe({
      next: (r) => {
        this.estadoPerfil.set(r.estado);
        this.consultando.set(false);
      },
      error: (e) => {
        const err = leerErrorApi(e);
        this.errorConsulta.set(
          err.statusCode === 429 ? 'Hiciste muchas consultas. Espera un minuto e intenta de nuevo.' : err.message,
        );
        this.consultando.set(false);
      },
    });
  }

  // ───────────── Expositor: carga ─────────────

  cargar(): void {
    this.vista.set('cargando');
    this.aviso.set('');
    this.recienReservada.set(false);
    this.reservas.getMiReserva().subscribe({
      next: (r) => {
        this.miReserva.set(r);
        if (this.esActiva(r)) {
          this.vista.set('reserva');
          return;
        }
        if (r) {
          this.aviso.set('Tu reserva anterior ya no está activa. Puedes elegir otra mesa.');
        }
        this.cargarMapa();
      },
      error: (e) => this.fallar(e),
    });
  }

  private cargarMapa(): void {
    this.reservas.getMapa().subscribe({
      next: (m) => {
        this.mapa.set(m);
        if (!m.evento.abierta) {
          this.vista.set('cerrado');
          return;
        }
        this.cargarReglas();
      },
      error: (e) => this.fallar(e),
    });
  }

  private cargarReglas(): void {
    this.reservas.getReglas().subscribe({
      next: (r) => {
        this.reglas.set(r);
        this.vista.set(r.aceptadas ? 'mapa' : 'reglas');
      },
      error: (e) => this.fallar(e),
    });
  }

  private recargarMapa(): void {
    this.reservas.getMapa().subscribe({
      next: (m) => this.mapa.set(m),
      error: (e) => this.fallar(e),
    });
  }

  private fallar(e: unknown): void {
    const err = leerErrorApi(e);
    if (err.statusCode === 401) {
      this.auth.logout();
      this.router.navigate(['/login']);
      return;
    }
    this.mensajeError.set(err.message);
    this.vista.set('error');
  }

  esActiva(r: MiReserva | null): boolean {
    return !!r && (r.estado === 'PENDIENTE_PAGO' || r.estado === 'CONFIRMADA');
  }

  etiquetaEstado(r: MiReserva): string {
    return r.estado === 'CONFIRMADA' ? 'Pagada' : 'Pendiente de pago';
  }

  // ───────────── Reglas ─────────────

  aceptarReglas(): void {
    if (this.aceptando()) return;
    this.aceptando.set(true);
    this.reservas.aceptarReglas().subscribe({
      next: () => {
        this.aceptando.set(false);
        this.vista.set('mapa');
      },
      error: (e) => {
        this.aceptando.set(false);
        this.aviso.set(leerErrorApi(e).message);
      },
    });
  }

  // ───────────── Mesa y compañero ─────────────

  elegirMesa(m: MesaMapa): void {
    this.aviso.set('');
    this.mesa.set(m);
    this.companero.set(null);
  }

  cerrarPanel(): void {
    this.mesa.set(null);
    this.companero.set(null);
  }

  cerrarAvisoReservada(): void {
    this.recienReservada.set(false);
  }

  // ───────────── Reservar ─────────────

  confirmar(): void {
    const m = this.mesa();
    if (!m || this.enviando()) return;
    this.enviando.set(true);
    this.aviso.set('');

    this.reservas.reservar({ standId: m.id, companeroPerfilId: this.companero()?.id }).subscribe({
      next: (r) => {
        this.miReserva.set(r);
        this.enviando.set(false);
        this.cerrarPanel();
        this.recienReservada.set(true);
        this.vista.set('reserva');
      },
      error: (e) => {
        const err = leerErrorApi(e);
        this.enviando.set(false);
        this.aviso.set(err.message);
        switch (err.code) {
          case 'MESA_TOMADA':
          case 'MESA_NO_DISPONIBLE':
            this.cerrarPanel();
            this.recargarMapa();
            break;
          case 'YA_TIENES_RESERVA':
            this.cargar();
            break;
          case 'REGLAS_NO_ACEPTADAS':
            this.cerrarPanel();
            this.cargarReglas();
            break;
          case 'SELECCION_CERRADA':
            this.cerrarPanel();
            this.cargar();
            break;
        }
      },
    });
  }
}