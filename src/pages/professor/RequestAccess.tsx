import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Clock, XCircle, LogOut } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import type { ProfessorAccess } from '../../lib/professorAccess';

// Shown by ProfessorGate when the user is not an approved professor.
// access === 'none'     -> request form
// access === 'pending'  -> "under review" screen
// access === 'rejected' -> rejection notice
export default function RequestAccess({ access }: { access: ProfessorAccess }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [institution, setInstitution] = useState('');
  const [motivation, setMotivation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await setDoc(doc(db, 'professors', user.uid), {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        institution: institution.trim(),
        motivation: motivation.trim(),
        status: 'pending',
        requestedAt: serverTimestamp(),
      });
      // useProfessor's onSnapshot picks up the new doc and re-renders as 'pending'.
    } catch (err) {
      console.error('Error submitting professor request:', err);
      setError('No se pudo enviar la solicitud. Intenta de nuevo.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="dramatic-card p-8 max-w-md w-full"
      >
        {access === 'pending' && (
          <div className="text-center">
            <Clock className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Solicitud en revisión</h1>
            <p className="text-muted mb-6">
              Tu solicitud de acceso como profesor está siendo revisada.
              Te avisaremos por correo cuando sea aprobada.
            </p>
          </div>
        )}

        {access === 'rejected' && (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Solicitud no aprobada</h1>
            <p className="text-muted mb-6">
              Tu solicitud no fue aprobada. Si crees que es un error, escribe a
              naim.bro@gmail.com.
            </p>
          </div>
        )}

        {access === 'none' && (
          <>
            <div className="text-center mb-6">
              <GraduationCap className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Acceso para profesores</h1>
              <p className="text-muted">
                Cuéntanos quién eres y qué curso quieres crear. El administrador
                revisará tu solicitud.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-ink-soft mb-1">Institución</label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  required
                  maxLength={120}
                  placeholder="Ej: Universidad Adolfo Ibáñez"
                  className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                />
              </div>
              <div>
                <label className="block text-sm text-ink-soft mb-1">
                  ¿Qué curso quieres crear?
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="Ej: Curso de políticas públicas para 30 estudiantes de magíster"
                  className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
                />
              </div>
              {error && <p className="text-rose-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="primary-button w-full py-3"
              >
                {submitting ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          </>
        )}

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 mx-auto mt-6 px-3 py-1.5 text-sm text-muted hover:text-ink bg-surface-2 hover:bg-surface-2 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Salir ({user?.email})
        </button>
      </motion.div>
    </div>
  );
}
