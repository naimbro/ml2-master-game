import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { relojDerivadoAbierta, DIFICULTAD_VALORES, FORMATO_VALORES } from '../src/lib/abiertaTiming';

const require = createRequire(import.meta.url);
const { relojDerivadoAbiertaCJS } = require('./validate-content.cjs') as {
  relojDerivadoAbiertaCJS: (sc: unknown) => number;
};

/**
 * El validador es CommonJS y no puede importar src/lib/abiertaTiming.ts, asi que
 * el calculo esta escrito dos veces. Este test es lo unico que impide que se
 * separen: si alguien ajusta la recta en un lado, aca se cae. Sin esto la
 * divergencia es SILENCIOSA — el build seguiria verde midiendo otra cosa.
 */
describe('el espejo del reloj en validate-content.cjs', () => {
  const casos = [
    { context: 'x '.repeat(179).trim(), answerFormat: 'code', difficulty: 'hard' },
    { context: 'x '.repeat(83).trim(), answerFormat: 'code', difficulty: 'medium' },
    { context: 'x '.repeat(236).trim(), difficulty: 'hard' },
    { question: 'x '.repeat(10).trim(), difficulty: 'easy' },
    { prompt: 'x '.repeat(120).trim(), answerFormat: 'prose', difficulty: 'medium' },
    { context: 'x '.repeat(50).trim(), answerFormat: 'CODIGO', difficulty: 'dificil' },
    { context: 'hola', question: 'y chau' },
    {},
    // El caso que se le escapaba al espejo: los dos campos juntos. La pantalla
    // muestra `context ?? prompt`, asi que prompt no se cobra cuando hay context.
    { context: 'a b c', prompt: 'd e f g h', question: 'i j' },
  ];

  for (const [i, caso] of casos.entries()) {
    it(`da el mismo numero que src/lib/abiertaTiming.ts (caso ${i})`, () => {
      expect(relojDerivadoAbiertaCJS(caso)).toBe(relojDerivadoAbierta(caso as never));
    });
  }
});

const { CURSOS_VIVOS, relojEsErrorEn } = require('./validate-content.cjs') as {
  CURSOS_VIVOS: string[];
  relojEsErrorEn: (curso: string) => boolean;
};

describe('a quien le falla el reloj corto', () => {
  it('los tres cursos que se dictan en 2026-2 fallan', () => {
    expect(relojEsErrorEn('dataviz_2026')).toBe(true);
    expect(relojEsErrorEn('mgt300_2026')).toBe(true);
    expect(relojEsErrorEn('ai_democracy_2026')).toBe(true);
  });

  it('un curso retirado solo avisa: su reloj ya no le puede hacer dano a nadie', () => {
    expect(relojEsErrorEn('ml2-2025')).toBe(false);
    expect(relojEsErrorEn('temas_emergentes_2026')).toBe(false);
    expect(relojEsErrorEn('mundial_2026')).toBe(false);
  });

  it('un curso nuevo falla por defecto, que es el lado seguro', () => {
    expect(relojEsErrorEn('curso_que_no_existe_todavia')).toBe(true);
  });

  it('CURSOS_VIVOS es la lista, no una heuristica sobre el nombre', () => {
    expect(CURSOS_VIVOS).toContain('dataviz_2026');
  });
});

const { validateRelojAbierto } = require('./validate-content.cjs') as {
  validateRelojAbierto: (
    scope: string,
    sc: Record<string, unknown>,
    curso: string,
    roundDurationSecondsDeLaSesion: number | undefined,
  ) => { nivel: 'error' | 'warn'; mensaje: string } | null;
};

/**
 * `validateRelojAbierto` hoy se saltea en silencio un escenario sin
 * `durationSeconds`, confiando en un comentario ("ya lo reporta el chequeo de
 * siempre") que es falso: nada mas exige ese campo. Un escenario asi NO corre
 * sin reloj — hereda `roundDurationSeconds` de la sesion — asi que el chequeo
 * tiene que resolver esa herencia, no exigir el campo.
 */
describe('el reloj heredado de la sesion tambien se valida', () => {
  // Enunciado largo de dificultad dura: el propio calculo exige bastante mas
  // que un reloj corto cualquiera, asi que sirve para separar "propio" de
  // "heredado" sin ambiguedad.
  const enunciadoCaro = { context: 'x '.repeat(180).trim(), difficulty: 'hard' as const };
  const pideCaro = relojDerivadoAbiertaCJS(enunciadoCaro);

  it('gana el reloj propio aunque el heredado de la sesion no alcanzaria', () => {
    const sc = { ...enunciadoCaro, durationSeconds: pideCaro }; // propio, justo alcanza
    const veredicto = validateRelojAbierto('escenario', sc, 'dataviz_2026', 1 /* heredado insuficiente */);
    expect(veredicto).toBeNull();
  });

  it('sin reloj propio, hereda uno de la sesion que alcanza: pasa', () => {
    const sc = { ...enunciadoCaro }; // sin durationSeconds
    const veredicto = validateRelojAbierto('escenario', sc, 'dataviz_2026', pideCaro);
    expect(veredicto).toBeNull();
  });

  it('sin reloj propio, hereda uno de la sesion que no alcanza: falla y dice que es heredado', () => {
    const sc = { ...enunciadoCaro }; // sin durationSeconds
    const veredicto = validateRelojAbierto('escenario', sc, 'dataviz_2026', pideCaro - 15);
    expect(veredicto).not.toBeNull();
    expect(veredicto!.nivel).toBe('error'); // dataviz_2026 esta en CURSOS_VIVOS
    expect(veredicto!.mensaje).toMatch(/heredad/i);
  });

  it('en un curso retirado, el reloj heredado insuficiente solo avisa', () => {
    const sc = { ...enunciadoCaro };
    const veredicto = validateRelojAbierto('escenario', sc, 'ml2-2025', pideCaro - 15);
    expect(veredicto).not.toBeNull();
    expect(veredicto!.nivel).toBe('warn');
  });

  it('sin reloj propio y sin reloj de sesion: error explicito, no un return mudo', () => {
    const sc = { ...enunciadoCaro };
    const veredicto = validateRelojAbierto('escenario', sc, 'dataviz_2026', undefined);
    expect(veredicto).not.toBeNull();
    expect(veredicto!.nivel).toBe('error');
    expect(veredicto!.mensaje).toMatch(/sin reloj/i);
  });

  it('multiple_choice nunca entra a este chequeo', () => {
    const veredicto = validateRelojAbierto(
      'escenario',
      { type: 'multiple_choice' },
      'dataviz_2026',
      undefined,
    );
    expect(veredicto).toBeNull();
  });
});

const { validateEtiquetasAbierta } = require('./validate-content.cjs') as {
  validateEtiquetasAbierta: (
    scope: string,
    sc: Record<string, unknown>,
    curso: string,
  ) => { nivel: 'error' | 'warn'; mensaje: string }[];
};

/**
 * `difficulty` y `answerFormat` desconocidos caen en silencio a un default
 * dentro del calculo del reloj (necesario: un valor fuera del enum no puede
 * indexar el Record). Pero un `difficulty` mal escrito cae a 'medium' —
 * sesenta segundos menos que 'hard', en silencio — asi que este chequeo
 * tiene que avisar antes de que el reloj derivado tape el error tipografico.
 */
describe('difficulty/answerFormat desconocidos se avisan', () => {
  it('un difficulty valido no reporta nada', () => {
    const problemas = validateEtiquetasAbierta('escenario', { difficulty: 'hard' }, 'dataviz_2026');
    expect(problemas).toEqual([]);
  });

  it('un difficulty invalido reporta en un curso vivo', () => {
    const problemas = validateEtiquetasAbierta(
      'escenario',
      { difficulty: 'medium-hard' },
      'dataviz_2026',
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0].nivel).toBe('error');
    expect(problemas[0].mensaje).toMatch(/medium-hard/);
    expect(problemas[0].mensaje).toMatch(/medium/); // el default al que cae
  });

  it('el mismo caso solo avisa en un curso retirado', () => {
    const problemas = validateEtiquetasAbierta(
      'escenario',
      { difficulty: 'medium-hard' },
      'ml2-2025',
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0].nivel).toBe('warn');
  });

  it('un answerFormat invalido reporta', () => {
    const problemas = validateEtiquetasAbierta(
      'escenario',
      { answerFormat: 'CODIGO' },
      'dataviz_2026',
    );
    expect(problemas).toHaveLength(1);
    expect(problemas[0].mensaje).toMatch(/CODIGO/);
    expect(problemas[0].mensaje).toMatch(/prose/); // el default al que cae
  });

  it('un escenario sin ninguno de los dos campos no reporta nada (ausente no es invalido)', () => {
    const problemas = validateEtiquetasAbierta('escenario', {}, 'dataviz_2026');
    expect(problemas).toEqual([]);
  });
});

const { DIFICULTAD_VALORES_CJS, FORMATO_VALORES_CJS } = require('./validate-content.cjs') as {
  DIFICULTAD_VALORES_CJS: string[];
  FORMATO_VALORES_CJS: string[];
};

describe('las listas de valores validos, atadas al original', () => {
  // El espejo las copia a mano porque un tipo de TypeScript no existe en
  // runtime. Sin este test, agregar un valor al tipo sin avisarle al validador
  // haria que el build rechace una etiqueta CORRECTA de un curso vivo.
  it('difficulty: el espejo conoce los mismos valores que el modulo', () => {
    expect(DIFICULTAD_VALORES_CJS).toEqual([...DIFICULTAD_VALORES]);
  });

  it('answerFormat: idem', () => {
    expect(FORMATO_VALORES_CJS).toEqual([...FORMATO_VALORES]);
  });
});
