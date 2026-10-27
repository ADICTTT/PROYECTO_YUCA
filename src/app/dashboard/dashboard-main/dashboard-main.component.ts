import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProfileService, Perfil } from '../../core/services/profile.service';
import { environment } from 'src/environments/environment';
import html2canvas from 'html2canvas-pro';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard-main',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './dashboard-main.component.html'
})
export class DashboardMainComponent implements OnInit {
  private profileService = inject(ProfileService);

  perfiles: Perfil[] = [];
  perfilesFiltrados: Perfil[] = [];
  filtroEstado: string = '';
  perfilSeleccionado: Perfil | null = null;
  isModalOpen = false;

  // Buscador y detección de perfiles repetidos
  buscar = '';
  infoRepetido = new Map<number, { total: number; esUltimo: boolean }>();

  // Propiedades nuevas para manejar la previsualización y el archivo seleccionado
  imagenPreview: string | null = null;
  selectedFile: File | null = null;
  // Modal de credenciales
  credencialesModal: {
    usuario: string;
    password: string;
    celular: string;
    nombre: string;
    esReset?: boolean;
  } | null = null;

  private readonly fileBase = new URL(environment.apiUrl).origin;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);


  // Variable para guardar el perfil que se quiere eliminar (si es null, el modal está cerrado)
  perfilAEliminar: any = null;

  // Método que abre la confirmación (lo llama el botón de la tabla)
  confirmarEliminacion(perfil: any) {
    this.perfilAEliminar = perfil;
  }

  // Método que cancela y cierra el modal
  cancelarEliminacion() {
    this.perfilAEliminar = null;
  }

  // Método que ejecuta la eliminación real
  ejecutarEliminacion() {
    if (!this.perfilAEliminar) return;

    this.profileService.eliminarPerfil(this.perfilAEliminar.id).subscribe({
      next: () => {
        this.perfilAEliminar = null; // Cerramos el modal
        this.cargarPerfiles(); // Recargamos la lista
      },
      error: (error) => {
        console.error('Error al eliminar el perfil', error);
      }
    });
  }
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
      next: (data) => {
        this.perfiles = data;
        this.aplicarFiltro();
      },
      error: (err) => console.error('Error al cargar perfiles', err),
    });
  }

  filtrarPor(estado: string): void {
    this.filtroEstado = estado;
    this.cargarPerfiles();
  }

  // ---------- Buscador y repetidos ----------

  private normalizar(valor: unknown): string {
    return String(valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private soloDigitos(valor: unknown): string {
    return String(valor ?? '').replace(/\D/g, '');
  }

  private claveInstagram(valor: unknown): string {
    return this.normalizar(valor).replace(/[@\s]/g, '');
  }

  private clavesDe(p: Perfil): string[] {
    const claves: string[] = [];
    const cel = this.soloDigitos(p.celular);
    if (cel.length >= 6) claves.push('c:' + cel);
    const ig = this.claveInstagram(p.instagram);
    if (ig) claves.push('i:' + ig);
    const nom = this.normalizar(p.nombreComercial);
    if (nom) claves.push('n:' + nom);
    return claves;
  }

  aplicarFiltro(): void {
    // 1) Detectar repetidos (comparten celular, Instagram o nombre comercial)
    const porClave = new Map<string, number[]>();
    for (const p of this.perfiles) {
      for (const k of this.clavesDe(p)) {
        const lista = porClave.get(k) ?? [];
        lista.push(p.id);
        porClave.set(k, lista);
      }
    }

    this.infoRepetido = new Map();
    for (const p of this.perfiles) {
      const grupo = new Set<number>([p.id]);
      for (const k of this.clavesDe(p)) {
        for (const id of porClave.get(k) ?? []) grupo.add(id);
      }
      if (grupo.size > 1) {
        const maxId = Math.max(...Array.from(grupo));
        this.infoRepetido.set(p.id, { total: grupo.size, esUltimo: p.id === maxId });
      }
    }

    // 2) Buscar
    const q = this.normalizar(this.buscar).replace(/^@/, '');
    const qDigitos = this.soloDigitos(this.buscar);

    const lista = this.perfiles.filter((p) => {
      if (!q) return true;
      const texto = [
        this.normalizar(p.nombreComercial),
        this.normalizar(p.nombreReal),
        this.claveInstagram(p.instagram),
        this.normalizar(p.celular),
      ].join(' ');
      if (texto.includes(q)) return true;
      return qDigitos.length >= 3 && this.soloDigitos(p.celular).includes(qDigitos);
    });

    // 3) Más reciente primero
    this.perfilesFiltrados = [...lista].sort((a, b) => b.id - a.id);
  }

  limpiarBusqueda(): void {
    this.buscar = '';
    this.aplicarFiltro();
  }

  verRepetidos(p: Perfil): void {
    // Prioridad: celular, luego Instagram, luego nombre comercial
    const cel = this.soloDigitos(p.celular);
    if (cel.length >= 6) {
      this.buscar = cel;
    } else if (p.instagram) {
      this.buscar = this.claveInstagram(p.instagram);
    } else {
      this.buscar = p.nombreComercial;
    }
    this.aplicarFiltro();
  }

  // ---------- Resto del panel ----------

  irAlMapa(): void {
    this.router.navigate(['./mapa']);
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

  restablecerCredenciales(p: any): void {
    const ok = confirm(
      `¿Restablecer las credenciales de ${p.nombreComercial}? Su contraseña actual dejará de funcionar.`,
    );
    if (!ok) return;

    this.auth.restablecerCredenciales(p.id).subscribe({
      next: (res: { nombre: string; usuario: string; password: string }) => {
        this.credencialesModal = {
          nombre: res.nombre,
          usuario: res.usuario,
          password: res.password,
          celular: p.celular,
          esReset: true,
        };
      },
      error: (err: any) => alert(err.error?.message || 'No se pudo restablecer'),
    });
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

    const mensaje = c.esReset
      ? `Hola ${c.nombre}, restablecimos tus credenciales de Proyecto Yuca.\n\n` +
      `Usuario: ${c.usuario}\n` +
      `Contraseña: ${c.password}\n\n` +
      `Al ingresar, el sistema te pedirá crear una contraseña nueva.`
      : `¡Hola ${c.nombre}! Tu perfil en Proyecto Yuca fue aprobado 🎉\n\n` +
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