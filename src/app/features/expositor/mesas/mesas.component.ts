import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { EVENTO_ACTUAL } from '../../../core/config/evento.config';
import { MapaMesasComponent } from '../../../core/components/mapa-mesas.component';
import { CompaneroSelectorComponent } from '../../../core/components/companero-selector/companero-selector.component';
import { Perfil, ProfileService } from '../../../core/services/profile.service';
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

type ColorRegla = 'coral' | 'oliva' | 'amarillo';

interface LineaRegla {
  texto: string;
  destacada: boolean;
}

interface ReglaBloque {
  numero: number;
  titulo: string;
  color: ColorRegla;
  lineas: LineaRegla[];
}

interface ReglasParseadas {
  titulo: string;
  introduccion: string[];
  aviso: string;
  reglas: ReglaBloque[];
}

const COLORES_REGLA: ColorRegla[] = ['coral', 'oliva', 'amarillo'];

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
  private readonly perfilesApi = inject(ProfileService);

  readonly vista = signal<Vista>('cargando');
  readonly mensajeError = signal('');
  readonly aviso = signal('');
  readonly exito = signal('');

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

  // Administrador: reserva en nombre de un perfil aprobado
  readonly esAdmin = signal(false);
  readonly perfilesAprobados = signal<Perfil[]>([]);
  readonly cargandoPerfiles = signal(false);
  readonly titular = signal<Perfil | null>(null);
  readonly busquedaTitular = signal('');

  readonly candidatos = computed(() => {
    const m = this.mesa();
    if (!m) return [];
    const q = this.busquedaTitular().trim().toLowerCase();
    return this.perfilesAprobados()
      .filter((p) => p.categoria === m.categoria)
      .filter(
        (p) =>
          !q ||
          p.nombreComercial.toLowerCase().includes(q) ||
          p.instagram.toLowerCase().includes(q),
      )
      .slice(0, 8);
  });

  // Solo es true justo después de confirmar la reserva (no al recargar la página)
  readonly recienReservada = signal(false);

  readonly esArtista = computed(() => this.mesa()?.categoria === 'ILUSTRADORES');

  readonly canalUrl = computed(
    () => this.miReserva()?.whatsappCanal || this.mapa()?.evento.whatsappCanal || EVENTO_ACTUAL.whatsappCanal,
  );
  readonly canalPublico = EVENTO_ACTUAL.whatsappCanal;

  readonly whatsappMenores = 'https://wa.me/59162986390?text=' + encodeURIComponent('Hola, soy menor de 17 años y quiero participar en el Yukawaii Fest. Mis padres están al tanto de mi participación.');

  // Las reglas partidas en bloques para mostrarlas con colores
  readonly reglasParseadas = computed<ReglasParseadas | null>(() => {
    const texto = this.reglas()?.texto;
    return texto ? this.parsearReglas(texto) : null;
  });

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.vista.set('visitante');
      return;
    }
    if (this.auth.debeCambiarPassword()) {
      this.router.navigate(['/mi-cuenta']);
      return;
    }
    const rol = this.auth.getRol();
    if (rol === 'ADMIN') {
      this.esAdmin.set(true);
      this.cargarAdmin();
      return;
    }
    if (rol !== 'EXPOSITOR') {
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

  // ───────────── Carga ─────────────

  cargar(): void {
    if (this.esAdmin()) {
      this.cargarAdmin();
      return;
    }
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

  // El administrador ve el mapa completo aunque la selección esté cerrada
  private cargarAdmin(): void {
    this.vista.set('cargando');
    this.aviso.set('');
    this.reservas.getMapa().subscribe({
      next: (m) => {
        this.mapa.set(m);
        this.vista.set('mapa');
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

  private parsearReglas(texto: string): ReglasParseadas {
    const lineas = texto
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trim());

    let titulo = '';
    let aviso = '';
    const introduccion: string[] = [];
    const reglas: ReglaBloque[] = [];
    let actual: ReglaBloque | null = null;

    for (const l of lineas) {
      if (!l) continue;

      // Inicio de una regla: "1. Propiedad Intelectual"
      const m = /^(\d{1,2})\.\s+(.+)$/.exec(l);
      if (m) {
        actual = {
          numero: Number(m[1]),
          titulo: m[2],
          color: COLORES_REGLA[reglas.length % COLORES_REGLA.length],
          lineas: [],
        };
        reglas.push(actual);
        continue;
      }

      // Dentro de una regla
      if (actual) {
        actual.lineas.push(this.armarLinea(l));
        continue;
      }

      // Antes de la primera regla
      if (!titulo) {
        titulo = l;
      } else if (this.esMayusculas(l) && l.length > 40) {
        aviso = l;
      } else {
        introduccion.push(l);
      }
    }

    return { titulo, introduccion, aviso, reglas };
  }

  private armarLinea(l: string): LineaRegla {
    const destacada = l.length > 2 && l.startsWith('*') && l.endsWith('*');
    return { texto: destacada ? l.slice(1, -1).trim() : l, destacada };
  }

  private esMayusculas(l: string): boolean {
    return l === l.toUpperCase() && l !== l.toLowerCase();
  }

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
    this.exito.set('');
    this.mesa.set(m);
    this.companero.set(null);
    this.titular.set(null);
    this.busquedaTitular.set('');
    if (this.esAdmin()) this.cargarPerfilesAprobados();
  }

  cerrarPanel(): void {
    this.mesa.set(null);
    this.companero.set(null);
    this.titular.set(null);
    this.busquedaTitular.set('');
  }

  cerrarAvisoReservada(): void {
    this.recienReservada.set(false);
  }

  // ───────────── Administrador ─────────────

  private cargarPerfilesAprobados(): void {
    if (this.perfilesAprobados().length > 0 || this.cargandoPerfiles()) return;
    this.cargandoPerfiles.set(true);
    this.perfilesApi.getPerfiles('APROBADO').subscribe({
      next: (lista) => {
        this.perfilesAprobados.set(lista);
        this.cargandoPerfiles.set(false);
      },
      error: () => {
        this.cargandoPerfiles.set(false);
        this.aviso.set('No se pudo cargar la lista de perfiles aprobados.');
      },
    });
  }

  escribirTitular(valor: string): void {
    this.busquedaTitular.set(valor);
  }

  elegirTitular(p: Perfil): void {
    this.titular.set(p);
    this.busquedaTitular.set('');
  }

  quitarTitular(): void {
    this.titular.set(null);
  }

  confirmarAdmin(): void {
    const m = this.mesa();
    const t = this.titular();
    if (!m || !t || this.enviando()) return;
    this.enviando.set(true);
    this.aviso.set('');
    this.exito.set('');

    this.reservas.crearManual({ standId: m.id, titularPerfilId: t.id }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.exito.set(`Reserva creada: mesa ${m.codigo} para ${t.nombreComercial}.`);
        this.cerrarPanel();
        this.recargarMapa();
      },
      error: (e) => {
        const err = leerErrorApi(e);
        this.enviando.set(false);
        this.aviso.set(err.message);
        if (err.code === 'MESA_TOMADA') {
          this.cerrarPanel();
          this.recargarMapa();
        }
      },
    });
  }

  // ───────────── Reservar (expositor) ─────────────

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