import { useEffect, useRef, useState } from 'react';
import { COUNT_UP_MS, countUpValue } from '../lib/countUp';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Options {
  durationMs?: number;
  decimals?: number;
}

/**
 * Cuenta de `from` a `to` al montarse.
 *
 * Bajo prefers-reduced-motion (o cuando no hay nada que recorrer) el valor arranca
 * directamente en `to`: no se anima ni se ve un frame con el numero equivocado.
 */
export function useCountUp(
  from: number,
  to: number,
  { durationMs = COUNT_UP_MS, decimals = 0 }: Options = {},
): number {
  const skip = prefersReducedMotion() || from === to || durationMs <= 0;
  const [value, setValue] = useState(() => (skip ? to : from));
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Todo setValue pasa por un callback de rAF, nunca sincrono en el cuerpo del
    // efecto: eso dispara renders en cascada (react-hooks/set-state-in-effect).
    if (skip) {
      frame.current = requestAnimationFrame(() => setValue(to));
    } else {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsedMs = now - start;
        setValue(countUpValue({ from, to, elapsedMs, durationMs, decimals }));
        if (elapsedMs < durationMs) frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    }

    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [from, to, durationMs, decimals, skip]);

  return value;
}
