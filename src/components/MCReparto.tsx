import { motion } from 'framer-motion';
import { MC_KEY_COLORS } from '../lib/mcOptionColors';
import type { MCOption } from '../types/game';

/**
 * El reparto de votos, en columnas — el PRIMER compas de la revelacion.
 *
 * Reemplaza a las casillas mientras dura ese compas, no se suma a ellas: en un
 * telefono de 390 px no hay alto para cuatro casillas Y un grafico, y la barrita
 * al pie de cada casilla —que fue el primer intento— no daba el efecto de sala
 * porque competia con el texto de la propia casilla. En el segundo compas las
 * casillas vuelven con la correcta encendida, que es donde se lee el contenido.
 *
 * ## Por que las columnas van en tinta y no del color de su alternativa
 *
 * Porque el verde es "correcta" y solo eso. Una columna verde entera durante el
 * primer compas —cuando por diseno todavia nadie sabe nada— revela la respuesta.
 * Y el verde no se puede simplemente cambiar por otro color: rojo/azul/ambar/
 * verde resulto ser la unica combinacion de cuatro que separa bien bajo
 * daltonismo (violeta y azul quedan a deltaE 0,4 en deuteranopia, o sea
 * identicos). Asi que el verde se reserva.
 *
 * No se pierde nada: aca el color nunca estuvo codificando identidad. La carga
 * la LETRA, que va al pie de cada columna con su ficha de color. La posicion y
 * el rotulo alcanzan, y de hecho es lo que hace legible el grafico proyectado.
 *
 * ## El cero es un dato, no un hueco
 *
 * Medido sobre N9YHC5: en las dos preguntas de alternativas el acierto fue 83% y
 * 89%, y en LAS DOS hubo una alternativa con cero votos. Una columna alta y tres
 * tocones es la forma normal de este grafico, no la excepcion. Que nadie eligiera
 * un distractor dice algo del distractor, asi que la columna en cero conserva su
 * ficha, su rotulo y su "0": lo que desaparece es la barra, no la alternativa.
 *
 * Y las que tienen votos nunca bajan de ALTO_MINIMO_PCT, o un voto de cuarenta
 * se dibujaria como una linea de 2 px indistinguible del cero.
 */

/** Piso de altura para una columna con al menos un voto, en % del alto util. */
const ALTO_MINIMO_PCT = 4;

interface Props {
  options: MCOption[];
  /** Votos por id de alternativa. Viene de `game.mcStats[...]`. */
  byOption: Record<string, number>;
  total: number;
  /** La alternativa que el jugador eligio, para marcarsela. No revela nada. */
  selectedOptionId?: string | null;
  className?: string;
}

export default function MCReparto({
  options,
  byOption,
  total,
  selectedOptionId,
  className = '',
}: Props) {
  // La escala va contra el MAXIMO, no contra el total: con 83% en una sola
  // alternativa, escalar al total dejaria la columna mas alta a 83% del alto y
  // las otras tres aplastadas contra el suelo por nada. El % que se lee sigue
  // siendo sobre el total, que es lo que la sala quiere saber.
  const maxN = Math.max(1, ...options.map((o) => byOption[o.id] ?? 0));

  return (
    <div className={`flex flex-col ${className}`}>
      <div
        className="grid gap-2 items-end"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, minHeight: '11rem' }}
      >
        {options.map((opt) => {
          const n = byOption[opt.id] ?? 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const alto = n === 0 ? 0 : Math.max(ALTO_MINIMO_PCT, (n / maxN) * 100);

          return (
            <div key={opt.id} className="flex flex-col justify-end items-center gap-1.5 h-full">
              <span className="text-center leading-none">
                <span className="block font-display text-xl sm:text-2xl text-ink tabular-nums">{n}</span>
                <span className="block text-[10px] font-bold text-muted tabular-nums">{pct}%</span>
              </span>
              <motion.span
                aria-hidden="true"
                initial={{ height: 0 }}
                animate={{ height: `${alto}%` }}
                transition={{ duration: 0.9, ease: [0.16, 0.84, 0.34, 1] }}
                // El borde de tinta no es decoracion: el ambar de la ficha C
                // queda a 1,99:1 contra el papel, bajo el minimo, y el borde es
                // lo que le da filo. Va en las cuatro para que se vean iguales.
                className="w-full rounded-t-md bg-surface-3 border-2 border-b-0 border-ink"
                style={{ minHeight: n === 0 ? 0 : undefined }}
              />
            </div>
          );
        })}
      </div>

      {/* La linea de base. Sin ella las columnas flotan y el cero no se lee
          como "apoyado en el suelo" sino como "no hay dato". */}
      <div className="h-[3px] bg-ink rounded-sm" />

      <div
        className="grid gap-2 pt-2"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((opt, i) => {
          const esMia = selectedOptionId === opt.id;
          return (
            <div key={opt.id} className="flex flex-col items-center gap-1">
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${
                  MC_KEY_COLORS[i % MC_KEY_COLORS.length]
                } ${esMia ? 'ring-2 ring-offset-2 ring-offset-paper ring-ink' : ''}`}
              >
                {opt.id}
              </span>
              {esMia && (
                <span className="text-[9px] font-black uppercase tracking-wide text-ink-soft">
                  la tuya
                </span>
              )}
              {/* Un lector de pantalla no ve columnas: lee esto. */}
              <span className="sr-only">
                {opt.text}: {byOption[opt.id] ?? 0} de {total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
