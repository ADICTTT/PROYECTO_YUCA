import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { ProfileService } from '../../../core/services/profile.service';
import { exportarCredenciales } from '../../../core/services/exportar-credenciales';
import { environment } from 'src/environments/environment';
import {
  CategoriaTipo,
  EstadoReserva,
  MapaReservas,
  PersonaReserva,
  ReservaAdmin,
  ReservasService,
  leerErrorApi,
} from '../../../core/services/reserva.service';

type FiltroEstado = '' | EstadoReserva;

interface AvisoLiberacion {
  reserva: ReservaAdmin;
  motivo: string;
}

@Component({
  selector: 'app-reservas-admin',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './reservas-admin.component.html',
})
export class ReservasAdminComponent implements OnInit {
  private readonly api = inject(ReservasService);

  private readonly perfilesApi = inject(ProfileService);
  private readonly origenArchivos = new URL(environment.apiUrl).origin;
  readonly exportando = signal(false);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly trabajando = signal<number | null>(null);

  readonly reservas = signal<ReservaAdmin[]>([]);
  readonly mapa = signal<MapaReservas | null>(null);

  readonly filtroEstado = signal<FiltroEstado>('');
  readonly busqueda = signal('');

  // Ventana para avisar por WhatsApp que se liberó una mesa
  readonly aviso = signal<AvisoLiberacion | null>(null);

  // Ventana para enviar por WhatsApp la confirmación de pago
  readonly confirmacion = signal<ReservaAdmin | null>(null);

  readonly estados: { valor: FiltroEstado; etiqueta: string }[] = [
    { valor: '', etiqueta: 'Todas' },
    { valor: 'PENDIENTE_PAGO', etiqueta: 'Pendientes de pago' },
    { valor: 'CONFIRMADA', etiqueta: 'Pagadas' },
    { valor: 'VENCIDA', etiqueta: 'Vencidas' },
    { valor: 'CANCELADA', etiqueta: 'Canceladas' },
  ];

  // ───────────── Contadores ─────────────

  readonly pendientes = computed(() => this.reservas().filter((r) => r.estado === 'PENDIENTE_PAGO').length);
  readonly pagadas = computed(() => this.reservas().filter((r) => r.estado === 'CONFIRMADA').length);
  readonly vencidas = computed(() => this.reservas().filter((r) => r.estado === 'VENCIDA').length);
  readonly canceladas = computed(() => this.reservas().filter((r) => r.estado === 'CANCELADA').length);

  // Mesas sin vender (sin reserva activa), por categoría
  readonly disponiblesPorCategoria = computed(() => {
    const cuenta: Record<CategoriaTipo, number> = { ILUSTRADORES: 0, EMPRENDEDORES: 0, COMIDA: 0 };
    for (const sector of this.mapa()?.sectores ?? []) {
      for (const mesa of sector.stands) {
        if (mesa.estado === 'DISPONIBLE') cuenta[mesa.categoria]++;
      }
    }
    return cuenta;
  });

  readonly disponibles = computed(() => {
    const c = this.disponiblesPorCategoria();
    return c.ILUSTRADORES + c.EMPRENDEDORES + c.COMIDA;
  });

  readonly totalMesas = computed(() =>
    (this.mapa()?.sectores ?? []).reduce((suma, s) => suma + s.stands.length, 0),
  );

  // ───────────── Lista filtrada ─────────────

  readonly filtradas = computed(() => {
    const estado = this.filtroEstado();
    const q = this.busqueda().trim().toLowerCase();
    return this.reservas().filter((r) => {
      if (estado && r.estado !== estado) return false;
      if (!q) return true;
      const texto = [
        r.codigo,
        r.stand.codigo,
        r.stand.sector,
        r.titular?.nombreComercial,
        r.titular?.instagram,
        r.titular?.celular,
        r.companero?.nombreComercial,
        r.companero?.instagram,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    forkJoin({
      reservas: this.api.listarAdmin(),
      mapa: this.api.getMapa(),
    }).subscribe({
      next: ({ reservas, mapa }) => {
        this.reservas.set(reservas);
        this.mapa.set(mapa);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(leerErrorApi(e).message);
        this.cargando.set(false);
      },
    });
  }

  // ───────────── Acciones ─────────────

  pagar(r: ReservaAdmin): void {
    if (!confirm(`¿Marcar como pagada la reserva ${r.codigo} (mesa ${r.stand.codigo})?`)) return;
    this.ejecutar(r, this.api.marcarPagada(r.id), `Reserva ${r.codigo} marcada como pagada.`, () =>
      this.confirmacion.set(r),
    );
  }

  extender(r: ReservaAdmin): void {
    const texto = prompt(`¿Cuántas horas más para la reserva ${r.codigo}?`, '24');
    if (texto === null) return;
    const horas = Number(texto);
    if (!Number.isFinite(horas) || horas <= 0) {
      this.error.set('Escribe un número de horas mayor a 0.');
      return;
    }
    this.ejecutar(r, this.api.extender(r.id, horas), `Plazo de ${r.codigo} extendido ${horas} h.`);
  }

  liberar(r: ReservaAdmin): void {
    const texto = prompt(
      `Motivo para liberar la mesa ${r.stand.codigo} (reserva ${r.codigo}).\n` +
        `Se le enviará por WhatsApp al artista:`,
    );
    if (texto === null) return;
    const motivo = texto.trim();
    if (motivo.length < 3) {
      this.error.set('Escribe un motivo para liberar la mesa.');
      return;
    }
    if (motivo.length > 200) {
      this.error.set(`El motivo es muy largo (${motivo.length} caracteres). Máximo 200.`);
      return;
    }
    this.ejecutar(r, this.api.liberar(r.id, motivo), `Mesa ${r.stand.codigo} liberada.`, () =>
      this.aviso.set({ reserva: r, motivo }),
    );
  }

  private ejecutar(
    r: ReservaAdmin,
    peticion: ReturnType<ReservasService['marcarPagada']>,
    exito: string,
    alExito?: () => void,
  ): void {
    this.trabajando.set(r.id);
    this.error.set('');
    this.mensaje.set('');
    peticion.subscribe({
      next: () => {
        this.trabajando.set(null);
        this.mensaje.set(exito);
        alExito?.();
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(null);
        this.error.set(leerErrorApi(e).message);
      },
    });
  }

  // ───────────── Aviso por WhatsApp (mesa liberada) ─────────────

  puedeAvisar(r: ReservaAdmin): boolean {
    return (r.estado === 'VENCIDA' || r.estado === 'CANCELADA') && !!r.titular;
  }

  avisar(r: ReservaAdmin): void {
    const motivo = r.motivoLiberacion || 'Se venció el plazo de pago';
    this.aviso.set({ reserva: r, motivo });
  }

  cerrarAviso(): void {
    this.aviso.set(null);
  }

  mensajeLiberacion(p: PersonaReserva, a: AvisoLiberacion): string {
    return (
      `Hola ${p.nombreComercial}, te escribimos de Proyecto Yuca.\n\n` +
      `Tu mesa ${a.reserva.stand.codigo} (reserva ${a.reserva.codigo}) fue liberada.\n` +
      `Motivo: ${a.motivo}\n\n` +
      `Si tienes dudas, respóndenos por este chat.`
    );
  }

  whatsappAviso(p: PersonaReserva, a: AvisoLiberacion): string {
    return `${this.whatsapp(p)}?text=${encodeURIComponent(this.mensajeLiberacion(p, a))}`;
  }

  // ───────────── Confirmación de pago por WhatsApp ─────────────

  puedeConfirmar(r: ReservaAdmin): boolean {
    return r.estado === 'CONFIRMADA' && !!r.titular;
  }

  abrirConfirmacion(r: ReservaAdmin): void {
    this.confirmacion.set(r);
  }

  cerrarConfirmacion(): void {
    this.confirmacion.set(null);
  }

  mensajePago(r: ReservaAdmin): string {
    const lineas = [
      'YUKAWAII FEST 2026 - RESERVA DE MESA',
      'Estado: PAGADA',
      `Código: ${r.codigo}`,
      `Mesa: ${r.stand.codigo} (${r.stand.sector})`,
      `Categoría: ${r.stand.categoria}`,
      `Monto: Bs ${r.precio}`,
    ];
    if (r.titular) lineas.push(`Titular: ${r.titular.nombreComercial} (@${r.titular.instagram})`);
    if (r.companero) lineas.push(`Compañero: ${r.companero.nombreComercial} (@${r.companero.instagram})`);
    lineas.push('Fecha del evento: 14 y 15 de noviembre, Hotel Asturias, Santa Cruz');
    return lineas.join('\n');
  }

  whatsappPago(p: PersonaReserva, r: ReservaAdmin): string {
    const texto = `Hola ${p.nombreComercial}, ¡tu pago fue confirmado!\n\n${this.mensajePago(r)}\n\n¡Nos vemos en el festival!`;
    return `${this.whatsapp(p)}?text=${encodeURIComponent(texto)}`;
  }

    // ───────────── Exportar credenciales (solo pagadas) ─────────────

  async exportarCredenciales(): Promise<void> {
    if (this.pagadas() === 0) {
      this.error.set('No hay reservas pagadas para exportar.');
      return;
    }
    const carpeta = prompt('Carpeta de tu PC donde dejarás las fotos (ej: D:/yuca/fotos/)', 'D:/yuca/fotos/');
    if (!carpeta) return;

    this.exportando.set(true);
    this.error.set('');
    this.mensaje.set('');
    try {
      // El endpoint de reservas no trae la foto: se cruza con los perfiles por id
      const perfiles = await firstValueFrom(this.perfilesApi.getPerfiles(''));
      const fotos = new Map<number, string>();
      for (const p of perfiles) if (p.fotoUrl) fotos.set(p.id, p.fotoUrl);

      const faltantes = await exportarCredenciales(this.reservas(), fotos, carpeta, this.origenArchivos);

      this.mensaje.set(`ZIP descargado con ${this.pagadas()} mesas pagadas.`);
      if (faltantes.length) {
        alert(`Faltan ${faltantes.length} foto(s). También quedaron en faltan-fotos.txt dentro del ZIP:\n\n` + faltantes.join('\n'));
      }
    } catch (e) {
      this.error.set('No se pudo generar el ZIP. Revisa la consola (F12).');
      console.error(e);
    } finally {
      this.exportando.set(false);
    }
  }
  
  // ───────────── Ayudas de vista ─────────────

  etiquetaEstado(e: EstadoReserva): string {
    switch (e) {
      case 'PENDIENTE_PAGO':
        return 'Pendiente de pago';
      case 'CONFIRMADA':
        return 'Pagada';
      case 'VENCIDA':
        return 'Vencida';
      default:
        return 'Cancelada';
    }
  }

  claseEstado(e: EstadoReserva): string {
    switch (e) {
      case 'PENDIENTE_PAGO':
        return 'bg-[#F4C453] text-[#2C221E]';
      case 'CONFIRMADA':
        return 'bg-[#7B8E3D] text-white';
      case 'VENCIDA':
        return 'bg-[#E85A4F] text-white';
      default:
        return 'bg-[#D1D5DB] text-[#2C221E]';
    }
  }

  puedePagar(r: ReservaAdmin): boolean {
    return r.estado === 'PENDIENTE_PAGO' || r.estado === 'VENCIDA';
  }

  puedeExtender(r: ReservaAdmin): boolean {
    return r.estado === 'PENDIENTE_PAGO' || r.estado === 'VENCIDA';
  }

  puedeLiberar(r: ReservaAdmin): boolean {
    return r.estado === 'PENDIENTE_PAGO' || r.estado === 'CONFIRMADA';
  }

  // Enlace de WhatsApp con el celular (si tiene 8 dígitos se agrega el 591)
  whatsapp(p: PersonaReserva): string {
    const d = (p.celular || '').replace(/\D/g, '');
    const numero = d.length === 8 ? `591${d}` : d;
    return `https://wa.me/${numero}`;
  }
}