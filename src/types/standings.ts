import { Timestamp } from 'firebase/firestore';

/** Un juego que cuenta para el acumulado del curso. */
export interface CountedGame {
  gameCode: string;
  sessionId: string;
  sessionTitle: string;
  finishedAtMs: number;
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
}

/** Documento standings/{courseId}. Lo escribe solo Cloud Functions. */
export interface CourseStandings {
  courseId: string;
  updatedAt: Timestamp;
  playerCount: number;
  finalized: boolean;
  excludedGameCodes: string[];
  gamesCounted: CountedGame[];
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
