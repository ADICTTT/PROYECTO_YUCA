import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { StandService, Stand } from '../../../core/services/stand.service';
import { PLANOS_RECT, RectPlano } from '../../../core/config/planos.config';

interface Limites {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface PosicionInicial {
  stand: Stand;
  x: number;
  y: number;
}

// Clave del plano según el id del sector
const CLAVES_SECTOR: Record<number, string> = {
  1: 'yuquin',
  2: 'yuca',
  3: 'infochan',
  4: 'confeti'
};

const MARGEN = 20;

// Unidades del mapa por cada cm real (200 cm = 60 unidades). Cámbiala cuando tengas el mapa escalado.
const ESCALA = 0.3;
const TAM_MIN = 15;

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

  // Mesas seleccionadas (1 = edición individual, 2 o más = cambio masivo)
  seleccion: Stand[] = [];

  // En celular: true = cada toque agrega o quita mesas de la selección
  modoSeleccion = false;

  // Medidas reales de la mesa seleccionada (cm)
  medidaLargo: number | null = null;
  medidaAncho: number | null = null;
  private mesaVertical = false;

  // Campos del cambio masivo (vacío = no cambiar)
  masivo = this.masivoVacio();

  // En celular: true = el dedo arrastra mesas; false = el dedo desplaza la página
  modoMesas = false;

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

  // Arrastre de mesas (una o varias)
  isDraggingStand: boolean = false;
  private arrastrados: PosicionInicial[] = [];
  private inicioClienteX = 0;
  private inicioClienteY = 0;
  private movioStand = false;
  private standClic: Stand | null = null;

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
        this.seleccion = [];
        this.alCambiarSeleccion();
        setTimeout(() => this.ajustarVista(), 0);
      },
      error: (err) => console.error('Error al cargar stands', err)
    });
  }

  cambiarSector(sectorId: number): void {
    this.sectorActualId = sectorId;
    this.seleccion = [];
    this.alCambiarSeleccion();
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

  // ───────────── Selección (una o varias) ─────────────

  // Mesa en edición individual (solo cuando hay exactamente 1 seleccionada)
  get standSeleccionado(): Stand | null {
    return this.seleccion.length === 1 ? this.seleccion[0] : null;
  }

  estaSeleccionada(stand: Stand): boolean {
    return this.seleccion.includes(stand);
  }

  private alternarSeleccion(stand: Stand): void {
    if (this.estaSeleccionada(stand)) {
      this.seleccion = this.seleccion.filter(s => s !== stand);
    } else {
      this.seleccion = [...this.seleccion, stand];
    }
    this.alCambiarSeleccion();
  }

  // Al quedar una sola mesa, carga sus medidas reales en el panel
  private alCambiarSeleccion(): void {
    const s = this.standSeleccionado;
    if (!s) {
      this.medidaLargo = null;
      this.medidaAncho = null;
      return;
    }
    this.mesaVertical = Number(s.alto) > Number(s.ancho);

    // Lee "200 × 90 cm" si ya estaba guardado
    const m = String(s.medidas ?? '').match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
    if (m) {
      this.medidaLargo = Number(m[1].replace(',', '.'));
      this.medidaAncho = Number(m[2].replace(',', '.'));
    } else {
      this.medidaLargo = null;
      this.medidaAncho = null;
    }
  }

  quitarSeleccion(): void {
    this.seleccion = [];
    this.alCambiarSeleccion();
  }

  seleccionarTodas(): void {
    this.seleccion = [...this.stands];
    this.alCambiarSeleccion();
  }

  alternarModoSeleccion(): void {
    this.modoSeleccion = !this.modoSeleccion;
  }

  // Recalcula el dibujo a partir de las medidas reales
  recalcularDibujo(): void {
    const s = this.standSeleccionado;
    const largo = Number(this.medidaLargo);
    const ancho = Number(this.medidaAncho);
    if (!s || !(largo > 0) || !(ancho > 0)) return;

    const a = Math.max(TAM_MIN, Math.round(largo * ESCALA));
    const b = Math.max(TAM_MIN, Math.round(ancho * ESCALA));
    if (this.mesaVertical) {
      s.ancho = b;
      s.alto = a;
    } else {
      s.ancho = a;
      s.alto = b;
    }
  }

  alternarModoMesas(): void {
    this.modoMesas = !this.modoMesas;
  }

  irAlPanel(): void {
    document.getElementById('panel-mesa')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // ───────────── Arrastre (mouse y dedo, con eventos de puntero) ─────────────

  private capturar(event: PointerEvent): void {
    try {
      this.lienzo?.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      /* si el navegador no puede capturar, el arrastre sigue funcionando dentro del lienzo */
    }
  }

  iniciarPan(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const el = event.target as Element;
    const esFondo = el.tagName === 'svg' || el.getAttribute('data-fondo') === 'true';
    if (!esFondo) return;

    this.isDraggingCanvas = true;
    this.movioElFondo = false;
    this.startX = event.clientX - this.panX;
    this.startY = event.clientY - this.panY;
    this.capturar(event);
  }

  moverPuntero(event: PointerEvent): void {
    if (this.isDraggingCanvas) {
      const nuevoX = event.clientX - this.startX;
      if (Math.abs(nuevoX - this.panX) > 2) {
        this.movioElFondo = true;
      }
      this.panX = nuevoX;
      this.limitarPan();
    } else if (this.isDraggingStand && this.arrastrados.length > 0) {
      const gridSize = 1;
      const dxPantalla = event.clientX - this.inicioClienteX;
      const dyPantalla = event.clientY - this.inicioClienteY;
      if (Math.abs(dxPantalla) > 3 || Math.abs(dyPantalla) > 3) {
        this.movioStand = true;
      }
      const dx = dxPantalla / this.zoom;
      const dy = dyPantalla / this.zoom;

      // Todas las mesas seleccionadas se mueven juntas
      for (const a of this.arrastrados) {
        const gx = Math.round((a.x + dx) / gridSize) * gridSize;
        const gy = Math.round((a.y + dy) / gridSize) * gridSize;
        a.stand.posicionX = Math.min(this.POS_MAX, Math.max(this.POS_MIN, gx));
        a.stand.posicionY = Math.min(this.POS_MAX, Math.max(this.POS_MIN, gy));
      }
    }
  }

  detenerArrastre(): void {
    // Un clic en el fondo (sin arrastrar) quita la selección
    if (this.isDraggingCanvas && !this.movioElFondo) {
      this.quitarSeleccion();
    }
    // Un clic (sin arrastrar) sobre una mesa de un grupo deja solo esa mesa
    if (this.isDraggingStand && !this.movioStand && this.standClic && this.seleccion.length > 1) {
      this.seleccion = [this.standClic];
      this.alCambiarSeleccion();
    }
    this.cancelarArrastre();
  }

  // Corta cualquier arrastre (también cuando el navegador toma el gesto para desplazar la página)
  cancelarArrastre(): void {
    this.isDraggingCanvas = false;
    this.isDraggingStand = false;
    this.arrastrados = [];
    this.standClic = null;
  }

  iniciarArrastreStand(stand: Stand, event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();

    // Ctrl / Shift / Cmd + clic, o modo "Selección múltiple": agrega o quita sin arrastrar
    const multiple = event.ctrlKey || event.shiftKey || event.metaKey || this.modoSeleccion;
    if (multiple) {
      this.alternarSeleccion(stand);
      return;
    }

    // Clic normal: si la mesa no estaba seleccionada, pasa a ser la única seleccionada
    if (!this.estaSeleccionada(stand)) {
      this.seleccion = [stand];
      this.alCambiarSeleccion();
    }

    // Con el dedo, solo se arrastra si "Mover mesas" está encendido
    if (event.pointerType === 'touch' && !this.modoMesas) return;

    this.isDraggingStand = true;
    this.movioStand = false;
    this.standClic = stand;
    this.inicioClienteX = event.clientX;
    this.inicioClienteY = event.clientY;
    this.arrastrados = this.seleccion.map(s => ({
      stand: s,
      x: Number(s.posicionX),
      y: Number(s.posicionY)
    }));
    this.capturar(event);
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

    const largo = Number(this.medidaLargo);
    const ancho = Number(this.medidaAncho);
    const tieneMedidas = largo > 0 && ancho > 0;
    if (tieneMedidas) this.recalcularDibujo();

    const s = this.standSeleccionado;
    const sillas = s.sillas === null || s.sillas === undefined || (s.sillas as any) === ''
      ? null
      : Number(s.sillas);
    const descripcion = String(s.descripcion ?? '').trim().slice(0, 300) || null;

    // Forzar conversión a número para evitar que se envíen como string
    const standClean = {
      ...s,
      precio: Number(s.precio),
      ancho: Number(s.ancho),
      alto: Number(s.alto),
      rotacion: Number(s.rotacion),
      posicionX: Number(s.posicionX),
      posicionY: Number(s.posicionY),
      sillas,
      incluyeMerienda: !!s.incluyeMerienda,
      bajoTecho: !!s.bajoTecho,
      descripcion,
      medidas: tieneMedidas ? `${largo} × ${ancho} cm` : (s.medidas ?? null)
    };

    this.standService.updateStand(standClean.id, standClean).subscribe({
      next: () => {
        s.medidas = standClean.medidas;
        s.sillas = standClean.sillas;
        s.incluyeMerienda = standClean.incluyeMerienda;
        s.bajoTecho = standClean.bajoTecho;
        s.descripcion = standClean.descripcion;
        alert('Stand actualizado correctamente');
      },
      error: (err) => alert(err.error?.message || 'Error al actualizar')
    });
  }

  // ───────────── Cambio masivo ─────────────

  private masivoVacio() {
    return {
      precio: null as number | null,
      categoria: '' as '' | 'ILUSTRADORES' | 'EMPRENDEDORES' | 'COMIDA',
      largo: null as number | null,
      ancho: null as number | null,
      sillas: null as number | null,
      merienda: '' as '' | 'si' | 'no',
      bajoTecho: '' as '' | 'si' | 'no',
      rotacion: null as number | null
    };
  }

  private lleno(valor: number | null): boolean {
    return valor !== null && valor !== undefined && (valor as any) !== '' && !isNaN(Number(valor));
  }

  limpiarMasivo(): void {
    this.masivo = this.masivoVacio();
  }

  aplicarMasivo(): void {
    const destino = [...this.seleccion];
    if (destino.length < 2) return;

    const m = this.masivo;
    const hayLargo = this.lleno(m.largo);
    const hayAncho = this.lleno(m.ancho);

    if (hayLargo !== hayAncho) {
      alert('Para cambiar el tamaño llena Largo y Ancho juntos.');
      return;
    }
    if ((hayLargo && Number(m.largo) <= 0) || (hayAncho && Number(m.ancho) <= 0)) {
      alert('Largo y Ancho deben ser mayores a 0.');
      return;
    }
    if (this.lleno(m.precio) && Number(m.precio) < 0) {
      alert('El precio no puede ser negativo.');
      return;
    }
    if (this.lleno(m.sillas) && Number(m.sillas) < 0) {
      alert('Las sillas no pueden ser negativas.');
      return;
    }

    const hayAlgo = this.lleno(m.precio) || m.categoria !== '' || hayLargo
      || this.lleno(m.sillas) || m.merienda !== '' || m.bajoTecho !== '' || this.lleno(m.rotacion);
    if (!hayAlgo) {
      alert('Llena al menos un campo para aplicar.');
      return;
    }

    if (!confirm(`¿Aplicar estos cambios a ${destino.length} mesas?`)) return;

    const peticiones = destino.map(s => {
      const cambios: Partial<Stand> = {};

      if (this.lleno(m.precio)) cambios.precio = Number(m.precio);
      if (m.categoria !== '') cambios.categoria = m.categoria;
      if (this.lleno(m.sillas)) cambios.sillas = Number(m.sillas);
      if (m.merienda !== '') cambios.incluyeMerienda = m.merienda === 'si';
      if (m.bajoTecho !== '') cambios.bajoTecho = m.bajoTecho === 'si';
      if (this.lleno(m.rotacion)) cambios.rotacion = Number(m.rotacion);

      if (hayLargo) {
        const largo = Number(m.largo);
        const ancho = Number(m.ancho);
        const a = Math.max(TAM_MIN, Math.round(largo * ESCALA));
        const b = Math.max(TAM_MIN, Math.round(ancho * ESCALA));
        const vertical = Number(s.alto) > Number(s.ancho);
        cambios.ancho = vertical ? b : a;
        cambios.alto = vertical ? a : b;
        cambios.medidas = `${largo} × ${ancho} cm`;
      }

      return this.standService.updateStand(Number(s.id), cambios).pipe(
        map(() => ({ s, cambios, ok: true })),
        catchError(() => of({ s, cambios, ok: false }))
      );
    });

    forkJoin(peticiones).subscribe(resultados => {
      let fallidas = 0;
      for (const r of resultados) {
        if (r.ok) {
          Object.assign(r.s, r.cambios);
        } else {
          fallidas++;
        }
      }
      if (fallidas === 0) {
        alert(`Cambios aplicados a ${resultados.length} mesas`);
        this.limpiarMasivo();
      } else {
        alert(`Se aplicaron ${resultados.length - fallidas} de ${resultados.length} mesas. Fallaron ${fallidas}; revisa la consola o vuelve a intentar.`);
      }
    });
  }
}