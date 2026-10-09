import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EVENTO_ACTUAL } from '@core/config/evento.config';

interface Accion {
  texto: string;
  icono: string;
  estilo: 'primario' | 'secundario';
  ruta?: string; // enlace interno
  url?: string; // enlace externo
}

interface Slide {
  tag: string;
  titulo: string;
  subtitulo: string;
  icono: string;
  etiqueta: string;
  fondo: string;
  imagen?: string;
  acciones: Accion[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  evento = EVENTO_ACTUAL;

  claseAccion = {
    primario:
      'inline-flex items-center gap-2 bg-[#E85A4F] hover:bg-[#d4473c] text-white font-black text-xs py-3.5 px-6 rounded-2xl border-2 border-white shadow-md transition hover:scale-105',
    secundario:
      'inline-flex items-center gap-2 bg-[#F4C453] hover:bg-[#ebd173] text-[#2C221E] font-black text-xs py-3.5 px-6 rounded-2xl border-2 border-[#2C221E] transition hover:scale-105',
  };

  // ---------- Carrusel ----------
  slides: Slide[] = [
    {
      tag: `${this.evento.fechaTexto} · ${this.evento.lugarCorto}`,
      titulo: this.evento.nombre,
      subtitulo: this.evento.descripcion,
      icono: 'fa-solid fa-star',
      etiqueta: 'AFICHE',
      fondo: 'bg-[#E85A4F]',
      imagen: this.evento.portada,
      acciones: [
        { texto: 'Registrar perfil', icono: 'fa-solid fa-pen-nib', estilo: 'primario', ruta: '/registro-artista' },
        { texto: 'Iniciar sesión', icono: 'fa-solid fa-right-to-bracket', estilo: 'secundario', ruta: '/login' },
      ],
    },
    {
      tag: 'Convocatoria abierta',
      titulo: 'Crea tu perfil de expositor',
      subtitulo: 'Envía tu perfil, espera la revisión (hasta 24 horas) y elige tu mesa en el mapa.',
      icono: 'fa-solid fa-id-card',
      etiqueta: 'TU PERFIL',
      fondo: 'bg-[#7B8E3D]',
      acciones: [
        { texto: 'Registrar perfil', icono: 'fa-solid fa-pen-nib', estilo: 'primario', ruta: '/registro-artista' },
      ],
    },
    {
      tag: 'Novedades',
      titulo: 'Entérate primero',
      subtitulo:
        'En el canal oficial de WhatsApp publicamos los perfiles aprobados, resultados y comunicados.',
      icono: 'fa-brands fa-whatsapp',
      etiqueta: 'CANAL OFICIAL',
      fondo: 'bg-[#5C5046]',
      imagen: '/images/yuka1.png',
      acciones: [
        {
          texto: 'Seguir canal de Proyecto Yuca',
          icono: 'fa-solid fa-bullhorn',
          estilo: 'secundario',
          url: 'https://whatsapp.com/channel/0029Vb20xSb4NVie43lyiB1z',
        },
      ],
    },
  ];

  indice = signal(0);
  slide = computed(() => this.slides[this.indice()]);
  private temporizador?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.iniciarAuto();
  }

  ngOnDestroy(): void {
    this.detenerAuto();
  }

  siguiente(): void {
    this.indice.update((i) => (i + 1) % this.slides.length);
  }

  anterior(): void {
    this.indice.update((i) => (i - 1 + this.slides.length) % this.slides.length);
  }

  irA(i: number): void {
    this.indice.set(i);
  }

  iniciarAuto(): void {
    if (typeof window === 'undefined') return;
    // Respeta a quienes tienen desactivadas las animaciones en su sistema
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.detenerAuto();
    this.temporizador = setInterval(() => this.siguiente(), 7000);
  }

  detenerAuto(): void {
    if (this.temporizador) {
      clearInterval(this.temporizador);
      this.temporizador = undefined;
    }
  }

  // ---------- Categorías ----------
  categorias = [
    { nombre: 'Ilustradores', icono: 'fa-solid fa-pen-nib', texto: 'Artistas y creadores de arte original.',color: 'bg-[#F4C453] text-[#2C221E]' },
    { nombre: 'Emprendedores', icono: 'fa-solid fa-store', texto: 'Marcas y tiendas con productos propios.',color: 'bg-[#7B8E3D] text-white' },
    { nombre: 'Comida', icono: 'fa-solid fa-utensils', texto: 'Postres, bebidas y propuestas gastronómicas.', color: 'bg-[#E85A4F] text-white'},
  ];

  // ---------- Pasos para participar ----------
  pasos = [
    {
      icono: 'fa-solid fa-id-card',
      titulo: 'Crea tu perfil',
      texto: 'Registra tu nombre, celular, nombre artístico o de tienda, categoría e Instagram.',
    },
    {
      icono: 'fa-solid fa-hourglass-half',
      titulo: 'Espera la revisión',
      texto: 'Proyecto Yuca revisa tu perfil en hasta 24 horas. Mientras tanto aún no puedes elegir mesa.',
    },
    {
      icono: 'fa-brands fa-whatsapp',
      titulo: 'Sigue el canal',
      texto: 'Los perfiles aprobados y los resultados se publican en el canal oficial de WhatsApp.',
    },
    {
      icono: 'fa-solid fa-file-signature',
      titulo: 'Acepta las reglas',
      texto: 'Antes de ver el mapa debes leer y aceptar las condiciones de participación.',
    },
    {
      icono: 'fa-solid fa-map-location-dot',
      titulo: 'Elige tu mesa',
      texto: 'Mira en el mapa las mesas disponibles y ocupadas, elige la tuya y, si corresponde, suma a un compañero.',
    },
    {
      icono: 'fa-solid fa-receipt',
      titulo: 'Paga y envía tu comprobante',
      texto: 'Tienes 24 horas para pagar. Luego envía el comprobante por WhatsApp a la organización.',
    },
  ];

  // ---------- Ediciones pasadas ----------
  eventosPasados = [
    {
      titulo: 'Edición 1',
      fecha: 'Evento pasado',
      imagen: '/images/aficheUno.png',
      resena: 'Una feria muy interesante. Nos encantó conocer a la Yuquita, la botarga del evento.',
      autor: 'Un asistente',
      enlace: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MTUyMDUxMzI2NDE1OTAx?story_media_id=3599932629618338104_68706629509&srtk=eDFtMDhpNHcxdmto',
    },
    {
      titulo: 'Edición 2',
      fecha: 'Evento pasado',
      imagen: '/images/aficheDos.png',
      resena: 'Fue un evento muy divertido, me encanto conocer por primera vez a tantos artistas y gente que consume mi contenido. Ame la experiencia, no faltare a ninguna version :D.',
      autor: '@adi.ct_ (Compadre)',
      enlace: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE4MTAzNjUwOTU4OTcxNTEy?story_media_id=3716030675951748694_68706629509&mdxt=ZWR0anh6enFqbG51',
    },
    {
      titulo: 'Yukawaii Fest',
      fecha: 'Evento pasado',
      imagen: '/images/aficheTres.png',
      resena: 'La tematica fue muy buena, espero con ansias la proxima version',
      autor: 'Un asistente',
      enlace: 'https://www.instagram.com/s/aGlnaGxpZ2h0OjE3OTM4OTc2Mzg4MTk5MDI0?story_media_id=3876894280543714549_68706629509&cplk=MXMxaG1pNG05dWtjeQ==',
    },
  ];
}
