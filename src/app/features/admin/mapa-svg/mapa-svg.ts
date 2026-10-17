import { Component, OnInit } from '@angular/core';
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

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const zoomFactor = 1.1;
    if (event.deltaY < 0) {
      this.zoom = Math.min(this.zoom * zoomFactor, 3);
    } else {
      this.zoom = Math.max(this.zoom / zoomFactor, 0.5);
    }
  }

  iniciarPan(event: MouseEvent): void {
    if ((event.target as HTMLElement).tagName === 'svg') {
      this.isDraggingCanvas = true;
      this.startX = event.clientX - this.panX;
      this.startY = event.clientY - this.panY;
    }
  }

  moverPan(event: MouseEvent): void {
    if (this.isDraggingCanvas) {
      this.panX = event.clientX - this.startX;
      this.panY = event.clientY - this.startY;
    } else if (this.isDraggingStand && this.standArrastrando) {
      const gridSize = 10;
      const x = (event.clientX - this.dragOffsetX - this.panX) / this.zoom;
      const y = (event.clientY - this.dragOffsetY - this.panY) / this.zoom;

      this.standArrastrando.posicionX = Math.round(x / gridSize) * gridSize;
      this.standArrastrando.posicionY = Math.round(y / gridSize) * gridSize;
    }
  }

  detenerArrastre(): void {
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