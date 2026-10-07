// Datos del evento mostrados en el inicio.
// Los nombres siguen las columnas de la tabla "eventos".
// Cuando quieras leerlos de la base de datos, reemplaza EVENTO_ACTUAL
// por la respuesta de tu API (por ejemplo GET /eventos/proximo).

export interface EventoInfo {
  nombre: string; // eventos.nombre
  descripcion: string; // eventos.descripcion
  ubicacion: string; // eventos.ubicacion
  fechaTexto: string; // eventos.fecha_inicio / fecha_fin
  portada?: string; // eventos.portada (afiche)
  whatsappCanal: string; // eventos.whatsapp_canal
  whatsappPagos: string; // eventos.whatsapp_pagos
}

export const EVENTO_ACTUAL: EventoInfo = {
  nombre: 'Yukawaii Fest',
  descripcion: 'Reserva de mesas para Ilustradores, Emprendedores y Comida.',
  ubicacion: 'Santa Cruz',
  fechaTexto: '19 de noviembre',
  // Afiche guardado en public/images/
  portada: 'images/afiche-yukawaii.jpg',
  // Reemplaza por el enlace real del canal
  whatsappCanal: 'https://whatsapp.com/channel/...',
  // Formato wa.me: código de país (591) + número, sin + ni espacios
  whatsappPagos: 'https://wa.me/59160423998',
};
