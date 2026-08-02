import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { FEEDBACK_COMMENT_MAX, FEEDBACK_MAX, FEEDBACK_MIN } from '../types/feedback';

interface Props {
  saving: boolean;
  onSubmit: (rating: number | null, comment: string) => void;
  onSkip: () => void;
}

const ESCALA = Array.from(
  { length: FEEDBACK_MAX - FEEDBACK_MIN + 1 },
  (_, i) => FEEDBACK_MIN + i
);

/**
 * Va ANTES del podio, en el teléfono del alumno, mientras la revelación ocurre
 * en el proyector. Dos preguntas y nada más: la escala es de 1 a 7 porque es la
 * de las notas y no hay que explicarla, y la caja de texto es corta porque se
 * escribe con el pulgar.
 *
 * Se puede saltar a propósito. Obligar sube la tasa de respuesta y baja la
 * calidad: el que no quiere contestar pone un 4, escribe "bien" y ensucia el
 * promedio sin decir nada.
 */
export default function GameFeedback({ saving, onSubmit, onSkip }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');

  return (
    <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-play p-6 w-full max-w-md"
      >
        <h1 className="text-2xl font-black mb-1">Antes del podio</h1>
        <p className="text-muted text-sm mb-6">
          Dos preguntas cortas sobre el juego de hoy. Las lee el profesor.
        </p>

        <div className="mb-6">
          <p className="font-bold mb-3">¿Cuánto te gustó?</p>
          <div className="grid grid-cols-7 gap-1.5">
            {ESCALA.map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-pressed={rating === n}
                aria-label={`${n} de ${FEEDBACK_MAX}`}
                className={`aspect-square rounded-xl font-black text-lg transition-all ${
                  rating === n
                    ? 'bg-kahoot-blue text-onaccent shadow-[0_3px_0_#1368CE] scale-105'
                    : 'bg-surface-2 hover:bg-surface-3 text-ink'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[11px] font-bold text-muted mt-1.5 px-1">
            <span>nada</span>
            <span>me encantó</span>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="fb-comment" className="font-bold block mb-2">
            ¿Qué cambiarías para la próxima?
          </label>
          <textarea
            id="fb-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, FEEDBACK_COMMENT_MAX))}
            rows={3}
            placeholder="Una cosa. La que más te molestó o la que más te faltó."
            className="w-full p-3 rounded-xl bg-surface-2 border-2 border-line focus:border-kahoot-blue outline-none resize-none font-medium"
          />
          <div className="text-right text-[11px] text-muted mt-1">
            {comment.length}/{FEEDBACK_COMMENT_MAX}
          </div>
        </div>

        <button
          onClick={() => onSubmit(rating, comment)}
          disabled={saving || (rating === null && comment.trim() === '')}
          className="w-full py-3.5 rounded-xl bg-kahoot-green text-onaccent font-black text-lg shadow-[0_4px_0_#1f7a4d] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2"
        >
          <Send className="w-5 h-5" />
          {saving ? 'Enviando...' : 'Enviar y ver el podio'}
        </button>

        <button
          onClick={onSkip}
          disabled={saving}
          className="w-full mt-3 py-2 text-muted hover:text-ink font-bold text-sm underline disabled:opacity-40"
        >
          Saltar e ir al podio
        </button>
      </motion.div>
    </div>
  );
}
