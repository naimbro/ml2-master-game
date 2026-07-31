import { describe, it, expect } from 'vitest';
import {
  pointsForPosition,
  POINTS_TABLE,
  POINTS_FLOOR,
  rankGame,
  type GamePlayerInput,
  accumulate,
  type GameResult,
} from './standings';

describe('pointsForPosition', () => {
  it('reparte la tabla fija en las diez primeras posiciones', () => {
    expect(POINTS_TABLE).toEqual([30, 25, 21, 18, 16, 15, 14, 13, 12, 11]);
    expect(pointsForPosition(1)).toBe(30);
    expect(pointsForPosition(2)).toBe(25);
    expect(pointsForPosition(10)).toBe(11);
  });

  it('baja de uno en uno despues de la decima', () => {
    expect(pointsForPosition(11)).toBe(10);
    expect(pointsForPosition(12)).toBe(9);
    expect(pointsForPosition(17)).toBe(4);
  });

  it('nunca baja del piso de 3 para quien jugo', () => {
    expect(POINTS_FLOOR).toBe(3);
    expect(pointsForPosition(18)).toBe(3);
    expect(pointsForPosition(26)).toBe(3);
    expect(pointsForPosition(200)).toBe(3);
  });

  it('rechaza posiciones invalidas', () => {
    expect(() => pointsForPosition(0)).toThrow();
    expect(() => pointsForPosition(-1)).toThrow();
    expect(() => pointsForPosition(1.5)).toThrow();
  });
});

const p = (uid: string, totalScore: number, answered = true): GamePlayerInput =>
  ({ uid, name: uid.toUpperCase(), totalScore, answered });

describe('rankGame', () => {
  it('ordena por puntaje descendente y asigna puntos', () => {
    const rows = rankGame([p('ana', 180), p('beto', 220), p('caro', 140)]);
    expect(rows).toEqual([
      { uid: 'beto', position: 1, points: 30 },
      { uid: 'ana', position: 2, points: 25 },
      { uid: 'caro', position: 3, points: 21 },
    ]);
  });

  it('empata con ranking de competencia: 1, 2, 2, 4', () => {
    const rows = rankGame([p('ana', 200), p('beto', 150), p('caro', 150), p('dani', 100)]);
    expect(rows.map((r) => [r.uid, r.position, r.points])).toEqual([
      ['ana', 1, 30],
      ['beto', 2, 25],
      ['caro', 2, 25],
      ['dani', 4, 18],
    ]);
  });

  it('deja fuera a quien no envio ninguna respuesta', () => {
    const rows = rankGame([p('ana', 200), p('fantasma', 0, false), p('beto', 100)]);
    expect(rows.map((r) => r.uid)).toEqual(['ana', 'beto']);
  });

  it('incluye a quien jugo y saco cero, con los puntos de piso si va ultimo', () => {
    const players = [p('ana', 200), ...Array.from({ length: 20 }, (_, i) => p(`x${i}`, 100 - i)), p('cero', 0)];
    const rows = rankGame(players);
    const last = rows[rows.length - 1];
    expect(last.uid).toBe('cero');
    expect(last.position).toBe(22);
    expect(last.points).toBe(POINTS_FLOOR);
  });

  it('desempata el orden de salida por uid, para que el resultado sea estable', () => {
    const rows = rankGame([p('zeta', 100), p('alfa', 100)]);
    expect(rows.map((r) => r.uid)).toEqual(['alfa', 'zeta']);
  });

  it('devuelve vacio si nadie jugo', () => {
    expect(rankGame([p('a', 0, false)])).toEqual([]);
  });
});

const game = (
  gameCode: string,
  finishedAtMs: number,
  players: Array<[string, number]>
): GameResult => ({
  gameCode,
  sessionId: `sesion_${gameCode}`,
  sessionTitle: `Clase ${gameCode}`,
  finishedAtMs,
  players: players.map(([uid, totalScore]) => ({
    uid, name: uid.toUpperCase(), totalScore, answered: true,
  })),
});

describe('accumulate', () => {
  it('suma los puntos de cada juego y ordena por total', () => {
    const entries = accumulate([
      game('g1', 1000, [['ana', 200], ['beto', 100]]),   // ana 30, beto 25
      game('g2', 2000, [['ana', 100], ['beto', 300]]),   // ana 25, beto 30
    ]);
    expect(entries.map((e) => [e.uid, e.points, e.position])).toEqual([
      ['ana', 55, 1],
      ['beto', 55, 1],
    ]);
  });

  it('ordena los juegos por fecha aunque lleguen desordenados', () => {
    const entries = accumulate([
      game('g2', 2000, [['ana', 100]]),
      game('g1', 1000, [['ana', 200]]),
    ]);
    expect(entries[0].positionsByGame).toEqual([1, 1]);
  });

  it('deja null en la clase que el alumno falto y no le suma nada', () => {
    const entries = accumulate([
      game('g1', 1000, [['ana', 200], ['beto', 100]]),
      game('g2', 2000, [['ana', 200]]),
    ]);
    const beto = entries.find((e) => e.uid === 'beto')!;
    expect(beto.positionsByGame).toEqual([2, null]);
    expect(beto.pointsByGame).toEqual([25, null]);
    expect(beto.points).toBe(25);
    expect(beto.gamesPlayed).toBe(1);
  });

  it('calcula la posicion anterior sin el ultimo juego', () => {
    const entries = accumulate([
      game('g1', 1000, [['ana', 100], ['beto', 200]]),   // beto 1ro, ana 2da
      game('g2', 2000, [['ana', 300], ['beto', 100]]),   // ana sube
    ]);
    const ana = entries.find((e) => e.uid === 'ana')!;
    expect(ana.position).toBe(1);
    expect(ana.previousPosition).toBe(2);
  });

  it('deja la posicion anterior en null cuando solo hay un juego', () => {
    const entries = accumulate([game('g1', 1000, [['ana', 100]])]);
    expect(entries[0].previousPosition).toBeNull();
  });

  it('deja la posicion anterior en null para quien debuta en el ultimo juego', () => {
    const entries = accumulate([
      game('g1', 1000, [['ana', 100]]),
      game('g2', 2000, [['ana', 100], ['nuevo', 300]]),
    ]);
    const nuevo = entries.find((e) => e.uid === 'nuevo')!;
    expect(nuevo.previousPosition).toBeNull();
  });

  it('usa el nombre mas reciente del alumno', () => {
    const g1 = game('g1', 1000, [['ana', 100]]);
    const g2 = game('g2', 2000, [['ana', 100]]);
    g2.players[0].name = 'Ana Nueva';
    expect(accumulate([g1, g2])[0].name).toBe('Ana Nueva');
  });

  it('con dropWorst descarta las peores casillas, contando las ausencias como cero', () => {
    // ana juega 4 clases: 30, 3, 30, 30 -> descartando 2 quedan 60
    // beto juega 2 de 4: 25, falto, 25, falto -> descartando 2 (los ceros) quedan 50
    const games = [
      game('g1', 1000, [['ana', 300], ['beto', 200]]),
      game('g2', 2000, [['ana', 10], ['x1', 500], ['x2', 400], ['x3', 300], ['x4', 200],
                        ['x5', 190], ['x6', 180], ['x7', 170], ['x8', 160], ['x9', 150],
                        ['x10', 140], ['x11', 130], ['x12', 120], ['x13', 110], ['x14', 100],
                        ['x15', 90], ['x16', 80], ['x17', 70]]),
      game('g3', 3000, [['ana', 300], ['beto', 200]]),
      game('g4', 4000, [['ana', 300]]),
    ];
    const sinDescarte = accumulate(games);
    expect(sinDescarte.find((e) => e.uid === 'ana')!.points).toBe(93);   // 30+3+30+30
    expect(sinDescarte.find((e) => e.uid === 'beto')!.points).toBe(50);  // 25+0+25+0

    const conDescarte = accumulate(games, { dropWorst: 2 });
    expect(conDescarte.find((e) => e.uid === 'ana')!.points).toBe(60);   // saca el 3 y un 30
    expect(conDescarte.find((e) => e.uid === 'beto')!.points).toBe(50);  // saca los dos ceros
  });

  it('no descarta nada por defecto', () => {
    const entries = accumulate([
      game('g1', 1000, [['ana', 100]]),
      game('g2', 2000, [['beto', 100]]),
    ]);
    expect(entries.find((e) => e.uid === 'ana')!.points).toBe(30);
  });

  it('devuelve vacio si no hay juegos', () => {
    expect(accumulate([])).toEqual([]);
  });

  it('ignora a quien nunca respondio nada en ningun juego del curso', () => {
    const g1 = game('g1', 1000, [['ana', 200]]);
    g1.players.push({ uid: 'fantasma', name: 'FANTASMA', totalScore: 0, answered: false });
    const entries = accumulate([g1]);
    expect(entries.map((e) => e.uid)).toEqual(['ana']);
  });

  it('cuenta al alumno que en una clase no respondio pero en otra si', () => {
    const g1 = game('g1', 1000, [['ana', 200]]);
    g1.players.push({ uid: 'beto', name: 'BETO', totalScore: 0, answered: false });
    const g2 = game('g2', 2000, [['ana', 100], ['beto', 300]]);
    const beto = accumulate([g1, g2]).find((e) => e.uid === 'beto')!;
    expect(beto.positionsByGame).toEqual([null, 1]);
    expect(beto.gamesPlayed).toBe(1);
  });

  it('calcula la posicion anterior sin descarte aunque se pida descarte', () => {
    // g1: ana 30, beto 25. g2: ana 25, beto 30. g3: ana 30, beto 25.
    // Sin descarte, 3 clases: ana 85, beto 80.
    // Con descarte de 2 (queda solo la mejor clase de cada uno): ana 30, beto 30
    // -> empatan en el 1er lugar del acumulado actual.
    // La posicion ANTERIOR se calcula solo con g1+g2 y SIN descarte (siempre,
    // sea cual sea la opcion dropWorst que se haya pedido para el acumulado
    // actual): ana 55, beto 55 -> tambien empatan en 1er lugar ahi.
    const g1 = game('g1', 1000, [['ana', 300], ['beto', 100]]);
    const g2 = game('g2', 2000, [['ana', 100], ['beto', 300]]);
    const g3 = game('g3', 3000, [['ana', 300], ['beto', 200]]);

    const conDescarte = accumulate([g1, g2, g3], { dropWorst: 2 });
    const ana = conDescarte.find((e) => e.uid === 'ana')!;

    const sinDescarte = accumulate([g1, g2]);
    const anaPrevia = sinDescarte.find((e) => e.uid === 'ana')!.position;

    expect(ana.previousPosition).toBe(anaPrevia);
  });
});
