import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StandService, Stand } from '../../../core/services/stand.service';

@Component({
  selector: 'app-mapa-svg',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './mapa-svg.html',
  styleUrls: ['./mapa-svg.css']
})
export class MapaSvg implements OnInit {
  sectores = [
    { id: 1, nombre: 'Salón de Yuquin' },
    { id: 2, nombre: 'Salón de Yuca' },
    { id: 3, nombre: 'Patio de Info-chan' },
    { id: 4, nombre: 'Patio de Confetti' }
  ];
  sectorActualId: number = 1;
  stands: Stand[] = [];
  standSeleccionado: Stand | null = null;

  readonly ZOOM_MIN = 0.2;
  readonly ZOOM_MAX = 3;

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

  // Para distinguir un clic de un arrastre en el fondo
  private movioElFondo = false;

  constructor(private standService: StandService) {}

  ngOnInit(): void {
    this.cargarStands();
  }

  cargarStands(): void {
    this.standService.getStandsBySector(this.sectorActualId).subscribe({
      next: (data) => this.stands = data,
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

  // ───────────── Zoom y desplazamiento ─────────────

  onWheel(event: WheelEvent): void {
    event.preventDefault();

    // Ctrl + rueda: zoom. Rueda sola: desplazar el plano.
    if (event.ctrlKey) {
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.zoom = Math.min(this.ZOOM_MAX, Math.max(this.ZOOM_MIN, this.zoom * factor));
    } else {
      this.panX -= event.deltaX;
      this.panY -= event.deltaY;
    }
  }

  acercar(): void {
    this.zoom = Math.min(this.ZOOM_MAX, this.zoom * 1.2);
  }

  alejar(): void {
    this.zoom = Math.max(this.ZOOM_MIN, this.zoom / 1.2);
  }

  ajustarVista(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
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
      const nuevoY = event.clientY - this.startY;
      if (Math.abs(nuevoX - this.panX) > 2 || Math.abs(nuevoY - this.panY) > 2) {
        this.movioElFondo = true;
      }
      this.panX = nuevoX;
      this.panY = nuevoY;
    } else if (this.isDraggingStand && this.standArrastrando) {
      const gridSize = 10;
      const x = (event.clientX - this.dragOffsetX - this.panX) / this.zoom;
      const y = (event.clientY - this.dragOffsetY - this.panY) / this.zoom;

      this.standArrastrando.posicionX = Math.round(x / gridSize) * gridSize;
      this.standArrastrando.posicionY = Math.round(y / gridSize) * gridSize;
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
    this.dragOffsetX = event.clientX - (stand.posicionX * this.zoom + this.panX);
    this.dragOffsetY = event.clientY - (stand.posicionY * this.zoom + this.panY);
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