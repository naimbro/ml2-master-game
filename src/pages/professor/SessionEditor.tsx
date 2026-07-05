import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyJson = any;

interface DraftState {
  title: string;
  description: string;
  status: 'draft' | 'ready';
  config: AnyJson;
  scenarios: AnyJson[];
  rubric: AnyJson;
  knowledgeBase: string;
}

const RUBRIC_LEVELS = ['level_100', 'level_80', 'level_60', 'level_40', 'level_20', 'level_0'] as const;

export default function SessionEditor() {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDim, setOpenDim] = useState<number | null>(null);

  useEffect(() => {
    if (!courseId || !sessionId) return;
    getDoc(doc(db, 'courses', courseId, 'sessions', sessionId))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setDraft({
            title: d.title || '',
            description: d.description || '',
            status: d.status === 'ready' ? 'ready' : 'draft',
            config: d.config || {},
            scenarios: d.scenarios || [],
            rubric: d.rubric || { dimensions: [] },
            knowledgeBase: d.knowledgeBase || '',
          });
        }
      })
      .catch((err) => console.error('Error loading session:', err))
      .finally(() => setLoading(false));
  }, [courseId, sessionId]);

  const persist = async (status: 'draft' | 'ready') => {
    if (!courseId || !sessionId || !draft) return;
    setSaving(true);
    setError(null);
    try {
      await updateDoc(doc(db, 'courses', courseId, 'sessions', sessionId), {
        title: draft.title,
        description: draft.description,
        status,
        config: { ...draft.config, title: draft.title, description: draft.description },
        scenarios: draft.scenarios,
        rubric: draft.rubric,
        knowledgeBase: draft.knowledgeBase,
        updatedAt: serverTimestamp(),
      });
      setDraft({ ...draft, status });
      setSavedAt(Date.now());
    } catch (err) {
      console.error('Error saving session:', err);
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const updateScenario = (index: number, field: string, value: string) => {
    if (!draft) return;
    const scenarios = draft.scenarios.map((s, i) => (i === index ? { ...s, [field]: value } : s));
    setDraft({ ...draft, scenarios });
  };

  const updateDimension = (index: number, field: string, value: string | number) => {
    if (!draft) return;
    const dimensions = draft.rubric.dimensions.map((d: AnyJson, i: number) =>
      i === index ? { ...d, [field]: value } : d,
    );
    setDraft({ ...draft, rubric: { ...draft.rubric, dimensions } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-white/70 mb-4">Sesión no encontrada</p>
          <Link to={`/professor/courses/${courseId}`} className="text-cyan-400 hover:underline">
            Volver al curso
          </Link>
        </div>
      </div>
    );
  }

  const inputClass = 'w-full bg-white/10 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400';

  return (
    <div className="min-h-screen bg-gradient-main pb-32">
      <header className="p-4 sticky top-0 bg-black/40 backdrop-blur-md z-10 border-b border-white/10">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <Link
            to={`/professor/courses/${courseId}`}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al curso
          </Link>
          <div className="flex items-center gap-3">
            {savedAt && !saving && <span className="text-white/40 text-sm">Guardado ✓</span>}
            <button
              onClick={() => persist(draft.status)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Guardar
            </button>
            <button
              onClick={() => persist('ready')}
              disabled={saving}
              className="primary-button flex items-center gap-2 px-4 py-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              {draft.status === 'ready' ? 'Publicada' : 'Publicar'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {error && <p className="text-rose-400">{error}</p>}

        {/* Session metadata */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h2 className="text-xl font-bold mb-4">Datos de la sesión</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Título</label>
              <input
                type="text" value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Descripción</label>
              <textarea
                value={draft.description} rows={2}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </motion.section>

        {/* Scenarios */}
        <section>
          <h2 className="text-xl font-bold mb-4">Rondas ({draft.scenarios.length})</h2>
          <div className="space-y-6">
            {draft.scenarios.map((scenario: AnyJson, i: number) => (
              <div key={scenario.id || i} className="dramatic-card p-5 space-y-3">
                <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">
                  Ronda {i + 1}
                </p>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Título</label>
                  <input
                    type="text" value={scenario.title || ''}
                    onChange={(e) => updateScenario(i, 'title', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Escenario (lo que ve el estudiante)
                  </label>
                  <textarea
                    value={scenario.prompt || ''} rows={6}
                    onChange={(e) => updateScenario(i, 'prompt', e.target.value)}
                    className={`${inputClass} resize-y`}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">
                    Foco de los jueces en esta ronda
                  </label>
                  <textarea
                    value={scenario.judgeFocus || ''} rows={2}
                    onChange={(e) => updateScenario(i, 'judgeFocus', e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Rubric */}
        <section>
          <h2 className="text-xl font-bold mb-1">Rúbrica</h2>
          <p className="text-white/50 text-sm mb-4">
            Los pesos deben sumar 1.0. Cada dimensión describe qué separa una respuesta
            excelente (100) de una deficiente (0).
          </p>
          <div className="mb-4">
            <label className="block text-sm text-white/70 mb-1">Instrucciones globales para los jueces</label>
            <textarea
              value={draft.rubric.globalInstructions || ''} rows={3}
              onChange={(e) => setDraft({ ...draft, rubric: { ...draft.rubric, globalInstructions: e.target.value } })}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="space-y-4">
            {(draft.rubric.dimensions || []).map((dim: AnyJson, i: number) => (
              <div key={dim.id || i} className="dramatic-card p-5">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <input
                    type="text" value={dim.name || ''}
                    onChange={(e) => updateDimension(i, 'name', e.target.value)}
                    className={`${inputClass} font-bold`}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-sm text-white/50">Peso</label>
                    <input
                      type="number" step="0.05" min="0" max="1" value={dim.weight ?? 0}
                      onChange={(e) => updateDimension(i, 'weight', Number(e.target.value))}
                      className="w-20 bg-white/10 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400 text-center"
                    />
                  </div>
                </div>
                <textarea
                  value={dim.description || ''} rows={2}
                  onChange={(e) => updateDimension(i, 'description', e.target.value)}
                  className={`${inputClass} resize-none mb-3`}
                />
                <button
                  onClick={() => setOpenDim(openDim === i ? null : i)}
                  className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  {openDim === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Niveles de puntaje
                </button>
                {openDim === i && (
                  <div className="mt-3 space-y-2">
                    {RUBRIC_LEVELS.map((level) => (
                      <div key={level}>
                        <label className="block text-xs text-white/50 mb-1">
                          {level.replace('level_', 'Puntaje ')}
                        </label>
                        <textarea
                          value={dim[level] || ''} rows={2}
                          onChange={(e) => updateDimension(i, level, e.target.value)}
                          className={`${inputClass} resize-none text-sm`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Knowledge base */}
        <section>
          <h2 className="text-xl font-bold mb-1">Material de apoyo (knowledge base)</h2>
          <p className="text-white/50 text-sm mb-4">
            Contexto que los jueces usan para evaluar. Formato markdown.
          </p>
          <textarea
            value={draft.knowledgeBase} rows={16}
            onChange={(e) => setDraft({ ...draft, knowledgeBase: e.target.value })}
            className={`${inputClass} resize-y font-mono text-sm`}
          />
        </section>
      </main>
    </div>
  );
}
