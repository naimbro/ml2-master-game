import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, X, ShieldCheck, Users } from 'lucide-react';
import {
  collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useProfessor } from '../../hooks/useProfessor';
import type { ProfessorProfile } from '../../types/professor';

export default function AdminPanel() {
  const { access, loading } = useProfessor();
  const [pending, setPending] = useState<ProfessorProfile[]>([]);
  const [approved, setApproved] = useState<ProfessorProfile[]>([]);

  useEffect(() => {
    if (access !== 'admin') return;
    const toProfile = (d: { id: string; data: () => unknown }) =>
      ({ ...(d.data() as Omit<ProfessorProfile, 'uid'>), uid: d.id });
    const unsubPending = onSnapshot(
      query(collection(db, 'professors'), where('status', '==', 'pending')),
      (snap) => setPending(snap.docs.map(toProfile)),
      (error) => console.error('Error loading pending professors:', error),
    );
    const unsubApproved = onSnapshot(
      query(collection(db, 'professors'), where('status', '==', 'approved')),
      (snap) => setApproved(snap.docs.map(toProfile)),
      (error) => console.error('Error loading approved professors:', error),
    );
    return () => { unsubPending(); unsubApproved(); };
  }, [access]);

  const review = async (uid: string, status: 'approved' | 'rejected') => {
    await updateDoc(doc(db, 'professors', uid), { status, reviewedAt: serverTimestamp() });
  };

  if (loading) return null;
  if (access !== 'admin') return <Navigate to="/professor" replace />;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-8 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
            Administración de profesores
          </h1>

          <h2 className="text-xl font-bold mb-4">
            Solicitudes pendientes {pending.length > 0 && `(${pending.length})`}
          </h2>
          {pending.length === 0 && (
            <p className="text-muted mb-8">No hay solicitudes pendientes.</p>
          )}
          <div className="space-y-4 mb-10">
            {pending.map((p) => (
              <div key={p.uid} className="dramatic-card p-5">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-bold">{p.displayName || p.email}</p>
                    <p className="text-muted text-sm">{p.email} · {p.institution}</p>
                    <p className="text-ink-soft text-sm mt-2">{p.motivation}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => review(p.uid, 'approved')}
                      className="flex items-center gap-1 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-700 rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Check className="w-4 h-4" /> Aprobar
                    </button>
                    <button
                      onClick={() => review(p.uid, 'rejected')}
                      className="flex items-center gap-1 px-3 py-2 bg-rose-500/20 hover:bg-rose-500/40 text-rose-700 rounded-lg transition-colors text-sm font-semibold"
                    >
                      <X className="w-4 h-4" /> Rechazar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-muted" />
            Profesores aprobados ({approved.length})
          </h2>
          <div className="space-y-2">
            {approved.map((p) => (
              <div key={p.uid} className="bg-surface-2 rounded-lg px-4 py-3 flex justify-between items-center">
                <div>
                  <span className="font-semibold">{p.displayName || p.email}</span>
                  <span className="text-muted text-sm ml-2">{p.email} · {p.institution}</span>
                </div>
                <button
                  onClick={() => review(p.uid, 'rejected')}
                  className="text-faint hover:text-rose-400 text-sm transition-colors"
                >
                  Revocar
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
