/**
 * Negrita de `**asi**` en el texto de una ronda.
 *
 * Los enunciados de las sesiones se escriben con markdown ligero desde el primer
 * juego, pero en la app NO hay ningun renderizador de markdown: `Round.tsx`
 * imprimia `context` y `question` como texto plano, asi que los asteriscos se
 * proyectaban literales delante del curso. La clase 1 de MGT300 se jugo asi el
 * 4 de agosto de 2026.
 *
 * Deliberadamente NO es un parser de markdown, y no deberia convertirse en uno:
 * solo `**`, y nunca HTML crudo. El texto viene de contenido versionado en el
 * repo, pero tambien de sesiones que escriben otros profesores desde la UI, asi
 * que la unica salida posible sigue siendo un `<strong>` con texto adentro.
 *
 * Los `**` sin cerrar quedan literales, que es como se ven hoy: degrada a lo
 * anterior en vez de comerse el resto del parrafo.
 *
 * No lleva color propio a proposito: hereda el del contenedor. Las superficies
 * de alumno, de profesor y la proyectada no comparten paleta de texto.
 */

/** Captura lo que va entre `**`. Perezoso, y `[\s\S]` para cruzar saltos de linea. */
const BOLD_SPAN = /\*\*([\s\S]+?)\*\*/g;

export function RichText({ text }: { text?: string | null }) {
  if (!text) return null;

  // split() con un grupo de captura intercala los capturados: los indices
  // impares son justamente lo que iba entre asteriscos.
  const parts = text.split(BOLD_SPAN);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : part,
      )}
    </>
  );
}
