import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
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

  // Elementos fijos del plano (iguales a los del editor de administración)
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

  // Posición y tamaño del plano dentro del mapa
  readonly rectPlano = computed<RectPlano>(() => {
    const c = this.claveSector();
    const guardado = this.ajustes()[c] ?? PLANOS_RECT[c];
    if (guardado) return guardado;
    const lim = this.limites();
    if (!lim) return { x: 0, y: 0, w: 100, h: 100 };
    const m = 30;
    return { x: lim.minX - m, y: lim.minY - m, w: lim.maxX - lim.minX + m * 2, h: lim.maxY - lim.minY + m * 2 };
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

  // Escala de la vista "ver todo": sirve de base para los límites del zoom
  private kBase = 1;

  // Área que ocupa todo el contenido del sector (mesas + elementos fijos)
  private readonly limites = computed<Limites | null>(() => {
    const lista = this.stands();
    if (lista.length === 0) return null;
    let minX = Math.min(...lista.map((m) => m.x));
    let minY = Math.min(...lista.map((m) => m.y));
    let maxX = Math.max(...lista.map((m) => m.x + m.ancho));
    let maxY = Math.max(...lista.map((m) => m.y + m.alto));

    const incluir = (x1: number, y1: number, x2: number, y2: number) => {
      minX = Math.min(minX, x1);
      minY = Math.min(minY, y1);
      maxX = Math.max(maxX, x2);
      maxY = Math.max(maxY, y2);
    };

    
    return { minX, minY, maxX, maxY };
  });

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

  cambiarSector(i: number): void {
    this.sectorIdx.set(i);
  }

  alternarMover(): void {
    this.moverMapa.update((v) => !v);
  }

  alternarPlano(): void {
    this.verPlano.update((v) => !v);
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

  ajustar(): void {
    const svg = this.svgRef()?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;

    const caja = svg.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;

    const margen = 20;
    const minX = lim.minX - margen;
    const minY = lim.minY - margen;
    const ancho = lim.maxX + margen - minX;
    const alto = lim.maxY + margen - minY;

    const nk = Math.max(0.05, Math.min(caja.width / ancho, caja.height / alto));
    this.kBase = nk;
    this.k.set(nk);
    this.tx.set((caja.width - ancho * nk) / 2 - minX * nk);
    this.ty.set((caja.height - alto * nk) / 2 - minY * nk);
  }

  zoomBoton(factor: number): void {
    const svg = this.svgRef()?.nativeElement;
    if (!svg) return;
    const caja = svg.getBoundingClientRect();
    this.zoomEn(caja.width / 2, caja.height / 2, factor);
  }

  private zoomEn(px: number, py: number, factor: number): void {
    const actual = this.k();
    const nuevo = Math.min(this.kBase * ZOOM_MAX_REL, Math.max(this.kBase * ZOOM_MIN_REL, actual * factor));
    const razon = nuevo / actual;
    this.tx.set(px - (px - this.tx()) * razon);
    this.ty.set(py - (py - this.ty()) * razon);
    this.k.set(nuevo);
    this.limitarArrastre();
  }

  // Evita que el mapa se pierda de vista: siempre queda una parte visible
  private limitarArrastre(): void {
    const svg = this.svgRef()?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;
    const caja = svg.getBoundingClientRect();
    const k = this.k();
    const mx = Math.min(80, caja.width * 0.25);
    const my = Math.min(80, caja.height * 0.25);

    const txMin = mx - lim.maxX * k;
    const txMax = caja.width - mx - lim.minX * k;
    const tyMin = my - lim.maxY * k;
    const tyMax = caja.height - my - lim.minY * k;

    this.tx.set(Math.min(txMax, Math.max(txMin, this.tx())));
    this.ty.set(Math.min(tyMax, Math.max(tyMin, this.ty())));
  }

  // ───────────── Mouse y táctil ─────────────

  onWheel(e: WheelEvent): void {
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
        this.ty.update((v) => v + dy);
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