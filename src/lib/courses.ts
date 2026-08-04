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

import aydC01Config from '../../content/sessions/ai_democracy_2026/clase_01_introduccion/config.json';
import aydC01Scenarios from '../../content/sessions/ai_democracy_2026/clase_01_introduccion/scenarios.json';
import aydC01Rubric from '../../content/sessions/ai_democracy_2026/clase_01_introduccion/rubric.json';
import aydC01KnowledgeBase from '../../content/sessions/ai_democracy_2026/clase_01_introduccion/knowledge_base.md?raw';

import teB2Config from '../../content/sessions/temas_emergentes_2026/bloque_2_concentracion_frontera/config.json';
import teB2Scenarios from '../../content/sessions/temas_emergentes_2026/bloque_2_concentracion_frontera/scenarios.json';
import teB2Rubric from '../../content/sessions/temas_emergentes_2026/bloque_2_concentracion_frontera/rubric.json';
import teB2KnowledgeBase from '../../content/sessions/temas_emergentes_2026/bloque_2_concentracion_frontera/knowledge_base.md?raw';

import teB3Config from '../../content/sessions/temas_emergentes_2026/bloque_3_captura_populismo/config.json';
import teB3Scenarios from '../../content/sessions/temas_emergentes_2026/bloque_3_captura_populismo/scenarios.json';
import teB3Rubric from '../../content/sessions/temas_emergentes_2026/bloque_3_captura_populismo/rubric.json';
import teB3KnowledgeBase from '../../content/sessions/temas_emergentes_2026/bloque_3_captura_populismo/knowledge_base.md?raw';

import mundialFinalConfig from '../../content/sessions/mundial_2026/final_2026/config.json';
import mundialFinalScenarios from '../../content/sessions/mundial_2026/final_2026/scenarios.json';
import mundialFinalRubric from '../../content/sessions/mundial_2026/final_2026/rubric.json';
import mundialFinalKnowledgeBase from '../../content/sessions/mundial_2026/final_2026/knowledge_base.md?raw';

import mundialKahootConfig from '../../content/sessions/mundial_2026/kahoot_only/config.json';
import mundialKahootScenarios from '../../content/sessions/mundial_2026/kahoot_only/scenarios.json';
import mundialKahootRubric from '../../content/sessions/mundial_2026/kahoot_only/rubric.json';
import mundialKahootKnowledgeBase from '../../content/sessions/mundial_2026/kahoot_only/knowledge_base.md?raw';

import dvC01Config from '../../content/sessions/dataviz_2026/clase_01_diagnostico/config.json';
import dvC01Scenarios from '../../content/sessions/dataviz_2026/clase_01_diagnostico/scenarios.json';
import dvC01Rubric from '../../content/sessions/dataviz_2026/clase_01_diagnostico/rubric.json';
import dvC01KnowledgeBase from '../../content/sessions/dataviz_2026/clase_01_diagnostico/knowledge_base.md?raw';

import mgtC01Config from '../../content/sessions/mgt300_2026/clase_01_piensa_primero/config.json';
import mgtC01Scenarios from '../../content/sessions/mgt300_2026/clase_01_piensa_primero/scenarios.json';
import mgtC01Rubric from '../../content/sessions/mgt300_2026/clase_01_piensa_primero/rubric.json';
import mgtC01KnowledgeBase from '../../content/sessions/mgt300_2026/clase_01_piensa_primero/knowledge_base.md?raw';

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
  {
    id: 'temas_emergentes_2026',
    name: 'Temas Emergentes',
    shortName: 'TE',
    tagline: 'Magister en Economia y Politicas Publicas (UAI)',
    accentClass: 'from-emerald-500 to-teal-600',
    iconClass: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
  {
    id: 'mundial_2026',
    name: 'Mundial 2026',
    shortName: 'MUN',
    tagline: 'Demo docente — opcion multiple, imagenes y audio',
    accentClass: 'from-amber-500 to-orange-600',
    iconClass: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
  {
    id: 'dataviz_2026',
    name: 'Descripcion y Visualizacion de Datos',
    shortName: 'DVD',
    tagline: 'Doble titulo Sociologia - Ingenieria Comercial (UAI)',
    accentClass: 'from-sky-500 to-indigo-600',
    iconClass: 'bg-gradient-to-br from-sky-500 to-indigo-600',
  },
  {
    id: 'mgt300_2026',
    name: 'Sociedad, Cultura y Politica',
    shortName: 'MGT300',
    tagline: 'Ingenieria Comercial, Escuela de Negocios (UAI)',
    accentClass: 'from-teal-600 to-slate-700',
    iconClass: 'bg-gradient-to-br from-teal-600 to-slate-700',
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
  {
    id: 'clase_01_introduccion',
    courseId: 'ai_democracy_2026',
    title: aydC01Config.title,
    description: aydC01Config.description,
    rounds: aydC01Scenarios.length,
    duration: Math.round(aydC01Config.roundDurationSeconds / 60),
    config: aydC01Config,
    scenarios: aydC01Scenarios,
    rubric: aydC01Rubric,
    knowledgeBase: aydC01KnowledgeBase,
  },
  {
    id: 'bloque_2_concentracion_frontera',
    courseId: 'temas_emergentes_2026',
    title: teB2Config.title,
    description: teB2Config.description,
    rounds: teB2Scenarios.length,
    duration: Math.round(teB2Config.roundDurationSeconds / 60),
    config: teB2Config,
    scenarios: teB2Scenarios,
    rubric: teB2Rubric,
    knowledgeBase: teB2KnowledgeBase,
  },
  {
    id: 'bloque_3_captura_populismo',
    courseId: 'temas_emergentes_2026',
    title: teB3Config.title,
    description: teB3Config.description,
    rounds: teB3Scenarios.length,
    duration: Math.round(teB3Config.roundDurationSeconds / 60),
    config: teB3Config,
    scenarios: teB3Scenarios,
    rubric: teB3Rubric,
    knowledgeBase: teB3KnowledgeBase,
  },
  {
    id: 'final_2026',
    courseId: 'mundial_2026',
    title: mundialFinalConfig.title,
    description: mundialFinalConfig.description,
    rounds: mundialFinalScenarios.length,
    duration: Math.round(mundialFinalConfig.roundDurationSeconds / 60),
    config: mundialFinalConfig,
    scenarios: mundialFinalScenarios,
    rubric: mundialFinalRubric,
    knowledgeBase: mundialFinalKnowledgeBase,
  },
  {
    id: 'kahoot_only',
    courseId: 'mundial_2026',
    title: mundialKahootConfig.title,
    description: mundialKahootConfig.description,
    rounds: mundialKahootScenarios.length,
    duration: Math.round(mundialKahootConfig.roundDurationSeconds / 60),
    config: mundialKahootConfig,
    scenarios: mundialKahootScenarios,
    rubric: mundialKahootRubric,
    knowledgeBase: mundialKahootKnowledgeBase,
  },
  {
    id: 'clase_01_diagnostico',
    courseId: 'dataviz_2026',
    title: dvC01Config.title,
    description: dvC01Config.description,
    rounds: dvC01Scenarios.length,
    duration: Math.round(dvC01Config.roundDurationSeconds / 60),
    config: dvC01Config,
    scenarios: dvC01Scenarios,
    rubric: dvC01Rubric,
    knowledgeBase: dvC01KnowledgeBase,
  },
  {
    id: 'clase_01_piensa_primero',
    courseId: 'mgt300_2026',
    title: mgtC01Config.title,
    description: mgtC01Config.description,
    rounds: mgtC01Scenarios.length,
    duration: Math.round(mgtC01Config.roundDurationSeconds / 60),
    config: mgtC01Config,
    scenarios: mgtC01Scenarios,
    rubric: mgtC01Rubric,
    knowledgeBase: mgtC01KnowledgeBase,
  },
];

export function getCourse(courseId: string): Course | undefined {
  return COURSES.find((c) => c.id === courseId);
}

export function getSessionsForCourse(courseId: string): SessionOption[] {
  return SESSIONS.filter((s) => s.courseId === courseId);
}
