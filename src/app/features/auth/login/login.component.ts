import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule,RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  errorMessage = '';

  onLogin(): void {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos.';
      return;
    }

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        const rol = this.authService.getRol();
        if (rol === 'ADMIN') {
          this.router.navigate(['/admin/postulaciones']);
        } else {
          this.router.navigate(['/mi-panel']);
        }
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Credenciales incorrectas';
      },
    });
  }
}