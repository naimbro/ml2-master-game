// Orden manual de las tarjetas del panel del profesor.
//
// El orden es una preferencia POR PROFESOR, no una propiedad del curso: los
// cursos del catalogo son los mismos para todos y no pueden llevar el orden
// que eligio uno. Por eso vive en `professorPrefs/{uid}` y no en `courses/`.
//
// La lista guardada es de ids y nada mas. Guardar posiciones numericas obliga a
// reescribir todas las tarjetas cuando se agrega una; guardar ids deja que la
// lista sobreviva a cursos que aparecen y desaparecen.

/**
 * Ordena `courses` segun `order`, una lista de ids.
 *
 * Las dos asimetrias importan:
 *
 * - Un id en `order` que ya no existe se ignora. Pasa cada vez que se borra un
 *   curso, y limpiarlo del documento seria una escritura por cada lectura.
 * - Un curso que no esta en `order` va al FINAL, conservando el orden en que
 *   venia. Es lo predecible cuando se crea un curso nuevo: aparece donde uno lo
 *   dejo la ultima vez, no en medio de la grilla.
 *
 * Estable: dos cursos ausentes de `order` mantienen su posicion relativa.
 */
export function applyCourseOrder<T extends { id: string }>(
  courses: T[],
  order: string[] | undefined | null,
): T[] {
  if (!Array.isArray(order) || order.length === 0) return [...courses];

  const rank = new Map<string, number>();
  order.forEach((id, i) => {
    // Un id repetido en el documento no debe mover el curso dos veces: gana la
    // primera aparicion, que es la que el profesor ve mas arriba.
    if (!rank.has(id)) rank.set(id, i);
  });

  return [...courses].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined && rb === undefined) return 0; // estable: no los toca
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}

/**
 * Mueve `fromId` a la posicion que ocupa `toId`, corriendo el resto.
 *
 * Recibe y devuelve la lista COMPLETA de ids visibles, no la guardada: si se
 * operara sobre la guardada, arrastrar un curso recien creado (que no esta en
 * ella) no tendria ningun efecto observable.
 */
export function moveCourse(ids: string[], fromId: string, toId: string): string[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return ids;

  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * Mueve `id` un lugar hacia adelante (-1) o hacia atras (+1).
 *
 * Existe para el teclado: el asa de arrastre es un boton, y con el foco puesto
 * las flechas mueven la tarjeta. Sin esto la funcion entera queda fuera del
 * alcance de quien no usa mouse.
 */
export function nudgeCourse(ids: string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  if (from < 0) return ids;
  const to = from + direction;
  if (to < 0 || to >= ids.length) return ids;

  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
