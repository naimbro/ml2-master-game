// Registro estatico, como compasContent.ts: imports a mano, que `npm run build`
// atrapa si una ruta se pudre. No vive en courses.ts por la misma razon que el
// compas: no es una sesion y no se puntua.
import vina from '../../../content/avatares/ai_democracy_2026/instrumento_vina_v1.json';
import type { Instrumento } from './contrato';

export interface InstrumentoPack {
  instrumentoId: string;
  nombre: string;
  courseId: string;
  instrumento: Instrumento;
}

export const INSTRUMENTOS: Record<string, InstrumentoPack> = {
  ayd14_vina_v1: {
    instrumentoId: 'ayd14_vina_v1',
    nombre: 'AyD · Semana 14 · avatares (ítems de Viña)',
    courseId: 'ai_democracy_2026',
    instrumento: vina as Instrumento,
  },
};

export function instrumentoDe(id: string): Instrumento | null {
  return INSTRUMENTOS[id]?.instrumento ?? null;
}
