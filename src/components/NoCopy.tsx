import type { ReactNode } from 'react';

/**
 * Envuelve el contenido que no debe poder seleccionarse ni copiarse: los
 * enunciados de las preguntas, mientras se juega la ronda.
 *
 * Encarece pegar la pregunta en un chatbot; no lo impide. La captura de
 * pantalla sigue funcionando y un modelo con visión la lee sin problema. La
 * defensa de verdad es que la respuesta viva en un gráfico o en un caso y no en
 * el texto, como ya pasa en las rondas de Visualización de Datos.
 *
 * En el celular —que es donde juegan— esto también corta el "Copiar" que sale
 * al mantener el dedo apretado, que es el camino real, no Ctrl+C.
 *
 * Va SOLO sobre el enunciado. La respuesta que escribe el alumno y el feedback
 * de los jueces se quedan seleccionables a propósito: son suyos, y varios los
 * copian a sus apuntes.
 *
 * `select-none` de Tailwind emite `user-select`; autoprefixer agrega la
 * variante `-webkit-` que necesita el Safari de iOS.
 */
export default function NoCopy({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`select-none ${className}`}>{children}</div>;
}
