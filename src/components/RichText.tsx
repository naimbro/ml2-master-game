/**
 * Markdown de una linea en el texto de una ronda: `**negrita**` y `*cursiva*`.
 *
 * Los enunciados de las sesiones se escriben con markdown ligero desde el primer
 * juego, pero en la app NO hay ningun renderizador de markdown: `Round.tsx`
 * imprimia `context` y `question` como texto plano, asi que los asteriscos se
 * proyectaban literales delante del curso. La clase 1 de MGT300 se jugo asi el
 * 4 de agosto de 2026.
 *
 * La cursiva se agrego el 15 de agosto de 2026 por el mismo motivo y con la
 * misma evidencia: la ronda 5 de dataviz clase 3 cita la pregunta de la Encuesta
 * CEP entre asteriscos simples, y el curso vio `*«¿cuales son los tres
 * problemas...»*` con los asteriscos puestos. Era la UNICA cursiva en todo
 * `content/`, y aun asi conviene soportarla en vez de sacarla del contenido:
 * los profesores escriben sesiones desde la UI y van a teclear `*asi*`, y el
 * modo de falla es silencioso y en publico.
 *
 * Deliberadamente NO es un parser de markdown y no deberia convertirse en uno:
 * solo `**` y `*`, nunca HTML crudo, nunca enlaces. El texto viene de contenido
 * versionado en el repo pero tambien de sesiones que escriben otros profesores,
 * asi que las unicas salidas posibles siguen siendo `<strong>` y `<em>` con
 * texto adentro.
 *
 * Los asteriscos sin cerrar quedan literales: degrada a lo anterior en vez de
 * comerse el resto del parrafo.
 *
 * No lleva color propio a proposito: hereda el del contenedor. Las superficies
 * de alumno, de profesor y la proyectada no comparten paleta de texto.
 */

/**
 * Captura lo que va entre `**`. Perezoso, y `[\s\S]` para cruzar saltos de
 * linea. **Se aplica PRIMERO**: si se buscara la cursiva antes, `**negrita**`
 * entraria como un `*` de apertura, un texto y un `*` de cierre, y saldria una
 * cursiva con asteriscos sueltos a los lados.
 */
const BOLD_SPAN = /\*\*([\s\S]+?)\*\*/g;

/**
 * Cursiva. A diferencia de la negrita NO cruza saltos de linea y no admite `*`
 * adentro: un asterisco suelto en un parrafo —o dos parrafos con uno cada uno—
 * no debe unirse en una cursiva gigante que se coma el texto del medio.
 */
const ITALIC_SPAN = /\*([^*\n]+)\*/g;

/** Parte un tramo SIN negrita en sus cursivas. */
function conCursivas(texto: string, claveBase: string) {
  const partes = texto.split(ITALIC_SPAN);
  if (partes.length === 1) return texto;
  return partes.map((parte, i) =>
    i % 2 === 1 ? <em key={`${claveBase}-i${i}`}>{parte}</em> : parte,
  );
}

export function RichText({ text }: { text?: string | null }) {
  if (!text) return null;

  // split() con un grupo de captura intercala los capturados: los indices
  // impares son justamente lo que iba entre asteriscos.
  const parts = text.split(BOLD_SPAN);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          // Dentro de una negrita tambien puede ir cursiva.
          <strong key={i} className="font-bold">{conCursivas(part, `b${i}`)}</strong>
        ) : (
          <span key={i}>{conCursivas(part, `t${i}`)}</span>
        ),
      )}
    </>
  );
}
