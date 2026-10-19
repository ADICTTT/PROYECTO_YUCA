import { Component, ElementRef, HostListener, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { MesaMapa, SectorMapa } from '../services/reserva.service';
import { PLANOS_RECT } from '../config/planos.config';

interface CategoriaLeyenda {
  clave: string;
  nombre: string;
  color: string;
}

interface Limites {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface RectPlano {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Zoom permitido respecto a la vista "ver todo"
const ZOOM_MIN_REL = 0.9;
const ZOOM_MAX_REL = 3;

// Igual que el editor de administración
const MARGEN = 20;
const ALTO_MIN = 360;
const ALTO_MAX = 2400;

@Component({
  selector: 'app-mapa-mesas',
  standalone: true,
  templateUrl: './mapa-mesas.component.html',
})
export class MapaMesasComponent {
  readonly sectores = input.required<SectorMapa[]>();
  readonly seleccionadaId = input<number | null>(null);
  readonly permitirCalibrar = input(false);
  readonly seleccionar = output<MesaMapa>();

  readonly sectorIdx = signal(0);
  readonly sectorActivo = computed(() => this.sectores()[this.sectorIdx()] ?? null);
  readonly stands = computed(() => this.sectorActivo()?.stands ?? []);

  // En celular, por defecto el dedo baja la página; con la mano activa mueve el mapa
  readonly moverMapa = signal(false);

  // Plano de fondo
  readonly verPlano = signal(true);
  readonly calibrando = signal(false);
  readonly opacidad = signal(0.5);
  private readonly ajustes = signal<Record<string, RectPlano>>({});

  private readonly nombreSector = computed(() => (this.sectorActivo()?.nombre ?? '').toLowerCase());

  readonly claveSector = computed(() => {
    const n = this.nombreSector();
    if (n.includes('yuquin')) return 'yuquin';
    if (n.includes('yuca')) return 'yuca';
    if (n.includes('info')) return 'infochan';
    if (n.includes('confet')) return 'confeti';
    return '';
  });

  readonly planoUrl = computed(() => {
    const c = this.claveSector();
    return c ? `/images/planos/${c}.png` : null;
  });

  // Las guías dibujadas a mano solo se ven cuando el plano de fondo está apagado
  readonly mostrarGuias = computed(() => !this.verPlano() || !this.planoUrl());

  // Área que ocupan solo las mesas
  private readonly limitesMesas = computed<Limites | null>(() => {
    const lista = this.stands();
    if (lista.length === 0) return null;
    return {
      minX: Math.min(...lista.map((m) => m.x)),
      minY: Math.min(...lista.map((m) => m.y)),
      maxX: Math.max(...lista.map((m) => m.x + m.ancho)),
      maxY: Math.max(...lista.map((m) => m.y + m.alto)),
    };
  });

  // Posición del plano si está guardada o calibrada
  private readonly rectGuardado = computed<RectPlano | null>(() => {
    const c = this.claveSector();
    return this.ajustes()[c] ?? PLANOS_RECT[c] ?? null;
  });

  // Posición y tamaño del plano dentro del mapa
  readonly rectPlano = computed<RectPlano>(() => {
    const guardado = this.rectGuardado();
    if (guardado) return guardado;
    const lim = this.limitesMesas();
    if (!lim) return { x: 0, y: 0, w: 100, h: 100 };
    const m = 30;
    return { x: lim.minX - m, y: lim.minY - m, w: lim.maxX - lim.minX + m * 2, h: lim.maxY - lim.minY + m * 2 };
  });

  // Área total del sector: mesas + plano de fondo (igual que el editor de administración)
  private readonly limites = computed<Limites | null>(() => {
    const base = this.limitesMesas();
    if (!base) return null;
    if (!(this.verPlano() && this.planoUrl())) return base;
    const r = this.rectPlano();
    return {
      minX: Math.min(base.minX, r.x),
      minY: Math.min(base.minY, r.y),
      maxX: Math.max(base.maxX, r.x + r.w),
      maxY: Math.max(base.maxY, r.y + r.h),
    };
  });

  // Línea lista para copiar y pegar en el código
  readonly textoCalibracion = computed(() => {
    const r = this.rectPlano();
    return `${this.claveSector()}: { x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} },`;
  });

  // Categorías que realmente hay en el sector activo (para la leyenda)
  readonly categoriasPresentes = computed<CategoriaLeyenda[]>(() => {
    const claves = new Set<string>(this.stands().map((m) => m.categoria));
    const orden = ['ILUSTRADORES', 'EMPRENDEDORES', 'COMIDA'];
    return orden
      .filter((c) => claves.has(c))
      .map((c) => ({ clave: c, nombre: this.nombreCategoria(c), color: this.colorBase(c) }));
  });

  readonly k = signal(1);
  readonly tx = signal(0);
  readonly ty = signal(0);
  readonly transform = computed(() => `translate(${this.tx()} ${this.ty()}) scale(${this.k()})`);

  // La altura del mapa cubre todo el largo del sector y la página sigue bajando normal
  readonly alturaLienzo = computed(() => {
    const lim = this.limites();
    if (!lim) return ALTO_MIN;
    const alto = (lim.maxY - lim.minY + MARGEN * 2) * this.k();
    return Math.min(ALTO_MAX, Math.max(ALTO_MIN, Math.round(alto)));
  });

  // Escala de la vista "ver todo": sirve de base para los límites del zoom
  private kBase = 1;

  private readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svg');

  // Control de dedos y arrastre
  private readonly punteros = new Map<number, { x: number; y: number }>();
  private ultimaDistancia = 0;
  private movido = false;
  private acumulado = 0;

  constructor() {
    // Cada vez que cambian las mesas (otro sector o datos nuevos) se reajusta la vista
    effect(() => {
      this.stands();
      setTimeout(() => this.ajustar(), 0);
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.ajustar();
  }

  cambiarSector(i: number): void {
    this.sectorIdx.set(i);
  }

  alternarMover(): void {
    this.moverMapa.update((v) => !v);
  }

  alternarPlano(): void {
    this.verPlano.update((v) => !v);
    setTimeout(() => this.ajustar(), 0);
  }

  alternarCalibrar(): void {
    this.calibrando.update((v) => !v);
    if (this.calibrando()) this.verPlano.set(true);
  }

  cambiarRect(campo: keyof RectPlano, valor: string): void {
    const n = Number(valor);
    if (!Number.isFinite(n)) return;
    const c = this.claveSector();
    const actual = this.rectPlano();
    this.ajustes.update((a) => ({ ...a, [c]: { ...actual, [campo]: n } }));
  }

  cambiarOpacidad(valor: string): void {
    const n = Number(valor);
    if (Number.isFinite(n)) this.opacidad.set(Math.min(1, Math.max(0.1, n)));
  }

  // ───────────── Vista ─────────────

  // Encaja el sector al ANCHO del mapa (como en administración); el largo se recorre bajando la página
  ajustar(): void {
    const svg = this.svgRef()?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;

    const caja = svg.getBoundingClientRect();
    if (caja.width === 0) return;

    const ancho = lim.maxX - lim.minX + MARGEN * 2;
    const nk = Math.max(0.05, caja.width / ancho);
    this.kBase = nk;
    this.k.set(nk);
    this.tx.set((caja.width - ancho * nk) / 2 - (lim.minX - MARGEN) * nk);
    this.ty.set(MARGEN - lim.minY * nk);
  }

  zoomBoton(factor: number): void {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return;
    const caja = svg.getBoundingClientRect();
    this.zoomEn(caja.width / 2, caja.height / 2, factor);
  }

  private zoomEn(px: number, _py: number, factor: number): void {
    const actual = this.k();
    const nuevo = Math.min(this.kBase * ZOOM_MAX_REL, Math.max(this.kBase * ZOOM_MIN_REL, actual * factor));
    const razon = nuevo / actual;
    this.tx.set(px - (px - this.tx()) * razon);
    this.k.set(nuevo);
    this.limitarArrastre();
  }

  // Vertical: fijo (el mapa ya muestra todo el largo). Horizontal: libre pero con tope.
  private limitarArrastre(): void {
    const svg = this.svgRef()?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;
    const caja = svg.getBoundingClientRect();
    const k = this.k();
    const mx = Math.min(80, caja.width * 0.25);

    const txMin = mx - lim.maxX * k;
    const txMax = caja.width - mx - lim.minX * k;

    this.tx.set(Math.min(txMax, Math.max(txMin, this.tx())));
    this.ty.set(MARGEN - lim.minY * k);
  }

  // ───────────── Mouse y táctil ─────────────

  onWheel(e: WheelEvent): void {
    // Solo Ctrl + rueda hace zoom. La rueda sola baja la página.
    if (!e.ctrlKey) return;
    e.preventDefault();
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return;
    const caja = svg.getBoundingClientRect();
    this.zoomEn(e.clientX - caja.left, e.clientY - caja.top, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  onDown(e: PointerEvent): void {
    this.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.punteros.size === 1) {
      this.movido = false;
      this.acumulado = 0;
    } else if (this.punteros.size === 2) {
      this.movido = true;
      this.ultimaDistancia = this.distanciaDedos();
    }
  }

  onMove(e: PointerEvent): void {
    const previo = this.punteros.get(e.pointerId);
    if (!previo) return;
    const actual = { x: e.clientX, y: e.clientY };
    this.punteros.set(e.pointerId, actual);

    if (this.punteros.size === 1) {
      const dx = actual.x - previo.x;
      const dy = actual.y - previo.y;
      this.acumulado += Math.abs(dx) + Math.abs(dy);
      if (this.acumulado > 6) this.movido = true;
      if (this.movido) {
        this.tx.update((v) => v + dx);
        this.limitarArrastre();
      }
    } else if (this.punteros.size === 2) {
      const svg = this.svgRef()?.nativeElement;
      if (!svg) return;
      const caja = svg.getBoundingClientRect();
      const [a, b] = [...this.punteros.values()];
      const distancia = this.distanciaDedos();
      if (this.ultimaDistancia > 0 && distancia > 0) {
        const medioX = (a.x + b.x) / 2 - caja.left;
        const medioY = (a.y + b.y) / 2 - caja.top;
        this.zoomEn(medioX, medioY, distancia / this.ultimaDistancia);
      }
      this.ultimaDistancia = distancia;
    }
  }

  onUp(e: PointerEvent): void {
    this.punteros.delete(e.pointerId);
    if (this.punteros.size < 2) this.ultimaDistancia = 0;
    // Si quedó un dedo tras pellizcar, no cuenta como toque en una mesa
    if (this.punteros.size === 1) this.movido = true;
  }

  private distanciaDedos(): number {
    const [a, b] = [...this.punteros.values()];
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // ───────────── Mesas ─────────────

  clickMesa(m: MesaMapa): void {
    if (this.movido) return;
    if (m.estado === 'OCUPADO') return;
    this.seleccionar.emit(m);
  }

  // Igual que el editor: la mesa gira sobre su esquina superior izquierda
  rotar(m: MesaMapa): string {
    return `rotate(${m.rotacion || 0} ${m.x} ${m.y})`;
  }

  // Las mesas altas y angostas llevan el código girado para que se lea completo
  private textoVertical(m: MesaMapa): boolean {
    return m.alto > m.ancho * 1.3;
  }

  rotarTexto(m: MesaMapa): string | null {
    if (!this.textoVertical(m)) return null;
    return `rotate(-90 ${m.x + m.ancho / 2} ${m.y + m.alto / 2})`;
  }

  tamanoTexto(m: MesaMapa): number {
    const largo = Math.max(m.codigo.length, 1) * 0.68;
    if (this.textoVertical(m)) {
      return Math.max(4, Math.min(m.ancho * 0.55, (m.alto * 0.9) / largo));
    }
    return Math.max(4, Math.min(m.alto * 0.55, (m.ancho * 0.9) / largo));
  }

  private nombreCategoria(categoria: string): string {
    if (categoria === 'EMPRENDEDORES') return 'Emprendedores';
    if (categoria === 'COMIDA') return 'Comida';
    return 'Ilustradores';
  }

  private colorBase(categoria: string): string {
    if (categoria === 'EMPRENDEDORES') return '#F4C453';
    if (categoria === 'COMIDA') return '#D8C7F0';
    return '#FFFFFF';
  }

  relleno(m: MesaMapa): string {
    if (m.estado === 'OCUPADO') return '#D1D5DB';
    if (m.estado === 'MIA') return '#7B8E3D';
    return this.colorBase(m.categoria);
  }

  borde(m: MesaMapa): string {
    if (m.id === this.seleccionadaId()) return '#E85A4F';
    return m.estado === 'OCUPADO' ? '#9CA3AF' : '#2C221E';
  }

  colorTexto(m: MesaMapa): string {
    if (m.estado === 'MIA') return '#FFFFFF';
    return m.estado === 'OCUPADO' ? '#6B7280' : '#2C221E';
  }
}
