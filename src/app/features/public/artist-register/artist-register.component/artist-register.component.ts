import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreatePerfileDto, ProfileService } from '@core/services/profile.service';
// Si tu tsconfig tiene configurado el path alias '@core', puedes usar:
// import { ProfileService, CreatePerfileDto } from '@core/services/profile.service';

// De lo contrario, usamos la ruta relativa corregida (4 niveles hacia arriba):

@Component({
  selector: 'app-artist-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './artist-register.component.html',
})
export class ArtistRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  isSubmitting = false;
  successMessage = false;
  errorMessage = '';

  categories = [
    { label: 'Ilustradores', value: 'ILUSTRADORES' },
    { label: 'Emprendedores', value: 'EMPRENDEDORES' },
    { label: 'Comida', value: 'COMIDA' },
  ];

  profileForm: FormGroup = this.fb.group({
    nombreReal: ['', [Validators.required, Validators.minLength(3)]],
    celular: ['', [Validators.required]],
    nombreComercial: ['', [Validators.required, Validators.minLength(2)]],
    categoria: ['', [Validators.required]],
    instagram: ['', [Validators.required]],
    descripcion: [''],
    portafolioUrl: [''],
  });

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const val = this.profileForm.value;

    const payload: CreatePerfileDto = {
      nombreReal: val.nombreReal,
      celular: val.celular,
      nombreComercial: val.nombreComercial,
      categoria: val.categoria,
      instagram: val.instagram,
    };

    if (val.descripcion?.trim()) {
      payload.descripcion = val.descripcion.trim();
    }

    if (
      val.portafolioUrl?.trim() &&
      (val.portafolioUrl.startsWith('http://') || val.portafolioUrl.startsWith('https://'))
    ) {
      payload.portafolioUrl = val.portafolioUrl.trim();
    }

    this.profileService.registerProfile(payload).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = true;
        this.profileForm.reset();
      },
      error: (err: any) => { // <--- Tipado explícito para evitar TS7006
        this.isSubmitting = false;
        if (Array.isArray(err.error?.message)) {
          this.errorMessage = err.error.message.join(', ');
        } else {
          this.errorMessage = err.error?.message || 'Error al enviar el perfil.';
        }
      },
    });
  }
}