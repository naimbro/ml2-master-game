import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { CourseStandings, MyCourseStanding } from '../types/standings';

/**
 * Lee los dos documentos del ranking acumulado: el publico del curso (top 10) y
 * el privado del alumno. Son documentos separados a proposito — ver el spec:
 * si la tabla completa viviera en uno solo, cualquier alumno con la consola
 * abierta leeria quien va ultimo.
 */
export function useCourseStandings(courseId: string | undefined) {
  const { user } = useAuth();
  const [standings, setStandings] = useState<CourseStandings | null>(null);
  const [mine, setMine] = useState<MyCourseStanding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courseId) {
      // Diferido a un microtask: setState sincrono en el cuerpo del efecto
      // dispara react-hooks/set-state-in-effect. useProfessor.ts y useRoundDuels.ts
      // conviven con ese error; acá se difiere para no sumar deuda nueva.
      queueMicrotask(() => {
        setStandings(null);
        setLoading(false);
      });
      return;
    }
    queueMicrotask(() => setLoading(true));
    const unsub = onSnapshot(
      doc(db, 'standings', courseId),
      (snap) => {
        setStandings(snap.exists() ? (snap.data() as CourseStandings) : null);
        setLoading(false);
      },
      (err) => {
        console.error('Error leyendo la tabla del curso:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [courseId]);

  useEffect(() => {
    if (!courseId || !user) {
      // Mismo motivo que arriba: diferido para no violar react-hooks/set-state-in-effect.
      queueMicrotask(() => setMine(null));
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'students', user.uid, 'courseData', courseId),
      (snap) => setMine(snap.exists() ? (snap.data() as MyCourseStanding) : null),
      (err) => console.error('Error leyendo tu posicion:', err)
    );
    return unsub;
  }, [courseId, user]);

  return { standings, mine, loading };
}
