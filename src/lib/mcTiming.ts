// Timing for multiple-choice blocks.
//
// Every screen in an MC round derives what it shows from ONE shared value:
// `game.roundStartTime`, written by the host. `mcTimeline()` turns that instant
// (plus the block's own question limits) into "what should be on screen right
// now", so the professor's projector and every student phone move together.
//
// This used to be local: each client ran its own setInterval and its own
// "Empezar" gate, so every screen started its block whenever that person
// pressed the button and drifted from there. There is deliberately no local
// clock left here — the only inputs are the shared round start and `now`.
//
// A scenario's `durationSeconds` drives the ROUND timer, which the host uses to
// auto-end the round (useGame.ts). If it is too small the host guillotines the
// block mid-question, so it is derived (`derivedMCRoundDuration`) rather than
// hand-typed, and the content validator fails the build when it is too short.

/**
 * Gate before the first question, for a round with nothing to show. Short: with
 * one question per round, a long gate is dead screen time on every question.
 */
export const MC_GATE_SECONDS = 5;

/**
 * Gate for a round that carries media. An audio clue ("acabas de escuchar el
 * himno...") has to finish playing before any clock starts.
 */
export const MC_GATE_WITH_MEDIA_SECONDS = 12;

/**
 * Cuánto se queda arriba la respuesta correcta después de cerrar una pregunta.
 *
 * Era una constante de 5 segundos y estaba rota: en MGT300 clase 1 las nueve
 * `explanation` medían entre 168 y 506 caracteres, y leer 421 en 5 segundos
 * exige 84 caracteres por segundo. Una persona lee 15 o 20. O sea que ninguna
 * explicación fue legible en el tiempo que estuvo en pantalla — el momento de
 * enseñar existía y pasaba de largo, y los alumnos reportaron "no entendí las
 * preguntas" cuando lo que no vieron fue el porqué.
 *
 * Ahora se deriva del largo del texto, igual que `durationSeconds` se deriva del
 * bloque. El tope existe porque una revelación muy larga apaga la sala: pasado
 * ese punto, la explicación se acorta, no la ventana se alarga.
 */
export const MC_READ_CHARS_PER_SECOND = 18;
/** Piso: el golpe en que la casilla se pone verde o roja, antes de leer nada. */
export const MC_FEEDBACK_MIN_SECONDS = 6;
/** Techo: más allá de esto el juego pierde el pulso. */
export const MC_FEEDBACK_MAX_SECONDS = 16;
/**
 * Segundos de registro antes de que empiece la lectura propiamente tal.
 *
 * Es tambien, exactamente, el compas en que se muestra el reparto de votos SIN
 * marcar todavia cual era la correcta — ver `mcAnswerRevealed`. Que las dos
 * cosas sean el mismo numero no es coincidencia: este golpe existe justamente
 * para que la sala registre algo antes de ponerse a leer.
 */
const MC_FEEDBACK_BEAT_SECONDS = 3;

/**
 * Ventana de revelación de UNA pregunta, a partir de su explicación.
 * Sin explicación se queda en el piso: no hay nada que leer.
 */
export function mcFeedbackSeconds(explanation?: string | null): number {
  const len = typeof explanation === 'string' ? explanation.trim().length : 0;
  if (len === 0) return MC_FEEDBACK_MIN_SECONDS;
  const needed = MC_FEEDBACK_BEAT_SECONDS + Math.ceil(len / MC_READ_CHARS_PER_SECOND);
  return Math.min(MC_FEEDBACK_MAX_SECONDS, Math.max(MC_FEEDBACK_MIN_SECONDS, needed));
}

/**
 * La revelación va en DOS TIEMPOS, como en Kahoot.
 *
 * Primero se llena el reparto de votos con las casillas en neutro: la sala ve
 * dónde está parada y todavía nadie sabe quién acertó. Recién después se
 * enciende la correcta. Ese segundo de suspenso es un momento colectivo, y es
 * todo el efecto; abriendo las dos cosas a la vez el gráfico pasa desapercibido
 * —de hecho pasó, porque la barra queda debajo de una casilla ya inundada de
 * verde—.
 *
 * `false` mientras corre el primer compás, `true` desde el segundo.
 *
 * No toca `mcTimeline` a propósito. Se deriva de `secondsLeft` en la fase
 * `feedback`, que ya sale del reloj compartido, así que el proyector y los
 * treinta teléfonos cambian de compás en el mismo instante sin que haya que
 * escribir ni leer nada nuevo en Firestore.
 *
 * @param secondsLeft lo que `mcTimeline` reporta en fase `feedback`.
 */
export function mcAnswerRevealed(
  explanation: string | null | undefined,
  secondsLeft: number,
): boolean {
  const total = mcFeedbackSeconds(explanation);
  // Sin explicación la ventana cae al piso de 6 s: ahí el compás se recorta para
  // no comerse la mitad de la revelación. Nunca deja al verde con menos de la
  // mitad de la ventana.
  const beat = Math.min(MC_FEEDBACK_BEAT_SECONDS, Math.floor(total / 2));
  const elapsed = total - secondsLeft;
  return elapsed >= beat;
}

/**
 * Largo de explicación que todavía cabe en el techo. Por encima de esto la
 * revelación se corta a mitad de frase; el validador avisa.
 */
export const MC_EXPLANATION_MAX_CHARS =
  (MC_FEEDBACK_MAX_SECONDS - MC_FEEDBACK_BEAT_SECONDS) * MC_READ_CHARS_PER_SECOND;

/** Extra headroom so a slow phone or a late joiner never gets cut off. */
export const MC_SLACK_SECONDS = 15;

export const MC_DEFAULT_TIME_LIMIT = 20;

export interface MCTimingQuestion {
  timeLimitSeconds?: number;
  /** La ventana de revelación se deriva de su largo — ver `mcFeedbackSeconds`. */
  explanation?: string | null;
}

/** Only the shape mcTiming cares about; the real MediaAsset lives in types/content. */
interface MediaLike {
  kind?: string;
  src?: string;
}

/** A question's limit, defaulting whatever the content left malformed. */
function limitOf(question: MCTimingQuestion | undefined): number {
  const limit = Number(question?.timeLimitSeconds);
  return Number.isFinite(limit) && limit > 0 ? limit : MC_DEFAULT_TIME_LIMIT;
}

/** Gate length for a round: long enough for its media clue, short otherwise. */
export function mcGateSeconds(media: MediaLike[] | undefined | null): number {
  return Array.isArray(media) && media.length > 0
    ? MC_GATE_WITH_MEDIA_SECONDS
    : MC_GATE_SECONDS;
}

export interface MCTimeline {
  /** gate = intro/media, question = clock running, feedback = answer revealed. */
  phase: 'gate' | 'question' | 'feedback' | 'done';
  /** Index of the question being asked or revealed. 0 during the gate. */
  questionIndex: number;
  /** Whole seconds left in the CURRENT phase, rounded up. */
  secondsLeft: number;
  /** Absolute ms at which the current question's clock started (0 during gate/done). */
  questionStartMs: number;
}

/**
 * What every screen should be showing, `nowMs` into a round that started at
 * `roundStartMs`. Pure: same inputs, same answer, on any device.
 *
 * Layout: [gate][q0][feedback][q1][feedback]...[done]
 */
export function mcTimeline({
  roundStartMs,
  nowMs,
  gateSeconds,
  questions,
  allAnsweredAtMs,
}: {
  roundStartMs: number;
  nowMs: number;
  gateSeconds: number;
  questions: MCTimingQuestion[];
  /**
   * Instant at which every player had answered, written once to the game doc by
   * the host. Truncates the question that was running — nobody waits out a clock
   * that has nothing left to decide. It moves the reveal EARLIER, never skips it:
   * the correct answer is shared, so everyone still gets the full feedback window.
   * Shared, like everything else here, so all screens cut at the same instant.
   */
  allAnsweredAtMs?: number | null;
}): MCTimeline {
  const secondsUntil = (ms: number) => Math.max(0, Math.ceil((ms - nowMs) / 1000));

  // roundStartTime is briefly absent right after the host advances the round.
  // Hold on the gate rather than guessing — never skip ahead into a question.
  if (!Number.isFinite(roundStartMs) || roundStartMs <= 0) {
    return { phase: 'gate', questionIndex: 0, secondsLeft: gateSeconds, questionStartMs: 0 };
  }

  const gateEnd = roundStartMs + gateSeconds * 1000;
  if (nowMs < gateEnd) {
    return { phase: 'gate', questionIndex: 0, secondsLeft: secondsUntil(gateEnd), questionStartMs: 0 };
  }

  let cursor = gateEnd;
  for (let i = 0; i < questions.length; i++) {
    const questionStartMs = cursor;
    const naturalEnd = questionStartMs + limitOf(questions[i]) * 1000;
    // Un corte solo cuenta si cae DENTRO de esta pregunta: uno anterior es de una
    // pregunta ya cerrada, y uno posterior no adelanta nada.
    const cut = Number(allAnsweredAtMs);
    const questionEnd = Number.isFinite(cut) && cut > questionStartMs && cut < naturalEnd
      ? cut
      : naturalEnd;
    if (nowMs < questionEnd) {
      return {
        phase: 'question',
        questionIndex: i,
        secondsLeft: secondsUntil(questionEnd),
        questionStartMs,
      };
    }

    const feedbackEnd = questionEnd + mcFeedbackSeconds(questions[i]?.explanation) * 1000;
    if (nowMs < feedbackEnd) {
      return {
        phase: 'feedback',
        questionIndex: i,
        secondsLeft: secondsUntil(feedbackEnd),
        questionStartMs,
      };
    }
    cursor = feedbackEnd;
  }

  return {
    phase: 'done',
    questionIndex: Math.max(0, questions.length - 1),
    secondsLeft: 0,
    questionStartMs: 0,
  };
}

/**
 * Should the host cut the running question short?
 *
 * Separated out and made pure because the first version of this lived inline in a
 * React effect and counted the WRONG THING: it used the submissions subcollection,
 * which is written once per block when the timeline reaches 'done'. So "everyone
 * has submitted" could only ever be true once the question had already closed, and
 * the cut never fired. `answeredCount` must come from a signal written when a
 * player actually answers — see the `answers` subcollection.
 */
export function shouldCutQuestion({
  phase,
  answeredCount,
  playerCount,
  alreadyCut,
}: {
  phase: MCTimeline['phase'];
  /** Players who have answered every question of this block. */
  answeredCount: number;
  playerCount: number;
  /** True once mcAllAnsweredAt is already stamped for this round. */
  alreadyCut: boolean;
}): boolean {
  if (alreadyCut) return false;
  // Solo tiene sentido cortar algo que todavia esta corriendo.
  if (phase !== 'question') return false;
  // Sin jugadores no hay nada que esperar, y no se corta por un lobby vacio.
  if (playerCount <= 0) return false;
  return answeredCount >= playerCount;
}

/**
 * Round duration for an MC block:
 *   gate + sum(question limits) + feedback per question + slack
 *
 * La ventana de feedback ya no es una constante: sale del largo de cada
 * `explanation`, entre 6 y 16 segundos. Por eso se suma pregunta a pregunta.
 *
 * e.g. 1 question x 20s, sin explicacion  -> 5 + 20 +  6 + 15 = 46
 *      1 question x 20s, explicacion 180  -> 5 + 20 + 13 + 15 = 53
 *      2 questions x 20s, explicaciones largas -> 5 + 40 + 32 + 15 = 92
 *
 * The slack matters less than it used to: on MC rounds the host closes the
 * round as soon as every player has answered (useGame.ts), so the tail is only
 * a backstop for a player who never answers at all.
 */
export function derivedMCRoundDuration(
  mcQuestions: MCTimingQuestion[] | undefined,
  media?: MediaLike[] | null,
): number {
  const questions = mcQuestions ?? [];
  const gate = mcGateSeconds(media);
  if (questions.length === 0) return gate + MC_SLACK_SECONDS;

  const limits = questions.reduce((sum, q) => sum + limitOf(q), 0);

  const feedback = questions.reduce((sum, q) => sum + mcFeedbackSeconds(q?.explanation), 0);

  return gate + limits + feedback + MC_SLACK_SECONDS;
}
