import { describe, expect, it } from 'vitest';
import { validarMatriz } from './contrato';
import { instrumentoDe } from './instrumentos';
import { sintetizar } from './sinteticos';
import { correlacionPorPropuesta, dispersion, porFuente } from './analitica/basico';

const inst = instrumentoDe('ayd14_vina_v1')!;

describe('sintetizar', () => {
  const { matriz, planillas } = sintetizar(inst, { semilla: 3, n: 30, replicas: 3 });
  it('produce una matriz valida y determinista', () => {
    expect(validarMatriz(matriz)).toEqual([]);
    expect(sintetizar(inst, { semilla: 3, n: 30, replicas: 3 }).matriz).toEqual(matriz);
  });
  it('tiene 30 humanos, 30 avatares y 3x30 avatares en red', () => {
    expect(matriz.personas.filter((p) => p.fuente === 'humano')).toHaveLength(30);
    expect(matriz.personas.filter((p) => p.fuente === 'avatar')).toHaveLength(30);
    expect(matriz.personas.filter((p) => p.fuente === 'avatar_red')).toHaveLength(90);
    expect(Object.keys(planillas)).toHaveLength(30);
  });
  it('los avatares en red estan mas homogeneos que los avatares, y estos que los humanos', () => {
    const media = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0) / Object.values(r).length;
    const h = media(dispersion(matriz, porFuente('humano')));
    const a = media(dispersion(matriz, porFuente('avatar')));
    const red = media(dispersion(matriz, porFuente('avatar_red', { replica: 1 })));
    expect(a).toBeLessThan(h);
    expect(red).toBeLessThan(a);
  });
  it('avatar y humano se correlacionan positivamente', () => {
    const c = correlacionPorPropuesta(matriz, porFuente('humano'), porFuente('avatar'));
    expect(c.promedio!).toBeGreaterThan(0.3);
  });
});
