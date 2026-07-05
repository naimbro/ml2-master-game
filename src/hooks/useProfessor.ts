import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { getProfessorAccess, type ProfessorAccess } from '../lib/professorAccess';
import type { ProfessorProfile } from '../types/professor';

// Live view of the caller's professor profile + computed access level.
export function useProfessor() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfessorProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'professors', user.uid), (snap) => {
      setProfile(snap.exists() ? ({ ...(snap.data() as Omit<ProfessorProfile, 'uid'>), uid: snap.id }) : null);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const access: ProfessorAccess = getProfessorAccess(user?.email, profile?.status);
  return { profile, access, loading };
}
