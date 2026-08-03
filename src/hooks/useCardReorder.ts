import { useCallback, useEffect, useRef, useState } from 'react';
import { moveCourse, nudgeCourse } from '../lib/courseOrder';

/**
 * Arrastrar-y-soltar para una grilla de tarjetas.
 *
 * Usa Pointer Events y NO la API de drag-and-drop de HTML5. La de HTML5 es
 * menos codigo pero no existe en tactil: en un telefono el gesto se interpreta
 * como scroll y la tarjeta nunca se mueve. Pointer Events cubre mouse, dedo y
 * lapiz con el mismo camino.
 *
 * El arrastre sale de un ASA y no de la tarjeta entera. Cada tarjeta tiene tres
 * botones adentro, y hacer arrastrable toda la superficie convierte cualquier
 * clic apurado en un arrastre accidental. El asa ademas acota `touch-action:
 * none` a un cuadrado de 30px: si estuviera en la tarjeta completa, tocarla
 * para hacer scroll en el telefono dejaria la pagina congelada.
 */
export interface CardReorder {
  /** Id que se esta arrastrando, o null. */
  dragId: string | null;
  /** Id de la tarjeta bajo el puntero, para resaltarla. */
  overId: string | null;
  /** Props para el elemento asa de cada tarjeta. */
  handleProps: (id: string, label: string) => {
    onPointerDown: (e: React.PointerEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    style: React.CSSProperties;
    'aria-label': string;
  };
}

export function useCardReorder(
  ids: string[],
  onReorder: (next: string[], committed: boolean) => void,
): CardReorder {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Los handlers viven en el DOM durante todo el arrastre, asi que no pueden
  // cerrar sobre el valor de `ids` del render en que se crearon.
  const idsRef = useRef(ids);
  const onReorderRef = useRef(onReorder);
  useEffect(() => { idsRef.current = ids; }, [ids]);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);

  const dragIdRef = useRef<string | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const movedRef = useRef(false);

  const cardUnder = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    return el?.closest<HTMLElement>('[data-course-id]')?.dataset.courseId ?? null;
  };

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    // Solo boton principal: el clic derecho abre el menu contextual.
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragIdRef.current = id;
    lastTargetRef.current = null;
    movedRef.current = false;
    setDragId(id);
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const dragging = dragIdRef.current;
      if (!dragging) return;

      const target = cardUnder(e.clientX, e.clientY);
      setOverId(target && target !== dragging ? target : null);

      // Sobre la propia tarjeta arrastrada se olvida el ultimo destino. Sin
      // esto no se puede devolver una tarjeta al lugar de donde vino: tras un
      // intercambio el puntero queda justo encima de ella, y el destino
      // anterior seguiria bloqueado por la comparacion de abajo.
      if (!target || target === dragging) {
        lastTargetRef.current = null;
        return;
      }
      if (target === lastTargetRef.current) return;

      lastTargetRef.current = target;
      movedRef.current = true;
      onReorderRef.current(moveCourse(idsRef.current, dragging, target), false);
    };

    const handleUp = () => {
      if (!dragIdRef.current) return;
      const moved = movedRef.current;
      dragIdRef.current = null;
      lastTargetRef.current = null;
      setDragId(null);
      setOverId(null);
      // Se guarda una sola vez, al soltar. Persistir en cada cruce escribiria
      // en Firestore varias veces por gesto.
      if (moved) onReorderRef.current(idsRef.current, true);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    const dir = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : 0;
    if (!dir) return;
    e.preventDefault();
    const next = nudgeCourse(idsRef.current, id, dir as -1 | 1);
    if (next === idsRef.current) return;
    onReorderRef.current(next, true);
  }, []);

  const handleProps = useCallback((id: string, label: string) => ({
    onPointerDown: (e: React.PointerEvent) => onPointerDown(e, id),
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, id),
    style: { touchAction: 'none' as const, cursor: 'grab' as const },
    'aria-label': label,
  }), [onPointerDown, onKeyDown]);

  return { dragId, overId, handleProps };
}
