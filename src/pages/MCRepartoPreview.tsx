import { useState } from 'react';
import MCReparto from '../components/MCReparto';
import type { MCOption } from '../types/game';

// El gemelo de RevealPreview, para el otro momento que es imposible de mirar sin
// una clase en vivo: el primer compas de la revelacion de una pregunta de
// alternativas. Sin esto, la unica forma de ver el grafico de columnas es
// jugar un juego entero con gente adentro.
//
// El reparto NO es inventado: es el de N9YHC5 (MGT300 clase 2, 11-ago-2026),
// que es donde se ve el caso que importa —una columna alta, dos tocones y un
// cero— y no un reparto parejo que se veria mucho mejor de lo que se ve nunca.

// El tipo va explicito y no inferido: el ultimo caso tiene solo dos
// alternativas, asi que TypeScript infiere una UNION de dos formas de
// `byOption` —una con C y D, otra sin— y esa union no es asignable a
// Record<string, number>. Es el error que rompia `npm run build` con este
// archivo sin commitear.
interface CasoReparto {
  id: string;
  titulo: string;
  pregunta: string;
  options: MCOption[];
  byOption: Record<string, number>;
  total: number;
  mia: string;
}

const CASOS: CasoReparto[] = [
  {
    id: 'r1',
    titulo: 'N9YHC5 R1 — el caso normal',
    pregunta: 'Han escribe que la autoexplotación es «mucho más eficaz que la explotación por otros». ¿Por qué es MÁS eficaz?',
    options: [
      { id: 'A', text: 'Porque le ahorra a la empresa el costo de supervisar' },
      { id: 'B', text: 'Porque uno conoce sus propios límites mejor que un jefe' },
      { id: 'C', text: 'Porque va acompañada de un sentimiento de libertad' },
      { id: 'D', text: 'Porque las jornadas de trabajo se hicieron más largas' },
    ],
    byOption: { A: 1, B: 6, C: 33, D: 0 },
    total: 40,
    mia: 'B',
  },
  {
    id: 'r4',
    titulo: 'N9YHC5 R4 — la correcta es la primera',
    pregunta: 'Un estudio de la American Management Association, de mediados de los noventa, midió qué hacían los despidos masivos. Según Ehrenreich, ¿qué pasaba?',
    options: [
      { id: 'A', text: 'No subían la productividad, pero sí el precio de la acción' },
      { id: 'B', text: 'Subían la productividad, pero no el precio de la acción' },
      { id: 'C', text: 'Subían la productividad y también el precio de la acción' },
      { id: 'D', text: 'No subían la productividad ni tampoco el precio de la acción' },
    ],
    byOption: { A: 32, B: 2, C: 2, D: 0 },
    total: 36,
    mia: 'A',
  },
  {
    id: 'parejo',
    titulo: 'Reparto parejo — el caso que casi nunca pasa',
    pregunta: 'Un reparto de cuatro columnas parecidas, para ver que la escala no se rompe cuando no hay una dominante.',
    options: [
      { id: 'A', text: 'Alternativa A' },
      { id: 'B', text: 'Alternativa B' },
      { id: 'C', text: 'Alternativa C' },
      { id: 'D', text: 'Alternativa D' },
    ],
    byOption: { A: 11, B: 9, C: 13, D: 8 },
    total: 41,
    mia: 'C',
  },
  {
    id: 'dos',
    titulo: 'Dos alternativas',
    pregunta: 'Una pregunta de dos alternativas, para ver que la grilla no queda coja.',
    options: [
      { id: 'A', text: 'Verdadero' },
      { id: 'B', text: 'Falso' },
    ],
    byOption: { A: 29, B: 12 },
    total: 41,
    mia: 'A',
  },
];

export default function MCRepartoPreview() {
  const [caso, setCaso] = useState(CASOS[0]);
  const [k, setK] = useState(0); // fuerza el re-montaje para volver a animar

  return (
    <div className="min-h-screen bg-paper p-6 flex flex-col items-center gap-6">
      <div className="flex flex-wrap gap-2 justify-center">
        {CASOS.map((c) => (
          <button
            key={c.id}
            onClick={() => { setCaso(c); setK((n) => n + 1); }}
            className={`px-3 py-2 rounded-lg text-sm font-bold border-2 ${
              caso.id === c.id
                ? 'bg-ink text-onaccent border-ink'
                : 'bg-surface text-ink border-line hover:bg-surface-2'
            }`}
          >
            {c.titulo}
          </button>
        ))}
        <button
          onClick={() => setK((n) => n + 1)}
          className="px-3 py-2 rounded-lg text-sm font-bold border-2 border-line bg-surface hover:bg-surface-2"
        >
          ↻ Repetir la animación
        </button>
      </div>

      {/* 390 px clavados: es el ancho en el que hay que decidir esto. */}
      <div className="w-[390px] border border-line rounded-2xl bg-paper p-4 flex flex-col gap-3 shadow-lg">
        <p className="font-bold text-ink text-[15px] leading-snug">{caso.pregunta}</p>
        <div className="h-2 bg-surface-2 rounded-full" />
        <MCReparto
          key={k}
          options={caso.options}
          byOption={caso.byOption}
          total={caso.total}
          selectedOptionId={caso.mia}
        />
      </div>

      <p className="text-muted text-sm max-w-md text-center">
        Primer compás de la revelación. En el segundo vuelven las casillas con la
        correcta encendida — eso no se previsualiza acá.
      </p>
    </div>
  );
}
