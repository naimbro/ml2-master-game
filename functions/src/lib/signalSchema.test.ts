import { describe, it, expect } from 'vitest';
import { buildSignalInstructions, type SignalSchema } from './signalSchema';

const schema: SignalSchema = {
  instructions: 'Parsea el bloque y devuelve las claves exactas.',
  fields: [
    { key: 'dominio', label: 'DOMINIO', type: 'texto', description: 'tema del proyecto' },
    { key: 'rol', label: 'ROL', type: 'enum', values: ['analista', 'programador'] },
    { key: 'skill_datos', label: 'SKILL_DATOS', type: 'entero_1_5' },
  ],
};

describe('buildSignalInstructions', () => {
  it('devuelve null cuando no hay esquema', () => {
    expect(buildSignalInstructions(undefined)).toBeNull();
    expect(buildSignalInstructions(null)).toBeNull();
  });

  it('devuelve null cuando el esquema no tiene campos usables', () => {
    expect(buildSignalInstructions({ fields: [] })).toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buildSignalInstructions({ fields: 'nope' } as any)).toBeNull();
  });

  it('nombra cada clave de parsedSignals', () => {
    const out = buildSignalInstructions(schema)!;
    expect(out).toContain('"dominio"');
    expect(out).toContain('"rol"');
    expect(out).toContain('"skill_datos"');
  });

  it('incluye la etiqueta del bloque y los valores permitidos de un enum', () => {
    const out = buildSignalInstructions(schema)!;
    expect(out).toContain('DOMINIO');
    expect(out).toContain('analista');
    expect(out).toContain('programador');
  });

  it('pide parsedSignals y extractionConfidence explicitamente', () => {
    const out = buildSignalInstructions(schema)!;
    expect(out).toContain('parsedSignals');
    expect(out).toContain('extractionConfidence');
  });

  it('pasa las instrucciones del esquema tal cual', () => {
    expect(buildSignalInstructions(schema)!).toContain(
      'Parsea el bloque y devuelve las claves exactas.',
    );
  });

  it('salta campos sin key y no rompe con un campo malformado', () => {
    const out = buildSignalInstructions({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fields: [{ label: 'X' } as any, { key: 'ok', label: 'OK', type: 'texto' }],
    })!;
    expect(out).toContain('"ok"');
    expect(out).not.toContain('"undefined"');
  });

  // La razon de existir de este modulo: el esquema de ml2-2025 estaba hardcodeado
  // y cualquier curso nuevo recibia SUS campos. Un esquema de dataviz no debe
  // arrastrar nada de ml2.
  it('no filtra campos del esquema viejo de ml2-2025', () => {
    const out = buildSignalInstructions(schema)!;
    expect(out).not.toContain('PREFERENCIAS_FAMILIAS');
    expect(out).not.toContain('SKILL_TECH');
    expect(out).not.toContain('family_chosen');
  });

  it('dice que la extraccion no cambia la evaluacion', () => {
    const out = buildSignalInstructions(schema)!;
    expect(out).toMatch(/NO cambia tu evaluacion/i);
  });
});
