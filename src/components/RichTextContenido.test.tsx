import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RichText } from './RichText';

/**
 * El contenido de TODAS las sesiones, pasado por el RichText real.
 *
 * Existe porque esta falla ya ocurrió tres veces y las tres en público: los
 * asteriscos de MGT300 clase 1 (4-ago-2026), la cursiva de dataviz clase 3
 * (15-ago) y los backticks y las cercas de dataviz clase 4 (24-ago). Las tres
 * pasaron el validador de contenido, `tsc`, eslint y la suite entera: el texto
 * era válido, sólo que la app no sabía renderizarlo y lo proyectaba crudo
 * delante del curso.
 *
 * La aserción es la única que sirve acá: después de renderizar, no puede quedar
 * un delimitador a la vista.
 */
const html = (t?: string | null) => renderToStaticMarkup(<RichText text={t} />);

const SESIONES = import.meta.glob('../../content/sessions/*/*/scenarios.json', {
  eager: true,
}) as Record<string, { default: Array<Record<string, unknown>> }>;

/** Todo lo que un alumno llega a leer, con su ruta para poder ubicarlo. */
function camposVisibles(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [ruta, mod] of Object.entries(SESIONES)) {
    const sesion = ruta.split('/').slice(-3, -1).join('/');
    for (const sc of mod.default ?? []) {
      const push = (donde: string, txt: unknown) => {
        if (typeof txt === 'string' && txt.trim()) out.push([`${sesion} ${donde}`, txt]);
      };
      push(`${sc.id}.context`, sc.context);
      push(`${sc.id}.question`, sc.question);
      push(`${sc.id}.prompt`, sc.prompt);
      for (const q of (sc.mcQuestions ?? []) as Array<Record<string, unknown>>) {
        push(`${sc.id}.mc.question`, q.question);
        push(`${sc.id}.mc.explanation`, q.explanation);
        for (const o of (q.options ?? []) as Array<Record<string, unknown>>) {
          push(`${sc.id}.mc.opt.${o.id}`, o.text);
        }
      }
    }
  }
  return out;
}

describe('el contenido, renderizado', () => {
  it('encuentra escenarios en varias sesiones (si esto falla, el glob no matchea)', () => {
    expect(Object.keys(SESIONES).length).toBeGreaterThan(5);
    expect(camposVisibles().length).toBeGreaterThan(50);
  });

  it('ningún campo deja un delimitador de markdown a la vista', () => {
    const sucios = camposVisibles()
      .filter(([, txt]) => /[`*]/.test(html(txt)))
      .map(([donde, txt]) => `${donde} → ${html(txt).slice(0, 140)}`);
    expect(sucios).toEqual([]);
  });
});
