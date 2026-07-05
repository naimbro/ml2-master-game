// Pure mapping helpers: Firestore course/session docs -> the same shapes
// the hardcoded catalog in courses.ts produces. No firebase imports here
// (keeps this file unit-testable).
import type { Course, SessionOption } from './courses';

export interface CourseColor {
  id: string;
  accentClass: string;
  iconClass: string;
}

export const COURSE_COLORS: CourseColor[] = [
  { id: 'cyan', accentClass: 'from-cyan-500 to-purple-600', iconClass: 'bg-gradient-to-br from-cyan-500 to-purple-600' },
  { id: 'rose', accentClass: 'from-rose-500 to-amber-500', iconClass: 'bg-gradient-to-br from-rose-500 to-amber-500' },
  { id: 'emerald', accentClass: 'from-emerald-500 to-teal-600', iconClass: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { id: 'blue', accentClass: 'from-blue-500 to-indigo-600', iconClass: 'bg-gradient-to-br from-blue-500 to-indigo-600' },
  { id: 'amber', accentClass: 'from-amber-500 to-orange-600', iconClass: 'bg-gradient-to-br from-amber-500 to-orange-600' },
];

export function colorById(id: string | undefined): CourseColor {
  return COURSE_COLORS.find((c) => c.id === id) ?? COURSE_COLORS[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function courseDocToCourse(id: string, data: any): Course {
  const color = colorById(data.color);
  return {
    id,
    name: data.name || 'Curso sin nombre',
    shortName: data.shortName || (data.name || '?').slice(0, 4),
    tagline: data.tagline || '',
    accentClass: color.accentClass,
    iconClass: color.iconClass,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sessionDocToOption(courseId: string, id: string, data: any): SessionOption {
  const scenarios = data.scenarios || [];
  const durationSeconds = data.config?.roundDurationSeconds || 300;
  return {
    id,
    courseId,
    title: data.title || data.config?.title || 'Sesión sin título',
    description: data.description || data.config?.description || '',
    rounds: scenarios.length,
    duration: Math.round(durationSeconds / 60),
    config: data.config || {},
    scenarios,
    rubric: data.rubric || {},
    knowledgeBase: data.knowledgeBase || '',
  };
}
