import { describe, it, expect } from 'vitest';
import { formatoReloj, proporcionPegada, posicionNube, puntosHuella, hechosDetalle } from './telemetriaDerived';

describe('formatoReloj', () => {
  it('bajo el minuto muestra solo segundos', () => {
    expect(formatoReloj(0)).toBe('0 s');
    expect(formatoReloj(41_000)).toBe('41 s');
    expect(formatoReloj(59_999)).toBe('59 s');
  });

  it('sobre el minuto muestra minutos y segundos', () => {
    expect(formatoReloj(138_000)).toBe('2 min 18 s');
  });

  it('omite los segundos cuando son cero', () => {
    expect(formatoReloj(180_000)).toBe('3 min');
  });
});

describe('proporcionPegada', () => {
  it('es 0 cuando no hubo ningun pegado', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 400 })).toBe(0);
  });

  it('es la fraccion del texto final que llego pegada', () => {
    expect(proporcionPegada({ charsPegados: 200, largoFinal: 400 })).toBe(0.5);
  });

  it('no pasa de 1 aunque hayan pegado y despues borrado', () => {
    expect(proporcionPegada({ charsPegados: 900, largoFinal: 400 })).toBe(1);
  });

  it('es 0 con respuesta vacia, sin dividir por cero', () => {
    expect(proporcionPegada({ charsPegados: 0, largoFinal: 0 })).toBe(0);
  });
});

const base = {
  huella: [] as number[],
  huellaIntervaloMs: 2000,
  msEnvio: 10_000,
  largoFinal: 0,
};

/** "12.0,3.5 20.0,1.0" -> [[12,3.5],[20,1]] */
const parse = (s: string) =>
  s.split(' ').filter(Boolean).map((p) => p.split(',').map(Number) as [number, number]);

describe('puntosHuella', () => {
  it('arranca en el origen de abajo a la izquierda', () => {
    const pts = parse(puntosHuella({ ...base, huella: [10, 20], largoFinal: 20 }, 10_000, 100, 20));
    expect(pts[0]).toEqual([2, 18]);
  });

  it('normaliza la altura al largo maximo de esa misma respuesta', () => {
    const corta = parse(puntosHuella({ ...base, huella: [50], msEnvio: 2000, largoFinal: 50 }, 10_000, 100, 20));
    const larga = parse(puntosHuella({ ...base, huella: [5000], msEnvio: 2000, largoFinal: 5000 }, 10_000, 100, 20));
    // misma forma: una sola muestra en el tope, en el mismo sitio
    expect(corta).toEqual(larga);
  });

  it('normaliza el ancho a la duracion de la ronda, no al largo de la huella', () => {
    // envio a la mitad de una ronda de 20 s: la linea termina a la mitad
    // del ancho util (2 .. 98), o sea en x = 50
    const pts = parse(puntosHuella({ ...base, huella: [30], msEnvio: 10_000, largoFinal: 30 }, 20_000, 100, 20));
    expect(pts[pts.length - 1][0]).toBe(50);
  });

  it('cierra en el largo final aunque el envio caiga entre dos muestras', () => {
    const pts = parse(puntosHuella({ ...base, huella: [100], msEnvio: 3000, largoFinal: 400 }, 10_000, 100, 20));
    // el ultimo punto es el mas alto: 400 sobre un maximo de 400
    expect(pts[pts.length - 1][1]).toBe(2);
  });

  it('devuelve el segmento plano cuando el alumno no escribio nada', () => {
    const pts = parse(puntosHuella({ ...base, huella: [0, 0], msEnvio: 6000, largoFinal: 0 }, 10_000, 100, 20));
    expect(pts.every(([, y]) => y === 18)).toBe(true);
  });

  it('no se sale del lienzo si la huella dura mas que la ronda', () => {
    const pts = parse(puntosHuella({ ...base, huella: [10, 20, 30], msEnvio: 30_000, largoFinal: 30 }, 4000, 100, 20));
    expect(Math.max(...pts.map(([x]) => x))).toBe(98);
  });

  it('dibuja solo el origen y el envio cuando no alcanzo a haber ni una muestra', () => {
    const pts = parse(puntosHuella({ ...base, huella: [], msEnvio: 800, largoFinal: 12 }, 10_000, 100, 20));
    expect(pts).toHaveLength(2);
  });

  it('la caida se dibuja mas abajo que el pico cuando el texto final quedo mas corto', () => {
    const pts = parse(puntosHuella({ ...base, huella: [500], msEnvio: 5000, largoFinal: 200 }, 10_000, 100, 20));
    expect(pts[2][1]).toBeGreaterThan(pts[1][1]); // mayor y = mas abajo = mas corto
  });
});

describe('posicionNube', () => {
  it('el que escribio al tiro y no pego cae abajo a la izquierda', () => {
    const p = posicionNube({ msPrimeraTecla: 0, charsPegados: 0, largoFinal: 500 }, 240_000, 100, 100);
    expect(p).toEqual({ x: 2, y: 98 });
  });

  it('el que tardo la ronda entera y pego todo cae arriba a la derecha', () => {
    const p = posicionNube({ msPrimeraTecla: 240_000, charsPegados: 500, largoFinal: 500 }, 240_000, 100, 100);
    expect(p).toEqual({ x: 98, y: 2 });
  });

  it('ubica al final del eje a quien nunca escribio nada', () => {
    const p = posicionNube({ msPrimeraTecla: null, charsPegados: 0, largoFinal: 0 }, 240_000, 100, 100);
    expect(p.x).toBe(98);
    expect(p.y).toBe(98);
  });
});

const captura = {
  scenarioId: 'r3',
  msPrimeraTecla: 138_000,
  msEnvio: 151_000,
  roundStartOffsetMs: 0,
  pegados: [{ ms: 138_000, chars: 782 }],
  huella: [0, 0, 0],
  huellaIntervaloMs: 2000,
  msFueraDeApp: 41_000,
  salidas: 1,
  msFueraAntesDeEscribir: 41_000,
  largoFinal: 782,
  charsPegados: 782,
  charsEditadosTrasUltimoPegado: 0,
};

describe('hechosDetalle', () => {
  it('describe la respuesta como hechos, sin ningun juicio', () => {
    const hechos = hechosDetalle(captura, 240_000);
    expect(hechos).toEqual([
      { etiqueta: 'Primera tecla', valor: 'a los 2 min 18 s de los 4 min de ronda' },
      { etiqueta: 'Fuera de la app', valor: '41 s antes de escribir (1 salida)' },
      { etiqueta: 'Pegados', valor: '1 · de 782 caracteres · a los 2 min 18 s' },
      { etiqueta: 'Editó después de pegar', valor: '0 caracteres' },
      { etiqueta: 'Largo final', valor: '782 caracteres' },
      { etiqueta: 'Envió', valor: 'a los 2 min 31 s' },
    ]);
  });

  it('dice que nunca escribio cuando no hubo primera tecla', () => {
    const hechos = hechosDetalle({ ...captura, msPrimeraTecla: null }, 240_000);
    expect(hechos[0]).toEqual({ etiqueta: 'Primera tecla', valor: 'nunca escribió' });
  });

  it('omite la linea de pegados cuando no hubo ninguno', () => {
    const hechos = hechosDetalle(
      { ...captura, pegados: [], charsPegados: 0, charsEditadosTrasUltimoPegado: 0 },
      240_000
    );
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Pegados');
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Editó después de pegar');
  });

  it('omite la linea de salidas cuando nunca salio de la app', () => {
    const hechos = hechosDetalle({ ...captura, msFueraDeApp: 0, salidas: 0, msFueraAntesDeEscribir: 0 }, 240_000);
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Fuera de la app');
  });

  it('lista varios pegados con sus tiempos', () => {
    const hechos = hechosDetalle(
      { ...captura, pegados: [{ ms: 20_000, chars: 300 }, { ms: 60_000, chars: 482 }] },
      240_000
    );
    expect(hechos.find((h) => h.etiqueta === 'Pegados')?.valor).toBe(
      '2 · de 300 y 482 caracteres · a los 20 s y 1 min'
    );
  });

  it('muestra cuanto se edito despues de pegar cuando hubo edicion', () => {
    const hechos = hechosDetalle({ ...captura, charsEditadosTrasUltimoPegado: 340 }, 240_000);
    expect(hechos.find((h) => h.etiqueta === 'Editó después de pegar')?.valor).toBe('340 caracteres');
  });
});

describe('hechosDetalle — el mayor salto de una vez', () => {
  it('lo muestra cuando el documento lo trae', () => {
    const hechos = hechosDetalle({ ...captura, maxInsercionDeGolpe: 465 }, 240_000);
    expect(hechos.find((h) => h.etiqueta === 'Mayor salto de una vez')?.valor).toBe(
      '465 caracteres'
    );
  });

  it('lo muestra aunque no se haya registrado ningun pegado', () => {
    // El caso del Android del 8-ago-2026: el texto entro entero y ningun
    // evento de pegado disparo. El salto es lo unico que queda.
    const hechos = hechosDetalle(
      { ...captura, pegados: [], charsPegados: 0, maxInsercionDeGolpe: 465 },
      240_000
    );
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Pegados');
    expect(hechos.map((h) => h.etiqueta)).toContain('Mayor salto de una vez');
  });

  it('se omite en los documentos viejos que no lo traen', () => {
    const hechos = hechosDetalle(captura, 240_000);
    expect(hechos.map((h) => h.etiqueta)).not.toContain('Mayor salto de una vez');
  });
});
