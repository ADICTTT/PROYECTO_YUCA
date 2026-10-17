import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Perfil, ProfileService } from '../../../core/services/profile.service';

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-mi-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './mi-panel.component.html',
})
export class MiPanelComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly perfilService = inject(ProfileService);

  readonly canalUrl = 'https://whatsapp.com/channel/0029Vb20xSb4NVie43lyiB1z';
  readonly whatsappSoporte = 'https://wa.me/59162986390';

  readonly perfil = signal<Perfil | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');

  // Cambio de foto
  readonly archivoNuevo = signal<File | null>(null);
  readonly vistaPrevia = signal<string | null>(null);
  readonly subiendo = signal(false);
  readonly mensajeFoto = signal('');
  readonly errorFoto = signal('');

  readonly categoriaSingular = computed(() => {
    switch (this.perfil()?.categoria) {
      case 'ILUSTRADORES':
        return 'Ilustrador';
      case 'EMPRENDEDORES':
        return 'Emprendedor';
      case 'COMIDA':
        return 'Comida';
      default:
        return 'Expositor';
    }
  });

  ngOnInit(): void {
    this.perfilService.mio().subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar tu perfil. Intenta de nuevo.');
        this.cargando.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.liberarVistaPrevia();
  }

  // ───────────── Foto ─────────────

  elegirFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.mensajeFoto.set('');
    this.errorFoto.set('');

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      this.errorFoto.set('La imagen debe ser JPG o PNG.');
      input.value = '';
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      this.errorFoto.set('La imagen no puede pesar más de 5 MB.');
      input.value = '';
      return;
    }

    this.liberarVistaPrevia();
    this.archivoNuevo.set(file);
    this.vistaPrevia.set(URL.createObjectURL(file));
  }

  cancelarFoto(): void {
    this.liberarVistaPrevia();
    this.archivoNuevo.set(null);
    this.errorFoto.set('');
  }

  guardarFoto(): void {
    const file = this.archivoNuevo();
    if (!file || this.subiendo()) return;

    this.subiendo.set(true);
    this.errorFoto.set('');
    this.mensajeFoto.set('');

    const formData = new FormData();
    formData.append('file', file);

    this.perfilService.cambiarMiFoto(formData).subscribe({
      next: (p) => {
        this.perfil.update((actual) => (actual ? { ...actual, fotoUrl: p.fotoUrl } : actual));
        this.cancelarFoto();
        this.subiendo.set(false);
        this.mensajeFoto.set('Foto actualizada.');
      },
      error: (e) => {
        this.subiendo.set(false);
        const msg = e?.error?.message;
        this.errorFoto.set(
          e?.status === 429
            ? 'Hiciste muchos cambios seguidos. Espera un minuto.'
            : Array.isArray(msg)
              ? msg.join(', ')
              : msg || 'No se pudo cambiar la foto. Intenta de nuevo.',
        );
      },
    });
  }

  private liberarVistaPrevia(): void {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set(null);
  }

  salir(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}