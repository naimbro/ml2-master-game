import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RoundDuel } from '../types/game';

/** Live subscription to a round's streamed pairwise duels, ordered by seq. */
export function useRoundDuels(gameCode: string | undefined, round: number | undefined): RoundDuel[] {
  const [duels, setDuels] = useState<RoundDuel[]>([]);
  useEffect(() => {
    if (!gameCode || !round) { setDuels([]); return; }
    const q = query(
      collection(db, 'games', gameCode, 'rounds', `round_${round}`, 'duels'),
      orderBy('seq'),
    );
    const unsub = onSnapshot(q, (snap) => setDuels(snap.docs.map((d) => d.data() as RoundDuel)));
    return () => unsub();
  }, [gameCode, round]);
  return duels;
}
