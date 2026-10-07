import { Component, signal } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  menuAbierto = signal(false);

  links = [
    { texto: 'Inicio', icono: 'fa-house', ruta: '/', fragmento: undefined as string | undefined },
    { texto: 'Próximo evento', icono: 'fa-calendar-days', ruta: '/', fragmento: 'proximo-evento' },
    { texto: 'Cómo participar', icono: 'fa-list-check', ruta: '/', fragmento: 'como-participar' },
    { texto: 'Ediciones pasadas', icono: 'fa-images', ruta: '/', fragmento: 'ediciones' },
  ];

  opcionesActivo: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'exact',
  };

  alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }
}