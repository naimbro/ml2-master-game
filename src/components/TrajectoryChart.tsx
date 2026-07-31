import { buildTrajectoryChart, type TrajectoryInput } from '../lib/trajectoryChart';

interface Props {
  entries: TrajectoryInput[];
  gameCount: number;
}

export default function TrajectoryChart({ entries, gameCount }: Props) {
  const chart = buildTrajectoryChart(entries, gameCount);

  if (chart.lines.length === 0 || gameCount === 0) {
    return <p className="text-muted text-sm">Todavía no hay clases jugadas.</p>;
  }

  return (
    <svg
      viewBox={`0 0 ${chart.width} ${chart.height}`}
      width="100%"
      role="img"
      aria-label={`Trayectoria de los ${chart.lines.length} primeros del curso a lo largo de ${gameCount} clases`}
      style={{ background: '#fcfcfb', borderRadius: 12 }}
    >
      {chart.rows.map((row) => (
        <g key={row.rank}>
          {row.banded && (
            <rect
              x={chart.bandLeft} y={row.y - 17} width={chart.bandRight - chart.bandLeft} height={34} fill="#f4f2ec"
            />
          )}
          <text x={chart.rowLabelX} y={row.y + 4} fontSize={11} fontFamily="system-ui" fill="#898781" textAnchor="end">
            {row.rank}º
          </text>
        </g>
      ))}

      {chart.columns.map((col) => (
        <text
          key={col.label} x={col.x} y={20} fontSize={11.5}
          fontFamily="system-ui" fill="#898781" textAnchor="middle"
        >
          {col.label}
        </text>
      ))}

      {chart.lines.map((line) => (
        <g key={line.name}>
          {line.segments.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke="#fcfcfb" strokeWidth={8} strokeLinecap="round" />
              <path d={d} fill="none" stroke={line.color} strokeWidth={3.5} strokeLinecap="round" />
            </g>
          ))}
          {line.dots.map((dot, i) => (
            <circle key={i} cx={dot.x} cy={dot.y} r={5.5} fill={line.color} stroke="#fcfcfb" strokeWidth={2.5} />
          ))}
          <text
            x={line.labelLeft.x} y={line.labelLeft.y} fontSize={12}
            fontFamily="system-ui" fill="#0b0b0b" fontWeight={600} textAnchor="end"
          >
            {line.labelLeft.text}
          </text>
          <text
            x={line.labelRight.x} y={line.labelRight.y} fontSize={12.5}
            fontFamily="system-ui" fill="#0b0b0b" fontWeight={700}
          >
            {line.labelRight.text}
          </text>
        </g>
      ))}
    </svg>
  );
}
