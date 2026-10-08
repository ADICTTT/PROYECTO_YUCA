import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Perfil, ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-mi-panel',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './mi-panel.component.html',
})
export class MiPanelComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly perfilService = inject(ProfileService);

  // Reemplaza por los enlaces reales de Proyecto Yuca
  readonly canalUrl = 'https://whatsapp.com/channel/XXXXXXXX';
  private readonly whatsappNumero = 'XXXXXXXXXXX'; // código de país + número, sin + ni espacios

  readonly perfil = signal<Perfil | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly reglasAceptadas = signal(false);

  readonly comprobanteUrl = computed(() => {
    const p = this.perfil();
    const texto = `Hola, soy ${p?.nombreComercial}. Envío mi comprobante de pago de la mesa ${p?.mesa?.numero}.`;
    return `https://wa.me/${this.whatsappNumero}?text=${encodeURIComponent(texto)}`;
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

  alternarReglas(event: Event): void {
    this.reglasAceptadas.set((event.target as HTMLInputElement).checked);
  }

  seleccionarMesa(): void {
    if (!this.reglasAceptadas()) return;
    this.router.navigate(['/seleccionar-mesa']); // ruta del mapa, la creamos después
  }

  salir(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}