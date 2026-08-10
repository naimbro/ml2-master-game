import { describe, it, expect } from 'vitest';
import { aggregateChoices, mcStatsKey } from './mcStats';

const jugadores = (...ids: string[]) => new Set(ids);

describe('mcStatsKey', () => {
  it('separa preguntas de rondas distintas', () => {
    // Todo bloque de alternativas empieza a contar desde la pregunta 0, asi que
    // sin la ronda adentro la ronda 5 pisaria el recuento de la ronda 1.
    expect(mcStatsKey(1, 0)).not.toBe(mcStatsKey(5, 0));
    expect(mcStatsKey(5, 0)).toBe('r5q0');
  });
});

describe('aggregateChoices', () => {
  it('cuenta cuantos eligieron cada alternativa', () => {
    const stats = aggregateChoices(
      [
        { playerId: 'ana', optionId: 'A' },
        { playerId: 'beto', optionId: 'B' },
        { playerId: 'cata', optionId: 'B' },
      ],
      ['A', 'B', 'C', 'D'],
      jugadores('ana', 'beto', 'cata'),
    );
    expect(stats).toEqual({ total: 3, byOption: { A: 1, B: 2, C: 0, D: 0 } });
  });

  it('deja en cero las alternativas que nadie marco, para que el grafico las dibuje', () => {
    const stats = aggregateChoices(
      [{ playerId: 'ana', optionId: 'C' }],
      ['A', 'B', 'C', 'D'],
      jugadores('ana'),
    );
    expect(Object.keys(stats.byOption)).toEqual(['A', 'B', 'C', 'D']);
    expect(stats.byOption.A).toBe(0);
  });

  it('cuenta una sola vez a quien tiene el doc reescrito', () => {
    // El doc se escribe con setDoc sobre un id fijo; un reintento lo reescribe.
    const stats = aggregateChoices(
      [
        { playerId: 'ana', optionId: 'A' },
        { playerId: 'ana', optionId: 'A' },
      ],
      ['A', 'B'],
      jugadores('ana'),
    );
    expect(stats.total).toBe(1);
    expect(stats.byOption.A).toBe(1);
  });

  it('deja fuera al profesor que dirige sin jugar', () => {
    // No esta en `players`, asi que su click no puede mover el grafico del curso.
    const stats = aggregateChoices(
      [
        { playerId: 'ana', optionId: 'A' },
        { playerId: 'profesor', optionId: 'B' },
      ],
      ['A', 'B'],
      jugadores('ana'),
    );
    expect(stats).toEqual({ total: 1, byOption: { A: 1, B: 0 } });
  });

  it('una opcion desconocida cuenta como respuesta pero no ensucia el desglose', () => {
    const stats = aggregateChoices(
      [
        { playerId: 'ana', optionId: 'A' },
        { playerId: 'beto', optionId: 'Z' },
      ],
      ['A', 'B'],
      jugadores('ana', 'beto'),
    );
    expect(stats.total).toBe(2);
    expect(stats.byOption).toEqual({ A: 1, B: 0 });
  });

  it('sin respuestas devuelve total 0 y no divide por cero rio abajo', () => {
    const stats = aggregateChoices([], ['A', 'B'], jugadores('ana'));
    expect(stats).toEqual({ total: 0, byOption: { A: 0, B: 0 } });
  });

  it('reproduce el 12-12 real de la ronda 5 de XNTUHB', () => {
    // 28 respuestas partidas exactamente entre la correcta y la que invierte el
    // orden de las dos palabras. Es el caso que justifica todo este grafico.
    const choices = [
      ...Array.from({ length: 12 }, (_, i) => ({ playerId: `a${i}`, optionId: 'A' })),
      ...Array.from({ length: 12 }, (_, i) => ({ playerId: `b${i}`, optionId: 'B' })),
      { playerId: 'c0', optionId: 'C' },
      ...Array.from({ length: 3 }, (_, i) => ({ playerId: `d${i}`, optionId: 'D' })),
    ];
    const stats = aggregateChoices(
      choices,
      ['A', 'B', 'C', 'D'],
      new Set(choices.map((c) => c.playerId)),
    );
    expect(stats.total).toBe(28);
    expect(stats.byOption).toEqual({ A: 12, B: 12, C: 1, D: 3 });
  });
});
