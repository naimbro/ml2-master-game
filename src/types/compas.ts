// Types for the compass — the opinion instrument under `content/compas/`.
//
// A compass is NOT a game session. It has no correct answers, no score and no
// ranking, so it deliberately shares nothing with `types/game.ts` beyond the
// player identity. See `content/compas/README.md` for why it lives outside
// `content/sessions/`.

/** Which end of an axis a position falls in, once the cuts are applied. */
export type Banda = 'bajo' | 'medio' | 'alto';

/** Who the respondent thinks should hold the wheel. The third dimension. */
export type Timon = 'empresas' | 'estado' | 'internacional' | 'ciudadania';

export interface CompasVector {
  magnitud: number;
  direccion: number;
}

export interface CompasOption {
  id: string;
  text: string;
  vector: CompasVector;
  /** The text in the syllabus that defends this position. Audited, not decorative. */
  anchor: string;
  /** Only on the tiebreak item. */
  timon?: Timon;
}

export interface CompasItem {
  id: string;
  order: number;
  question: string;
  discrimina: string;
  /** Marks the item whose `timon` answers break the Vigilante/Oligarquía tie. */
  esItemDeTimon?: boolean;
  options: CompasOption[];
}

export interface CompasAxis {
  id: string;
  label: string;
  min: number;
  max: number;
  minLabel: string;
  maxLabel: string;
  pregunta: string;
}

export interface CompasAplicacion {
  n: number;
  semana: number;
  fecha: string;
  hito: string;
  proposito: string;
  nota?: string;
}

export interface CompasInstrument {
  instrumentId: string;
  courseId: string;
  version: number;
  title: string;
  subtitle: string;
  axes: { x: CompasAxis; y: CompasAxis };
  scoring: {
    method: string;
    skippable: boolean;
    /** Both are always false. A scored compass stops measuring opinion. */
    ranked: boolean;
    scored: boolean;
    nota: string;
  };
  aplicaciones: CompasAplicacion[];
  items: CompasItem[];
}

export interface Arquetipo {
  id: string;
  name: string;
  celda: { magnitud: Banda; direccion: Banda };
  desc: string;
  /** A reading from the syllabus that argues this position. */
  lectura: string;
  /** The strongest objection against it. What makes the debate work. */
  puntoCiego: string;
  /** Present only on the two archetypes that share a cell. */
  timon?: Timon[];
}

/**
 * Band edges, as written in `arquetipos_v*.json`: `[min, max]` per band. Only
 * the upper edge of `bajo` and of `medio` is read — see `bandaDe`.
 */
export interface CompasCortesEje {
  bajo: number[];
  medio: number[];
  alto: number[];
}

export interface CompasArquetipos {
  archetypesId: string;
  instrumentId: string;
  version: number;
  cortes: {
    magnitud: CompasCortesEje;
    direccion: CompasCortesEje;
  };
  desempate: {
    celda: { magnitud: Banda; direccion: Banda };
    item: string;
    reglas: Array<{ timon: Timon[]; arquetipo: string }>;
    porDefecto: string;
  };
  arquetipos: Arquetipo[];
}

/**
 * What a student answered: option id per item id. A skipped item is absent or
 * null — skipping is allowed and must not be read as a zero.
 */
export type CompasAnswers = Record<string, string | null | undefined>;

export interface CompasPosicion {
  magnitud: number;
  direccion: number;
  /** How many items actually fed this position. */
  respondidas: number;
  total: number;
}

/** Change between two applications of the same instrument. */
export interface CompasMovimiento {
  dMagnitud: number;
  dDireccion: number;
  distancia: number;
}
