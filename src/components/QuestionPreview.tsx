import { CheckCircle, Zap } from 'lucide-react';
import MediaBlock from './MediaBlock';
import { resolveMediaSrc } from '../lib/media';
import { MC_SCORING_LEGEND } from '../lib/mcScoring';
import type { MediaAsset, MCQuestion, MCOption } from '../types/game';

// Deliberately a STATIC replica of the student view — no timers, no animation,
// no submission. The live student path (Round.tsx) is never refactored to feed
// this, so a bug here can never break a running game.

// Mirrors the Kahoot answer colors used in Round.tsx.
const MC_COLORS = ['bg-red-600', 'bg-blue-600', 'bg-yellow-600', 'bg-green-600'];

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
  const base = MC_COLORS[index % MC_COLORS.length];
  return (
    <div
      className={`${isCorrect ? 'bg-green-500 ring-4 ring-green-300' : `${base} opacity-70`} p-4 rounded-xl font-bold text-white text-sm leading-snug min-h-[64px] flex ${
        option.imageSrc ? 'flex-col items-stretch gap-2' : 'items-center gap-3'
      }`}
    >
      {option.imageSrc && (
        <img
          src={resolveMediaSrc(option.imageSrc)}
          alt={option.imageAlt || option.text}
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
          className="w-full h-28 object-cover rounded-lg bg-black/20"
        />
      )}
      <span className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-lg bg-black/20 flex items-center justify-center text-xs font-black shrink-0">
          {option.id}
        </span>
        <span className="flex-1">{option.text || <em className="text-white/60">(sin texto)</em>}</span>
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
      <div className="rounded-xl bg-kahoot-purple-deep/60 border-2 border-white/10 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-kahoot-yellow/25 text-yellow-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Kahoot
          </span>
          <Zap className="w-3.5 h-3.5 text-kahoot-yellow" />
          <span className="text-white/50 text-xs font-semibold">
            {questions.length} {questions.length === 1 ? 'pregunta' : 'preguntas'}
          </span>
        </div>

        <h3 className="text-lg font-black">{scenario.title || 'Sin título'}</h3>
        <MediaBlock media={scenario.media} />
        <p className="text-white/40 text-[10px] font-medium leading-relaxed">{MC_SCORING_LEGEND}</p>

        {questions.length === 0 && (
          <p className="text-white/40 text-sm italic">Aún no hay preguntas en esta ronda.</p>
        )}

        {questions.map((q, qi) => (
          <div key={qi} className="pt-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs font-bold">
                Pregunta {qi + 1} / {questions.length}
              </span>
              <span className="text-white/50 text-xs font-mono font-bold">
                {q.timeLimitSeconds}s
              </span>
            </div>
            <p className="text-base font-black leading-relaxed">
              {q.question || <em className="text-white/50">(sin enunciado)</em>}
            </p>
            <MediaBlock media={q.media} />
            <div className={`grid gap-2 ${(q.options || []).some(o => o.imageSrc) && (q.options || []).length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {(q.options || []).map((opt, oi) => (
                <OptionCard key={opt.id || oi} option={opt} index={oi} isCorrect={oi === q.correctOptionIndex} />
              ))}
            </div>
            {q.explanation && (
              <p className="text-white/60 text-xs font-medium italic">
                Tras responder: {q.explanation}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-kahoot-purple-deep/60 border-2 border-white/10 p-4 space-y-3">
      <h3 className="text-lg font-black">{scenario.title || 'Sin título'}</h3>

      <div>
        <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Contexto</h4>
        <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap font-medium">
          {scenario.context || scenario.prompt || <em className="text-white/50">(sin escenario)</em>}
        </p>
      </div>

      <MediaBlock media={scenario.media} />

      {scenario.question && (
        <div className="p-3 bg-kahoot-blue/15 border-2 border-kahoot-blue/30 rounded-xl">
          <h4 className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mb-1">Pregunta</h4>
          <p className="text-white text-sm leading-relaxed font-semibold">{scenario.question}</p>
        </div>
      )}

      <p className="text-white/40 text-[10px] font-medium">
        Los jueces IA evalúan esta respuesta con la rúbrica de la sesión (escala 0-100).
      </p>
    </div>
  );
}
