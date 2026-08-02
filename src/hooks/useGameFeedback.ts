import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import type { GameFeedbackDoc } from '../types/feedback';

/**
 * Lo del propio alumno: si ya contestó, y cómo guardar su respuesta.
 *
 * `answered` parte en null mientras se averigua. Esa distinción importa: si
 * partiera en false, al alumno que ya contestó se le mostraría el formulario de
 * nuevo por un instante antes de desaparecer.
 */
export function useMyGameFeedback(gameCode: string | undefined) {
  const { user } = useAuth();
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!gameCode || !user) return;
    let cancelled = false;
    getDoc(doc(db, 'games', gameCode, 'feedback', user.uid))
      .then((snap) => {
        if (!cancelled) setAnswered(snap.exists());
      })
      .catch((err) => {
        console.error('Error leyendo tu feedback:', err);
        // Si no se puede leer, mejor mostrar el formulario que bloquear el podio.
        if (!cancelled) setAnswered(false);
      });
    return () => { cancelled = true; };
  }, [gameCode, user]);

  const save = useCallback(
    async (rating: number | null, comment: string) => {
      if (!gameCode || !user) return;
      setSaving(true);
      try {
        const payload: Omit<GameFeedbackDoc, 'submittedAt'> & { submittedAt: unknown } = {
          rating,
          comment: comment.trim(),
          playerName: user.displayName || 'Sin nombre',
          submittedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'games', gameCode, 'feedback', user.uid), payload);
      } catch (err) {
        // Que no se pueda guardar el feedback no puede dejar a nadie sin ver su
        // podio: se registra y se sigue.
        console.error('Error guardando tu feedback:', err);
      } finally {
        setSaving(false);
        setAnswered(true);
      }
    },
    [gameCode, user]
  );

  return { answered, saving, save };
}

export interface FeedbackEntry extends GameFeedbackDoc {
  playerId: string;
}

/**
 * Todo el feedback del juego, para el anfitrión. Las reglas de Firestore solo
 * dejan leer esta subcolección al anfitrión, así que `enabled` evita pedirla
 * —y provocar un error de permisos en la consola— cuando el que mira es alumno.
 */
export function useGameFeedbackSummary(gameCode: string | undefined, enabled: boolean) {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);

  useEffect(() => {
    if (!gameCode || !enabled) return;
    return onSnapshot(
      collection(db, 'games', gameCode, 'feedback'),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ playerId: d.id, ...(d.data() as GameFeedbackDoc) })));
      },
      (err) => console.error('Error leyendo el feedback del curso:', err)
    );
  }, [gameCode, enabled]);

  const rated = entries.filter((e) => typeof e.rating === 'number');
  const average = rated.length
    ? rated.reduce((acc, e) => acc + (e.rating as number), 0) / rated.length
    : null;

  return { entries, average, ratedCount: rated.length };
}
