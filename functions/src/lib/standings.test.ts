import { describe, it, expect } from 'vitest';
import {
  pointsForPosition,
  POINTS_TABLE,
  POINTS_FLOOR,
  rankGame,
  type GamePlayerInput,
  accumulate,
  pickOfficialGames,
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

  it('el puesto acumulado no es el puesto dentro de cada juego', () => {
    // La forma del caso real de dataviz_2026: Lucas gana la clase 1 (30 pts) y
    // se hunde al ultimo puesto en la clase 2 (21 pts). Su linea POR JUEGO cae
    // de 1o a 3o, como si se hubiera desplomado; en la tabla del curso baja un
    // solo puesto, de 1o a 2o, que es lo que realmente le paso.
    const entries = accumulate([
      game('g1', 1000, [['lucas', 300], ['ana', 200], ['beto', 100]]),
      game('g2', 2000, [['ana', 300], ['beto', 200], ['lucas', 100]]),
    ]);
    const lucas = entries.find((e) => e.uid === 'lucas')!;
    expect(lucas.positionsByGame).toEqual([1, 3]);
    expect(lucas.cumulativePositionsByGame).toEqual([1, 2]);
    expect(lucas.points).toBe(51);

    const ana = entries.find((e) => e.uid === 'ana')!;
    expect(ana.positionsByGame).toEqual([2, 1]);
    expect(ana.cumulativePositionsByGame).toEqual([2, 1]);
    expect(ana.points).toBe(55);
  });

  it('la linea acumulada arranca en la primera clase que jugo, no en el fondo', () => {
    // Joaco falto a la clase 1: antes de eso no estaba en la tabla, que no es
    // lo mismo que ir ultimo.
    const entries = accumulate([
      game('g1', 1000, [['ana', 200], ['beto', 100]]),
      game('g2', 2000, [['ana', 300], ['beto', 200], ['joaco', 100]]),
    ]);
    const joaco = entries.find((e) => e.uid === 'joaco')!;
    expect(joaco.cumulativePositionsByGame).toEqual([null, 3]);
    expect(joaco.positionsByGame).toEqual([null, 3]);
  });

  it('el puesto acumulado ignora el descarte de las 2 peores', () => {
    // Igual que previousPosition: es "como iba en ese momento", y en ese
    // momento el semestre no estaba cerrado.
    const entries = accumulate([
      game('g1', 1000, [['ana', 200], ['beto', 100]]),
      game('g2', 2000, [['ana', 100], ['beto', 200]]),
      game('g3', 3000, [['ana', 200], ['beto', 100]]),
    ], { dropWorst: 2 });
    const ana = entries.find((e) => e.uid === 'ana')!;
    expect(ana.cumulativePositionsByGame).toEqual([1, 1, 1]);
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

describe('pickOfficialGames', () => {
  const game = (
    gameCode: string,
    sessionId: string,
    finishedAtMs: number,
    answeredCount: number,
    lobbyOnly = 0,
  ): GameResult => ({
    gameCode,
    sessionId,
    sessionTitle: sessionId,
    finishedAtMs,
    players: [
      ...Array.from({ length: answeredCount }, (_, i) => ({
        uid: `${gameCode}_a${i}`, name: `A${i}`, totalScore: 10 + i, answered: true,
      })),
      ...Array.from({ length: lobbyOnly }, (_, i) => ({
        uid: `${gameCode}_l${i}`, name: `L${i}`, totalScore: 0, answered: false,
      })),
    ],
  });

  it('el caso real de dataviz_2026: 6 juegos de la clase 1, cuenta el del curso', () => {
    const { official, discarded } = pickOfficialGames([
      game('YBWGQP', 'clase_01_diagnostico', 1_753_866_744_926, 1),
      game('735ZGL', 'clase_01_diagnostico', 1_785_667_733_164, 2),
      game('H4ATHA', 'clase_01_diagnostico', 1_785_673_207_969, 2),
      game('BXZ8QP', 'clase_01_diagnostico', 1_785_769_280_641, 1),
      game('EP55M5', 'clase_01_diagnostico', 1_785_769_763_611, 1),
      game('MTF4MX', 'clase_01_diagnostico', 1_785_772_826_126, 33),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['MTF4MX']);
    expect(discarded).toHaveLength(5);
  });

  it('cuenta un juego por sesion, no uno por curso', () => {
    const { official } = pickOfficialGames([
      game('A1', 'clase_01', 100, 30),
      game('A2', 'clase_01', 200, 2),
      game('B1', 'clase_02', 300, 28),
    ]);
    expect(official.map((g) => g.gameCode).sort()).toEqual(['A1', 'B1']);
  });

  it('gana el que tiene mas alumnos, no el mas nuevo', () => {
    const { official } = pickOfficialGames([
      game('CLASE', 'clase_01', 100, 30),
      game('PRUEBA', 'clase_01', 999, 1),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['CLASE']);
  });

  it('a igual cantidad de alumnos gana el mas reciente', () => {
    const { official } = pickOfficialGames([
      game('VIEJO', 'clase_01', 100, 20),
      game('NUEVO', 'clase_01', 200, 20),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['NUEVO']);
  });

  it('empate total: elige siempre el mismo, para que dos recalculos no discrepen', () => {
    const dos = [game('ZZZ', 'clase_01', 100, 20), game('AAA', 'clase_01', 100, 20)];
    expect(pickOfficialGames(dos).official[0].gameCode).toBe('AAA');
    expect(pickOfficialGames([...dos].reverse()).official[0].gameCode).toBe('AAA');
  });

  it('quien entro al lobby y no contesto no infla el conteo', () => {
    // 2 que contestaron + 40 mirones no le ganan a 5 que contestaron.
    const { official } = pickOfficialGames([
      game('MIRONES', 'clase_01', 200, 2, 40),
      game('REAL', 'clase_01', 100, 5),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['REAL']);
  });

  it('los juegos sin sessionId cuentan todos, sin competir entre si', () => {
    const { official, discarded } = pickOfficialGames([
      game('X', '', 100, 3),
      game('Y', '', 200, 9),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['X', 'Y']);
    expect(discarded).toEqual([]);
  });

  it('devuelve los oficiales en orden cronologico, listos para accumulate', () => {
    const { official } = pickOfficialGames([
      game('C', 'clase_03', 300, 10),
      game('A', 'clase_01', 100, 10),
      game('B', 'clase_02', 200, 10),
    ]);
    expect(official.map((g) => g.gameCode)).toEqual(['A', 'B', 'C']);
  });

  it('sin juegos no devuelve nada', () => {
    expect(pickOfficialGames([])).toEqual({ official: [], discarded: [] });
  });
});
