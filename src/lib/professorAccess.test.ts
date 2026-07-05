import { describe, it, expect } from 'vitest';
import { getProfessorAccess, canUsePlatform } from './professorAccess';

describe('getProfessorAccess', () => {
  it('admin email wins regardless of status', () => {
    expect(getProfessorAccess('naim.bro@gmail.com', undefined)).toBe('admin');
    expect(getProfessorAccess('naim.bro@gmail.com', 'rejected')).toBe('admin');
  });

  it('maps professor status', () => {
    expect(getProfessorAccess('otra@gmail.com', 'approved')).toBe('approved');
    expect(getProfessorAccess('otra@gmail.com', 'pending')).toBe('pending');
    expect(getProfessorAccess('otra@gmail.com', 'rejected')).toBe('rejected');
  });

  it('no profile -> none', () => {
    expect(getProfessorAccess('otra@gmail.com', undefined)).toBe('none');
    expect(getProfessorAccess(null, undefined)).toBe('none');
  });
});

describe('canUsePlatform', () => {
  it('only admin and approved can use it', () => {
    expect(canUsePlatform('admin')).toBe(true);
    expect(canUsePlatform('approved')).toBe(true);
    expect(canUsePlatform('pending')).toBe(false);
    expect(canUsePlatform('rejected')).toBe(false);
    expect(canUsePlatform('none')).toBe(false);
  });
});
