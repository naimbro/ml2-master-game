import { Timestamp } from 'firebase/firestore';

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

  // Status
  status: GameStatus;
  currentRound: number;
  totalRounds: number;

  // Timing
  roundStartTime?: Timestamp;
  roundEndTime?: Timestamp;
  roundDurationSeconds: number;

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
  imageSrc?: string; // optional picture-answer (same resolution rules as MediaAsset.src)
  imageAlt?: string;
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
  mcQuestions?: MCQuestion[];
  media?: MediaAsset[];                 // open-round scenario card / MC block intro
  context: string;
  question: string;
  conceptTags: string[];
  idealAnswer?: IdealAnswer;
  referenceAnswer?: string;
  // AI-generated scenarios carry their full case text in a single `prompt`
  // field instead of separate `context`/`question`.
  prompt?: string;
  judgeFocus?: string;
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
