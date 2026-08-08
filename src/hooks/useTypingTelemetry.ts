import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ClipboardEvent } from 'react';
import { HUELLA_INTERVALO_MS, RegistroEscritura } from '../lib/registroEscritura';
import type { TelemetriaCaptura } from '../lib/telemetriaDerived';

interface Opciones {
  /** false en rondas de seleccion multiple y para el profesor que dirige sin jugar. */
  enabled: boolean;
  round: number;
  scenarioId: string;
  /** `game.roundStartTime` en ms, o null si todavia no llego. */
  roundStartMs: number | null;
}

/**
 * Le conecta al textarea de la respuesta abierta la contabilidad de
 * `RegistroEscritura`: el muestreo periodico, el evento de pegado y las salidas
 * de la app.
 *
 * Todo el estado vive en un `useRef` y no en `useState`, por dos razones que ya
 * nos costaron caro: el callback del `setInterval` captura el estado viejo de
 * React y muestrearia siempre el mismo largo; y un estado que dispara
 * re-render en cada tecla haria re-renderizar la ronda entera mientras el
 * alumno escribe.
 *
 * Este hook NO tiene logica propia. Si aparece un `if` que decide algo sobre la
 * respuesta, va en `RegistroEscritura`, que si tiene tests.
 */
export function useTypingTelemetry({ enabled, round, scenarioId, roundStartMs }: Opciones) {
  const registro = useRef<RegistroEscritura | null>(null);

  useEffect(() => {
    if (!enabled) {
      registro.current = null;
      return;
    }

    registro.current = new RegistroEscritura({
      ahora: () => Date.now(),
      scenarioId,
      roundStartMs,
    });

    const tic = setInterval(() => registro.current?.muestra(), HUELLA_INTERVALO_MS);
    const onVisibilidad = () => {
      if (document.hidden) registro.current?.seOculto();
      else registro.current?.seMostro();
    };
    document.addEventListener('visibilitychange', onVisibilidad);

    return () => {
      clearInterval(tic);
      document.removeEventListener('visibilitychange', onVisibilidad);
    };
    // `roundStartMs` a proposito fuera: llega despues del montaje y reiniciaria
    // el registro a mitad de la ronda, borrando lo que el alumno ya escribio.
    // Depender solo de `round` alcanza porque `startGame()` y `nextRound()` en
    // useGame.ts escriben `currentRound` y `roundStartTime` en el MISMO
    // updateDoc: siempre llegan juntos, en un solo snapshot y un solo render.
    // Si algun dia esas dos escrituras se separan, este efecto seguiria
    // remontando bien con el `round` nuevo, pero `roundStartOffsetMs` quedaria
    // calculado contra un `roundStartMs` viejo o nulo, en silencio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, round, scenarioId]);

  const noteChange = useCallback((valor: string) => {
    registro.current?.cambio(valor);
  }, []);

  const onPaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    // El largo se toma del portapapeles y no del delta del textarea: si habia
    // texto seleccionado, el delta seria el saldo neto y no lo que entro.
    //
    // Todo envuelto porque este handler corre dentro del render de React: si
    // `clipboardData` faltara en algun navegador de celular, un throw aca
    // reventaria la pantalla de la ronda del alumno. Ningun registro vale eso.
    // Un pegado que llega con largo 0 significa "hubo pegado y el navegador no
    // dijo de que tamano", que sigue siendo mas informacion que nada.
    try {
      registro.current?.pegado(e.clipboardData?.getData('text').length ?? 0);
    } catch (err) {
      console.warn('pegado no registrado', err);
    }
  }, []);

  const snapshot = useCallback((): TelemetriaCaptura | null => {
    return registro.current?.cerrar() ?? null;
  }, []);

  // El objeto se memoiza porque `handleSubmit` lo lleva en sus dependencias, y
  // el efecto de auto-envio por tiempo agotado depende de `handleSubmit`. Un
  // objeto nuevo en cada render volveria a montar ese efecto en cada tecla que
  // escribe el alumno.
  return useMemo(() => ({ noteChange, onPaste, snapshot }), [noteChange, onPaste, snapshot]);
}
