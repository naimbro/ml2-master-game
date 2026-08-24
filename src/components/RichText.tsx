/**
 * Markdown de una linea en el texto de una ronda: `**negrita**`, `*cursiva*` y
 * ahora tambien codigo, en linea y en bloque.
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
 * EL CODIGO se agrego el 24 de agosto de 2026, y no por prolijidad: la ronda 3
 * de dataviz clase 4 pone cuatro lineas de R casi identicas como alternativas, y
 * lo unico que las separa es `=` contra `==` y una mayuscula. En Outfit bold
 * —proporcional— esa diferencia mide casi lo mismo, asi que la ronda dejaba de
 * medir dplyr y pasaba a medir vista. En monoespaciada cada caracter ocupa una
 * celda y el `==` se ve mas ancho que el `=`. Los backticks, ademas, se
 * proyectaban literales igual que los asteriscos en su momento; ya habia
 * contenido con backticks jugado asi en la clase 3.
 *
 * Deliberadamente NO es un parser de markdown y no deberia convertirse en uno:
 * solo `**`, `*`, `` ` `` y la cerca de tres backticks, nunca HTML crudo, nunca
 * enlaces. El texto viene de contenido versionado en el repo pero tambien de
 * sesiones que escriben otros profesores, asi que las unicas salidas posibles
 * siguen siendo `<strong>`, `<em>` y `<code>` con texto adentro.
 *
 * Los delimitadores sin cerrar quedan literales: degrada a lo anterior en vez de
 * comerse el resto del parrafo.
 *
 * No lleva color propio a proposito: hereda el del contenedor. Las superficies
 * de alumno, de profesor y la proyectada no comparten paleta de texto.
 */

/**
 * Bloque de codigo cercado, con el lenguaje opcional (```r). **Se aplica
 * PRIMERO**: adentro de un bloque los asteriscos y los backticks sueltos son
 * codigo, no marcas, y cualquier otro orden se los comeria.
 *
 * Sale como `<code>` y no como `<pre>` a proposito: el contenedor de `context`
 * y de `question` es un `<p>`, y un `<pre>` adentro de un `<p>` es HTML
 * invalido —el navegador cierra el parrafo solo y el resto del texto se sale
 * del bloque—. `<code>` es contenido de frase, cabe en un `<p>`, y con
 * `display:block` se ve igual. El estilo vive en `.rt-code-block`.
 */
const FENCED_BLOCK = /```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n?```/g;

/** Codigo en linea: un backtick, sin saltos adentro. */
const CODE_SPAN = /`([^`\n]+)`/g;

/**
 * Captura lo que va entre `**`. Perezoso, y `[\s\S]` para cruzar saltos de
 * linea. **Se aplica antes que la cursiva**: si se buscara la cursiva antes,
 * `**negrita**` entraria como un `*` de apertura, un texto y un `*` de cierre, y
 * saldria una cursiva con asteriscos sueltos a los lados.
 */
const BOLD_SPAN = /\*\*([\s\S]+?)\*\*/g;

/**
 * Cursiva. A diferencia de la negrita NO cruza saltos de linea y no admite `*`
 * adentro: un asterisco suelto en un parrafo —o dos parrafos con uno cada uno—
 * no debe unirse en una cursiva gigante que se coma el texto del medio.
 */
const ITALIC_SPAN = /\*([^*\n]+)\*/g;

/**
 * HOJA del arbol: parte un tramo ya sin negrita ni cursiva en su codigo en
 * linea.
 *
 * El codigo va ULTIMO, y ese orden importa. Al reves —codigo primero— una
 * negrita que envuelve un backtick queda partida en dos tramos y sus asteriscos
 * se proyectan literales: `**UNA sola cadena con \`%>%\`**` se parte en
 * "**UNA sola cadena con ", el codigo, y "**", y ninguno de los dos tramos
 * tiene su pareja. Es exactamente el enunciado de la ronda 2 de dataviz clase 4,
 * y se descubrio escribiendolo.
 *
 * El precio del orden es el simetrico y es mucho mas barato: `**` ADENTRO de un
 * backtick si se leeria como negrita. No hay contenido asi, y el codigo que de
 * verdad lleva asteriscos —una multiplicacion— va en bloque, que se separa antes
 * que todo lo demas.
 */
function conCodigo(texto: string, claveBase: string) {
  const partes = texto.split(CODE_SPAN);
  if (partes.length === 1) return texto;
  return partes.map((parte, i) =>
    i % 2 === 1 ? (
      <code key={`${claveBase}-c${i}`} className="rt-code">{parte}</code>
    ) : (
      parte
    ),
  );
}

/** Parte un tramo SIN negrita en sus cursivas. */
function conCursivas(texto: string, claveBase: string) {
  const partes = texto.split(ITALIC_SPAN);
  if (partes.length === 1) return conCodigo(texto, claveBase);
  return partes.map((parte, i) =>
    i % 2 === 1 ? (
      <em key={`${claveBase}-i${i}`}>{conCodigo(parte, `${claveBase}-i${i}`)}</em>
    ) : (
      conCodigo(parte, `${claveBase}-t${i}`)
    ),
  );
}

/** Parte un tramo FUERA de bloques en sus negritas. */
function conNegritas(texto: string, claveBase: string) {
  // split() con un grupo de captura intercala los capturados: los indices
  // impares son justamente lo que iba entre asteriscos.
  const partes = texto.split(BOLD_SPAN);
  if (partes.length === 1) return conCursivas(texto, claveBase);
  return partes.map((parte, i) =>
    i % 2 === 1 ? (
      // Dentro de una negrita tambien puede ir cursiva, y codigo.
      <strong key={`${claveBase}-b${i}`} className="font-bold">
        {conCursivas(parte, `${claveBase}-b${i}`)}
      </strong>
    ) : (
      conCursivas(parte, `${claveBase}-t${i}`)
    ),
  );
}

export function RichText({ text }: { text?: string | null }) {
  if (!text) return null;

  const parts = text.split(FENCED_BLOCK);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <code key={`f${i}`} className="rt-code-block">{part}</code>
        ) : (
          <span key={`s${i}`}>{conNegritas(part, `s${i}`)}</span>
        ),
      )}
    </>
  );
}
