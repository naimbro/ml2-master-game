// Fuente UNICA del texto que sale hacia un LLM (Function de avatares) y hacia
// MiroFish (persona). Sin campos sensibles y con la edad en tramos.
import type { Instrumento } from './contrato';

export type Planilla = Record<string, string>;

export function tramoEdad(edad: string): string {
  const m = /\d+/.exec(edad ?? '');
  if (!m) return 'no informa';
  const n = Number(m[0]);
  if (n <= 20) return '18-20';
  if (n <= 25) return '21-25';
  if (n <= 30) return '26-30';
  return '31+';
}

export function planillaComoTexto(inst: Instrumento, p: Planilla): string {
  const lineas: string[] = [];
  for (const c of inst.planilla) {
    if (c.sensible) continue;
    const v = (p[c.id] ?? '').trim();
    if (!v) continue;
    if (c.id === 'edad') lineas.push(`Edad (tramo): ${tramoEdad(v)}`);
    else lineas.push(`${c.etiqueta}: ${v}`);
  }
  return lineas.join('\n');
}
