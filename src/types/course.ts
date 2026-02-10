import { Timestamp } from 'firebase/firestore';

// =====================================
// COURSE TYPES
// =====================================

export interface Course {
  courseId: string;
  name: string;
  code?: string;
  description?: string;
  professorId: string;
  professorEmail: string;
  professorName?: string;
  startDate?: string;
  endDate?: string;
  sessions: string[]; // List of session IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CourseEnrollment {
  students: EnrolledStudent[];
}

export interface EnrolledStudent {
  email: string;
  name: string;
  enrolledAt: string;
  studentId?: string; // Firebase UID once they login
}

// =====================================
// STUDENT PROFILE TYPES
// =====================================

export interface StudentProfile {
  id: string;
  name: string;
  email: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  enrollments: Record<string, CourseEnrollmentInfo>;
}

export interface CourseEnrollmentInfo {
  courseId: string;
  courseName: string;
  enrolledAt: Timestamp;
  role: 'student' | 'professor';
}

export interface StudentCourseData {
  courseId: string;
  conceptMastery: Record<string, ConceptMastery>;
  sessionHistory: Record<string, SessionHistoryEntry>;
  cumulativeStats: CumulativeStats;
}

export interface ConceptMastery {
  concept: string;
  occurrences: number;
  averageScore: number;
  scores: number[];
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Timestamp;
}

export interface SessionHistoryEntry {
  sessionId: string;
  sessionTitle: string;
  gameCode: string;
  completedAt: Timestamp;
  score: number;
  rank: number;
  totalPlayers: number;
  percentile: number;
  conceptsIdentified: string[];
}

export interface CumulativeStats {
  totalSessions: number;
  averageScore: number;
  averageRank: number;
  averagePercentile: number;
  bestSession: {
    sessionId: string;
    score: number;
  };
  worstSession: {
    sessionId: string;
    score: number;
  };
  improvement: number; // First session vs last session delta
}

// =====================================
// ANALYTICS TYPES
// =====================================

export interface SessionClassReport {
  courseId: string;
  sessionId: string;
  sessionName: string;
  generatedAt: Timestamp;

  // Participation
  totalEnrolled: number;
  totalParticipated: number;
  participationRate: number;

  // Score distribution
  classAverage: number;
  median: number;
  standardDeviation: number;
  scoreDistribution: ScoreRange[];

  // Leaderboard
  topPerformers: TopPerformer[];

  // Concept analysis
  conceptPerformance: ConceptPerformance[];

  // At-risk students
  studentsNeedingAttention: AtRiskStudent[];

  // Question difficulty
  questionDifficulty: QuestionDifficulty[];
}

export interface ScoreRange {
  range: string;
  count: number;
}

export interface TopPerformer {
  name: string;
  score: number;
  rank: number;
}

export interface ConceptPerformance {
  concept: string;
  classAverage: number;
  studentsStruggling: number;
  studentsExcelling: number;
}

export interface AtRiskStudent {
  name: string;
  email: string;
  score: number;
  weakConcepts: string[];
}

export interface QuestionDifficulty {
  scenarioTitle: string;
  averageScore: number;
  hardestForClass: boolean;
}

// =====================================
// CUMULATIVE CLASS REPORT
// =====================================

export interface CumulativeClassReport {
  courseId: string;
  courseName: string;
  generatedAt: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;

  // Overall metrics
  sessionsCompleted: number;
  totalStudents: number;
  averageParticipationRate: number;
  overallClassAverage: number;

  // Progress over time
  sessionProgress: SessionProgress[];

  // Student rankings (cumulative)
  finalRankings: FinalRanking[];

  // Concept mastery evolution
  conceptMasteryTrend: ConceptTrend[];

  // Students needing intervention
  atRiskStudents: AtRiskStudentCumulative[];

  // AI-generated insights
  classInsights: string[];
}

export interface SessionProgress {
  sessionNumber: number;
  sessionName: string;
  classAverage: number;
  participation: number;
}

export interface FinalRanking {
  rank: number;
  name: string;
  email: string;
  averageScore: number;
  sessionsAttended: number;
  improvement: number;
}

export interface ConceptTrend {
  concept: string;
  sessionScores: { session: number; avgScore: number }[];
  trend: 'improving' | 'stable' | 'declining';
}

export interface AtRiskStudentCumulative {
  name: string;
  email: string;
  averageScore: number;
  attendance: number;
  trend: string;
  suggestedIntervention: string;
}

// =====================================
// ORAL TASK TYPES
// =====================================

export interface OralTask {
  id: string;
  studentId: string;
  courseId: string;
  gameCode: string;
  basedOnScore: number;

  title: string;
  description: string;
  focusConcepts: string[];

  requirements: {
    minDuration: number;
    maxDuration: number;
    requiredElements: string[];
  };

  preparationGuide: {
    readings: string[];
    keyQuestions: string[];
    tips: string[];
  };

  status: 'pending' | 'submitted' | 'reviewed';
  generatedAt: Timestamp;
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
  professorFeedback?: string;
  finalGrade?: number;
}

// =====================================
// STUDENT REPORT TYPES
// =====================================

export interface StudentSessionReport {
  gameCode: string;
  sessionTitle: string;
  playerId: string;
  playerName?: string;
  totalRounds: number;
  completedRounds: number;
  averageScore: number;
  rank?: number;
  totalPlayers?: number;
  percentile?: number;

  roundDetails: RoundDetail[];

  summary: {
    strengths: string[];
    improvements: string[];
    conceptsIdentified: string[];
  };

  generatedAt: Timestamp;
}

export interface RoundDetail {
  round: number;
  scenario: string;
  response: string;
  evaluation?: {
    finalScore: number;
    evaluations: JudgeEvaluationSummary[];
    conceptsIdentified: string[];
  };
}

export interface JudgeEvaluationSummary {
  judgeName: string;
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}
