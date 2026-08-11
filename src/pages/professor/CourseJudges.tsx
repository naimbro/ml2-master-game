import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RotateCcw, Users, Check } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getCourse, type Course } from '../../lib/courses';
import { fetchCourse } from '../../lib/dynamicCourses';
import {
  fetchCourseJudges,
  fetchJudgeOverrides,
  saveJudgeOverrides,
  type BaselineJudge,
} from '../../lib/judges';

type Draft = Record<string, Record<string, string>>;

export default function CourseJudges() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(courseId ? getCourse(courseId) ?? null : null);
  const [baseline, setBaseline] = useState<BaselineJudge[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  // Snapshot of what was saved when the page opened. "Restaurar" undoes the edits made in this
  // sitting; it does NOT reset to the config/judges baseline — for a course like mundial_2026 the
  // persona the professor knows (La DT) lives in judgeOverrides, so that would wipe it.
  const savedRef = useRef<Draft>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    const builtin = getCourse(courseId);
    setCourse(builtin ?? null);
    if (!builtin) {
      fetchCourse(courseId).then(setCourse).catch((err) => console.error('Error loading course:', err));
    }
    Promise.all([fetchCourseJudges(courseId), fetchJudgeOverrides(courseId)])
      .then(([judges, overrides]) => {
        setBaseline(judges);
        const initial: Draft = {};
        for (const j of judges) {
          const ov = overrides[j.judgeId] || {};
          initial[j.judgeId] = {
            name: ov.name ?? j.name,
            avatar: ov.avatar ?? j.avatar,
            personality: ov.personality ?? j.personality,
            evaluationStyle: ov.evaluationStyle ?? j.evaluationStyle,
          };
        }
        savedRef.current = initial;
        setDraft(initial);
      })
      .catch((err) => console.error('Error loading judges:', err))
      .finally(() => setLoading(false));
  }, [courseId]);

  const setField = (judgeId: string, field: string, value: string) => {
    setSaved(false);
    setDraft((d) => ({ ...d, [judgeId]: { ...d[judgeId], [field]: value } }));
  };

  const resetJudge = (j: BaselineJudge) => {
    const savedJudge = savedRef.current[j.judgeId];
    if (!savedJudge) return;
    setSaved(false);
    setDraft((d) => ({ ...d, [j.judgeId]: { ...savedJudge } }));
  };

  const handleSave = async () => {
    if (!courseId || !user) return;
    setSaving(true);
    try {
      await saveJudgeOverrides(courseId, user.uid, draft);
      savedRef.current = draft;
      setSaved(true);
    } catch (err) {
      console.error('Error saving judges:', err);
      alert('Error al guardar los jueces. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Se vuelve a la pagina del curso, venga de donde venga. Hasta el 2026-08-11
  // un curso del repo volvia al panel porque `CourseHome` no sabia resolverlo;
  // ahora resuelve los dos y el camino de vuelta es el mismo para todos.
  const backHref = `/professor/courses/${courseId}`;

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link to={backHref} className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit">
          <ArrowLeft className="w-5 h-5" />
          Volver
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {course && (
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">{course.name}</p>
          )}
          <h1 className="text-3xl font-bold mb-2">Jueces del curso</h1>
          <p className="text-muted mb-8">
            Personaliza el nombre, el avatar y la personalidad de los jueces que evalúan a los estudiantes.
            Los cambios aplican a <strong>todo el curso</strong>.
          </p>

          {baseline.length === 0 ? (
            <div className="dramatic-card p-8 text-center text-muted">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Este curso todavía no tiene jueces configurados.
            </div>
          ) : (
            <>
              <div className="space-y-6 mb-8">
                {baseline.map((j) => (
                  <div key={j.judgeId} className="dramatic-card p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <input
                        aria-label="Avatar"
                        value={draft[j.judgeId]?.avatar ?? ''}
                        onChange={(e) => setField(j.judgeId, 'avatar', e.target.value)}
                        className="w-14 h-14 text-3xl text-center bg-surface-2 rounded-xl focus:ring-2 focus:ring-cyan-400 outline-none"
                        maxLength={4}
                      />
                      <input
                        aria-label="Nombre"
                        value={draft[j.judgeId]?.name ?? ''}
                        onChange={(e) => setField(j.judgeId, 'name', e.target.value)}
                        className="flex-1 text-lg font-bold bg-surface-2 rounded-lg px-3 py-2 focus:ring-2 focus:ring-cyan-400 outline-none"
                      />
                      <button
                        onClick={() => resetJudge(j)}
                        title="Descartar los cambios sin guardar de este juez"
                        className="flex items-center gap-1 px-3 py-2 text-sm text-muted hover:text-ink bg-surface-2 hover:bg-surface-2 rounded-lg transition-colors shrink-0"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Restaurar
                      </button>
                    </div>

                    <label htmlFor={`personality-${j.judgeId}`} className="block text-sm text-muted mb-1">Personalidad</label>
                    <textarea
                      id={`personality-${j.judgeId}`}
                      value={draft[j.judgeId]?.personality ?? ''}
                      onChange={(e) => setField(j.judgeId, 'personality', e.target.value)}
                      rows={4}
                      className="w-full bg-surface-2 rounded-lg px-3 py-2 mb-4 text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-y"
                    />

                    <label htmlFor={`evaluationStyle-${j.judgeId}`} className="block text-sm text-muted mb-1">Estilo de evaluación</label>
                    <textarea
                      id={`evaluationStyle-${j.judgeId}`}
                      value={draft[j.judgeId]?.evaluationStyle ?? ''}
                      onChange={(e) => setField(j.judgeId, 'evaluationStyle', e.target.value)}
                      rows={4}
                      className="w-full bg-surface-2 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-400 outline-none resize-y"
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                {saving ? (
                  <>
                    <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                    Guardando...
                  </>
                ) : saved ? (
                  <>
                    <Check className="w-5 h-5" />
                    Guardado
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Guardar jueces
                  </>
                )}
              </button>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}
