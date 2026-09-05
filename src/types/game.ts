import { Timestamp } from 'firebase/firestore';
import type { MCQuestionStats } from '../lib/mcStats';

// =====================================
// GAME STATE TYPES
// =====================================

export type GameStatus = 'waiting' | 'active' | 'round_end' | 'finished';

export interface Player {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  joinedAt: Timestamp;
  isReady: boolean;
  totalScore: number;
  currentRoundScore?: number;
}

export interface Game {
  gameCode: string;
  courseId: string;
  sessionId: string;
  hostId: string;
  hostName: string;
  /**
   * Si el anfitrion entro como jugador. Se elige al crear el juego y por defecto
   * es false: corriendo el juego con el curso, el profesor dirige y no contesta.
   * Importa mas de lo que parece — un anfitrion dentro de `players` que no
   * responde bloquea los dos cortes anticipados, que comparan contra
   * `playerCount`, y cada pregunta termina quemando su reloj completo.
   * Ausente en juegos creados antes de 2026-08-04, donde el anfitrion siempre
   * entraba como jugador; leerlo como `game.players[hostId] != null`, no como
   * `hostPlays === true`.
   */
  hostPlays?: boolean;

  // Status
  status: GameStatus;
  currentRound: number;
  totalRounds: number;

  // Timing
  roundStartTime?: Timestamp;
  roundEndTime?: Timestamp;
  roundDurationSeconds: number;
  /**
   * MC only: instant at which every player had answered the running question.
   * Written once per round by the host; truncates the question on every screen at
   * the same moment (see mcTimeline). Cleared when the round advances.
   */
  mcAllAnsweredAt?: Timestamp;
  /**
   * MC only: cuantos eligieron cada alternativa, por pregunta ya cerrada.
   * Clave `r{ronda}q{indice}` (ver `src/lib/mcStats.ts`). Lo escribe el
   * anfitrion al entrar la pregunta en 'feedback', agregando la subcoleccion
   * `choices`, que solo el puede leer. Es la unica forma publica de saber que
   * eligio el curso: los datos crudos nunca salen de ahi.
   */
  mcStats?: Record<string, MCQuestionStats>;

  // Config from session
  sessionConfig: SessionConfig;
  scenarios: Scenario[];
  knowledgeBase?: string;
  referenceDocs?: string;

  // Players
  players: Record<string, Player>;
  playerCount: number;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  finishedAt?: Timestamp;
}

// =====================================
// SUBMISSION TYPES
// =====================================

export interface Submission {
  id: string;
  gameCode: string;
  playerId: string;
  playerName: string;
  round: number;
  response: string;
  submittedAt: Timestamp;
  evaluated: boolean;
  evaluation?: SubmissionEvaluation;
  // MC block fields
  mcResponses?: MCResponse[];
  mcBlockScore?: number;
}

export interface SubmissionEvaluation {
  finalScore: number;
  evaluations: JudgeEvaluation[];
  conceptsIdentified: string[];
  processedAt: Timestamp;
}

export interface JudgeEvaluation {
  judgeId: string;
  judgeName: string;
  judgeAvatar?: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  rawResponse?: Record<string, unknown>;
  parsedSignals?: StudentSignals;
}

export interface StudentSignals {
  interestByScenario?: Record<string, number>;
  sectorKnowledge?: Record<string, number>;
  technicalConfidence?: Record<string, number>;
  preferredRole?: string;
  comfortProcessDesign?: number;
  comfortPipelineBuilding?: number;
  openQuestion?: string;
  extractionConfidence?: number;
}

// =====================================
// ROUND RESULTS
// =====================================

export interface RoundRanking {
  playerId: string;
  playerName: string;
  score: number;
  rank: number;
  totalScore?: number; // cumulative total (avoids race condition with game doc)
  provScore?: number;
  provRank?: number;
}

export interface RoundResults {
  round: number;
  ranked: boolean;
  rankings: RoundRanking[];
  processedAt: Timestamp;
  phase?: 'provisional' | 'final';
  duelTotal?: number;
  /** Cuando entro a la tabla alguien que envio despues de que se cerro. */
  amendedAt?: Timestamp;
  /** Presente solo si la ronda paso por duelos; entonces ya no se enmienda. */
  recalibratedAt?: Timestamp;
}

// =====================================
// LIVE RECALIBRATION DUELS
// =====================================

export interface DuelSide { name: string; provRank: number; provScore: number; }
export interface RoundDuel {
  seq: number;
  a: DuelSide;
  b: DuelSide;
  winner: 'a' | 'b' | 'tie';
  isUpset: boolean;
  isClimax?: boolean;
}

// =====================================
// LEADERBOARD
// =====================================

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  photoURL?: string;
  totalScore: number;
  roundScores: number[];
  rank: number;
}

// =====================================
// MEDIA
// =====================================

// `src` is either a path relative to the app's base URL (e.g.
// 'media/mundial/bandera.jpg' -> public/media/mundial/bandera.jpg) or an
// absolute https:// URL. Always resolve through resolveMediaSrc() in
// src/components/MediaBlock.tsx — the app is served from a sub-path on GitHub
// Pages, so a bare '/media/...' 404s in production only.
export interface MediaAsset {
  kind: 'image' | 'audio';
  src: string;
  alt?: string;      // alt text for images; also the fallback shown if the asset fails
  credit?: string;   // attribution line (required for CC BY-SA assets)
}

// =====================================
// MULTIPLE CHOICE TYPES
// =====================================

export interface MCOption {
  id: string;        // 'A', 'B', 'C', 'D'
  text: string;
  imageSrc?: string;  // optional picture-answer (same resolution rules as MediaAsset.src)
  imageAlt?: string;
  imageCredit?: string; // attribution — required by CC BY assets, rendered under the image
}

export interface MCQuestion {
  question: string;
  options: MCOption[];
  correctOptionIndex: number;
  timeLimitSeconds: number;
  media?: MediaAsset[];   // shown above the options
  explanation?: string;   // shown during the post-answer feedback beat
}

export interface MCResponse {
  questionIndex: number;
  selectedOptionId: string | null;  // null if timed out
  responseTimeMs: number;
  correct: boolean;
  pointsAwarded: number;
}

// =====================================
// CONTENT TYPES (imported during game creation)
// =====================================

export interface SessionConfig {
  sessionId: string;
  title: string;
  description?: string;
  date?: string;
  roundCount: number;
  roundDurationSeconds: number;
  bufferSeconds?: number;
  conceptTags: string[];
  judges: JudgeWeight[];
}

export interface JudgeWeight {
  judgeId: string;
  weight: number;
}

export interface Scenario {
  id: string;
  order: number;
  title: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  ranked?: boolean;
  durationSeconds?: number;
  type?: 'open' | 'multiple_choice';    // default 'open'
  /**
   * Solo rondas abiertas. `'code'` cambia el textarea a monoespaciado y apaga
   * autocorreccion, autocapitalizacion y corrector ortografico: en un teclado de
   * telefono `count(curso, dominio)` se envia como `Count(Curso, dominio)` y el
   * juez termina puntuando al corrector de iOS. Default `'prose'`.
   */
  answerFormat?: 'prose' | 'code';
  mcQuestions?: MCQuestion[];
  media?: MediaAsset[];                 // open-round scenario card / MC block intro
  context: string;
  question: string;
  conceptTags: string[];
  /**
   * Dos formas, las dos vivas. El objeto es la original; el texto corrido es lo
   * que usan todas las sesiones escritas desde 2026 y lo que genera el asistente
   * (`functions/src/lib/sessionDraft.ts`). El prompt del juez le pasa un
   * `JSON.stringify` encima, asi que las dos llegan legibles.
   */
  idealAnswer?: IdealAnswer | string;
  referenceAnswer?: string;
  // AI-generated scenarios carry their full case text in a single `prompt`
  // field instead of separate `context`/`question`.
  prompt?: string;
  judgeFocus?: string;
  /** Guia de evaluacion por pregunta; manda sobre `idealAnswer` en el prompt del juez. */
  evaluationGuide?: {
    must_hit?: string[];
    nice_to_have?: string[];
    fatal_errors?: string[];
  };
  /**
   * Solo rondas `ranked: false`: que campos debe extraer el juez a `parsedSignals`.
   * Sin esto, el motor cae a las ramas hardcodeadas de ml2-2025 y le pide al juez
   * los campos de otro curso (functions/src/lib/signalSchema.ts).
   */
  signalSchema?: {
    instructions?: string;
    fields: Array<{
      key: string;
      label?: string;
      type?: string;
      values?: string[];
      description?: string;
    }>;
  };
}

export interface IdealAnswer {
  keyPoints: string[];
  expectedConcepts: string[];
  commonMistakes: string[];
  excellentResponseIndicators?: string[];
}

// =====================================
// PLAYER ACTIONS
// =====================================

export interface JoinGamePayload {
  gameCode: string;
  playerName: string;
}

export interface SubmitAnswerPayload {
  gameCode: string;
  round: number;
  response: string;
}
