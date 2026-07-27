/**
 * El estado donde el alumno pasa mas minutos de la clase. Antes era un punto gris que
 * pulsaba; ahora dice cuanta gente falta, que es el dato que hace mirar la pantalla.
 */
export default function WaitingForRound({ answered, total }: { answered: number; total: number }) {
  const complete = total > 0 && answered >= total;
  return (
    <div className="inline-flex items-center gap-3 px-4 py-2 bg-surface-2 rounded-full border-2 border-line">
      <div className={`w-2 h-2 rounded-full ${complete ? 'bg-kahoot-green' : 'bg-kahoot-orange animate-pulse'}`} />
      <span className="text-ink-soft text-sm font-semibold">
        {total > 0 ? (
          <>
            <b className="font-black tabular-nums">{answered}</b>
            <span className="text-faint"> de </span>
            <b className="font-black tabular-nums">{total}</b>
            {complete ? ' ya respondieron — cerrando la ronda' : ' ya respondieron'}
          </>
        ) : (
          'Esperando a que termine la ronda...'
        )}
      </span>
    </div>
  );
}
