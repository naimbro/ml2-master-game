import { describe, expect, it } from 'vitest';
import { instrumentoDe } from './instrumentos';
import { planillaComoTexto, tramoEdad } from './planilla';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('tramoEdad', () => {
  it('agrupa en tramos y tolera texto', () => {
    expect(tramoEdad('19')).toBe('18-20');
    expect(tramoEdad('22 años')).toBe('21-25');
    expect(tramoEdad('29')).toBe('26-30');
    expect(tramoEdad('45')).toBe('31+');
    expect(tramoEdad('')).toBe('no informa');
    expect(tramoEdad('veinte')).toBe('no informa');
  });
});

describe('planillaComoTexto', () => {
  const p = { edad: '22', pais_ciudad: 'Chile, Viña del Mar', economia: 'centro socialdemócrata',
    rol_estado: 'equilibrado', prioridad_1: 'educación', conf_congreso: '2' };
  const t = planillaComoTexto(inst, p);
  it('no incluye campos sensibles ni la edad exacta', () => {
    expect(t).not.toContain('Viña');
    expect(t).not.toContain('22');
    expect(t).toContain('21-25');
  });
  it('incluye las respuestas con su etiqueta y omite los campos vacios', () => {
    expect(t).toContain('En economía me considero: centro socialdemócrata');
    expect(t).toContain('Prioridad política 1: educación');
    expect(t).not.toContain('Género');
  });
  it('es determinista', () => {
    expect(planillaComoTexto(inst, p)).toBe(t);
  });
});
