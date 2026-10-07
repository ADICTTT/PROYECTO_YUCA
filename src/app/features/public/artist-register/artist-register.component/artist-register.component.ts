import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from '@core/services/profile.service';

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
  instagramEnviado = ''; // <--- Variable para conservar el Instagram registrado

  imagenPreview: string | null = null;
  selectedFile: File | null = null;

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

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.imagenPreview = URL.createObjectURL(file);
    }
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const val = this.profileForm.value;

    // Guardamos el Instagram ingresado antes de limpiar el formulario
    this.instagramEnviado = val.instagram;

    const formData = new FormData();
    formData.append('nombreReal', val.nombreReal);
    formData.append('celular', val.celular);
    formData.append('nombreComercial', val.nombreComercial);
    formData.append('categoria', val.categoria);
    formData.append('instagram', val.instagram);

    if (val.descripcion?.trim()) {
      formData.append('descripcion', val.descripcion.trim());
    }

    if (
      val.portafolioUrl?.trim() &&
      (val.portafolioUrl.startsWith('http://') || val.portafolioUrl.startsWith('https://'))
    ) {
      formData.append('portafolioUrl', val.portafolioUrl.trim());
    }

    if (this.selectedFile) {
      formData.append('file', this.selectedFile);
    }

    this.profileService.registerProfile(formData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = true;
        this.profileForm.reset();
        this.imagenPreview = null; // Limpiamos la vista previa
        this.selectedFile = null;
      },
      error: (err: any) => {
        this.isSubmitting = false;
        if (Array.isArray(err.error?.message)) {
          this.errorMessage = err.error.message.join(', ');
        } else {
          this.errorMessage = err.error?.message || 'Error al enviar el perfil.';
        }
      },
    });
  }

  getWhatsAppPostulacionLink(): string {
    // Usamos la variable guardada para que mantenga el Instagram que escribió el usuario
    const instagramUser = this.instagramEnviado || '@artista';
    const numeroOrganizador = '60423998'; 
    const mensaje = `Hola, soy ${instagramUser}, ya realicé mi postulación para la adquisición de un stand en la feria`;
    return `https://wa.me/${numeroOrganizador}?text=${encodeURIComponent(mensaje)}`;
  }
}