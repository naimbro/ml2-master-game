import type { Timestamp } from 'firebase/firestore';
import type { ProfessorStatus } from '../lib/professorAccess';

export interface ProfessorProfile {
  uid: string;
  email: string;
  displayName: string;
  institution: string;
  motivation: string;
  status: ProfessorStatus;
  requestedAt: Timestamp;
  reviewedAt?: Timestamp;
}
