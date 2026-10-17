import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
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

@Component({
  selector: 'app-reservas-admin',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe],
  templateUrl: './reservas-admin.component.html',
})
export class ReservasAdminComponent implements OnInit {
  private readonly api = inject(ReservasService);

  readonly cargando = signal(true);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly trabajando = signal<number | null>(null);

  readonly reservas = signal<ReservaAdmin[]>([]);
  readonly mapa = signal<MapaReservas | null>(null);

  readonly filtroEstado = signal<FiltroEstado>('');
  readonly busqueda = signal('');

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
    this.ejecutar(r, this.api.marcarPagada(r.id), `Reserva ${r.codigo} marcada como pagada.`);
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
    const motivo = prompt(`Motivo para liberar la mesa ${r.stand.codigo} (reserva ${r.codigo}):`);
    if (motivo === null) return;
    if (motivo.trim().length < 3) {
      this.error.set('Escribe un motivo para liberar la mesa.');
      return;
    }
    this.ejecutar(r, this.api.liberar(r.id, motivo), `Mesa ${r.stand.codigo} liberada.`);
  }

  private ejecutar(r: ReservaAdmin, peticion: ReturnType<ReservasService['marcarPagada']>, exito: string): void {
    this.trabajando.set(r.id);
    this.error.set('');
    this.mensaje.set('');
    peticion.subscribe({
      next: () => {
        this.trabajando.set(null);
        this.mensaje.set(exito);
        this.cargar();
      },
      error: (e) => {
        this.trabajando.set(null);
        this.error.set(leerErrorApi(e).message);
      },
    });
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