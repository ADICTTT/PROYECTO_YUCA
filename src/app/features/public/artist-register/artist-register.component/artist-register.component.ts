import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProfileService } from '@core/services/profile.service';
import { EVENTO_ACTUAL } from '@core/config/evento.config';

const MAX_FOTO_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-artist-register',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './artist-register.component.html',
})
export class ArtistRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  readonly canalUrl = EVENTO_ACTUAL.whatsappCanal;

  isSubmitting = false;
  successMessage = false;
  errorMessage = '';
  instagramEnviado = '';

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

  // ───────────── Foto ─────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.errorMessage = '';
    const tiposOk = ['image/jpeg', 'image/png'];
    if (!tiposOk.includes(file.type)) {
      this.errorMessage = 'La imagen debe ser JPG o PNG.';
      input.value = '';
      return;
    }
    if (file.size > MAX_FOTO_BYTES) {
      this.errorMessage = 'La imagen no puede pesar más de 5 MB.';
      input.value = '';
      return;
    }

    if (this.imagenPreview) URL.revokeObjectURL(this.imagenPreview);
    this.selectedFile = file;
    this.imagenPreview = URL.createObjectURL(file);
  }

  // ───────────── Vista previa de la credencial ─────────────

  categoriaSingular(): string {
    switch (this.profileForm.get('categoria')?.value) {
      case 'ILUSTRADORES':
        return 'Ilustrador';
      case 'EMPRENDEDORES':
        return 'Emprendedor';
      case 'COMIDA':
        return 'Comida';
      default:
        return 'Categoría';
    }
  }

  instagramVista(): string {
    const ig = String(this.profileForm.get('instagram')?.value || '')
      .trim()
      .replace(/^@/, '');
    return ig ? `@${ig}` : '@instagram';
  }

  campoInvalido(nombre: string): boolean {
    const c = this.profileForm.get(nombre);
    return !!c && c.invalid && c.touched;
  }

  // ───────────── Enviar ─────────────

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    if (!this.selectedFile) {
      this.errorMessage = 'Sube tu logo o foto para la credencial.';
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const val = this.profileForm.value;
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

    formData.append('file', this.selectedFile);

    this.profileService.registerProfile(formData).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.successMessage = true;
        this.profileForm.reset();
        if (this.imagenPreview) URL.revokeObjectURL(this.imagenPreview);
        this.imagenPreview = null;
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
    const instagramUser = this.instagramEnviado || '@artista';
    const numeroOrganizador = '62986390';
    const mensaje = `Hola, soy ${instagramUser}, ya realicé mi postulación para la adquisición de un stand en la feria`;
    return `https://wa.me/${numeroOrganizador}?text=${encodeURIComponent(mensaje)}`;
  }
}