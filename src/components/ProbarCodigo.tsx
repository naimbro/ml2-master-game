import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useMotorR } from '../hooks/useMotorR';
import { motorR, type ConfigR } from '../lib/rEnVivo';

interface Props {
  config: ConfigR;
  /** Lo que hay en el textarea ahora mismo. */
  codigo: string;
  /** true mientras la respuesta se está enviando. */
  bloqueado?: boolean;
  /** Avisa cada vez que termina una prueba. Sólo para la telemetría. */
  onPrueba?: (ok: boolean) => void;
}

interface Mostrado {
  ok: boolean;
  texto: string;
  hayGrafico: boolean;
  ms: number;
  /** El código tal como estaba cuando se probó, para saber si ya cambió. */
  codigo: string;
}

const segundos = (ms: number) =>
  `${(ms / 1000).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/**
 * La tira de «Probar» que va pegada bajo el textarea en las rondas de código,
 * y el resultado que se abre ahí mismo. Variante B de las tres que eligió Naim
 * el 14-nov-2026: probar queda separado de enviar, para que nadie mande la
 * respuesta por tocar el botón equivocado con el reloj corriendo.
 *
 * DOS COSAS QUE ESTE COMPONENTE NO PUEDE HACER NUNCA:
 *
 * 1. Tocar el envío. No recibe `onSubmit`, no deshabilita nada fuera de sí
 *    mismo. Si R no cargó, muestra un aviso y el alumno envía igual.
 * 2. Pintar «corrió» de verde. En esta app el verde es exclusivamente
 *    «correcto», y un código que corre puede dibujar una sola barra de 33.
 *    Por eso el pie le pide al alumno MIRAR el resultado.
 */
export default function ProbarCodigo({ config, codigo, bloqueado = false, onPrueba }: Props) {
  const estado = useMotorR(config);
  const [corriendo, setCorriendo] = useState(false);
  const [mostrado, setMostrado] = useState<Mostrado | null>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const probar = async () => {
    if (corriendo || !codigo.trim()) return;
    setCorriendo(true);
    const probado = codigo;
    const r = await motorR.ejecutar(probado);

    // El bitmap se dibuja y se suelta en el acto, esté o no montado el
    // componente: un ImageBitmap que nadie cierra es memoria del teléfono que
    // no vuelve, y la ronda puede haber terminado mientras R dibujaba.
    let hayGrafico = false;
    if (r.imagen) {
      const c = lienzo.current;
      const ctx = montado.current && c ? c.getContext('2d') : null;
      if (c && ctx) {
        c.width = r.imagen.width;
        c.height = r.imagen.height;
        ctx.drawImage(r.imagen, 0, 0);
        hayGrafico = true;
      }
      r.imagen.close();
    }
    onPrueba?.(r.ok);
    if (!montado.current) return;
    setMostrado({ ok: r.ok, texto: r.texto, hayGrafico, ms: r.ms, codigo: probado });
    setCorriendo(false);
  };

  if (estado === 'fallo') {
    return (
      <div className="border-t-2 border-line bg-surface-2 px-3 py-2.5 text-sm text-ink-soft">
        <p>
          <strong className="text-ink">R no cargó en este teléfono.</strong>{' '}
          Envía tu respuesta igual: los jueces la leen como siempre.
        </p>
        <button
          type="button"
          onClick={() => void motorR.preparar(config)}
          className="mt-1 font-bold text-orange-ink underline underline-offset-2"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const listo = estado === 'listo';
  const viejo = mostrado !== null && mostrado.codigo !== codigo;
  // Lo que dice la derecha de la tira. Una sola línea, siempre.
  const alLado = !listo
    ? 'Puedes ir escribiendo'
    : corriendo
      ? ''
      : mostrado === null
        ? ''
        : mostrado.ok ? `Corrió en ${segundos(mostrado.ms)}` : 'No corrió';

  return (
    <>
      <div className="flex items-center justify-between gap-3 border-t-2 border-line bg-surface-2 px-2.5 py-2">
        <button
          type="button"
          onClick={probar}
          disabled={!listo || corriendo || bloqueado || !codigo.trim()}
          className="secondary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm"
        >
          {listo && !corriendo ? (
            <Play className="h-4 w-4" aria-hidden="true" />
          ) : (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent" aria-hidden="true" />
          )}
          {!listo ? 'Preparando R' : corriendo ? 'Probando' : 'Probar'}
        </button>
        <span className="text-right text-[13px] font-semibold text-muted">{alLado}</span>
      </div>

      {/* El lienzo está siempre en el DOM —se dibuja sobre él antes de que React
          sepa que hay resultado— y sólo se muestra cuando tiene un gráfico. */}
      <div
        aria-live="polite"
        className={`border-t-2 border-line bg-surface ${mostrado ? '' : 'hidden'}`}
      >
        <div className={viejo ? 'opacity-50' : ''}>
          <canvas
            ref={lienzo}
            role="img"
            aria-label="El gráfico que dibujó tu código"
            className={`block h-auto w-full ${mostrado?.hayGrafico ? '' : 'hidden'}`}
          />
          {mostrado?.texto && (
            <pre
              className={`m-0 overflow-x-auto whitespace-pre px-3.5 py-3 text-[13px] leading-normal ${mostrado.ok ? 'text-ink' : 'text-kahoot-red'}`}
              style={{ fontFamily: 'var(--mono)' }}
            >
              {mostrado.texto}
            </pre>
          )}
        </div>
        {mostrado && (
          <p className="border-t-2 border-line bg-surface-2 px-3.5 py-2 text-sm text-ink-soft">
            {viejo ? (
              <>
                <strong className="text-ink">Cambiaste el código.</strong> Este resultado es de la versión anterior.
              </>
            ) : mostrado.ok ? (
              <>
                <strong className="text-ink">Corrió.</strong> Mira si es lo que pide la pregunta.
              </>
            ) : (
              <>
                <strong className="text-ink">R no pudo correr tu código.</strong> Puedes corregirlo y probar de nuevo.
              </>
            )}
          </p>
        )}
      </div>
    </>
  );
}
