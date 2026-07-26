import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, CheckCircle, ChevronDown, ChevronUp,
  ArrowUp, ArrowDown, Trash2, Plus, Eye, EyeOff, Image as ImageIcon, Music, X,
} from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import QuestionPreview from '../../components/QuestionPreview';
import { resolveMediaSrc } from '../../lib/media';
import { derivedMCRoundDuration, MC_DEFAULT_TIME_LIMIT } from '../../lib/mcTiming';

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
const OPTION_IDS = ['A', 'B', 'C', 'D'];
const DEFAULT_OPEN_DURATION = 180;

const INPUT_CLASS = 'w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400';
const SMALL_INPUT_CLASS = 'w-full bg-surface-2 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-400';

// Defined at module level, NOT inside SessionEditor: a component declared during
// render is a new type on every keystroke, so React remounts it and the input
// loses focus after each character.
function MediaEditor({
  media,
  onChange,
  label,
}: {
  media: AnyJson[] | undefined;
  onChange: (next: AnyJson[]) => void;
  label: string;
}) {
  const list: AnyJson[] = media || [];
  const patch = (mi: number, key: string, value: string) =>
    onChange(list.map((x, i) => (i === mi ? { ...x, [key]: value } : x)));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm text-ink-soft">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...list, { kind: 'image', src: '', alt: '' }])}
          className="flex items-center gap-1 px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold transition-colors"
        >
          <ImageIcon className="w-3 h-3" aria-hidden="true" /> Imagen
        </button>
        <button
          type="button"
          onClick={() => onChange([...list, { kind: 'audio', src: '', alt: '' }])}
          className="flex items-center gap-1 px-2 py-1 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold transition-colors"
        >
          <Music className="w-3 h-3" aria-hidden="true" /> Audio
        </button>
      </div>

      {list.map((m: AnyJson, mi: number) => (
        <div key={mi} className="mb-2 p-3 bg-surface-3 rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted shrink-0">
              {m.kind === 'audio' ? 'Audio' : 'Imagen'}
            </span>
            <button
              type="button"
              onClick={() => onChange(list.filter((_, i) => i !== mi))}
              className="ml-auto text-faint hover:text-rose-400 transition-colors"
              aria-label="Quitar medio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text" value={m.src || ''}
            placeholder="media/mi-curso/foto.jpg  o  https://…"
            onChange={(e) => patch(mi, 'src', e.target.value)}
            className={SMALL_INPUT_CLASS}
          />
          <input
            type="text" value={m.alt || ''}
            placeholder={m.kind === 'audio' ? 'Descripción del audio' : 'Texto alternativo (obligatorio)'}
            onChange={(e) => patch(mi, 'alt', e.target.value)}
            className={SMALL_INPUT_CLASS}
          />
          <input
            type="text" value={m.credit || ''}
            placeholder="Crédito / atribución (opcional)"
            onChange={(e) => patch(mi, 'credit', e.target.value)}
            className={SMALL_INPUT_CLASS}
          />
          {m.kind === 'image' && !m.alt && (
            <p className="text-amber-700 text-xs font-medium">
              Añade texto alternativo: se muestra si la imagen no carga.
            </p>
          )}
          {m.kind === 'image' && m.src && (
            <img
              src={resolveMediaSrc(m.src)}
              alt={m.alt || ''}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
              className="max-h-28 rounded-lg"
            />
          )}
        </div>
      ))}
    </div>
  );
}

function newScenarioId() {
  return `r_${Math.random().toString(36).slice(2, 8)}`;
}

function blankMCQuestion(): AnyJson {
  return {
    question: '',
    options: OPTION_IDS.slice(0, 4).map((id) => ({ id, text: '' })),
    correctOptionIndex: 0,
    timeLimitSeconds: MC_DEFAULT_TIME_LIMIT,
  };
}

export default function SessionEditor() {
  const { courseId, sessionId } = useParams<{ courseId: string; sessionId: string }>();
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openDim, setOpenDim] = useState<number | null>(null);
  const [previewRound, setPreviewRound] = useState<Record<number, boolean>>({});

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
      // Keep `order` in sync with array position; the runtime uses the array
      // index, but repo tooling and reports read `order`.
      const scenarios = draft.scenarios.map((s, i) => ({ ...s, order: i + 1 }));
      await updateDoc(doc(db, 'courses', courseId, 'sessions', sessionId), {
        title: draft.title,
        description: draft.description,
        status,
        config: {
          ...draft.config,
          title: draft.title,
          description: draft.description,
          roundCount: scenarios.length,
        },
        scenarios,
        rubric: draft.rubric,
        knowledgeBase: draft.knowledgeBase,
        updatedAt: serverTimestamp(),
      });
      setDraft({ ...draft, scenarios, status });
      setSavedAt(Date.now());
    } catch (err) {
      console.error('Error saving session:', err);
      setError('No se pudo guardar. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  // ---- scenario helpers -------------------------------------------------
  // Every mutation spreads the existing scenario. AI-generated rounds carry
  // fields this editor does not know about; rebuilding them would silently
  // drop those.

  const patchScenario = (index: number, patch: AnyJson) => {
    setDraft((prev) =>
      prev
        ? { ...prev, scenarios: prev.scenarios.map((s, i) => (i === index ? { ...s, ...patch } : s)) }
        : prev,
    );
  };

  const updateScenario = (index: number, field: string, value: unknown) => {
    patchScenario(index, { [field]: value });
  };

  /** MC rounds derive their round timer from their question limits. */
  const patchMCQuestions = (index: number, mcQuestions: AnyJson[]) => {
    patchScenario(index, { mcQuestions, durationSeconds: derivedMCRoundDuration(mcQuestions) });
  };

  const setRoundType = (index: number, type: 'open' | 'multiple_choice') => {
    const scenario = draft?.scenarios[index];
    if (!scenario) return;
    if (type === 'multiple_choice') {
      // Preserve any existing questions so toggling back and forth is lossless.
      const mcQuestions = scenario.mcQuestions?.length ? scenario.mcQuestions : [blankMCQuestion()];
      patchScenario(index, {
        type,
        mcQuestions,
        durationSeconds: derivedMCRoundDuration(mcQuestions),
      });
    } else {
      patchScenario(index, {
        type: 'open',
        durationSeconds: scenario.durationSeconds && scenario.type !== 'multiple_choice'
          ? scenario.durationSeconds
          : DEFAULT_OPEN_DURATION,
      });
    }
  };

  const addRound = () => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            scenarios: [
              ...prev.scenarios,
              {
                id: newScenarioId(),
                order: prev.scenarios.length + 1,
                title: `Ronda ${prev.scenarios.length + 1}`,
                type: 'open',
                ranked: true,
                durationSeconds: DEFAULT_OPEN_DURATION,
                prompt: '',
                judgeFocus: '',
                conceptTags: [],
              },
            ],
          }
        : prev,
    );
  };

  const deleteRound = (index: number) => {
    if (!draft) return;
    if (draft.scenarios.length <= 1) {
      setError('La sesión debe tener al menos una ronda.');
      return;
    }
    const label = draft.scenarios[index]?.title || `Ronda ${index + 1}`;
    if (!window.confirm(`¿Eliminar "${label}"? Esta acción no se puede deshacer.`)) return;
    setDraft({ ...draft, scenarios: draft.scenarios.filter((_, i) => i !== index) });
    setError(null);
  };

  const moveRound = (index: number, delta: number) => {
    if (!draft) return;
    const target = index + delta;
    if (target < 0 || target >= draft.scenarios.length) return;
    const scenarios = [...draft.scenarios];
    [scenarios[index], scenarios[target]] = [scenarios[target], scenarios[index]];
    setDraft({ ...draft, scenarios });
  };

  // ---- MC question helpers ---------------------------------------------

  const mcQuestionsOf = (index: number): AnyJson[] => draft?.scenarios[index]?.mcQuestions || [];

  const updateMCQuestion = (sIdx: number, qIdx: number, patch: AnyJson) => {
    patchMCQuestions(sIdx, mcQuestionsOf(sIdx).map((q, i) => (i === qIdx ? { ...q, ...patch } : q)));
  };

  const addMCQuestion = (sIdx: number) => {
    patchMCQuestions(sIdx, [...mcQuestionsOf(sIdx), blankMCQuestion()]);
  };

  const removeMCQuestion = (sIdx: number, qIdx: number) => {
    const questions = mcQuestionsOf(sIdx);
    if (questions.length <= 1) {
      setError('Un bloque de opción múltiple necesita al menos una pregunta.');
      return;
    }
    patchMCQuestions(sIdx, questions.filter((_, i) => i !== qIdx));
    setError(null);
  };

  const updateMCOption = (sIdx: number, qIdx: number, oIdx: number, patch: AnyJson) => {
    const q = mcQuestionsOf(sIdx)[qIdx];
    updateMCQuestion(sIdx, qIdx, {
      options: (q.options || []).map((o: AnyJson, i: number) => (i === oIdx ? { ...o, ...patch } : o)),
    });
  };

  const addMCOption = (sIdx: number, qIdx: number) => {
    const q = mcQuestionsOf(sIdx)[qIdx];
    const options = q.options || [];
    if (options.length >= 4) return;
    updateMCQuestion(sIdx, qIdx, { options: [...options, { id: OPTION_IDS[options.length], text: '' }] });
  };

  const removeMCOption = (sIdx: number, qIdx: number, oIdx: number) => {
    const q = mcQuestionsOf(sIdx)[qIdx];
    const options = q.options || [];
    if (options.length <= 2) {
      setError('Cada pregunta necesita al menos 2 alternativas.');
      return;
    }
    // Re-letter so ids stay A, B, C, D in order.
    const next = options
      .filter((_: AnyJson, i: number) => i !== oIdx)
      .map((o: AnyJson, i: number) => ({ ...o, id: OPTION_IDS[i] }));
    const correct = q.correctOptionIndex;
    updateMCQuestion(sIdx, qIdx, {
      options: next,
      correctOptionIndex: correct === oIdx ? 0 : correct > oIdx ? correct - 1 : correct,
    });
    setError(null);
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
          <p className="text-ink-soft mb-4">Sesión no encontrada</p>
          <Link to={`/professor/courses/${courseId}`} className="text-cyan-400 hover:underline">
            Volver al curso
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main pb-32">
      <header className="p-4 sticky top-0 bg-surface-3 backdrop-blur-md z-10 border-b border-line">
        <div className="max-w-3xl mx-auto flex flex-wrap justify-between items-center gap-3">
          <Link
            to={`/professor/courses/${courseId}`}
            className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver al curso
          </Link>
          <div className="flex items-center gap-3">
            {savedAt && !saving && <span className="text-faint text-sm">Guardado ✓</span>}
            <button
              onClick={() => persist(draft.status)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors text-sm font-semibold"
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
              <label className="block text-sm text-ink-soft mb-1" htmlFor="session-title">Título</label>
              <input
                id="session-title" type="text" value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1" htmlFor="session-desc">Descripción</label>
              <textarea
                id="session-desc" value={draft.description} rows={2}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={`${INPUT_CLASS} resize-none`}
              />
            </div>
          </div>
        </motion.section>

        {/* Scenarios */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-bold">Rondas ({draft.scenarios.length})</h2>
            <button
              onClick={addRound}
              className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-semibold transition-colors"
            >
              <Plus className="w-4 h-4" />
              Añadir ronda
            </button>
          </div>

          <div className="space-y-6">
            {draft.scenarios.map((scenario: AnyJson, i: number) => {
              const isMC = scenario.type === 'multiple_choice';
              const showPreview = Boolean(previewRound[i]);
              return (
                <div key={scenario.id || i} className="dramatic-card p-5 space-y-4">
                  {/* Round header controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider">
                      Ronda {i + 1}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPreviewRound({ ...previewRound, [i]: !showPreview })}
                        className="flex items-center gap-1 px-2 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg text-xs font-semibold transition-colors"
                      >
                        {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        Vista previa
                      </button>
                      <button
                        onClick={() => moveRound(i, -1)} disabled={i === 0}
                        className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg disabled:opacity-30 transition-colors"
                        aria-label="Subir ronda"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveRound(i, 1)} disabled={i === draft.scenarios.length - 1}
                        className="p-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg disabled:opacity-30 transition-colors"
                        aria-label="Bajar ronda"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteRound(i)}
                        className="p-1.5 bg-surface-2 hover:bg-rose-500/40 rounded-lg transition-colors"
                        aria-label="Eliminar ronda"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Type toggle + ranked + duration */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex rounded-lg overflow-hidden border border-line">
                      <button
                        onClick={() => setRoundType(i, 'open')}
                        className={`px-3 py-2 text-sm font-semibold transition-colors ${
                          !isMC ? 'bg-cyan-500 text-black' : 'bg-surface-2 hover:bg-surface-2'
                        }`}
                      >
                        Abierta
                      </button>
                      <button
                        onClick={() => setRoundType(i, 'multiple_choice')}
                        className={`px-3 py-2 text-sm font-semibold transition-colors ${
                          isMC ? 'bg-kahoot-yellow text-black' : 'bg-surface-2 hover:bg-surface-2'
                        }`}
                      >
                        Opción múltiple
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={scenario.ranked !== false}
                        onChange={(e) => updateScenario(i, 'ranked', e.target.checked)}
                        className="w-4 h-4 accent-cyan-400"
                      />
                      Cuenta para el ranking
                    </label>

                    {isMC ? (
                      <span className="text-sm text-muted">
                        Duración: <strong className="text-ink-soft">{scenario.durationSeconds ?? derivedMCRoundDuration(scenario.mcQuestions)}s</strong>{' '}
                        (calculada)
                      </span>
                    ) : (
                      <label className="flex items-center gap-2 text-sm text-ink-soft">
                        Duración (s)
                        <input
                          type="number" min={30} max={900} step={30}
                          value={scenario.durationSeconds ?? DEFAULT_OPEN_DURATION}
                          onChange={(e) => updateScenario(i, 'durationSeconds', Number(e.target.value))}
                          className="w-24 bg-surface-2 rounded-lg px-2 py-2 text-center outline-none focus:ring-2 focus:ring-cyan-400"
                        />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm text-ink-soft mb-1">Título</label>
                    <input
                      type="text" value={scenario.title || ''}
                      onChange={(e) => updateScenario(i, 'title', e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>

                  {isMC ? (
                    <>
                      <MediaEditor
                        media={scenario.media}
                        onChange={(next) => updateScenario(i, 'media', next)}
                        label="Medios del bloque (se ven antes de empezar)"
                      />

                      <div className="space-y-4">
                        {(scenario.mcQuestions || []).map((q: AnyJson, qi: number) => (
                          <div key={qi} className="p-4 bg-surface-3 rounded-xl space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-ink-soft">Pregunta {qi + 1}</span>
                              <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1.5 text-xs text-muted">
                                  Tiempo (s)
                                  <input
                                    type="number" min={5} max={120} step={5}
                                    value={q.timeLimitSeconds ?? MC_DEFAULT_TIME_LIMIT}
                                    onChange={(e) => updateMCQuestion(i, qi, { timeLimitSeconds: Number(e.target.value) })}
                                    className="w-16 bg-surface-2 rounded-lg px-2 py-1 text-center outline-none focus:ring-2 focus:ring-cyan-400"
                                  />
                                </label>
                                <button
                                  onClick={() => removeMCQuestion(i, qi)}
                                  className="text-faint hover:text-rose-400 transition-colors"
                                  aria-label="Eliminar pregunta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <textarea
                              value={q.question || ''} rows={2}
                              placeholder="Enunciado de la pregunta"
                              onChange={(e) => updateMCQuestion(i, qi, { question: e.target.value })}
                              className={`${SMALL_INPUT_CLASS} resize-y`}
                            />

                            <MediaEditor
                              media={q.media}
                              onChange={(next) => updateMCQuestion(i, qi, { media: next })}
                              label="Medios de la pregunta"
                            />

                            <div className="space-y-2">
                              <p className="text-xs text-muted font-semibold uppercase tracking-wider">
                                Alternativas — marca la correcta
                              </p>
                              {(q.options || []).map((opt: AnyJson, oi: number) => (
                                <div key={oi} className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="radio"
                                      name={`correct-${i}-${qi}`}
                                      checked={q.correctOptionIndex === oi}
                                      onChange={() => updateMCQuestion(i, qi, { correctOptionIndex: oi })}
                                      className="w-4 h-4 accent-kahoot-green shrink-0"
                                      aria-label={`Alternativa ${opt.id} es la correcta`}
                                    />
                                    <span className="w-6 text-center text-xs font-black text-muted shrink-0">
                                      {opt.id}
                                    </span>
                                    <input
                                      type="text" value={opt.text || ''}
                                      placeholder={`Alternativa ${opt.id}`}
                                      onChange={(e) => updateMCOption(i, qi, oi, { text: e.target.value })}
                                      className={SMALL_INPUT_CLASS}
                                    />
                                    <button
                                      onClick={() => removeMCOption(i, qi, oi)}
                                      className="text-faint hover:text-rose-400 transition-colors shrink-0"
                                      aria-label={`Eliminar alternativa ${opt.id}`}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2 pl-12">
                                    <input
                                      type="text" value={opt.imageSrc || ''}
                                      placeholder="Imagen de la alternativa (opcional)"
                                      onChange={(e) => updateMCOption(i, qi, oi, { imageSrc: e.target.value })}
                                      className={`${SMALL_INPUT_CLASS} text-xs`}
                                    />
                                    {opt.imageSrc && (
                                      <>
                                        <input
                                          type="text" value={opt.imageAlt || ''}
                                          placeholder="Texto alt"
                                          onChange={(e) => updateMCOption(i, qi, oi, { imageAlt: e.target.value })}
                                          className={`${SMALL_INPUT_CLASS} text-xs`}
                                        />
                                        <input
                                          type="text" value={opt.imageCredit || ''}
                                          placeholder="Crédito"
                                          onChange={(e) => updateMCOption(i, qi, oi, { imageCredit: e.target.value })}
                                          className={`${SMALL_INPUT_CLASS} text-xs`}
                                        />
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                              {(q.options || []).length < 4 && (
                                <button
                                  onClick={() => addMCOption(i, qi)}
                                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-700 font-semibold"
                                >
                                  <Plus className="w-3 h-3" /> Añadir alternativa
                                </button>
                              )}
                            </div>

                            <input
                              type="text" value={q.explanation || ''}
                              placeholder="Explicación tras responder (opcional)"
                              onChange={(e) => updateMCQuestion(i, qi, { explanation: e.target.value })}
                              className={SMALL_INPUT_CLASS}
                            />
                          </div>
                        ))}

                        <button
                          onClick={() => addMCQuestion(i)}
                          className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg text-sm font-semibold transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Añadir pregunta
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm text-ink-soft mb-1">
                          Escenario (lo que ve el estudiante)
                        </label>
                        <textarea
                          value={scenario.prompt ?? scenario.context ?? ''} rows={6}
                          onChange={(e) => updateScenario(i, scenario.context !== undefined && scenario.prompt === undefined ? 'context' : 'prompt', e.target.value)}
                          className={`${INPUT_CLASS} resize-y`}
                        />
                      </div>

                      <MediaEditor
                        media={scenario.media}
                        onChange={(next) => updateScenario(i, 'media', next)}
                        label="Medios de la ronda"
                      />

                      <div>
                        <label className="block text-sm text-ink-soft mb-1">
                          Foco de los jueces en esta ronda
                        </label>
                        <textarea
                          value={scenario.judgeFocus || ''} rows={2}
                          onChange={(e) => updateScenario(i, 'judgeFocus', e.target.value)}
                          className={`${INPUT_CLASS} resize-none`}
                        />
                      </div>
                    </>
                  )}

                  {showPreview && (
                    <div>
                      <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">
                        Vista previa (como la ve el estudiante)
                      </p>
                      <QuestionPreview scenario={scenario} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Rubric */}
        <section>
          <h2 className="text-xl font-bold mb-1">Rúbrica</h2>
          <p className="text-muted text-sm mb-4">
            Solo se aplica a las rondas abiertas. Los pesos deben sumar 1.0. Cada dimensión describe
            qué separa una respuesta excelente (100) de una deficiente (0).
          </p>
          <div className="mb-4">
            <label className="block text-sm text-ink-soft mb-1">Instrucciones globales para los jueces</label>
            <textarea
              value={draft.rubric.globalInstructions || ''} rows={3}
              onChange={(e) => setDraft({ ...draft, rubric: { ...draft.rubric, globalInstructions: e.target.value } })}
              className={`${INPUT_CLASS} resize-y`}
            />
          </div>
          <div className="space-y-4">
            {(draft.rubric.dimensions || []).map((dim: AnyJson, i: number) => (
              <div key={dim.id || i} className="dramatic-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <input
                    type="text" value={dim.name || ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        rubric: {
                          ...draft.rubric,
                          dimensions: draft.rubric.dimensions.map((d: AnyJson, j: number) =>
                            j === i ? { ...d, name: e.target.value } : d,
                          ),
                        },
                      })
                    }
                    className={`${INPUT_CLASS} font-bold flex-1 min-w-[12rem]`}
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-sm text-muted">Peso</label>
                    <input
                      type="number" step="0.05" min="0" max="1" value={dim.weight ?? 0}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          rubric: {
                            ...draft.rubric,
                            dimensions: draft.rubric.dimensions.map((d: AnyJson, j: number) =>
                              j === i ? { ...d, weight: Number(e.target.value) } : d,
                            ),
                          },
                        })
                      }
                      className="w-20 bg-surface-2 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-cyan-400 text-center"
                    />
                  </div>
                </div>
                <textarea
                  value={dim.description || ''} rows={2}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      rubric: {
                        ...draft.rubric,
                        dimensions: draft.rubric.dimensions.map((d: AnyJson, j: number) =>
                          j === i ? { ...d, description: e.target.value } : d,
                        ),
                      },
                    })
                  }
                  className={`${INPUT_CLASS} resize-none mb-3`}
                />
                <button
                  onClick={() => setOpenDim(openDim === i ? null : i)}
                  className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-700"
                >
                  {openDim === i ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Niveles de puntaje
                </button>
                {openDim === i && (
                  <div className="mt-3 space-y-2">
                    {RUBRIC_LEVELS.map((level) => (
                      <div key={level}>
                        <label className="block text-xs text-muted mb-1">
                          {level.replace('level_', 'Puntaje ')}
                        </label>
                        <textarea
                          value={dim[level] || ''} rows={2}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              rubric: {
                                ...draft.rubric,
                                dimensions: draft.rubric.dimensions.map((d: AnyJson, j: number) =>
                                  j === i ? { ...d, [level]: e.target.value } : d,
                                ),
                              },
                            })
                          }
                          className={`${INPUT_CLASS} resize-none text-sm`}
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
          <p className="text-muted text-sm mb-4">
            Contexto que los jueces usan para evaluar. Formato markdown.
          </p>
          <textarea
            value={draft.knowledgeBase} rows={16}
            onChange={(e) => setDraft({ ...draft, knowledgeBase: e.target.value })}
            className={`${INPUT_CLASS} resize-y font-mono text-sm`}
          />
        </section>
      </main>
    </div>
  );
}
