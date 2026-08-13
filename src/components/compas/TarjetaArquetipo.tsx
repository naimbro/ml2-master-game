import { useState } from 'react';
import CompasPlano from './CompasPlano';
import type { Arquetipo, CompasAxis, CompasPosicion } from '../../types/compas';

interface Props {
  arquetipo: Arquetipo;
  posicion: CompasPosicion;
  ejeX: CompasAxis;
  ejeY: CompasAxis;
  /** Previous application, when there is one: draws the trail on the mini plot. */
  posicionPrevia?: CompasPosicion | null;
}

const f = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/**
 * The student's card, on their own phone. Revealed in two beats.
 *
 * The blind spot — the strongest objection against their own position — stays
 * behind a tap on purpose. Handed over at the same time as the name, it reads
 * as the professor disagreeing before they have finished recognising
 * themselves; handed over after, it reads as an objection they chose to hear,
 * which is the only version that survives into the debate.
 *
 * There is no score on this card and there is no rank. Nothing to compare with
 * the person sitting next to them except a position, which is the point.
 */
export default function TarjetaArquetipo({ arquetipo, posicion, ejeX, ejeY, posicionPrevia }: Props) {
  const [abierto, setAbierto] = useState(false);
  const primeraFrase = arquetipo.desc.split(/(?<=\.)\s/)[0];

  return (
    <div className="card-play relative overflow-hidden p-4 pb-6">
      <div className="tape" aria-hidden="true" />

      <p className="mt-2 text-[10.5px] uppercase tracking-wider text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Eres
      </p>
      <h2
        className="mb-2 text-[clamp(24px,7vw,31px)] uppercase leading-none text-ink"
        style={{ fontFamily: "'Archivo Black', sans-serif", textWrap: 'balance' }}
      >
        {arquetipo.name}
      </h2>
      <p className="mb-3 text-[15px] text-ink-soft">{abierto ? arquetipo.desc : primeraFrase}</p>

      <div className="mb-2 border border-line bg-surface">
        <CompasPlano
          modo="mini"
          ejeX={ejeX}
          ejeY={ejeY}
          puntos={[
            {
              id: 'yo',
              esMio: true,
              pos: { magnitud: posicion.magnitud, direccion: posicion.direccion },
              previa: posicionPrevia
                ? { magnitud: posicionPrevia.magnitud, direccion: posicionPrevia.direccion }
                : null,
            },
          ]}
        />
      </div>

      <p className="mb-3 text-[13px] tabular-nums text-faint">
        {ejeX.label} {f(posicion.magnitud)} · {ejeY.label} {f(posicion.direccion)}
        {posicion.respondidas < posicion.total && (
          <> — sobre {posicion.respondidas} de {posicion.total} respondidas</>
        )}
      </p>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="w-full border-2 border-ink bg-surface px-4 py-3 text-[13px] uppercase shadow-[3px_3px_0_#101114] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
          style={{ fontFamily: "'Archivo Black', sans-serif" }}
        >
          Ver mi punto ciego
        </button>
      ) : (
        <div className="space-y-3">
          <div className="border-l-[3px] border-ink bg-surface py-2 pl-3">
            <h3 className="mb-1 text-[10.5px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Tu lectura
            </h3>
            <p className="text-[14px] text-ink-soft">{arquetipo.lectura}</p>
          </div>
          <div className="border-l-[3px] border-kahoot-orange bg-surface py-2 pl-3">
            <h3 className="mb-1 text-[10.5px] uppercase text-faint" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Tu punto ciego
            </h3>
            <p className="text-[14px] text-ink-soft">{arquetipo.puntoCiego}</p>
          </div>
        </div>
      )}
    </div>
  );
}
