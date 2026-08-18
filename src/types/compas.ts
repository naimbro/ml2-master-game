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

/**
 * What an option contributes to the plane.
 *
 * Both components are OPTIONAL, and that is what makes conditional items
 * possible. An item whose premise stipulates the scenario --"suppose AI does
 * every job: how good is that?"-- cannot honestly declare a magnitude: every
 * one of its options lives inside a transformed world, so scoring them would
 * shove anyone who answers toward "this changes everything" whether they
 * believe it or not. Such an item declares `direccion` only.
 *
 * `CompasPosicion` keeps a separate denominator per axis, so a missing
 * component is skipped rather than counted as zero. Zero is a position on
 * these axes, not the absence of one.
 */
export interface CompasVector {
  magnitud?: number;
  direccion?: number;
}

export interface CompasOption {
  id: string;
  text: string;
  vector: CompasVector;
  /**
   * The third axis: −10 humans at the wheel, +10 machines at the wheel.
   *
   * OPTIONAL on purpose, and averaged only over the options that declare it.
   * Most options say nothing about who acts — an option about data centres or
   * about the Chilean bill has no honest value here, and inventing one would
   * measure the instrument instead of the student. Six of the twelve items
   * declare it on all five options; the rest declare nothing.
   */
  agencia?: number;
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
  /**
   * The third axis. NOT part of the plane and NOT part of the archetype cell:
   * nine cells times three bands is 27 boxes for twenty-five students, and the
   * grid comes out empty. It is averaged separately and reported as a band.
   */
  ejeAgencia?: CompasAxis;
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

/** One band of the third axis. Reported next to the archetype, never inside it. */
export interface BandaAgencia {
  id: string;
  name: string;
  /** `[min, max]`. The bands tile the axis with no gaps and no overlap. */
  rango: number[];
  desc: string;
  lectura: string;
  puntoCiego: string;
}

export interface CompasArquetipos {
  archetypesId: string;
  instrumentId: string;
  version: number;
  cortes: {
    magnitud: CompasCortesEje;
    direccion: CompasCortesEje;
  };
  /**
   * Solo cuando dos arquetipos comparten celda. Un instrumento de
   * proposiciones no puede tenerlo: el desempate necesita una respuesta del
   * tipo empresas / estado / internacional / ciudadania, y un grado de acuerdo
   * no la produce. Sin desempate, ninguna celda puede estar compartida.
   */
  desempate?: {
    celda: { magnitud: Banda; direccion: Banda };
    item: string;
    reglas: Array<{ timon: Timon[]; arquetipo: string }>;
    porDefecto: string;
  };
  arquetipos: Arquetipo[];
  bandasAgencia?: {
    eje: string;
    bandas: BandaAgencia[];
  };
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
  /** How many answers fed each plane axis. They differ when an item is conditional. */
  magnitudRespondidas: number;
  direccionRespondidas: number;
  /**
   * Mean of the `agencia` values among the answered options that declare one.
   * `null` when they answered nothing that speaks to it — which is a real
   * outcome, not a zero. Zero on this axis means "in dispute", and handing that
   * to someone who never expressed it is the same lie as plotting a silent
   * student at the origin.
   */
  agencia: number | null;
  /** How many answers fed `agencia`. Fewer than `respondidas` by design. */
  agenciaRespondidas: number;
}

/** Change between two applications of the same instrument. */
export interface CompasMovimiento {
  dMagnitud: number;
  dDireccion: number;
  distancia: number;
}
