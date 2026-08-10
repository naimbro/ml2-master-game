import { Timestamp } from 'firebase/firestore';

/** Un juego que cuenta para el acumulado del curso. */
export interface CountedGame {
  gameCode: string;
  sessionId: string;
  sessionTitle: string;
  finishedAtMs: number;
  /** Cuantos alumnos respondieron. Ausente en tablas escritas antes del 2026-08-03. */
  playedCount?: number;
}

/** Fila publica: solo los diez primeros del curso salen con nombre. */
export interface PublicStandingsRow {
  uid: string;
  name: string;
  photoURL: string | null;
  points: number;
  position: number;
  previousPosition: number | null;
  positionsByGame: Array<number | null>;
  /**
   * Puesto en la tabla del curso despues de cada clase — no el puesto dentro de
   * ese juego. Es lo que grafica la figura de los seis primeros. Ausente en
   * tablas escritas antes del 2026-08-11: ahi se cae a `positionsByGame`.
   */
  cumulativePositionsByGame?: Array<number | null>;
}

/** Documento standings/{courseId}. Lo escribe solo Cloud Functions. */
export interface CourseStandings {
  courseId: string;
  updatedAt: Timestamp;
  playerCount: number;
  finalized: boolean;
  excludedGameCodes: string[];
  gamesCounted: CountedGame[];
  /**
   * Juegos terminados que NO cuentan porque su clase ya tiene uno oficial — el
   * que tuvo mas alumnos. Ausente en tablas escritas antes del 2026-08-03.
   */
  gamesShadowed?: CountedGame[];
  top: PublicStandingsRow[];
}

/** Documento students/{uid}/courseData/{courseId}. Solo lo lee su dueno. */
export interface MyCourseStanding {
  courseId: string;
  updatedAt: Timestamp;
  points: number;
  position: number;
  previousPosition: number | null;
  playerCount: number;
  gamesPlayed: number;
  pointsByGame: Array<number | null>;
  positionsByGame: Array<number | null>;
}
