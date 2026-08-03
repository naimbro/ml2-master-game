import { describe, it, expect } from 'vitest';
import { buildTrajectoryChart, TRAJECTORY_COLORS } from './trajectoryChart';

const entry = (name: string, positions: Array<number | null>) => ({ name, positionsByGame: positions });

describe('buildTrajectoryChart', () => {
  it('usa como maximo seis series, en el orden recibido', () => {
    const chart = buildTrajectoryChart(
      Array.from({ length: 9 }, (_, i) => entry(`Alumno ${i}`, [i + 1, i + 1])),
      2
    );
    expect(chart.lines).toHaveLength(6);
    expect(chart.lines[0].color).toBe(TRAJECTORY_COLORS[0]);
    expect(chart.lines[5].color).toBe(TRAJECTORY_COLORS[5]);
  });

  it('la fila mas baja es la peor posicion alcanzada, con tope de 15', () => {
    expect(buildTrajectoryChart([entry('Ana', [1, 9])], 2).maxRank).toBe(9);
    expect(buildTrajectoryChart([entry('Ana', [1, 40])], 2).maxRank).toBe(15);
  });

  it('deja al menos dos filas aunque todos hayan estado siempre primeros', () => {
    expect(buildTrajectoryChart([entry('Ana', [1, 1])], 2).maxRank).toBe(2);
  });

  it('corta la linea en dos tramos cuando el alumno falto al medio', () => {
    const chart = buildTrajectoryChart([entry('Ana', [1, 2, null, 3, 4])], 5);
    expect(chart.lines[0].segments).toHaveLength(2);
    expect(chart.lines[0].dots).toHaveLength(4);
  });

  it('no dibuja tramo con un solo punto, pero si el punto', () => {
    const chart = buildTrajectoryChart([entry('Ana', [null, 3, null])], 3);
    expect(chart.lines[0].segments).toHaveLength(0);
    expect(chart.lines[0].dots).toHaveLength(1);
  });

  it('abrevia el nombre a la izquierda y lo deja entero a la derecha', () => {
    const chart = buildTrajectoryChart([entry('Matías Fuenzalida', [1, 1])], 2);
    expect(chart.lines[0].labelLeft.text).toBe('Matías F.');
    expect(chart.lines[0].labelRight.text).toBe('Matías Fuenzalida');
  });

  it('con una sola clase no duplica el nombre: solo queda el completo, a la derecha del punto', () => {
    const chart = buildTrajectoryChart([entry('Matías Fuenzalida', [1])], 1);
    const dot = chart.lines[0].dots[0];
    expect(chart.lines[0].labelLeft.text).toBe('');
    expect(chart.lines[0].labelRight.text).toBe('Matías Fuenzalida');
    expect(chart.lines[0].labelRight.x).toBeGreaterThan(dot.x);
  });

  it('devuelve una columna por clase', () => {
    const chart = buildTrajectoryChart([entry('Ana', [1, 2, 3])], 3);
    expect(chart.columns.map((c) => c.label)).toEqual(['Clase 1', 'Clase 2', 'Clase 3']);
  });

  it('no explota sin series', () => {
    const chart = buildTrajectoryChart([], 3);
    expect(chart.lines).toEqual([]);
  });

  it('la banda de fondo y el numero de fila quedan dentro del lienzo, fuera de la primera y ultima columna', () => {
    const chart = buildTrajectoryChart([entry('Ana', [1, 2, 3])], 3);
    const firstColumnX = chart.columns[0].x;
    const lastColumnX = chart.columns[chart.columns.length - 1].x;

    expect(chart.rowLabelX).toBeGreaterThanOrEqual(0);
    expect(chart.rowLabelX).toBeLessThan(chart.bandLeft);
    expect(chart.bandLeft).toBeLessThanOrEqual(firstColumnX);
    expect(chart.bandRight).toBeGreaterThanOrEqual(lastColumnX);
    expect(chart.bandRight).toBeLessThanOrEqual(chart.width);
  });
});

describe('buildTrajectoryChart · empates que caen en la misma fila', () => {
  it('separa los nombres de dos empatados en vez de imprimirlos encima', () => {
    // El caso real del 2026-08-03: Ivan W y Benicio Arraga, 186 puntos los dos,
    // quintos los dos, con una sola clase jugada (o sea la misma x tambien).
    const chart = buildTrajectoryChart(
      [entry('Ivan W', [5]), entry('Benicio Arraga', [5])],
      1
    );
    const [ivan, benicio] = chart.lines;
    expect(ivan.labelRight.x).toBe(benicio.labelRight.x);
    expect(ivan.labelRight.y).not.toBe(benicio.labelRight.y);
    expect(Math.abs(ivan.labelRight.y - benicio.labelRight.y)).toBeGreaterThanOrEqual(12);
    // Los puntos NO se mueven: la posicion sigue siendo la misma fila.
    expect(ivan.dots[0].y).toBe(benicio.dots[0].y);
  });

  it('el que va mejor en la tabla queda arriba', () => {
    const chart = buildTrajectoryChart([entry('Primero', [5]), entry('Segundo', [5])], 1);
    expect(chart.lines[0].labelRight.y).toBeLessThan(chart.lines[1].labelRight.y);
  });

  it('amarra el nombre corrido a su punto con una guia', () => {
    const chart = buildTrajectoryChart([entry('A', [5]), entry('B', [5])], 1);
    const [a] = chart.lines;
    expect(a.labelRight.leader).not.toBeNull();
    expect(a.labelRight.leader!.y1).toBe(a.dots[0].y);
    expect(a.labelRight.leader!.y2).toBeCloseTo(a.labelRight.y - 4);
    expect(a.labelRight.leader!.x1).toBeGreaterThan(a.dots[0].x);
  });

  it('sin empate el nombre queda en su fila y no lleva guia', () => {
    const chart = buildTrajectoryChart([entry('A', [1]), entry('B', [2])], 1);
    expect(chart.lines[0].labelRight.y).toBe(chart.lines[0].dots[0].y + 4);
    expect(chart.lines[0].labelRight.leader).toBeNull();
    expect(chart.lines[1].labelRight.leader).toBeNull();
  });

  it('reparte tres empatados dejando uno en su fila', () => {
    const chart = buildTrajectoryChart(
      [entry('A', [3]), entry('B', [3]), entry('C', [3])],
      1
    );
    const ys = chart.lines.map((l) => l.labelRight.y);
    expect(new Set(ys).size).toBe(3);
    expect(chart.lines[1].labelRight.leader).toBeNull(); // el del medio no se movio
  });

  it('el empate del final no arrastra el del principio', () => {
    // Empatados en la clase 2 pero separados en la clase 1: solo se corren los
    // nombres de la derecha.
    const chart = buildTrajectoryChart([entry('A', [1, 4]), entry('B', [7, 4])], 2);
    expect(chart.lines[0].labelLeft.y).not.toBe(chart.lines[1].labelLeft.y);
    expect(chart.lines[0].labelLeft.leader).toBeNull();
    expect(chart.lines[0].labelRight.leader).not.toBeNull();
  });

  it('tambien separa los nombres de la izquierda cuando el empate esta al principio', () => {
    const chart = buildTrajectoryChart([entry('A', [2, 1]), entry('B', [2, 6])], 2);
    expect(chart.lines[0].labelLeft.y).not.toBe(chart.lines[1].labelLeft.y);
    expect(chart.lines[0].labelLeft.leader).not.toBeNull();
    expect(chart.lines[0].labelLeft.leader!.x1).toBeLessThan(chart.lines[0].dots[0].x);
  });

  it('los nombres corridos no se salen del lienzo', () => {
    // Seis empatados en el primer puesto: 37,5 px hacia arriba de la fila 1.
    const chart = buildTrajectoryChart(
      Array.from({ length: 6 }, (_, i) => entry(`Alumno ${i}`, [1])),
      1
    );
    for (const line of chart.lines) {
      // Debajo de la fila de las clases (baseline en y=20) y dentro del alto.
      expect(line.labelRight.y).toBeGreaterThan(24);
      expect(line.labelRight.y).toBeLessThan(chart.height);
    }
    expect(chart.rows[0].y).toBeGreaterThan(chart.lines[0].labelRight.y);
  });
});
