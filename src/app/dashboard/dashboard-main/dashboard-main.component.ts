import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService, Perfil } from '../../core/services/profile.service';

@Component({
  selector: 'app-dashboard-main',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-main.component.html'
})
export class DashboardMainComponent implements OnInit {
  private profileService = inject(ProfileService);

  perfiles: Perfil[] = [];
  filtroEstado: string = '';
  perfilSeleccionado: Perfil | null = null;
  isModalOpen = false;

  ngOnInit(): void {
    this.cargarPerfiles();
  }

  cargarPerfiles(): void {
    this.profileService.getPerfiles(this.filtroEstado).subscribe({
      next: (data) => (this.perfiles = data),
      error: (err) => console.error('Error al cargar perfiles', err),
    });
  }

  filtrarPor(estado: string): void {
    this.filtroEstado = estado;
    this.cargarPerfiles();
  }

  abrirDetalle(perfil: Perfil): void {
    this.perfilSeleccionado = { ...perfil };
    this.isModalOpen = true;
  }

  cerrarModal(): void {
    this.isModalOpen = false;
    this.perfilSeleccionado = null;
  }

  guardarCambios(): void {
    if (!this.perfilSeleccionado) return;
    
    const id = this.perfilSeleccionado.id;
    this.profileService.updatePerfil(id, this.perfilSeleccionado).subscribe({
      next: () => {
        alert('Perfil actualizado correctamente');
        this.cargarPerfiles();
        this.cerrarModal();
      },
      error: () => alert('Error al actualizar el perfil'),
    });
  }

  actualizarEstadoDirecto(id: number, nuevoEstado: string): void {
    this.profileService.cambiarEstado(id, nuevoEstado).subscribe({
      next: () => this.cargarPerfiles(),
      error: () => alert('No se pudo cambiar el estado'),
    });
  }

  getWhatsAppLink(celular: string): string {
    const telefonoLimpiado = celular.replace(/\D/g, '');
    const mensaje = encodeURIComponent('Hola! Te contactamos desde la administración respecto a tu postulación.');
    return `https://wa.me/${telefonoLimpiado}?text=${mensaje}`;
  }
}