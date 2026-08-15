/**
 * El color de TU fila en la tabla de posiciones.
 *
 * Hasta el 2026-08-15 era naranjo al 15% sobre el papel, o sea #FEE8E0: un
 * salmon desteñido, porque el naranjo a esa opacidad deja de leerse como
 * naranjo. Ahora la fila va rellena y maciza, y el relleno es distinto para cada
 * alumno.
 *
 * ## Por que puede ser cualquier color sin significar nada
 *
 * Porque nadie ve la fila de otro. La tabla se renderiza en cada cliente y solo
 * marca al que la mira, asi que el tono no codifica informacion: lo unico que
 * tiene que ser cierto es que hay EXACTAMENTE UNA fila rellena y es la tuya. Con
 * esa condicion cumplida, el color queda libre para ser de cada uno.
 *
 * (En la pantalla proyectada no hay ninguna fila rellena, porque el profesor
 * dirige sin jugar. Lo que la sala mira son los dorsales del podio.)
 *
 * ## Por que se DERIVA y no se sortea
 *
 * `Math.random()` en el render haria que la fila cambiara de color en cada
 * re-render, y la tabla se re-renderiza muchas veces mientras corre la animacion
 * de revelacion: el color parpadearia justo en el momento que importa. Derivarlo
 * del uid da un color estable durante todo el juego —y entre juegos— sin
 * guardar absolutamente nada.
 *
 * ## Por que estos cinco y no los siete
 *
 * Quedaron fuera los dos rellenos que YA son dorsales del podio: el ambar es el
 * primer lugar y el naranjo el tercero. Si a un alumno le tocara uno de esos, el
 * mismo color estaria diciendo dos cosas distintas en su pantalla.
 *
 * Y nunca el verde, que en esta identidad significa "correcta" y nada mas. Se
 * midio tambien un petroleo #0E7490 y se descarto: queda a deltaE 12,3 del verde
 * reservado, menos que los 15,6 que separan al naranjo del ambar dentro del
 * propio sistema, asi que se leeria como "correcto".
 *
 * Los cinco son oscuros y llevan texto blanco, lo que ademas simplifica: no hay
 * que decidir el color del texto caso a caso. El costo es que en tu propia fila
 * se pierde el codigo de color del puntaje (verde/ambar/rojo); sigue estando
 * grande en la tarjeta "Tu Resultado".
 *
 * Contrastes medidos contra blanco, todos AA: tinta 18,88:1 · indigo 7,90:1 ·
 * magenta 6,04:1 · violeta 5,70:1 · azul 5,17:1.
 */

export interface ColorJugador {
  /** Para el `background` de la fila. */
  fondo: string;
  /** Nombre legible, para tests y para depurar. */
  nombre: string;
}

/**
 * El orden es fijo y no se toca a la ligera: cambiarlo le cambia el color a
 * todos los alumnos que ya tenian uno.
 */
export const COLORES_JUGADOR: readonly ColorJugador[] = [
  { fondo: '#101114', nombre: 'tinta' },
  { fondo: '#2563EB', nombre: 'azul' },
  { fondo: '#7C3AED', nombre: 'violeta' },
  { fondo: '#4338CA', nombre: 'indigo' },
  { fondo: '#BE185D', nombre: 'magenta' },
];

/**
 * Hash estable de un string. Es FNV-1a de 32 bits, elegido por aburrido: no
 * necesita dependencias, cabe en cinco lineas y reparte bien cadenas cortas que
 * comparten prefijo — que es exactamente la forma de los uid de Firebase.
 *
 * `>>> 0` en cada vuelta mantiene el numero en 32 bits sin signo; sin eso, el
 * producto se sale del rango seguro de los enteros de JavaScript y el hash deja
 * de ser el mismo en distintos motores.
 */
function hash(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * El color de un jugador. Mismo id, mismo color, siempre.
 *
 * Sin id devuelve el primero en vez de reventar: la tabla se renderiza durante
 * el arranque, cuando el usuario todavia puede no estar resuelto, y un color de
 * mas vale infinitamente mas que una pantalla en blanco.
 */
export function colorDeJugador(playerId: string | null | undefined): ColorJugador {
  if (!playerId) return COLORES_JUGADOR[0];
  return COLORES_JUGADOR[hash(playerId) % COLORES_JUGADOR.length];
}
