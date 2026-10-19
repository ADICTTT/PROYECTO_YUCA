import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type TipoPase = 'normal' | 'vip';
type Modalidad = 'adelanto' | 'total';

interface PaseConfig {
  titulo: string;
  precio: number;
  adelanto: number;
}

interface Invitado {
  nombre: string;
  etiqueta: string;
  serie: string;
  texto: string;
  imagen: string;
}

/**
 * Meet & Greet LIBRE (público, sin login).
 * No llama al backend ni guarda nada: solo arma el mensaje y abre WhatsApp.
 * Ruta: /meet-greet
 */
@Component({
  selector: 'app-meet-greet-publico',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './meet-greet-publico.component.html',
})
export class MeetGreetPublicoComponent {
  // ====== AJUSTES ======
  /** Número destino con código de país de Bolivia (+591). */
  readonly numeroWhatsApp = '59162986390';
  /** Cupos totales (solo informativo: no hay backend que los descuente). */
  readonly cupos = 24;
  /** Ruta de la imagen del QR de pago (ej: 'qr-pago.png'). Vacío = no se muestra. */
  readonly qrPagoUrl = '';

  /**
   * Fotos: colócalas en la carpeta de archivos estáticos (public/ en Angular 18+,
   * src/assets/ en versiones anteriores; en ese caso usa 'assets/Dee.jpg').
   */
  readonly invitados: Invitado[] = [
    {
      nombre: 'Dee',
      etiqueta: 'Doblaje del personaje',
      serie: 'Metal Family',
      texto:
        'Conoce a quien da voz a Dee en el doblaje de Metal Family. Conversa, tómate fotos y llévate un recuerdo de este encuentro.',
      imagen: 'Dee.jpg',
    },
    {
      nombre: 'Glam',
      etiqueta: 'Invitado especial',
      serie: 'Metal Family',
      texto:
        'Acceso al espacio exclusivo de interacción: conversa, tómate fotografías y solicita autógrafos o saludos personalizados según tu pase.',
      imagen: 'glam.png',
    },
  ];

  readonly PASES: Record<TipoPase, PaseConfig> = {
    normal: { titulo: 'Pase Normal', precio: 50, adelanto: 10 },
    vip: { titulo: 'Pase VIP Especial', precio: 80, adelanto: 15 },
  };

  pase: TipoPase = 'normal';
  modalidad: Modalidad = 'adelanto';
  nombre = '';
  telefono = '';
  correo = '';
  acepta = false;
  error = '';

  get config(): PaseConfig {
    return this.PASES[this.pase];
  }

  elegirPase(tipo: TipoPase): void {
    this.pase = tipo;
  }

  enviarWhatsApp(): void {
    this.error = '';
    const nombre = this.nombre.trim();
    const telefono = this.telefono.replace(/\D/g, '');
    const correo = this.correo.trim();

    if (nombre.length < 3) {
      this.error = 'Escribe tu nombre completo.';
      return;
    }
    if (telefono.length < 8) {
      this.error = 'Escribe un número de WhatsApp válido (8 dígitos).';
      return;
    }
    if (correo && !/^\S+@\S+\.\S+$/.test(correo)) {
      this.error = 'El correo no parece válido. Corrígelo o déjalo vacío.';
      return;
    }
    if (!this.acepta) {
      this.error = 'Debes aceptar las políticas de reserva.';
      return;
    }

    const c = this.config;
    const monto = this.modalidad === 'adelanto' ? c.adelanto : c.precio;
    const modalidadTxt =
      this.modalidad === 'adelanto'
        ? `Reserva adelantada (${c.adelanto} Bs., saldo ${c.precio - c.adelanto} Bs. el día del evento)`
        : `Pago total (${c.precio} Bs.)`;

    const mensaje =
      `¡Hola Proyecto Yuca! 🌸\n` +
      `Quiero reservar un cupo para el *Meet & Greet* (público general).\n\n` +
      `👤 *Nombre:* ${nombre}\n` +
      `📱 *WhatsApp:* ${telefono}\n` +
      (correo ? `✉️ *Correo:* ${correo}\n` : '') +
      `🎟️ *Pase:* ${c.titulo} (${c.precio} Bs.)\n` +
      `💵 *Modalidad:* ${modalidadTxt}\n` +
      `💰 *Monto a pagar ahora:* ${monto} Bs.\n\n` +
      `Acepto las políticas de reserva. Por favor confírmenme si hay cupo y envíenme los datos / QR para el pago. ¡Gracias!`;

    const url = `https://wa.me/${this.numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }
}
