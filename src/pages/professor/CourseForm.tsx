import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { createCourse } from '../../lib/dynamicCourses';
import { COURSE_COLORS } from '../../lib/courseMappers';

export default function CourseForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [tagline, setTagline] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0].id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const courseId = await createCourse(user.uid, {
        name: name.trim(),
        shortName: shortName.trim() || name.trim().slice(0, 6),
        tagline: tagline.trim(),
        color,
      }, user.email);
      navigate(`/professor/courses/${courseId}`);
    } catch (err) {
      console.error('Error creating course:', err);
      setError('No se pudo crear el curso. Intenta de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to="/professor" className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-cyan-400" />
            Crear curso
          </h1>
          <p className="text-muted mb-8">
            Después de crear el curso podrás generar sesiones con el asistente IA.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Nombre del curso</label>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                required maxLength={80} placeholder="Ej: Economía del Comportamiento"
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Nombre corto (opcional)</label>
              <input
                type="text" value={shortName} onChange={(e) => setShortName(e.target.value)}
                maxLength={12} placeholder="Ej: EconC"
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Descripción breve</label>
              <input
                type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
                required maxLength={120} placeholder="Una línea que describa el curso"
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-2">Color</label>
              <div className="flex gap-3">
                {COURSE_COLORS.map((c) => (
                  <button
                    key={c.id} type="button" onClick={() => setColor(c.id)}
                    className={`w-10 h-10 rounded-lg ${c.iconClass} transition-transform ${
                      color === c.id ? 'ring-2 ring-ink scale-110' : 'opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Color ${c.id}`}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button type="submit" disabled={saving || !name.trim()} className="primary-button w-full py-4 text-lg">
              {saving ? 'Creando...' : 'Crear curso'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
