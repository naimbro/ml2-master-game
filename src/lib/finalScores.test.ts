import { describe, it, expect } from 'vitest';
import {
  buildRoundScoreIndex,
  collectPlayerRoundScores,
  coerceScore,
  roundScoreKey,
} from './finalScores';

describe('coerceScore', () => {
  it('acepta numeros y strings numericos, rechaza el resto', () => {
    expect(coerceScore(73)).toBe(73);
    expect(coerceScore('73')).toBe(73);
    expect(coerceScore(' 73 ')).toBe(73);
    expect(Number.isNaN(coerceScore(''))).toBe(true);
    expect(Number.isNaN(coerceScore(undefined))).toBe(true);
    expect(Number.isNaN(coerceScore(null))).toBe(true);
    expect(Number.isNaN(coerceScore('ochenta'))).toBe(true);
  });
});

describe('collectPlayerRoundScores', () => {
  it('el doc de la ronda le gana a la submission', () => {
    // El caso real de MTF4MX ronda 2: los jueces le pusieron 73 a Martina y los
    // duelos la subieron a 89. El podio sumaba 73.
    const out = collectPlayerRoundScores(
      2,
      [{ round: 2, rankings: [{ playerId: 'martina', playerName: 'Martina', score: 89 }] }],
      [{ playerId: 'martina', playerName: 'Martina', round: 2, finalScore: 73 }],
    );
    expect(out).toEqual([{ playerId: 'martina', playerName: 'Martina', scores: [null, 89] }]);
  });

  it('usa la submission cuando la ronda no tiene doc', () => {
    const out = collectPlayerRoundScores(
      2,
      [{ round: 1, rankings: [{ playerId: 'p', playerName: 'P', score: 50 }] }],
      [
        { playerId: 'p', playerName: 'P', round: 1, finalScore: 50 },
        { playerId: 'p', playerName: 'P', round: 2, finalScore: 80 },
      ],
    );
    expect(out[0].scores).toEqual([50, 80]);
  });

  it('funciona con juegos viejos que no tienen ningun doc de ronda', () => {
    const out = collectPlayerRoundScores(
      2,
      [],
      [
        { playerId: 'p', playerName: 'P', round: 1, finalScore: 40 },
        { playerId: 'p', playerName: 'P', round: 2, finalScore: 60 },
      ],
    );
    expect(out[0].scores).toEqual([40, 60]);
  });

  it('distingue "no jugo esa ronda" (null) de "saco cero" (0)', () => {
    // 4 de los 33 de MTF4MX no contestaron la ronda 3. Si eso se contara como 0
    // les bajaria el promedio por una ronda a la que no llegaron.
    const out = collectPlayerRoundScores(
      3,
      [
        { round: 1, rankings: [{ playerId: 'a', score: 90 }, { playerId: 'b', score: 0 }] },
        { round: 3, rankings: [{ playerId: 'b', score: 70 }] },
      ],
      [],
    );
    const a = out.find((p) => p.playerId === 'a')!;
    const b = out.find((p) => p.playerId === 'b')!;
    expect(a.scores).toEqual([90, null, null]);
    expect(b.scores).toEqual([0, null, 70]);
  });

  it('deja fuera a quien no tiene ningun puntaje', () => {
    // El profesor entra como jugador (CreateGame.tsx lo mete en `players`) pero
    // no contesta: no debe aparecer en el podio.
    const out = collectPlayerRoundScores(
      1,
      [{ round: 1, rankings: [{ playerId: 'host', playerName: 'Naim', score: undefined }] }],
      [],
    );
    expect(out).toEqual([]);
  });

  it('acepta puntajes guardados como string', () => {
    const out = collectPlayerRoundScores(
      1,
      [{ round: 1, rankings: [{ playerId: 'p', playerName: 'P', score: '66' }] }],
      [],
    );
    expect(out[0].scores).toEqual([66]);
  });

  it('el nombre lo gana la ronda mas alta en que aparece', () => {
    const out = collectPlayerRoundScores(
      2,
      [
        { round: 1, rankings: [{ playerId: 'p', playerName: 'Nombre viejo', score: 10 }] },
        { round: 2, rankings: [{ playerId: 'p', playerName: 'Nombre nuevo', score: 20 }] },
      ],
      [],
    );
    expect(out[0].playerName).toBe('Nombre nuevo');
  });

  it('crece si un doc trae una ronda mas alla de totalRounds', () => {
    const out = collectPlayerRoundScores(
      1,
      [{ round: 3, rankings: [{ playerId: 'p', score: 5 }] }],
      [],
    );
    expect(out[0].scores).toEqual([null, null, 5]);
  });

  it('ignora rondas y jugadores mal formados en vez de reventar', () => {
    const out = collectPlayerRoundScores(
      1,
      [
        { round: 0, rankings: [{ playerId: 'p', score: 99 }] },
        { round: 1, rankings: undefined },
        { round: 1, rankings: [{ playerId: '', score: 99 }] },
        { round: 1, rankings: [{ playerId: 'p', playerName: 'P', score: 42 }] },
      ],
      [{ playerId: 'q', round: -1, finalScore: 7 }],
    );
    expect(out).toEqual([{ playerId: 'p', playerName: 'P', scores: [42] }]);
  });
});

describe('buildRoundScoreIndex', () => {
  it('indexa por ronda y jugador, ignorando puntajes no numericos', () => {
    const index = buildRoundScoreIndex([
      { round: 1, rankings: [{ playerId: 'a', score: 90 }, { playerId: 'b', score: '80' }] },
      { round: 2, rankings: [{ playerId: 'a', score: 89 }, { playerId: 'b', score: undefined }] },
      { round: 0, rankings: [{ playerId: 'a', score: 1 }] },
    ]);
    expect(index.get(roundScoreKey(1, 'a'))).toBe(90);
    expect(index.get(roundScoreKey(1, 'b'))).toBe(80);
    expect(index.get(roundScoreKey(2, 'a'))).toBe(89);
    expect(index.has(roundScoreKey(2, 'b'))).toBe(false);
    expect(index.has(roundScoreKey(0, 'a'))).toBe(false);
    expect(index.size).toBe(3);
  });

  it('no confunde jugadores cuyos ids se parecen', () => {
    const index = buildRoundScoreIndex([
      { round: 1, rankings: [{ playerId: '1', score: 10 }] },
      { round: 11, rankings: [{ playerId: '', score: 20 }] },
    ]);
    expect(index.get(roundScoreKey(1, '1'))).toBe(10);
    expect(index.size).toBe(1);
  });
});
