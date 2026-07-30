// Red de seguridad del registro de sesiones.
//
// Escrito ANTES de reemplazar los 36 imports a mano por import.meta.glob, para
// que el refactor tenga contra qué compararse. Corre en vitest y no en tsx a
// proposito: `?raw` es una feature de Vite y `npx tsx` no la resuelve, asi que
// esto es lo unico que puede verificar el registro en runtime.

import { describe, it, expect } from 'vitest';
import { COURSES, SESSIONS, getCourse, getSessionsForCourse } from './courses';

describe('registro de sesiones', () => {
  it('registra las sesiones publicadas', () => {
    const ids = SESSIONS.map((s) => s.id);
    for (const id of [
      'session_1_ia_procesos_sector_publico',
      'session_2_apis',
      'session_3_rag',
      'session_4_rag_applied',
      'unidad_00_demo',
      'bloque_2_concentracion_frontera',
      'bloque_3_captura_populismo',
      'final_2026',
      'kahoot_only',
      'clase_01_diagnostico',
    ]) {
      expect(ids, `falta ${id}`).toContain(id);
    }
  });

  it('no publica las sesiones placeholder que nunca estuvieron registradas', () => {
    const ids = SESSIONS.map((s) => s.id);
    expect(ids).not.toContain('session_1_llm_fundamentals');
    expect(ids).not.toContain('unidad_01_backlash');
    expect(ids).not.toContain('bloque_1_backlash_diagnostico');
  });

  it('cada sesion apunta a un curso que existe', () => {
    for (const s of SESSIONS) {
      expect(getCourse(s.courseId), `curso desconocido: ${s.courseId}`).toBeDefined();
    }
  });

  it('agrupa por curso sin perder ninguna sesion', () => {
    const grouped = COURSES.flatMap((c) => getSessionsForCourse(c.id));
    expect(grouped.length).toBe(SESSIONS.length);
  });
});

describe('clase_01_diagnostico', () => {
  const session = () => SESSIONS.find((s) => s.id === 'clase_01_diagnostico')!;

  it('deriva rounds de los escenarios y duration de roundDurationSeconds', () => {
    const s = session();
    expect(s.rounds).toBe(s.scenarios.length);
    expect(s.rounds).toBe(5);
    expect(s.duration).toBe(Math.round(s.config.roundDurationSeconds / 60));
  });

  it('carga el knowledge base como texto, no como modulo', () => {
    const kb = session().knowledgeBase;
    expect(typeof kb).toBe('string');
    expect(kb.length).toBeGreaterThan(100);
  });

  it('usa el panel _generic con pesos que suman 1', () => {
    const judges = session().config.judges as { judgeId: string; weight: number }[];
    expect(judges.map((j) => j.judgeId)).toEqual([
      'generic_specialist',
      'generic_praxis',
      'generic_teacher',
    ]);
    expect(judges.reduce((sum, j) => sum + j.weight, 0)).toBeCloseTo(1, 5);
  });

  // Sin weightFormula los tres generic_* caen a los pesos de la rubrica y dejan
  // de estar diferenciados, en silencio: defaultFormulas en functions/src/index.ts
  // solo conoce los judgeIds historicos.
  it('declara una weightFormula por juez', () => {
    const jc = session().config.judgeConfig as Record<string, { weightFormula?: string }>;
    for (const id of ['generic_specialist', 'generic_praxis', 'generic_teacher']) {
      expect(jc?.[id]?.weightFormula, `falta weightFormula para ${id}`).toBeTruthy();
    }
  });

  // Las cuatro rondas de opcion multiple compiten; la abierta de senales no.
  // Pedirle a alguien que declare su dominio de interes y su rol no es una
  // competencia, y ponerle ranking incentivaria a inventar la respuesta que
  // "puntua" en vez de la verdadera, que es justo el insumo que se necesita
  // para armar los grupos.
  it('las rondas MC son rankeadas y la abierta de senales no', () => {
    const scenarios = session().scenarios as {
      id: string;
      type?: string;
      ranked?: boolean;
    }[];
    for (const s of scenarios) {
      const compite = s.ranked !== false;
      expect(compite, `${s.id} deberia ${s.type === 'multiple_choice' ? '' : 'NO '}competir`)
        .toBe(s.type === 'multiple_choice');
    }
    expect(scenarios.filter((s) => s.ranked !== false)).toHaveLength(4);
  });

  it('la rubrica tiene las tres dimensiones del curso sumando 1', () => {
    const rubric = session().rubric as {
      sessionId: string;
      dimensions: { id: string; weight: number }[];
    };
    expect(rubric.sessionId).toBe('clase_01_diagnostico');
    expect(rubric.dimensions.map((d) => d.id)).toEqual([
      'rigor_descriptivo',
      'criterio_visual',
      'claridad',
    ]);
    expect(rubric.dimensions.reduce((sum, d) => sum + d.weight, 0)).toBeCloseTo(1, 5);
  });
});
