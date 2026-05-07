// Single source of truth for which courses + sessions exist.
// Imported by professor Dashboard (course cards) and CreateGame (session list).

import session1Config from '../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/config.json';
import session1Scenarios from '../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/scenarios.json';
import session1Rubric from '../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/rubric.json';
import session1KnowledgeBase from '../../content/sessions/ml2-2025/session_1_ia_procesos_sector_publico/knowledge_base.md?raw';

import session2Config from '../../content/sessions/ml2-2025/session_2_apis/config.json';
import session2Scenarios from '../../content/sessions/ml2-2025/session_2_apis/scenarios.json';
import session2Rubric from '../../content/sessions/ml2-2025/session_2_apis/rubric.json';
import session2KnowledgeBase from '../../content/sessions/ml2-2025/session_2_apis/knowledge_base.md?raw';

import session3Config from '../../content/sessions/ml2-2025/session_3_rag/config.json';
import session3Scenarios from '../../content/sessions/ml2-2025/session_3_rag/scenarios.json';
import session3Rubric from '../../content/sessions/ml2-2025/session_3_rag/rubric.json';
import session3KnowledgeBase from '../../content/sessions/ml2-2025/session_3_rag/knowledge_base.md?raw';

import session4Config from '../../content/sessions/ml2-2025/session_4_rag_applied/config.json';
import session4Scenarios from '../../content/sessions/ml2-2025/session_4_rag_applied/scenarios.json';
import session4Rubric from '../../content/sessions/ml2-2025/session_4_rag_applied/rubric.json';
import session4KnowledgeBase from '../../content/sessions/ml2-2025/session_4_rag_applied/knowledge_base.md?raw';

import aydDemoConfig from '../../content/sessions/ai_democracy_2026/unidad_00_demo/config.json';
import aydDemoScenarios from '../../content/sessions/ai_democracy_2026/unidad_00_demo/scenarios.json';
import aydDemoRubric from '../../content/sessions/ai_democracy_2026/unidad_00_demo/rubric.json';
import aydDemoKnowledgeBase from '../../content/sessions/ai_democracy_2026/unidad_00_demo/knowledge_base.md?raw';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

export interface SessionOption {
  id: string;
  courseId: string;
  title: string;
  description: string;
  rounds: number;
  duration: number;
  config: AnyJson;
  scenarios: AnyJson;
  rubric: AnyJson;
  knowledgeBase: string;
}

export interface Course {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  accentClass: string;
  iconClass: string;
}

export const COURSES: Course[] = [
  {
    id: 'ml2-2025',
    name: 'Machine Learning II',
    shortName: 'ML II',
    tagline: 'IA generativa aplicada al sector publico',
    accentClass: 'from-cyan-500 to-purple-600',
    iconClass: 'bg-gradient-to-br from-cyan-500 to-purple-600',
  },
  {
    id: 'ai_democracy_2026',
    name: 'IA y Democracia',
    shortName: 'AyD',
    tagline: 'Tensiones democraticas de la IA en seis unidades',
    accentClass: 'from-rose-500 to-amber-500',
    iconClass: 'bg-gradient-to-br from-rose-500 to-amber-500',
  },
];

export const SESSIONS: SessionOption[] = [
  {
    id: 'session_1_ia_procesos_sector_publico',
    courseId: 'ml2-2025',
    title: 'Sesion 1: IA, Procesos y Sector Publico',
    description: '6 rondas: estructuracion de procesos, TRL, limites de IA, feria de familias, preferencias y estilo de trabajo',
    rounds: 6,
    duration: 5,
    config: session1Config,
    scenarios: session1Scenarios,
    rubric: session1Rubric,
    knowledgeBase: session1KnowledgeBase,
  },
  {
    id: 'session_2_apis',
    courseId: 'ml2-2025',
    title: session2Config.title,
    description: session2Config.description,
    rounds: session2Scenarios.length,
    duration: Math.round(session2Config.roundDurationSeconds / 60),
    config: session2Config,
    scenarios: session2Scenarios,
    rubric: session2Rubric,
    knowledgeBase: session2KnowledgeBase,
  },
  {
    id: 'session_3_rag',
    courseId: 'ml2-2025',
    title: session3Config.title,
    description: session3Config.description,
    rounds: session3Scenarios.length,
    duration: Math.round(session3Config.roundDurationSeconds / 60),
    config: session3Config,
    scenarios: session3Scenarios,
    rubric: session3Rubric,
    knowledgeBase: session3KnowledgeBase,
  },
  {
    id: 'session_4_rag_applied',
    courseId: 'ml2-2025',
    title: session4Config.title,
    description: session4Config.description,
    rounds: session4Scenarios.length,
    duration: Math.round(session4Config.roundDurationSeconds / 60),
    config: session4Config,
    scenarios: session4Scenarios,
    rubric: session4Rubric,
    knowledgeBase: session4KnowledgeBase,
  },
  {
    id: 'unidad_00_demo',
    courseId: 'ai_democracy_2026',
    title: aydDemoConfig.title,
    description: aydDemoConfig.description,
    rounds: aydDemoScenarios.length,
    duration: Math.round(aydDemoConfig.roundDurationSeconds / 60),
    config: aydDemoConfig,
    scenarios: aydDemoScenarios,
    rubric: aydDemoRubric,
    knowledgeBase: aydDemoKnowledgeBase,
  },
];

export function getCourse(courseId: string): Course | undefined {
  return COURSES.find((c) => c.id === courseId);
}

export function getSessionsForCourse(courseId: string): SessionOption[] {
  return SESSIONS.filter((s) => s.courseId === courseId);
}
