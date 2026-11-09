// ¿Te achuntó tu avatar? (2026-11-09). Lo que ve cada alumno en su teléfono,
// calculado con SUS votos y los de SUS avatares (callable misAvatares). Puro y
// testeado; la pantalla solo dibuja esto.
import { pearson } from './analitica/basico';

export interface AvatarMio { modelo: string; votos: Record<string, number>; faltantes: string[] }
export interface RespuestaMisAvatares {
  votos: Record<string, number>;
  avatares: AvatarMio[];
  /** Promedio de los demás por propuesta; null con menos de minCurso compañeros. */
  curso: Record<string, number> | null;
  nCurso: number;
  minCurso: number;
}

export interface Acierto {
  /** Propuestas comparadas (las que el avatar sí votó). */
  n: number;
  /** Votó lo mismo que tú. */
  exactos: number;
  /** Quedó a un punto o menos. */
  cerca: number;
  /** Distancia promedio en puntos de la escala 1-5; null si no hay nada que comparar. */
  error: number | null;
  /** Correlación entre tus 12 votos y los suyos: ¿sube donde tú subes? null si alguno no varía. */
  r: number | null;
}

export function acierto(mios: Record<string, number>, pred: Record<string, number>, ids: string[]): Acierto {
  const x: number[] = [], y: number[] = [];
  for (const id of ids) {
    if (Number.isFinite(mios[id]) && Number.isFinite(pred[id])) { x.push(mios[id]); y.push(pred[id]); }
  }
  const d = x.map((v, i) => Math.abs(v - y[i]));
  return {
    n: x.length,
    exactos: d.filter((v) => v < 0.5).length,
    cerca: d.filter((v) => v <= 1 + 1e-9).length,
    error: x.length ? d.reduce((s, v) => s + v, 0) / x.length : null,
    r: x.length >= 3 ? pearson(x, y) : null,
  };
}

export interface ResumenMiAvatar {
  modelos: (Acierto & { modelo: string; faltantes: string[] })[];
  curso: Acierto | null;
}

/** Un avatar por modelo, el que más se acerca primero; los que no votaron nada, al final. */
export function resumenMiAvatar(resp: RespuestaMisAvatares, ids: string[]): ResumenMiAvatar {
  const modelos = resp.avatares
    .map((a) => ({ modelo: a.modelo, faltantes: a.faltantes, ...acierto(resp.votos, a.votos, ids) }))
    .sort((a, b) => (a.error ?? Infinity) - (b.error ?? Infinity));
  return { modelos, curso: resp.curso ? acierto(resp.votos, resp.curso, ids) : null };
}

/** 0,83 con coma decimal, como el resto de la app. */
export function puntos(x: number): string {
  return x.toFixed(1).replace('.', ',');
}
