// Checks the REAL content files, not fixtures.
//
// These are the failures that stay silent otherwise: an item edited so no
// archetype cell can be reached, a tiebreak rule pointing at an archetype id
// that no longer exists, an option whose vector drifted out of range. None of
// them throw at runtime — they just hand a student the wrong card.

import { describe, it, expect } from 'vitest';
import { COMPASES, compasDe, posicionPath } from './compasContent';
import { posicionDe, arquetipoDe, timonDe, bandaDe } from './compas';
import type { Banda, CompasAnswers } from '../types/compas';

const BANDAS: Banda[] = ['bajo', 'medio', 'alto'];

describe.each(Object.entries(COMPASES))('compas %s', (courseId, pack) => {
  const { instrumento, arquetipos } = pack;

  it('el instrumento y los arquetipos se refieren al mismo instrumentId', () => {
    expect(arquetipos.instrumentId).toBe(instrumento.instrumentId);
  });

  it('nunca puntua ni rankea', () => {
    expect(instrumento.scoring.scored).toBe(false);
    expect(instrumento.scoring.ranked).toBe(false);
  });

  it('los ids de item son unicos y los order son 1..n', () => {
    const ids = instrumento.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(instrumento.items.map((i) => i.order).sort((a, b) => a - b)).toEqual(
      instrumento.items.map((_, n) => n + 1),
    );
  });

  it('cada item tiene cinco opciones con ids unicos, texto y ancla', () => {
    for (const item of instrumento.items) {
      expect(item.options).toHaveLength(5);
      const ids = item.options.map((o) => o.id);
      expect(new Set(ids).size).toBe(5);
      for (const o of item.options) {
        expect(o.text.trim().length).toBeGreaterThan(0);
        expect(o.anchor.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('todos los vectores caen dentro de los ejes declarados', () => {
    const { x, y } = instrumento.axes;
    for (const item of instrumento.items) {
      for (const o of item.options) {
        expect(o.vector.magnitud).toBeGreaterThanOrEqual(x.min);
        expect(o.vector.magnitud).toBeLessThanOrEqual(x.max);
        expect(o.vector.direccion).toBeGreaterThanOrEqual(y.min);
        expect(o.vector.direccion).toBeLessThanOrEqual(y.max);
      }
    }
  });

  it('cada item ofrece al menos una salida optimista', () => {
    // Sin esto el instrumento arrastra al curso hacia abajo por construccion y
    // el desplazamiento de fin de semestre seria un artefacto del diseno.
    for (const item of instrumento.items) {
      const max = Math.max(...item.options.map((o) => o.vector.direccion));
      expect(max, `item ${item.id} sin salida optimista`).toBeGreaterThanOrEqual(2);
    }
  });

  it('el tercer eje viene completo: eje, bandas que lo cubren, y sin huecos', () => {
    if (!instrumento.ejeAgencia) return; // instrumentos anteriores al v3
    const bandas = arquetipos.bandasAgencia?.bandas;
    expect(bandas, 'hay ejeAgencia pero no hay bandas').toBeTruthy();
    const { min, max } = instrumento.ejeAgencia;
    expect(bandas![0].rango[0]).toBe(min);
    expect(bandas![bandas!.length - 1].rango[1]).toBe(max);
    for (let i = 1; i < bandas!.length; i += 1) {
      expect(bandas![i].rango[0], `hueco o solape antes de ${bandas![i].id}`).toBe(
        bandas![i - 1].rango[1],
      );
    }
  });

  it('un item que declara agencia la declara en las CINCO opciones', () => {
    // A medias es peor que nada: el promedio del eje saldria de las opciones que
    // por casualidad la traen, y quien eligio la que no la trae desaparece de la
    // medicion sin que nadie lo note.
    for (const item of instrumento.items) {
      const con = item.options.filter((o) => typeof o.agencia === 'number').length;
      expect([0, 5], `${item.id} declara agencia en ${con} de 5 opciones`).toContain(con);
    }
  });

  it('los valores de agencia caen dentro del eje declarado', () => {
    if (!instrumento.ejeAgencia) return;
    const { min, max } = instrumento.ejeAgencia;
    for (const item of instrumento.items) {
      for (const o of item.options) {
        if (typeof o.agencia !== 'number') continue;
        expect(o.agencia, `${item.id}/${o.id}`).toBeGreaterThanOrEqual(min);
        expect(o.agencia, `${item.id}/${o.id}`).toBeLessThanOrEqual(max);
      }
    }
  });

  it('cada item del tercer eje ofrece una salida por el polo humano', () => {
    // La invariante anticontaminacion. Si un item deja contestar "perdemos el
    // control" solo con respuestas del polo maquina, el eje se confunde con
    // direccion: perder el control frente a cinco empresas es HUMANOS al mando,
    // y tiene que poder decirse. Sin esta salida el eje deja de medir algo
    // distinto de lo que ya mide el plano, y nadie se entera.
    for (const item of instrumento.items) {
      const ag = item.options.map((o) => o.agencia).filter((a): a is number => typeof a === 'number');
      if (ag.length === 0) continue;
      expect(Math.min(...ag), `${item.id} sin salida por el polo humano`).toBeLessThanOrEqual(-5);
      expect(Math.max(...ag), `${item.id} sin salida por el polo maquina`).toBeGreaterThanOrEqual(2);
    }
  });

  it('el tercer eje lo miden varios items, no uno solo', () => {
    if (!instrumento.ejeAgencia) return;
    const cuantos = instrumento.items.filter((i) =>
      i.options.some((o) => typeof o.agencia === 'number'),
    ).length;
    expect(cuantos, 'un eje colgando de un item es ruido, no medicion').toBeGreaterThanOrEqual(4);
  });

  it('hay exactamente un item de timon y todas sus opciones lo declaran', () => {
    const deTimon = instrumento.items.filter((i) => i.esItemDeTimon);
    expect(deTimon).toHaveLength(1);
    for (const o of deTimon[0].options) expect(o.timon).toBeTruthy();
  });

  it('las nueve celdas de la grilla tienen arquetipo', () => {
    const celdas = new Set(arquetipos.arquetipos.map((a) => `${a.celda.magnitud}/${a.celda.direccion}`));
    for (const m of BANDAS) {
      for (const d of BANDAS) {
        expect(celdas.has(`${m}/${d}`), `celda ${m}/${d} sin arquetipo`).toBe(true);
      }
    }
  });

  it('el desempate apunta a un item real, a arquetipos reales y cubre todos los timones', () => {
    const { desempate } = arquetipos;
    expect(instrumento.items.some((i) => i.id === desempate.item)).toBe(true);

    const ids = new Set(arquetipos.arquetipos.map((a) => a.id));
    expect(ids.has(desempate.porDefecto)).toBe(true);
    for (const r of desempate.reglas) expect(ids.has(r.arquetipo)).toBe(true);

    const enItem = new Set(
      instrumento.items.find((i) => i.esItemDeTimon)!.options.map((o) => o.timon!),
    );
    const cubiertos = new Set(desempate.reglas.flatMap((r) => r.timon));
    for (const t of enItem) expect(cubiertos.has(t), `timon ${t} sin regla`).toBe(true);
  });

  it('solo la celda del desempate tiene mas de un arquetipo', () => {
    const porCelda: Record<string, string[]> = {};
    for (const a of arquetipos.arquetipos) {
      const k = `${a.celda.magnitud}/${a.celda.direccion}`;
      (porCelda[k] ??= []).push(a.id);
    }
    const compartidas = Object.entries(porCelda).filter(([, v]) => v.length > 1);
    expect(compartidas).toHaveLength(1);
    expect(compartidas[0][0]).toBe(`${arquetipos.desempate.celda.magnitud}/${arquetipos.desempate.celda.direccion}`);
  });

  it('cada arquetipo trae descripcion, lectura y punto ciego', () => {
    for (const a of arquetipos.arquetipos) {
      expect(a.desc.trim().length, `${a.id} sin desc`).toBeGreaterThan(40);
      expect(a.lectura.trim().length, `${a.id} sin lectura`).toBeGreaterThan(10);
      expect(a.puntoCiego.trim().length, `${a.id} sin punto ciego`).toBeGreaterThan(40);
    }
  });

  it('toda combinacion de respuestas produce un arquetipo — ninguna deja al alumno sin carta', () => {
    // Recorre las 5^n combinaciones seria caro; se prueba el extremo de cada
    // opcion sola, que es lo que produce las posiciones mas excentricas.
    for (const item of instrumento.items) {
      for (const o of item.options) {
        const answers: CompasAnswers = { [item.id]: o.id };
        const pos = posicionDe(answers, instrumento.items);
        expect(pos).not.toBeNull();
        const a = arquetipoDe(pos, timonDe(answers, instrumento.items), arquetipos);
        expect(a, `sin arquetipo para ${item.id}/${o.id} (m ${pos!.magnitud}, d ${pos!.direccion})`).not.toBeNull();
      }
    }
  });

  it('contestar todo con la misma letra tampoco deja a nadie sin carta', () => {
    for (const letra of ['A', 'B', 'C', 'D', 'E']) {
      const answers: CompasAnswers = {};
      for (const i of instrumento.items) answers[i.id] = letra;
      const pos = posicionDe(answers, instrumento.items)!;
      const a = arquetipoDe(pos, timonDe(answers, instrumento.items), arquetipos);
      expect(a, `todo ${letra} deja sin arquetipo`).not.toBeNull();
    }
  });

  it('las aplicaciones estan ordenadas y ninguna cae el dia de una prueba', () => {
    const ns = instrumento.aplicaciones.map((a) => a.n);
    expect(ns).toEqual([...ns].sort((a, b) => a - b));
    // La Prueba I es la Semana 8; medir opiniones ese dia contamina las dos cosas.
    expect(instrumento.aplicaciones.some((a) => a.semana === 8)).toBe(false);
  });

  it('se encuentra por courseId', () => {
    expect(compasDe(courseId)).toBe(pack);
    expect(compasDe('no_existe')).toBeNull();
    expect(compasDe(undefined)).toBeNull();
  });
});

describe('posicionPath', () => {
  it('separa las aplicaciones para que se puedan comparar despues', () => {
    expect(posicionPath('ai_democracy_2026', 'inst_v1', 1)).toBe('compas/ai_democracy_2026/inst_v1_a1');
    expect(posicionPath('ai_democracy_2026', 'inst_v1', 3)).toBe('compas/ai_democracy_2026/inst_v1_a3');
  });
});

describe('bandas contra los cortes reales', () => {
  it('los cortes provisorios reparten el rango completo', () => {
    const { cortes } = COMPASES.ai_democracy_2026.arquetipos;
    expect(bandaDe(-10, cortes.magnitud)).toBe('bajo');
    expect(bandaDe(0, cortes.magnitud)).toBe('medio');
    expect(bandaDe(10, cortes.magnitud)).toBe('alto');
  });
});
