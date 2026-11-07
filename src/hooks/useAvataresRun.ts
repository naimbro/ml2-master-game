import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { AvataresRun, DocHumano, DocPersona, DocPlanilla } from '../lib/avatares/sala';

/**
 * La sala de avatares en vivo. Planillas, votos humanos y personas solo se
 * suscriben si quien mira es el anfitrion: las reglas se los niegan a cualquier
 * otro, y un listener rechazado solo ensucia la consola.
 */
export function useAvataresRun(code?: string) {
  const { user } = useAuth();
  const [run, setRun] = useState<AvataresRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planillas, setPlanillas] = useState<DocPlanilla[]>([]);
  const [humanos, setHumanos] = useState<DocHumano[]>([]);
  const [personas, setPersonas] = useState<DocPersona[]>([]);
  const isHost = !!run && !!user && run.hostId === user.uid;

  useEffect(() => {
    if (!code) return;
    return onSnapshot(doc(db, 'avataresRuns', code.toUpperCase()), (s) => {
      setRun(s.exists() ? (s.data() as AvataresRun) : null);
      setError(s.exists() ? null : 'Sala no encontrada');
      setLoading(false);
    }, (e) => { setError(e.message); setLoading(false); });
  }, [code]);

  useEffect(() => {
    if (!code || !isHost) return;
    const c = code.toUpperCase();
    const u1 = onSnapshot(collection(db, 'avataresRuns', c, 'planillas'), (s) => setPlanillas(s.docs.map((d) => d.data() as DocPlanilla)));
    const u2 = onSnapshot(collection(db, 'avataresRuns', c, 'humanos'), (s) => setHumanos(s.docs.map((d) => d.data() as DocHumano)));
    const u3 = onSnapshot(collection(db, 'avataresRuns', c, 'personas'), (s) => setPersonas(s.docs.map((d) => d.data() as DocPersona)));
    return () => { u1(); u2(); u3(); };
  }, [code, isHost]);

  return { run, loading, error, isHost, planillas, humanos, personas };
}
