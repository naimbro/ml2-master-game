import { describe, it, expect } from 'vitest';
import { courseDocToCourse, sessionDocToOption, colorById, COURSE_COLORS } from './courseMappers';

describe('colorById', () => {
  it('finds a color by id and falls back to the first one', () => {
    expect(colorById('emerald').id).toBe('emerald');
    expect(colorById('nope')).toBe(COURSE_COLORS[0]);
    expect(colorById(undefined)).toBe(COURSE_COLORS[0]);
  });
});

describe('courseDocToCourse', () => {
  it('maps a firestore course doc to the Course shape', () => {
    const course = courseDocToCourse('abc123', {
      name: 'Políticas Públicas',
      shortName: 'PP',
      tagline: 'Curso de prueba',
      color: 'emerald',
      professorId: 'uid1',
    });
    expect(course.id).toBe('abc123');
    expect(course.name).toBe('Políticas Públicas');
    expect(course.accentClass).toContain('emerald');
    expect(course.iconClass).toContain('emerald');
  });

  it('defaults missing fields', () => {
    const course = courseDocToCourse('x', {});
    expect(course.name).toBe('Curso sin nombre');
    expect(course.tagline).toBe('');
    expect(course.accentClass).toBe(COURSE_COLORS[0].accentClass);
  });
});

describe('sessionDocToOption', () => {
  it('maps a firestore session doc to the SessionOption shape', () => {
    const opt = sessionDocToOption('course1', 'sess1', {
      title: 'Sesión 1',
      description: 'desc',
      config: { roundDurationSeconds: 240 },
      scenarios: [{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }],
      rubric: { dimensions: [] },
      knowledgeBase: '# KB',
    });
    expect(opt.id).toBe('sess1');
    expect(opt.courseId).toBe('course1');
    expect(opt.rounds).toBe(3);
    expect(opt.duration).toBe(4);
    expect(opt.knowledgeBase).toBe('# KB');
  });

  it('defaults duration to 5 min and rounds to 0 when data is missing', () => {
    const opt = sessionDocToOption('c', 's', {});
    expect(opt.rounds).toBe(0);
    expect(opt.duration).toBe(5);
    expect(opt.title).toBe('Sesión sin título');
  });
});
