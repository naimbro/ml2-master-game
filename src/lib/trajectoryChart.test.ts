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
