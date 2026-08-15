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
 * del uid da un color estable durante todo el juego —y entre juegos— sin guardar
 * absolutamente nada.
 *
 * El reparto esta medido: sobre 10.000 uid con forma de Firebase, FNV-1a deja
 * cada color entre 19,4% y 20,7%. Que dos cuentas de prueba caigan en el mismo
 * color es el 4% y no un sintoma — paso, y no habia nada roto.
 *
 * ## Por que una familia fria, y por que NO importa que sean vecinos
 *
 * Porque casi todo el circulo esta tomado: el verde significa "correcta", el
 * ambar y el naranjo son dorsales del podio, el rojo es "incorrecta", y encima
 * cada relleno tiene que dar 4,5:1 con texto blanco. Lo que queda disponible es
 * la franja azul-violeta-fucsia.
 *
 * Que midan 10 u 11 de distancia entre si NO es un problema, y costo entenderlo:
 * los cinco nunca coexisten en pantalla. Cada alumno ve uno solo, asi que la
 * separacion entre ellos es preferencia estetica, no legibilidad. El requisito
 * duro es la distancia a los colores que SI comparten pantalla con la fila —los
 * dorsales del podio y los puntajes—, y de eso todos estan a 15 o mas.
 *
 * Un primer intento optimizo la separacion mutua a ciegas y devolvio un olivo
 * #534805 y un azul apagado: separados de verdad, y feos. La restriccion estaba
 * mal puesta.
 *
 * ## Que salio, y por que
 *
 * - **Tinta #101114**: la fila negra no gusto. Salio por decision, no por medida.
 * - **Magenta #BE185D**: deltaE 7,5 del rojo que significa "incorrecta". Se habia
 *   colado en la primera version.
 * - **Petroleo #0E7490**: deltaE 12,3 del verde reservado.
 * - **Tabaco #7C2D12**: deltaE 11,7 del rojo.
 * - **Ambar y naranjo**: son los dorsales del primer y del tercer lugar. El mismo
 *   color estaria diciendo dos cosas distintas en la misma pantalla.
 *
 * ## Los cinco que quedaron
 *
 * Todos oscuros y con texto blanco, lo que ademas simplifica: no hay que decidir
 * el color del texto caso a caso. Contrastes medidos contra blanco, todos AA:
 * marino 10,36:1 · indigo 7,90:1 · fucsia 6,32:1 · violeta 5,70:1 · azul 5,17:1.
 * El peor acercamiento a un color reservado es fucsia contra el rojo, a 20,9.
 *
 * El costo asumido es que en tu propia fila se pierde el codigo de color del
 * puntaje (verde/ambar/rojo); sigue estando grande en la tarjeta "Tu Resultado".
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
  { fondo: '#1E3A8A', nombre: 'marino' },
  { fondo: '#2563EB', nombre: 'azul' },
  { fondo: '#4338CA', nombre: 'indigo' },
  { fondo: '#7C3AED', nombre: 'violeta' },
  { fondo: '#A21CAF', nombre: 'fucsia' },
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
