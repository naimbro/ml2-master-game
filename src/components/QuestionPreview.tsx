import { CheckCircle, Zap } from 'lucide-react';
import MediaBlock from './MediaBlock';
import { resolveMediaSrc } from '../lib/media';
import { MC_SCORING_LEGEND } from '../lib/mcScoring';
import type { MediaAsset, MCQuestion, MCOption } from '../types/game';

// Deliberately a STATIC replica of the student view — no timers, no animation,
// no submission. The live student path (Round.tsx) is never refactored to feed
// this, so a bug here can never break a running game.

// Mirrors the key-badge colours used in Round.tsx.
const MC_KEY_COLORS = ['bg-kahoot-red text-onaccent', 'bg-kahoot-blue text-onaccent', 'bg-kahoot-yellow text-ink', 'bg-kahoot-green text-onaccent'];

interface PreviewScenario {
  title?: string;
  type?: string;
  prompt?: string;
  context?: string;
  question?: string;
  media?: MediaAsset[];
  mcQuestions?: MCQuestion[];
}

function OptionCard({
  option,
  index,
  isCorrect,
}: {
  option: MCOption;
  index: number;
  isCorrect: boolean;
}) {
  return (
    <div
      className={`${
        isCorrect
          ? 'bg-kahoot-green border-2 border-kahoot-green-dark text-onaccent'
          : 'bg-surface border-2 border-ink text-ink'
      } p-4 rounded-xl font-bold text-sm leading-snug min-h-[64px] flex ${
        option.imageSrc ? 'flex-col items-stretch gap-2' : 'items-center gap-3'
      }`}
    >
      {option.imageSrc && (
        <span className="block">
          <img
            src={resolveMediaSrc(option.imageSrc)}
            alt={option.imageAlt || option.text}
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            className="w-full h-28 object-cover rounded-lg bg-surface-3"
          />
          {option.imageCredit && (
            <span className="block text-[9px] font-medium text-muted mt-1 leading-tight">
              {option.imageCredit}
            </span>
          )}
        </span>
      )}
      <span className="flex items-center gap-3">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${isCorrect ? 'bg-ink/20 text-ink' : MC_KEY_COLORS[index % MC_KEY_COLORS.length]}`}>
          {option.id}
        </span>
        <span className="flex-1">{option.text || <em className="text-muted">(sin texto)</em>}</span>
        {isCorrect && <CheckCircle className="w-5 h-5 shrink-0" />}
      </span>
    </div>
  );
}

export default function QuestionPreview({ scenario }: { scenario: PreviewScenario }) {
  const isMC = scenario.type === 'multiple_choice';

  if (isMC) {
    const questions = scenario.mcQuestions || [];
    return (
      <div className="rounded-xl bg-surface-2 border-2 border-line p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Kahoot
          </span>
          <Zap className="w-3.5 h-3.5 text-amber-ink" />
          <span className="text-muted text-xs font-semibold">
            {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}
          </span>
        </div>

        <h3 className="text-lg font-black">{scenario.title || 'Sin título'}</h3>
        <MediaBlock media={scenario.media} />
        <p className="text-faint text-[10px] font-medium leading-relaxed">{MC_SCORING_LEGEND}</p>

        {questions.length === 0 && (
          <p className="text-faint text-sm italic">Aún no hay preguntas en esta ronda.</p>
        )}

        {questions.map((q, qi) => (
          <div key={qi} className="pt-4 border-t border-line space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted text-xs font-bold">
                Pregunta {qi + 1} / {questions.length}
              </span>
              <span className="text-muted text-xs font-mono font-bold">
                {q.timeLimitSeconds}s
              </span>
            </div>
            <p className="text-base font-black leading-relaxed">
              {q.question || <em className="text-muted">(sin enunciado)</em>}
            </p>
            <MediaBlock media={q.media} />
            <div className={`grid gap-2 ${(q.options || []).some(o => o.imageSrc) && (q.options || []).length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {(q.options || []).map((opt, oi) => (
                <OptionCard key={opt.id || oi} option={opt} index={oi} isCorrect={oi === q.correctOptionIndex} />
              ))}
            </div>
            {q.explanation && (
              <p className="text-muted text-xs font-medium italic">
                Tras responder: {q.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface-2 border-2 border-line p-4 space-y-3">
      <h3 className="text-lg font-black">{scenario.title || 'Sin título'}</h3>

      <div>
        <h4 className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Contexto</h4>
        <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-wrap font-medium">
          {scenario.context || scenario.prompt || <em className="text-muted">(sin escenario)</em>}
        </p>
      </div>

      <MediaBlock media={scenario.media} />

      {scenario.question && (
        <div className="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h4 className="text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-1">Pregunta</h4>
          <p className="text-ink text-sm leading-relaxed font-semibold">{scenario.question}</p>
        </div>
      )}

      <p className="text-faint text-[10px] font-medium">
        Los jueces IA evalúan esta respuesta con la rúbrica de la sesión (escala 0-100).
      </p>
    </div>
  );
}
