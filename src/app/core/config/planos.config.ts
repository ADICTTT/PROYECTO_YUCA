export interface RectPlano {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Posición fija del plano de fondo por sector.
// Es la misma en el editor de administración y en el mapa de los artistas.
// El plano mantiene su proporción dentro de esta caja.
export const PLANOS_RECT: Record<string, RectPlano> = {
  yuquin: { x: 0, y: 0, w: 450, h: 900 },
  yuca: { x: 0, y: 0, w: 850, h: 620 },
  infochan: { x: 0, y: 0, w: 1520, h: 1620 },
  confeti: { x: 0, y: 0, w: 1800, h: 1620 },
};