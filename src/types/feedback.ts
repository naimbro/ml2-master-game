import { Timestamp } from 'firebase/firestore';

/** Rango válido de la escala. Es la escala de notas chilena, que ya conocen. */
export const FEEDBACK_MIN = 1;
export const FEEDBACK_MAX = 7;

/** Largo máximo del comentario. Corto a propósito: se escribe desde un teléfono. */
export const FEEDBACK_COMMENT_MAX = 300;

/**
 * Documento games/{gameCode}/feedback/{uid}. Lo escribe el propio alumno y solo
 * lo leen él y el anfitrión del juego.
 *
 * NO es anónimo, y en ninguna parte se le dice al alumno que lo sea: el id del
 * documento es su uid. Si algún día se quiere anonimato de verdad hay que
 * cambiar la forma del documento, no solo el texto de la pantalla.
 */
export interface GameFeedbackDoc {
  /** 1 a 7, o null si prefirió saltarse la pregunta. */
  rating: number | null;
  /** Puede venir vacío: nadie está obligado a escribir. */
  comment: string;
  playerName: string;
  submittedAt: Timestamp;
}
