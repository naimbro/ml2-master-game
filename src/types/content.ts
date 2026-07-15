// Re-export common types from game.ts to avoid duplication
import type { SessionConfig, Scenario, IdealAnswer, JudgeWeight } from './game';
export type { SessionConfig, Scenario, IdealAnswer };

// =====================================
// SESSION CONTENT TYPES
// =====================================

export interface SessionContent {
  config: SessionConfig;
  scenarios: Scenario[];
  rubric: SessionRubric;
  knowledgeBase: string;
  referenceDocs: string[];
}

// JudgeConfigRef is an alias for JudgeWeight
export type JudgeConfigRef = JudgeWeight;

// =====================================
// RUBRIC TYPES
// =====================================

export interface SessionRubric {
  sessionId: string;
  globalInstructions: string;
  dimensions: RubricDimension[];
  bonusIndicators?: string[];
  penaltyIndicators?: string[];
}

export interface RubricDimension {
  id: string;
  name: string;
  weight: number;
  description: string;
  levels: RubricLevel[];
}

export interface RubricLevel {
  score: number;
  label: string;
  indicators: string[];
}

// =====================================
// JUDGE TYPES
// =====================================

export interface JudgesConfig {
  judges: Judge[];
  defaultWeights: Record<string, number>;
  evaluationSettings: EvaluationSettings;
}

export interface Judge {
  judgeId: string;
  courseId?: string;
  name: string;
  avatar: string;
  personality: string;
  evaluationStyle: string;
  focusDimensions: string[];
  promptTemplate: string;
}

export interface EvaluationSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  parallelEvaluation: boolean;
}

// =====================================
// CONTENT LOADER TYPES
// =====================================

export interface LoadedSession {
  config: SessionConfig;
  scenarios: Scenario[];
  rubric: SessionRubric;
  knowledgeBase: string;
  referenceDocsContent: string;
}

export interface ContentError {
  type: 'not_found' | 'parse_error' | 'validation_error';
  message: string;
  file?: string;
}
