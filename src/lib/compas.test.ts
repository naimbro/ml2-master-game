import { describe, it, expect } from 'vitest';
import {
  posicionDe,
  bandaDe,
  timonDe,
  arquetipoDe,
  movimiento,
  tercilesDe,
  posicionesDeCohorte,
  posicionesPreviasDeCohorte,
  cuantosRespondieron,
} from './compas';
import type { CompasArquetipos, CompasCortesEje, CompasItem, Timon } from '../types/compas';

const cortes: CompasCortesEje = { bajo: [-10, -2.5], medio: [-2.5, 2.5], alto: [2.5, 10] };

function item(id: string, opts: Array<[string, number, number]>, esTimon = false): CompasItem {
  return {
    id,
    order: 1,
    question: 'q',
    discrimina: 'd',
    ...(esTimon ? { esItemDeTimon: true } : {}),
    options: opts.map(([oid, m, d]) => {
      const timon: Timon = oid === 'A' ? 'empresas' : 'estado';
      return {
        id: oid,
        text: oid,
        vector: { magnitud: m, direccion: d },
        anchor: 'x',
        ...(esTimon ? { timon } : {}),
      };
    }),
  };
}

const items: CompasItem[] = [
  item('i1', [['A', 10, 10], ['B', -10, -10]]),
  item('i2', [['A', 6, 2], ['B', -6, -2]]),
  item('i3', [['A', 2, 6], ['B', -2, -6]]),
];

describe('posicionDe', () => {
  it('promedia solo los items respondidos', () => {
    const p = posicionDe({ i1: 'A', i2: 'A' }, items);
    expect(p).toEqual(mkPos(8, 6, 2, 3));
  });

  it('saltarse un item no arrastra hacia el centro', () => {
    // Con promedio sobre el total, magnitud caeria a 20/3 = 6,67 e inventaria
    // un moderado que el alumno nunca dijo ser.
    const dos = posicionDe({ i1: 'A', i2: 'A' }, items)!;
    const tres = posicionDe({ i1: 'A', i2: 'A', i3: 'A' }, items)!;
    expect(dos.magnitud).toBe(8);
    expect(tres.magnitud).toBe(6);
  });

  it('devuelve null cuando no contesto nada, en vez de (0,0)', () => {
    expect(posicionDe({}, items)).toBeNull();
    expect(posicionDe({ i1: null, i2: undefined }, items)).toBeNull();
  });

  it('ignora una opcion que ya no existe en vez de romperse', () => {
    const p = posicionDe({ i1: 'A', i2: 'ZZZ' }, items);
    expect(p).toEqual(mkPos(10, 10, 1, 3));
  });

  it('sobrevive a vectores malformados', () => {
    const roto: CompasItem[] = [
      { ...items[0], options: [{ id: 'A', text: 'a', vector: { magnitud: NaN, direccion: 1 }, anchor: '' }] },
    ];
    expect(posicionDe({ i1: 'A' }, roto)).toBeNull();
  });

  it('devuelve null sin items', () => {
    expect(posicionDe({ i1: 'A' }, [])).toBeNull();
  });
});

describe('bandaDe', () => {
  it('reparte en las tres bandas', () => {
    expect(bandaDe(-8, cortes)).toBe('bajo');
    expect(bandaDe(0, cortes)).toBe('medio');
    expect(bandaDe(8, cortes)).toBe('alto');
  });

  it('un valor justo en el borde cae en la banda ALTA, nunca en dos', () => {
    expect(bandaDe(-2.5, cortes)).toBe('medio');
    expect(bandaDe(2.5, cortes)).toBe('medio');
    expect(bandaDe(2.5001, cortes)).toBe('alto');
  });

  it('cae a medio si los cortes vienen rotos, en vez de propagar NaN', () => {
    expect(bandaDe(5, undefined as unknown as CompasCortesEje)).toBe('medio');
    expect(bandaDe(NaN, cortes)).toBe('medio');
  });
});

const timonItems: CompasItem[] = [...items, item('i9', [['A', 7, -8], ['B', 5, 2]], true)];

const doc: CompasArquetipos = {
  archetypesId: 'test',
  instrumentId: 'test',
  version: 1,
  cortes: { magnitud: cortes, direccion: cortes },
  desempate: {
    celda: { magnitud: 'alto', direccion: 'bajo' },
    item: 'i9',
    reglas: [
      { timon: ['estado', 'internacional'], arquetipo: 'vigilante' },
      { timon: ['empresas', 'ciudadania'], arquetipo: 'oligarquia' },
    ],
    porDefecto: 'oligarquia',
  },
  arquetipos: [
    { id: 'vigilante', name: 'El Vigilante', celda: { magnitud: 'alto', direccion: 'bajo' }, desc: '', lectura: '', puntoCiego: '', timon: ['estado', 'internacional'] },
    { id: 'oligarquia', name: 'La Oligarquía', celda: { magnitud: 'alto', direccion: 'bajo' }, desc: '', lectura: '', puntoCiego: '', timon: ['empresas', 'ciudadania'] },
    { id: 'pragmatica', name: 'La Pragmática', celda: { magnitud: 'bajo', direccion: 'alto' }, desc: '', lectura: '', puntoCiego: '' },
  ],
};

describe('timonDe', () => {
  it('lee el item marcado como desempate', () => {
    expect(timonDe({ i9: 'A' }, timonItems)).toBe('empresas');
    expect(timonDe({ i9: 'B' }, timonItems)).toBe('estado');
  });

  it('devuelve null si lo salto o si no hay item de timon', () => {
    expect(timonDe({ i1: 'A' }, timonItems)).toBeNull();
    expect(timonDe({ i1: 'A' }, items)).toBeNull();
  });
});

/** Posicion de prueba. El tercer eje no entra en la celda del arquetipo. */
const mkPos = (magnitud: number, direccion: number, respondidas = 1, total = 1) => ({
  magnitud,
  direccion,
  respondidas,
  total,
  agencia: null,
  agenciaRespondidas: 0,
});

describe('arquetipoDe', () => {
  const celdaCompartida = mkPos(7, -7, 4, 4);

  it('resuelve una celda con un solo arquetipo', () => {
    const a = arquetipoDe(mkPos(-7, 7, 1, 1), null, doc);
    expect(a?.id).toBe('pragmatica');
  });

  it('el timon desempata la celda compartida', () => {
    expect(arquetipoDe(celdaCompartida, 'estado', doc)?.id).toBe('vigilante');
    expect(arquetipoDe(celdaCompartida, 'internacional', doc)?.id).toBe('vigilante');
    expect(arquetipoDe(celdaCompartida, 'empresas', doc)?.id).toBe('oligarquia');
    expect(arquetipoDe(celdaCompartida, 'ciudadania', doc)?.id).toBe('oligarquia');
  });

  it('sin timon cae al por defecto declarado', () => {
    expect(arquetipoDe(celdaCompartida, null, doc)?.id).toBe('oligarquia');
  });

  it('devuelve null sin posicion o sin arquetipos', () => {
    expect(arquetipoDe(null, 'estado', doc)).toBeNull();
    expect(arquetipoDe(celdaCompartida, null, { ...doc, arquetipos: [] })).toBeNull();
  });

  it('devuelve null si ninguna celda calza, en vez de inventar un arquetipo', () => {
    const soloUna: CompasArquetipos = { ...doc, arquetipos: [doc.arquetipos[2]] };
    expect(arquetipoDe(celdaCompartida, null, soloUna)).toBeNull();
  });
});

describe('movimiento', () => {
  it('mide el desplazamiento entre dos aplicaciones', () => {
    const m = movimiento(
      mkPos(0, 0, 10, 10),
      mkPos(3, -4, 10, 10),
    );
    expect(m).toEqual({ dMagnitud: 3, dDireccion: -4, distancia: 5 });
  });

  it('devuelve null si falta una de las dos', () => {
    expect(movimiento(null as never, mkPos(1, 1, 1, 1))).toBeNull();
  });
});

describe('tercilesDe', () => {
  it('parte la distribucion en tres', () => {
    const t = tercilesDe(Array.from({ length: 30 }, (_, i) => i));
    expect(t).toEqual([10, 20]);
  });

  it('se niega a calibrar con pocos datos, donde los terciles son ruido', () => {
    expect(tercilesDe([1, 2, 3])).toBeNull();
    expect(tercilesDe(Array.from({ length: 11 }, (_, i) => i))).toBeNull();
    expect(tercilesDe(Array.from({ length: 12 }, (_, i) => i))).not.toBeNull();
  });

  it('descarta valores no finitos antes de ordenar', () => {
    const con = tercilesDe([...Array.from({ length: 12 }, (_, i) => i), NaN, Infinity]);
    expect(con).toEqual(tercilesDe(Array.from({ length: 12 }, (_, i) => i)));
  });
});

describe('posicionesDeCohorte', () => {
  const cohorte = [
    { playerId: 'a', answers: { i1: 'A', i2: 'A', i3: 'A' } },
    { playerId: 'b', answers: { i1: 'B' } },
    { playerId: 'c', answers: {} },
  ];

  it('solo cuenta los items que el anfitrion ya mostro', () => {
    // 'a' ya contesto el item 3, pero la sala va en el 1: graficarlo adelantado
    // mostraria a alguien donde la clase todavia no llega.
    const r = posicionesDeCohorte(cohorte, items, 1);
    expect(r).toEqual([
      { id: 'a', pos: mkPos(10, 10, 1, 1) },
      { id: 'b', pos: mkPos(-10, -10, 1, 1) },
    ]);
  });

  it('deja fuera a quien no ha contestado nada, en vez de ponerlo en el centro', () => {
    const ids = posicionesDeCohorte(cohorte, items, 3).map((r) => r.id);
    expect(ids).toEqual(['a', 'b']);
  });

  it('es vacio antes de empezar', () => {
    expect(posicionesDeCohorte(cohorte, items, 0)).toEqual([]);
  });
});

describe('posicionesPreviasDeCohorte', () => {
  const cohorte = [{ playerId: 'a', answers: { i1: 'A', i2: 'B' } }];

  it('mira un item hacia atras, que es de donde sale la estela', () => {
    const previas = posicionesPreviasDeCohorte(cohorte, items, 2);
    expect(previas.a.magnitud).toBe(10); // solo i1
    const ahora = posicionesDeCohorte(cohorte, items, 2)[0].pos;
    expect(ahora.magnitud).toBe(2); // (10 + -6) / 2
  });

  it('no hay estela en el primer item: seria una linea desde ninguna parte', () => {
    expect(posicionesPreviasDeCohorte(cohorte, items, 1)).toEqual({});
  });
});

describe('cuantosRespondieron', () => {
  const cohorte = [
    { playerId: 'ana', answers: { c01: 'A', c02: 'B', c03: 'C' } },
    // Beto se salto el c02. Con el contador viejo quedaba atrasado para siempre.
    { playerId: 'beto', answers: { c01: 'A', c03: 'E' } },
    { playerId: 'coca', answers: { c01: 'D' } },
  ];

  it('cuenta a quien respondio ESE item, no a quien lleva muchas respuestas', () => {
    expect(cuantosRespondieron(cohorte, 'c01')).toBe(3);
    expect(cuantosRespondieron(cohorte, 'c02')).toBe(1);
  });

  it('el que se salto un item anterior igual cuenta en el de ahora', () => {
    // Beto lleva 2 respuestas cuando la sala va en el item 3: el contador viejo
    // (respondidas >= itemIndex) lo daba por atrasado. Respondio el c03.
    expect(cuantosRespondieron(cohorte, 'c03')).toBe(2);
  });

  it('nadie respondio un item que nadie toco', () => {
    expect(cuantosRespondieron(cohorte, 'c09')).toBe(0);
  });

  it('sin item en pantalla no hay nada que contar', () => {
    expect(cuantosRespondieron(cohorte, null)).toBe(0);
    expect(cuantosRespondieron(cohorte, undefined)).toBe(0);
    expect(cuantosRespondieron([], 'c01')).toBe(0);
  });
});
