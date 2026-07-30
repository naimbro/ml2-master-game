/**
 * Geometria de la figura de trayectorias: seis lineas, una por alumno del top,
 * con la posicion como filas. Se muestra SOLO la parte de arriba de la tabla —
 * quien no esta entre los seis no aparece, ni siquiera en gris.
 *
 * Los seis colores son los seis primeros cupos categoricos de la skill dataviz,
 * validados con scripts/validate_palette.js en modo claro. Tres de ellos quedan
 * bajo el minimo de contraste, asi que CADA linea lleva su nombre escrito: el
 * color no puede cargar la identidad solo.
 */
export const TRAJECTORY_COLORS = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300',
] as const;

export const MAX_TRAJECTORY_SERIES = 6;
const MAX_RANK_SHOWN = 15;

const WIDTH = 900;
const MARGIN_LEFT = 132;
const MARGIN_RIGHT = 150;
const MARGIN_TOP = 40;
const ROW_HEIGHT = 34;
const MARGIN_BOTTOM = 46;

export interface TrajectoryInput {
  name: string;
  positionsByGame: Array<number | null>;
}

export interface TrajectoryLine {
  name: string;
  color: string;
  /** Un `d` de <path> por tramo. Una ausencia corta el tramo. */
  segments: string[];
  dots: Array<{ x: number; y: number }>;
  labelLeft: { x: number; y: number; text: string };
  labelRight: { x: number; y: number; text: string };
}

export interface TrajectoryChart {
  width: number;
  height: number;
  maxRank: number;
  rows: Array<{ rank: number; y: number; banded: boolean }>;
  columns: Array<{ x: number; label: string }>;
  lines: TrajectoryLine[];
}

/** "Matías Fuenzalida" -> "Matías F." */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[1][0]}.`;
}

/** Cubica suave entre puntos: se ve mejor que el zigzag y no inventa sobrepasos. */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = (b.x - a.x) * 0.42;
    d += ` C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}

export function buildTrajectoryChart(
  entries: TrajectoryInput[],
  gameCount: number
): TrajectoryChart {
  const series = entries.slice(0, MAX_TRAJECTORY_SERIES);
  const shown = series.flatMap((s) => s.positionsByGame.filter((p): p is number => p !== null));
  const maxRank = Math.min(MAX_RANK_SHOWN, Math.max(2, ...shown));
  const height = MARGIN_TOP + (maxRank - 1) * ROW_HEIGHT + MARGIN_BOTTOM;

  const columns = Array.from({ length: gameCount }, (_, c) => ({
    x: gameCount === 1
      ? MARGIN_LEFT
      : MARGIN_LEFT + (c * (WIDTH - MARGIN_LEFT - MARGIN_RIGHT)) / (gameCount - 1),
    label: `Clase ${c + 1}`,
  }));
  const y = (rank: number) => MARGIN_TOP + (rank - 1) * ROW_HEIGHT;

  const rows = Array.from({ length: maxRank }, (_, i) => ({
    rank: i + 1,
    y: y(i + 1),
    banded: i % 2 === 0,
  }));

  const lines: TrajectoryLine[] = series.map((s, k) => {
    const dots: Array<{ x: number; y: number }> = [];
    const groups: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];

    s.positionsByGame.slice(0, gameCount).forEach((rank, c) => {
      if (rank === null) {
        if (current.length > 1) groups.push(current);
        current = [];
        return;
      }
      const point = { x: columns[c].x, y: y(Math.min(rank, maxRank)) };
      dots.push(point);
      current.push(point);
    });
    if (current.length > 1) groups.push(current);

    const first = dots[0];
    const last = dots[dots.length - 1];

    return {
      name: s.name,
      color: TRAJECTORY_COLORS[k],
      segments: groups.map(smoothPath),
      dots,
      labelLeft: { x: (first?.x ?? MARGIN_LEFT) - 16, y: (first?.y ?? 0) + 4, text: shortName(s.name) },
      labelRight: { x: (last?.x ?? MARGIN_LEFT) + 16, y: (last?.y ?? 0) + 4, text: s.name },
    };
  });

  return { width: WIDTH, height, maxRank, rows, columns, lines };
}
