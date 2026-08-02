import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import type { FeedbackEntry } from '../hooks/useGameFeedback';

interface Props {
  entries: FeedbackEntry[];
  average: number | null;
  ratedCount: number;
  playerCount: number;
}

/**
 * Lo que ve el anfitrión al cerrar el juego. Solo para él: esta pantalla es la
 * que se proyecta, así que el bloque muestra el promedio y los comentarios, pero
 * nunca aparece en la pantalla de un alumno.
 */
export default function HostFeedbackSummary({
  entries,
  average,
  ratedCount,
  playerCount,
}: Props) {
  const conComentario = entries.filter((e) => e.comment.trim().length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="dramatic-card p-6"
    >
      <h2 className="text-xl font-black mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-cyan-400" />
        Qué dijo el curso
      </h2>

      {entries.length === 0 ? (
        <p className="text-muted text-sm">Todavía no contesta nadie.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-4 mb-5">
            <div>
              <div className="text-4xl font-black tabular-nums">
                {average === null ? '—' : average.toFixed(1)}
              </div>
              <div className="text-muted text-xs font-bold uppercase tracking-wider">
                promedio de 7
              </div>
            </div>
            <div className="text-muted text-sm font-semibold">
              {ratedCount} de {playerCount}{' '}
              {playerCount === 1 ? 'jugador puso nota' : 'jugadores pusieron nota'}
              {entries.length > ratedCount &&
                ` · ${entries.length - ratedCount} contestó sin poner nota`}
            </div>
          </div>

          {conComentario.length === 0 ? (
            <p className="text-muted text-sm">Nadie escribió un comentario.</p>
          ) : (
            <div className="space-y-2">
              {conComentario.map((e) => (
                <div key={e.playerId} className="p-3 rounded-xl bg-surface-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm">{e.playerName}</span>
                    {typeof e.rating === 'number' && (
                      <span className="text-xs font-black text-muted tabular-nums">
                        {e.rating}/7
                      </span>
                    )}
                  </div>
                  <p className="text-ink-soft text-sm whitespace-pre-wrap">{e.comment}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
