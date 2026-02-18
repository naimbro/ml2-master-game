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
}

export interface RoundResults {
  round: number;
  ranked: boolean;
  rankings: RoundRanking[];
  processedAt: Timestamp;
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
  context: string;
  question: string;
  conceptTags: string[];
  idealAnswer?: IdealAnswer;
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
