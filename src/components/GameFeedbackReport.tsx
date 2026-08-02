import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useGameFeedbackSummary } from '../hooks/useGameFeedback';

interface Props {
  gameCode: string | undefined;
  totalPlayers: number;
}

/**
 * El feedback del juego, para el profesor que lo hizo correr.
 *
 * Vive en el reporte de clase y NO en la pantalla final: esa se proyecta, y ver
 * los comentarios con nombre delante del curso cambia lo que la gente se atreve
 * a escribir. Acá el profesor entra a proposito, despues de la clase.
 *
 * Las reglas de Firestore solo dejan leer esta subcoleccion al anfitrion de ese
 * juego, asi que un colega ve el feedback de sus propias partidas y de ninguna
 * otra. Naim, ademas, tiene scripts/game-feedback.ts para mirar varias clases
 * juntas y ver como evoluciona el juego.
 */
export default function GameFeedbackReport({ gameCode, totalPlayers }: Props) {
  const { entries, average, ratedCount } = useGameFeedbackSummary(gameCode, true);
  const conComentario = entries.filter((e) => e.comment.trim().length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="dramatic-card p-6"
    >
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-cyan-400" />
        Qué dijo el curso del juego
      </h2>

      {entries.length === 0 ? (
        <p className="text-muted text-sm">
          Nadie dejó feedback en esta partida. El formulario aparece al cerrar el juego y se puede
          saltar.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-4 mb-5 flex-wrap">
            <div>
              <div className="text-4xl font-bold tabular-nums">
                {average === null ? '—' : average.toFixed(1)}
              </div>
              <div className="text-muted text-xs font-bold uppercase tracking-wider">
                promedio de 7
              </div>
            </div>
            <div className="text-muted text-sm">
              {ratedCount} de {totalPlayers}{' '}
              {totalPlayers === 1 ? 'jugador puso nota' : 'jugadores pusieron nota'}
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
                      <span className="text-xs font-bold text-muted tabular-nums">{e.rating}/7</span>
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
