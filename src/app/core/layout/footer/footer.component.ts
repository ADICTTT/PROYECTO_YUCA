import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
})
export class FooterComponent {
  anio = new Date().getFullYear();

  // Reemplaza las URLs por las reales
  redes = [
    { nombre: 'Instagram', icono: 'fa-instagram', url: 'https://www.instagram.com/yukawaiifest' },
    { nombre: 'TikTok', icono: 'fa-tiktok', url: 'https://www.tiktok.com/@yukawaiifest' },
    { nombre: 'Discord', icono: 'fa-discord', url: 'https://discord.com/' },
    { nombre: 'Canal de WhatsApp', icono: 'fa-whatsapp', url: 'https://whatsapp.com/channel/0029Vb20xSb4NVie43lyiB1z' },
  ];
}
