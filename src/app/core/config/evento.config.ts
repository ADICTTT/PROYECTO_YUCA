export interface EventoInfo {
  nombre: string; // eventos.nombre
  descripcion: string; // eventos.descripcion
  ubicacion: string; // eventos.ubicacion (dirección completa)
  lugarCorto: string; // solo para el carrusel (no está en la BD)
  fechaTexto: string; // eventos.fecha_inicio / fecha_fin
  portada?: string; // eventos.portada (afiche)
  whatsappCanal: string; // eventos.whatsapp_canal
  whatsappPagos: string; // eventos.whatsapp_pagos
}

export const EVENTO_ACTUAL: EventoInfo = {
  nombre: 'Yukawaii Fest',
  descripcion: 'Reserva de mesas para Ilustradores, Emprendedores y Comida.',
  ubicacion: 'Hotel Asturias, Calle Moldes N.º 154, entre Calle Chuquisaca y Calle La Paz',
  lugarCorto: 'Hotel Asturias',
  fechaTexto: '14-15 noviembre',
  // Afiche guardado en public/images/
  portada: 'images/afiche-yukawaii.jpg',
  whatsappCanal: 'https://whatsapp.com/channel/0029Vb20xSb4NVie43lyiB1z',
  // Formato wa.me: código de país (591) + número, sin + ni espacios
  whatsappPagos: 'https://wa.me/59169006784',
};
