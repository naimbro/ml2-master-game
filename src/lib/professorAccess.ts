import { isAdminEmail } from './config';

export type ProfessorStatus = 'pending' | 'approved' | 'rejected';
export type ProfessorAccess = 'admin' | 'approved' | 'pending' | 'rejected' | 'none';

export function getProfessorAccess(
  email: string | null | undefined,
  status: ProfessorStatus | undefined,
): ProfessorAccess {
  if (isAdminEmail(email)) return 'admin';
  if (status === 'approved' || status === 'pending' || status === 'rejected') return status;
  return 'none';
}

export function canUsePlatform(access: ProfessorAccess): boolean {
  return access === 'admin' || access === 'approved';
}
