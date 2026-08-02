import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
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
