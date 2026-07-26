import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';

export default function SessionBuilder() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [topicDescription, setTopicDescription] = useState('');
  const [audience, setAudience] = useState('');
  const [roundCount, setRoundCount] = useState(3);
  const [roundMinutes, setRoundMinutes] = useState(5);
  const [language, setLanguage] = useState('español');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;
    setGenerating(true);
    setError(null);
    try {
      const generate = httpsCallable(functions, 'generateSessionDraft');
      const result = await generate({
        courseId,
        title: title.trim(),
        topicDescription: topicDescription.trim(),
        audience: audience.trim(),
        roundCount,
        roundMinutes,
        language,
      });
      const { sessionId } = result.data as { sessionId: string };
      navigate(`/professor/courses/${courseId}/sessions/${sessionId}/edit`);
    } catch (err) {
      console.error('Error generating session:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo generar la sesión: ${message}`);
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-main">
      <header className="p-4">
        <Link
          to={`/professor/courses/${courseId}`}
          className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al curso
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-cyan-400" />
            Nueva sesión con IA
          </h1>
          <p className="text-muted mb-8">
            Describe qué quieres enseñar y el asistente generará un borrador completo:
            escenarios por ronda, rúbrica de evaluación y material de apoyo. Después
            podrás editar todo antes de publicar.
          </p>

          <form onSubmit={handleGenerate} className="space-y-5">
            <div>
              <label className="block text-sm text-ink-soft mb-1">Título de la sesión</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                required maxLength={120} placeholder="Ej: Sesión 1: Sesgos cognitivos en decisiones públicas"
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">
                Tema y objetivos (mientras más detalle, mejor el borrador)
              </label>
              <textarea
                value={topicDescription} onChange={(e) => setTopicDescription(e.target.value)}
                required minLength={30} maxLength={2000} rows={5}
                placeholder="Ej: Quiero que practiquen identificar sesgos de anclaje y disponibilidad en casos reales de política pública chilena. Que tomen posición y justifiquen, no que reciten definiciones..."
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-ink-soft mb-1">Audiencia</label>
              <input
                type="text" value={audience} onChange={(e) => setAudience(e.target.value)}
                required maxLength={200} placeholder="Ej: 30 estudiantes de magíster en políticas públicas"
                className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-ink-soft mb-1">Rondas</label>
                <select
                  value={roundCount} onChange={(e) => setRoundCount(Number(e.target.value))}
                  className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n} className="bg-slate-800">{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-ink-soft mb-1">Min/ronda</label>
                <select
                  value={roundMinutes} onChange={(e) => setRoundMinutes(Number(e.target.value))}
                  className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  {[3, 4, 5, 6, 8, 10].map((n) => <option key={n} value={n} className="bg-slate-800">{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-ink-soft mb-1">Idioma</label>
                <select
                  value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-surface-2 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-400"
                >
                  <option value="español" className="bg-slate-800">Español</option>
                  <option value="inglés" className="bg-slate-800">Inglés</option>
                </select>
              </div>
            </div>
            {error && <p className="text-rose-400 text-sm">{error}</p>}
            <button type="submit" disabled={generating} className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3">
              {generating ? (
                <>
                  <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                  Generando (puede tardar ~1 minuto)...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generar borrador
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}
