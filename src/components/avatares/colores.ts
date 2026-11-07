import type { Fuente } from '../../lib/avatares/contrato';

// Identidad "Cancha": tinta para la sala, azul para los avatares, naranja oscuro
// para los avatares en red, gris para los bots. Verde NO: en esta app significa
// "correcto", y aca no hay respuestas correctas.
export const COLOR_FUENTE: Record<Fuente, string> = {
  humano: '#101114',
  avatar: '#2563EB',
  avatar_red: '#C2400F',
  bot: '#767980',
};

export const NOMBRE_FUENTE: Record<Fuente, string> = {
  humano: 'La sala',
  avatar: 'Avatares solos',
  avatar_red: 'Avatares en red',
  bot: 'Bots',
};

export const ARCHIVO = { fontFamily: "'Archivo Black', sans-serif" } as const;

export const coma = (x: number, d = 2) => x.toFixed(d).replace('.', ',');
