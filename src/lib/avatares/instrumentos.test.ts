import { describe, expect, it } from 'vitest';
import { INSTRUMENTOS, instrumentoDe } from './instrumentos';

describe('INSTRUMENTOS', () => {
  it('cada instrumento tiene ids unicos, 5 etiquetas y polo en toda propuesta', () => {
    for (const { instrumento } of Object.values(INSTRUMENTOS)) {
      const ids = instrumento.propuestas.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      const campos = instrumento.planilla.map((c) => c.id);
      expect(new Set(campos).size).toBe(campos.length);
      expect(instrumento.escala.etiquetas).toHaveLength(5);
      for (const p of instrumento.propuestas) {
        expect(p.texto.trim()).not.toBe('');
        expect(p.polo?.trim()).toBeTruthy();
        expect(p.polo).not.toBe(p.texto);
      }
    }
  });
  it('el de Viña tiene 12 propuestas y la ciudad marcada como sensible', () => {
    const i = instrumentoDe('ayd14_vina_v1')!;
    expect(i.propuestas).toHaveLength(12);
    expect(i.planilla.find((c) => c.id === 'pais_ciudad')?.sensible).toBe(true);
  });
  it('devuelve null para un id desconocido', () => {
    expect(instrumentoDe('nope')).toBeNull();
  });
});
