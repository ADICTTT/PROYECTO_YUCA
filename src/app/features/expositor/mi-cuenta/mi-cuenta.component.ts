import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './mi-cuenta.component.html',
})
export class MiCuentaComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly forzado = this.auth.debeCambiarPassword();
  readonly rutaVolver = this.auth.getRol() === 'ADMIN' ? '/admin/postulaciones' : '/mi-panel';

  passwordActual = '';
  nuevoNombreUsuario = '';
  nuevaPassword = '';
  confirmar = '';

  readonly error = signal('');
  readonly guardando = signal(false);

  guardar(): void {
    this.error.set('');

    if (!this.passwordActual || !this.nuevaPassword) {
      this.error.set('Completa la contraseña actual y la nueva.');
      return;
    }
    if (this.nuevaPassword.length < 8) {
      this.error.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.nuevaPassword !== this.confirmar) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.guardando.set(true);
    this.auth
      .cambiarCredenciales({
        passwordActual: this.passwordActual,
        nuevoNombreUsuario: this.nuevoNombreUsuario.trim() || undefined,
        nuevaPassword: this.nuevaPassword,
      })
      .subscribe({
        next: () => {
          this.auth.logout();
          this.router.navigate(['/login']);
        },
        error: (err) => {
          const msg = err.error?.message;
          this.error.set(Array.isArray(msg) ? msg.join('. ') : msg || 'No se pudo actualizar.');
          this.guardando.set(false);
        },
      });
  }
}