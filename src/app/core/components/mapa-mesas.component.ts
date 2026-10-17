import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { MesaMapa, SectorMapa } from '../services/reserva.service';

interface CategoriaLeyenda {
  clave: string;
  nombre: string;
  color: string;
}

@Component({
  selector: 'app-mapa-mesas',
  standalone: true,
  templateUrl: './mapa-mesas.component.html',
})
export class MapaMesasComponent {
  readonly sectores = input.required<SectorMapa[]>();
  readonly seleccionadaId = input<number | null>(null);
  readonly seleccionar = output<MesaMapa>();

  readonly sectorIdx = signal(0);
  readonly sectorActivo = computed(() => this.sectores()[this.sectorIdx()] ?? null);
  readonly stands = computed(() => this.sectorActivo()?.stands ?? []);

  // Plano original (en pantallas medianas se abre y cierra con un botón)
  readonly mostrarPlano = signal(false);
  readonly planoUrl = computed(() => this.planoDe(this.sectorActivo()?.nombre ?? ''));

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

  togglePlano(): void {
    this.mostrarPlano.update((v) => !v);
  }

  // ───────────── Plano original ─────────────

  private planoDe(nombre: string): string | null {
    const n = nombre.toLowerCase();
    if (n.includes('yuquin')) return '/images/planos/yuquin.png';
    if (n.includes('yuca')) return '/images/planos/yuca.png';
    if (n.includes('info')) return '/images/planos/infochan.png';
    if (n.includes('confet')) return '/images/planos/confeti.png';
    return null;
  }

  // ───────────── Vista ─────────────

  ajustar(): void {
    const svg = this.svgRef()?.nativeElement;
    const lista = this.stands();
    if (!svg || lista.length === 0) return;

    const caja = svg.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;

    const margen = 20;
    const minX = Math.min(...lista.map((m) => m.x)) - margen;
    const minY = Math.min(...lista.map((m) => m.y)) - margen;
    const maxX = Math.max(...lista.map((m) => m.x + m.ancho)) + margen;
    const maxY = Math.max(...lista.map((m) => m.y + m.alto)) + margen;
    const ancho = maxX - minX;
    const alto = maxY - minY;

    const nk = Math.min(8, Math.max(0.05, Math.min(caja.width / ancho, caja.height / alto)));
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
    const nuevo = Math.min(10, Math.max(0.05, actual * factor));
    const razon = nuevo / actual;
    this.tx.set(px - (px - this.tx()) * razon);
    this.ty.set(py - (py - this.ty()) * razon);
    this.k.set(nuevo);
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

  rotar(m: MesaMapa): string {
    return `rotate(${m.rotacion || 0} ${m.x + m.ancho / 2} ${m.y + m.alto / 2})`;
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