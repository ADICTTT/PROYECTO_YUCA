import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IsActiveMatchOptions, NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service'; // ajusta la ruta a donde esté tu header

interface LinkMenu {
  texto: string;
  icono: string;
  ruta: string;
  fragmento: string | undefined;
  soloAdmin?: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  host: { class: 'sticky top-0 z-50 block' },
})
export class HeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  menuAbierto = signal(false);

  // Rol de la sesión actual (null = sin sesión)
  private readonly rol = signal<string | null>(this.auth.getRol());
  readonly logueado = computed(() => !!this.rol());
  readonly esExpositor = computed(() => this.rol() === 'EXPOSITOR');
  readonly esAdmin = computed(() => this.rol() === 'ADMIN');

  links: LinkMenu[] = [
    { texto: 'Inicio', icono: 'fa-house', ruta: '/', fragmento: undefined },
    { texto: 'Próximo evento', icono: 'fa-calendar-days', ruta: '/', fragmento: 'proximo-evento' },
    // TEMPORAL: solo admins. Para abrirlo al público, quitar soloAdmin.
    { texto: 'Meet & Greet', icono: 'fa-ticket', ruta: '/meet-greet', fragmento: undefined, soloAdmin: false },
    { texto: 'Cómo participar', icono: 'fa-list-check', ruta: '/', fragmento: 'como-participar' },
    { texto: 'Ediciones pasadas', icono: 'fa-images', ruta: '/', fragmento: 'ediciones' },
  ];

  // Enlaces que ve la sesión actual
  readonly linksVisibles = computed(() => this.links.filter((l) => !l.soloAdmin || this.esAdmin()));

  opcionesActivo: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'exact',
  };

  constructor() {
    // Cada navegación vuelve a leer la sesión (login, logout, recarga)
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => this.rol.set(this.auth.getRol()));
  }

  alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  salir(): void {
    this.cerrarMenu();
    this.auth.logout();
    this.rol.set(null);
    this.router.navigate(['/login']);
  }
}