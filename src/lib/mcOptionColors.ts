/**
 * El color de la ficha de cada alternativa (A, B, C, D).
 *
 * Vivia duplicado en `Round.tsx` y en `QuestionPreview.tsx`, y la copia se
 * desincronizo: al sacar el verde de la cuarta ficha habia que acordarse de los
 * dos archivos. Un arreglo de strings no es logica, asi que compartirlo no
 * rompe la separacion deliberada entre la vista viva y su replica estatica —
 * `QuestionPreview` sigue sin leer nada de `Round`.
 *
 * **La cuarta NO es verde.** En esta identidad el verde significa "correcta" y
 * nada mas. A tamano de ficha la infraccion pasaba desapercibida; dibujando el
 * reparto de votos en columnas quedo claro que una alternativa verde afirma la
 * respuesta antes de que se revele nada.
 *
 * El orden es fijo y no se cicla: la quinta alternativa no existe (el validador
 * de contenido corta en 4).
 */
export const MC_KEY_COLORS = [
  'bg-kahoot-red text-onaccent',
  'bg-kahoot-blue text-onaccent',
  'bg-kahoot-yellow text-ink',
  'bg-kahoot-violet text-onaccent',
];

/** El mismo orden, en hex, para lo que no puede usar clases de Tailwind. */
export const MC_KEY_HEX = ['#B3272B', '#2563EB', '#F5A524', '#7C3AED'];
