import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService, Perfil } from '../../core/services/profile.service';
import { environment } from 'src/environments/environment';
import html2canvas from 'html2canvas-pro';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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

  // Propiedades nuevas para manejar la previsualización y el archivo seleccionado
  imagenPreview: string | null = null;
  selectedFile: File | null = null;
    // Modal de credenciales
  credencialesModal: { usuario: string; password: string; celular: string; nombre: string } | null = null;

  private readonly fileBase = new URL(environment.apiUrl).origin;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  cerrarSesion(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
  readonly PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#e5e7eb"/><text x="50%" y="50%" fill="#9ca3af" font-size="14" text-anchor="middle" dy=".3em">Sin foto</text></svg>'
    );

  get fotoActual(): string {
    if (this.selectedFile && this.imagenPreview) return this.imagenPreview;
    const url = this.perfilSeleccionado?.fotoUrl;
    if (!url) return this.PLACEHOLDER;
    return url.startsWith('http') ? url : this.fileBase + url;
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).src = this.PLACEHOLDER;
  }

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
    this.imagenPreview = null;
    this.selectedFile = null;
    this.isModalOpen = true;
  }

  cerrarModal(): void {
    this.isModalOpen = false;
    this.perfilSeleccionado = null;
    this.imagenPreview = null;
    this.selectedFile = null;
  }

  // Método para capturar el archivo cuando se selecciona una nueva imagen en el modal
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.imagenPreview = URL.createObjectURL(file);
    }
  }

  guardarCambios(): void {
    if (!this.perfilSeleccionado) return;
    
    const id = this.perfilSeleccionado.id;

    // Si se seleccionó una nueva foto, enviamos FormData; de lo contrario, enviamos el objeto JSON normal
    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('nombreComercial', this.perfilSeleccionado.nombreComercial);
      formData.append('nombreReal', this.perfilSeleccionado.nombreReal);
      formData.append('celular', this.perfilSeleccionado.celular);
      formData.append('instagram', this.perfilSeleccionado.instagram || '');
      if (this.perfilSeleccionado.portafolioUrl) {
        formData.append('portafolioUrl', this.perfilSeleccionado.portafolioUrl);
      }
      if (this.perfilSeleccionado.descripcion) {
        formData.append('descripcion', this.perfilSeleccionado.descripcion);
      }
      formData.append('estado', this.perfilSeleccionado.estado);
      formData.append('file', this.selectedFile);

      this.profileService.updatePerfilWithFile(id, formData).subscribe({
        next: () => {
          alert('Perfil y foto actualizados correctamente');
          this.cargarPerfiles();
          this.cerrarModal();
        },
        error: () => alert('Error al actualizar el perfil con la imagen'),
      });
    } else {
      this.profileService.updatePerfil(id, this.perfilSeleccionado).subscribe({
        next: () => {
          alert('Perfil actualizado correctamente');
          this.cargarPerfiles();
          this.cerrarModal();
        },
        error: () => alert('Error al actualizar el perfil'),
      });
    }
  }

  actualizarEstadoDirecto(id: number, nuevoEstado: string): void {
    const perfil = this.perfiles.find((p) => p.id === id);

    this.profileService.cambiarEstado(id, nuevoEstado).subscribe({
      next: (res) => {
        if (res.credenciales && perfil) {
          this.credencialesModal = {
            usuario: res.credenciales.usuario,
            password: res.credenciales.password,
            celular: perfil.celular,
            nombre: perfil.nombreComercial,
          };
        }
        this.cargarPerfiles();
      },
      error: () => alert('No se pudo cambiar el estado'),
    });
  }

  cerrarCredenciales(): void {
    this.credencialesModal = null;
  }

  getWhatsAppCredencialesLink(): string {
    const c = this.credencialesModal;
    if (!c) return '#';
    const telefono = c.celular.replace(/\D/g, '');
    const mensaje =
      `¡Hola ${c.nombre}! Tu perfil en Proyecto Yuca fue aprobado 🎉\n\n` +
      `Ya puedes ingresar al sistema para elegir tu mesa:\n` +
      `Usuario: ${c.usuario}\n` +
      `Contraseña: ${c.password}\n\n` +
      `Por seguridad, cambia tu contraseña al ingresar. ` +
      `Síguenos también en el canal oficial para enterarte de las novedades.`;
    return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
  }

  // Método para exportar la credencial en PNG transparente
  async downloadCredentialPNG(): Promise<void> {
    const element = document.getElementById('credential-export-node');
    if (!element) {
      console.error('No se encontró credential-export-node');
      return;
    }

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: null,   // html2canvas 1.x (PNG transparente)
        useCORS: true,
        scale: 2,
      } as any);

      const link = document.createElement('a');
      link.download = `credencial-${this.perfilSeleccionado?.nombreComercial || 'artista'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Error generando la credencial:', e);
      alert('No se pudo generar la credencial. Revisa la consola (F12).');
    }
  }

  getWhatsAppLink(celular: string): string {
    const telefonoLimpiado = celular.replace(/\D/g, '');
    const mensaje = encodeURIComponent('Hola! Te contactamos desde la administración respecto a tu postulación.');
    return `https://wa.me/${telefonoLimpiado}?text=${mensaje}`;
  }
}