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
    expect(s.rounds).toBe(3);
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

  // Las TRES rondas compiten: una de opcion multiple sobre un grafico y dos
  // abiertas de comprension sobre el articulo de Katie Parrott que se discute en
  // clase. Naim fijo la forma de cuatro el 2026-08-02 y saco la segunda de
  // opcion multiple el 2026-08-03, jugando la clase.
  it('es una ronda de opcion multiple y dos abiertas, y las tres compiten', () => {
    const scenarios = session().scenarios as {
      id: string;
      type?: string;
      ranked?: boolean;
    }[];
    for (const s of scenarios) {
      expect(s.ranked !== false, `${s.id} deberia competir`).toBe(true);
    }
    expect(scenarios.filter((s) => s.type === 'multiple_choice')).toHaveLength(1);
    expect(scenarios.filter((s) => s.type !== 'multiple_choice')).toHaveLength(2);
  });

  // Las dos abiertas dicen el largo esperado EN EL ENUNCIADO, y la rubrica se lo
  // repite a los jueces. Sin eso, los jueces esperan ensayos y castigan las
  // cuatro lineas que el enunciado pidio.
  it('las rondas abiertas declaran el largo pedido', () => {
    const abiertas = (session().scenarios as { type?: string; question: string }[]).filter(
      (s) => s.type !== 'multiple_choice'
    );
    for (const s of abiertas) {
      expect(s.question).toMatch(/cuatro l[ií]neas/i);
    }
    const rubric = session().rubric as { globalInstructions: string };
    expect(rubric.globalInstructions).toMatch(/CUATRO L[ÍI]NEAS/);
  });

  // Esta clase NO usa las tres dimensiones del curso: las unicas rondas que los
  // jueces evaluan son de comprension lectora, y "criterio visual" no describe
  // nada de lo que hay que juzgar ahi.
  it('la rubrica es la de comprension lectora y sus pesos suman 1', () => {
    const rubric = session().rubric as {
      sessionId: string;
      dimensions: { id: string; weight: number }[];
    };
    expect(rubric.sessionId).toBe('clase_01_diagnostico');
    expect(rubric.dimensions.map((d) => d.id)).toEqual([
      'fidelidad_al_texto',
      'articulacion',
      'economia',
    ]);
    expect(rubric.dimensions.reduce((sum, d) => sum + d.weight, 0)).toBeCloseTo(1, 5);
  });
});
