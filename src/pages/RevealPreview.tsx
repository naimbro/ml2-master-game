import { useState } from 'react';
import RecalibrationReveal from './student/RecalibrationReveal';
import type { RoundDuel } from '../types/game';

// Synthetic "similar rivals" data so the professor can preview the full reveal
// (montage + upsets + climax + morph) without needing a live class or the AI.
const D = (
  seq: number,
  a: [string, number, number],
  b: [string, number, number],
  winner: 'a' | 'b' | 'tie',
  isUpset: boolean,
  isClimax = false,
): RoundDuel => ({
  seq,
  a: { name: a[0], provRank: a[1], provScore: a[2] },
  b: { name: b[0], provRank: b[1], provScore: b[2] },
  winner,
  isUpset,
  isClimax,
});

// ~1 de cada 5 empatado, que es la tasa que produce el doble orden en produccion.
const DUELS: RoundDuel[] = [
  D(0, ['Constanza Arcos', 6, 71], ['Ángelo Dossi', 7, 70], 'b', true),
  D(1, ['Javiera Piñol', 4, 74], ['Fabián Águila', 5, 73], 'a', false),
  D(2, ['Natalia Rosales', 2, 76], ['Maximiliano Sotomayor', 3, 75], 'tie', false),
  D(3, ['Ángelo Dossi', 7, 70], ['Matías Almarza', 8, 68], 'a', false),
  D(4, ['Fabián Águila', 5, 73], ['Constanza Arcos', 6, 71], 'b', true),
  D(5, ['Javiera Piñol', 4, 74], ['Natalia Rosales', 2, 76], 'a', true),
  D(6, ['Ángelo Dossi', 7, 70], ['Fabián Águila', 5, 73], 'tie', false),
  D(7, ['Maximiliano Sotomayor', 3, 75], ['Javiera Piñol', 4, 74], 'a', false),
  D(8, ['Joaco Morales', 1, 78], ['Natalia Rosales', 2, 76], 'a', false),
  D(9, ['Joaco Morales', 1, 78], ['Maximiliano Sotomayor', 3, 75], 'b', true, true),
];

const FINAL = [
  { playerId: 'maxi', playerName: 'Maximiliano Sotomayor', score: 77, rank: 1, provScore: 75, provRank: 3 },
  { playerId: 'javi', playerName: 'Javiera Piñol', score: 76, rank: 2, provScore: 74, provRank: 4 },
  { playerId: 'joaco', playerName: 'Joaco Morales', score: 75, rank: 3, provScore: 78, provRank: 1 },
  { playerId: 'ange', playerName: 'Ángelo Dossi', score: 73, rank: 4, provScore: 70, provRank: 7 },
  { playerId: 'nata', playerName: 'Natalia Rosales', score: 72, rank: 5, provScore: 76, provRank: 2 },
  { playerId: 'cons', playerName: 'Constanza Arcos', score: 71, rank: 6, provScore: 71, provRank: 6 },
  { playerId: 'fabi', playerName: 'Fabián Águila', score: 70, rank: 7, provScore: 73, provRank: 5 },
  { playerId: 'mati', playerName: 'Matías Almarza', score: 68, rank: 8, provScore: 68, provRank: 8 },
];

export default function RevealPreview() {
  const [runKey, setRunKey] = useState(0);
  const [done, setDone] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#07080d' }}>
      <RecalibrationReveal
        key={runKey}
        duels={DUELS}
        duelTotal={DUELS.length}
        finalReady={true}
        finalRankings={FINAL}
        onDone={() => setDone(true)}
      />
      {done && (
        <button
          onClick={() => { setDone(false); setRunKey((k) => k + 1); }}
          style={{
            position: 'fixed', zIndex: 60, bottom: 24, left: '50%', transform: 'translateX(-50%)',
            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, letterSpacing: '.2em',
            textTransform: 'uppercase', color: '#eef1f6', background: 'transparent',
            border: '1px solid #ffc24b', padding: '12px 24px', cursor: 'pointer', borderRadius: 4,
          }}
        >
          ▸ Repetir vista previa
        </button>
      )}
    </div>
  );
}
