import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  
  // Banner / Carrusel Evento Próximo
  imagenesCarrusel = [
    {
      titulo: 'YUKAWAII FEST 2026',
      subtitulo: 'Reserva de mesas para Ilustradores, Emprendedores y Comida.',
      fecha: 'Noviembre 19 • Santa Cruz',
      tag: '¡Convocatoria Abierta!',
      bgClass: 'from-[#E85A4F] to-[#2C221E]'
    },
    {
      titulo: 'MAPA Y DISTRIBUCIÓN',
      subtitulo: 'Conoce la ubicación de los stands y zonas gastronómicas.',
      fecha: 'Edición Ilustración & Pop',
      tag: 'Próximamente Elección de Mesas',
      bgClass: 'from-[#F4C453] to-[#2C221E]'
    }
  ];

  carruselIndex = 0;

  siguienteSlide() {
    this.carruselIndex = (this.carruselIndex + 1) % this.imagenesCarrusel.length;
  }

  anteriorSlide() {
    this.carruselIndex = (this.carruselIndex - 1 + this.imagenesCarrusel.length) % this.imagenesCarrusel.length;
  }

  // Galería de Eventos Pasados y Reseñas
  eventosPasados = [
    {
      titulo: 'Festicker 2025',
      fecha: 'Octubre 2025 • Teatro CBA',
      asistentes: '+1,200 Asistentes',
      expositores: '45 Expositores',
      resena: '“Una experiencia increíble, la afluencia de gente superó nuestras expectativas y la organización impecable.”',
      autor: '— @adict_postres',
      imagenBg: 'bg-[#E85A4F]'
    },
    {
      titulo: 'Proyecto Yuca Edición Verano',
      fecha: 'Febrero 2025 • Santa Cruz',
      asistentes: '+900 Asistentes',
      expositores: '30 Expositores',
      resena: '“El ambiente súper seguro y lleno de energía. Los canales de comunicación ayudaron muchísimo.”',
      autor: '— @ilustra_arte',
      imagenBg: 'bg-[#F4C453]'
    },
    {
      titulo: 'Yuca Pop Market',
      fecha: 'Noviembre 2024',
      asistentes: '+1,500 Asistentes',
      expositores: '50 Expositores',
      resena: '“Es la feria con mejor recepción del público joven e ilustradores en la ciudad.”',
      autor: '— @estudio_kawaii',
      imagenBg: 'bg-[#7B8E3D]'
    }
  ];
}