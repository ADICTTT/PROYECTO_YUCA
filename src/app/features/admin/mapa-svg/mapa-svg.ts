import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StandService, Stand } from '../../../core/services/stand.service';
import { PLANOS_RECT, RectPlano } from '../../../core/config/planos.config';

interface Limites {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Clave del plano según el id del sector
const CLAVES_SECTOR: Record<number, string> = {
  1: 'yuquin',
  2: 'yuca',
  3: 'infochan',
  4: 'confeti'
};

const MARGEN = 20;

@Component({
  selector: 'app-mapa-svg',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mapa-svg.html',
  styleUrls: ['./mapa-svg.css']
})
export class MapaSvg implements OnInit {
  @ViewChild('lienzo') lienzo?: ElementRef<SVGSVGElement>;

  sectores = [
    { id: 1, nombre: 'Salón de Yuquin' },
    { id: 2, nombre: 'Salón de Yuca' },
    { id: 3, nombre: 'Patio de Info-chan' },
    { id: 4, nombre: 'Patio de Confetti' }
  ];
  sectorActualId: number = 1;
  stands: Stand[] = [];
  standSeleccionado: Stand | null = null;

  readonly ZOOM_MIN = 0.3;
  readonly ZOOM_MAX = 2.5;
  readonly POS_MIN = -50;
  readonly POS_MAX = 1600;
  readonly ALTO_MIN = 420;
  readonly ALTO_MAX = 2400;

  zoom: number = 1;
  panX: number = 0;
  panY: number = 0;
  isDraggingCanvas: boolean = false;
  startX: number = 0;
  startY: number = 0;

  isDraggingStand: boolean = false;
  standArrastrando: Stand | null = null;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;

  // Plano de fondo (posición fija, igual que en el mapa de los artistas)
  verPlano = true;
  readonly opacidad = 0.5;

  // Para distinguir un clic de un arrastre en el fondo
  private movioElFondo = false;

  constructor(private standService: StandService) {}

  ngOnInit(): void {
    this.cargarStands();
  }

  cargarStands(): void {
    this.standService.getStandsBySector(this.sectorActualId).subscribe({
      next: (data) => {
        this.stands = data;
        setTimeout(() => this.ajustarVista(), 0);
      },
      error: (err) => console.error('Error al cargar stands', err)
    });
  }

  cambiarSector(sectorId: number): void {
    this.sectorActualId = sectorId;
    this.standSeleccionado = null;
    this.cargarStands();
  }

  obtenerColorCategoria(categoria: string): string {
    switch (categoria) {
      case 'COMIDA': return '#D9C2F0'; // Lila
      case 'EMPRENDEDORES': return '#F4C453'; // Amarillo
      case 'ILUSTRADORES': default: return '#FFFFFF'; // Blanco
    }
  }

  // ───────────── Texto de cada mesa (se ajusta a su cuadro) ─────────────

  // Las mesas altas y angostas llevan el código girado para que se lea completo
  textoVertical(stand: Stand): boolean {
    return Number(stand.alto) > Number(stand.ancho) * 1.3;
  }

  rotarTexto(stand: Stand): string | null {
    if (!this.textoVertical(stand)) return null;
    return `rotate(-90 ${Number(stand.ancho) / 2} ${Number(stand.alto) / 2})`;
  }

  tamanoTexto(stand: Stand): number {
    const ancho = Number(stand.ancho);
    const alto = Number(stand.alto);
    const largo = Math.max(String(stand.codigo || '').length, 1) * 0.68;
    if (this.textoVertical(stand)) {
      return Math.max(4, Math.min(ancho * 0.55, (alto * 0.9) / largo));
    }
    return Math.max(4, Math.min(alto * 0.55, (ancho * 0.9) / largo));
  }

  seleccionarStand(stand: Stand, event: MouseEvent): void {
    event.stopPropagation();
    this.standSeleccionado = stand;
  }

  quitarSeleccion(): void {
    this.standSeleccionado = null;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.quitarSeleccion();
  }

  // ───────────── Plano de fondo ─────────────

  get clave(): string {
    return CLAVES_SECTOR[this.sectorActualId] ?? '';
  }

  get planoUrl(): string | null {
    return this.clave ? `/images/planos/${this.clave}.png` : null;
  }

  get rectPlano(): RectPlano {
    return PLANOS_RECT[this.clave] ?? { x: 0, y: 0, w: 800, h: 600 };
  }

  alternarPlano(): void {
    this.verPlano = !this.verPlano;
  }

  // ───────────── Zoom y desplazamiento ─────────────

  private limites(): Limites | null {
    if (this.stands.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of this.stands) {
      const x = Number(s.posicionX), y = Number(s.posicionY);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + Number(s.ancho));
      maxY = Math.max(maxY, y + Number(s.alto));
    }
    if (this.verPlano && this.planoUrl) {
      const r = this.rectPlano;
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    return { minX, minY, maxX, maxY };
  }

  // Altura del lienzo: cubre todo el largo del mapa, y la página sigue bajando normal
  get alturaLienzo(): number {
    const lim = this.limites();
    if (!lim) return this.ALTO_MIN;
    const alto = (lim.maxY - lim.minY + MARGEN * 2) * this.zoom;
    return Math.min(this.ALTO_MAX, Math.max(this.ALTO_MIN, Math.round(alto)));
  }

  // Vertical: fijo (el lienzo ya muestra todo el largo). Horizontal: libre pero con tope.
  private limitarPan(): void {
    const svg = this.lienzo?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;
    const caja = svg.getBoundingClientRect();
    const k = this.zoom;
    const mx = Math.min(80, caja.width * 0.25);

    const xMin = mx - lim.maxX * k;
    const xMax = caja.width - mx - lim.minX * k;

    this.panX = Math.min(xMax, Math.max(xMin, this.panX));
    this.panY = MARGEN - lim.minY * k;
  }

  private zoomEn(px: number, factor: number): void {
    const actual = this.zoom;
    const nuevo = Math.min(this.ZOOM_MAX, Math.max(this.ZOOM_MIN, actual * factor));
    const razon = nuevo / actual;
    this.panX = px - (px - this.panX) * razon;
    this.zoom = nuevo;
    this.limitarPan();
  }

  onWheel(event: WheelEvent): void {
    // Solo Ctrl + rueda hace zoom. La rueda sola baja la página.
    if (!event.ctrlKey) return;
    event.preventDefault();
    const svg = this.lienzo?.nativeElement;
    if (!svg) return;
    const caja = svg.getBoundingClientRect();
    this.zoomEn(event.clientX - caja.left, event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  private zoomCentro(factor: number): void {
    const svg = this.lienzo?.nativeElement;
    if (!svg) return;
    const caja = svg.getBoundingClientRect();
    this.zoomEn(caja.width / 2, factor);
  }

  acercar(): void {
    this.zoomCentro(1.2);
  }

  alejar(): void {
    this.zoomCentro(1 / 1.2);
  }

  // Encaja el sector al ancho del lienzo
  ajustarVista(): void {
    const svg = this.lienzo?.nativeElement;
    const lim = this.limites();
    if (!svg || !lim) return;
    const caja = svg.getBoundingClientRect();
    if (caja.width === 0) return;

    const ancho = lim.maxX - lim.minX + MARGEN * 2;
    const k = Math.min(this.ZOOM_MAX, Math.max(this.ZOOM_MIN, caja.width / ancho));

    this.zoom = k;
    this.panX = (caja.width - ancho * k) / 2 - (lim.minX - MARGEN) * k;
    this.panY = MARGEN - lim.minY * k;
  }

  get zoomPorcentaje(): number {
    return Math.round(this.zoom * 100);
  }

  // ───────────── Arrastre del fondo ─────────────

  iniciarPan(event: MouseEvent): void {
    const el = event.target as Element;
    const esFondo = el.tagName === 'svg' || el.getAttribute('data-fondo') === 'true';
    if (!esFondo) return;

    this.isDraggingCanvas = true;
    this.movioElFondo = false;
    this.startX = event.clientX - this.panX;
    this.startY = event.clientY - this.panY;
  }

  moverPan(event: MouseEvent): void {
    if (this.isDraggingCanvas) {
      const nuevoX = event.clientX - this.startX;
      if (Math.abs(nuevoX - this.panX) > 2) {
        this.movioElFondo = true;
      }
      this.panX = nuevoX;
      this.limitarPan();
    } else if (this.isDraggingStand && this.standArrastrando) {
      const gridSize = 10;
      const x = (event.clientX - this.dragOffsetX - this.panX) / this.zoom;
      const y = (event.clientY - this.dragOffsetY - this.panY) / this.zoom;

      const gx = Math.round(x / gridSize) * gridSize;
      const gy = Math.round(y / gridSize) * gridSize;
      this.standArrastrando.posicionX = Math.min(this.POS_MAX, Math.max(this.POS_MIN, gx));
      this.standArrastrando.posicionY = Math.min(this.POS_MAX, Math.max(this.POS_MIN, gy));
    }
  }

  detenerArrastre(): void {
    // Un clic en el fondo (sin arrastrar) quita la selección
    if (this.isDraggingCanvas && !this.movioElFondo) {
      this.standSeleccionado = null;
    }
    this.isDraggingCanvas = false;
    this.isDraggingStand = false;
    this.standArrastrando = null;
  }

  // Si el mouse sale del lienzo, se corta cualquier arrastre
  cancelarArrastre(): void {
    this.isDraggingCanvas = false;
    this.isDraggingStand = false;
    this.standArrastrando = null;
  }

  iniciarArrastreStand(stand: Stand, event: MouseEvent): void {
    event.stopPropagation();
    this.isDraggingStand = true;
    this.standArrastrando = stand;
    this.standSeleccionado = stand;
    this.dragOffsetX = event.clientX - (Number(stand.posicionX) * this.zoom + this.panX);
    this.dragOffsetY = event.clientY - (Number(stand.posicionY) * this.zoom + this.panY);
  }

  // ───────────── Guardado ─────────────

  guardarLayout(): void {
    const layoutStands = this.stands.map(s => ({
      id: Number(s.id),
      posicionX: Number(s.posicionX),
      posicionY: Number(s.posicionY),
      ancho: Number(s.ancho),
      alto: Number(s.alto),
      rotacion: Number(s.rotacion)
    }));

    this.standService.updateLayout(this.sectorActualId, layoutStands).subscribe({
      next: () => alert('Layout guardado exitosamente'),
      error: (err) => alert('Error al guardar: ' + (err.error?.message || err.message))
    });
  }

  actualizarStandSeleccionado(): void {
    if (!this.standSeleccionado) return;

    // Forzar conversión a número para evitar que se envíen como string
    const standClean = {
      ...this.standSeleccionado,
      precio: Number(this.standSeleccionado.precio),
      ancho: Number(this.standSeleccionado.ancho),
      alto: Number(this.standSeleccionado.alto),
      rotacion: Number(this.standSeleccionado.rotacion),
      posicionX: Number(this.standSeleccionado.posicionX),
      posicionY: Number(this.standSeleccionado.posicionY)
    };

    this.standService.updateStand(standClean.id, standClean).subscribe({
      next: () => alert('Stand actualizado correctamente'),
      error: (err) => alert(err.error?.message || 'Error al actualizar')
    });
  }
}