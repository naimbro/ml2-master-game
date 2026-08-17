/**
 * Telemetria de escritura de las rondas abiertas: tipos compartidos y las
 * funciones puras que el panel del profesor usa para dibujarla.
 *
 * REGLA QUE MANDA SOBRE ESTE ARCHIVO: nada de aca entra en un puntaje, en el
 * ranking ni en la recalibracion por duelos. Es registro descriptivo. Si
 * alguna vez una de estas funciones aparece importada desde el calculo de
 * puntajes, eso es el bug.
 *
 * Ver docs/superpowers/specs/2026-08-08-telemetria-antitrampa-design.md
 */

export interface PegadoEvento {
  /** ms desde que se le abrio la ronda a ese alumno */
  ms: number;
  /** cuantos caracteres traia el portapapeles */
  chars: number;
}

/** Lo que el navegador del alumno junta durante una ronda abierta. */
export interface TelemetriaCaptura {
  scenarioId: string;
  msPrimeraTecla: number | null;
  msEnvio: number;
  /** (momento del montaje) - game.roundStartTime. Negativo si monto antes. */
  roundStartOffsetMs: number;
  pegados: PegadoEvento[];
  /** huella[i] = largo del texto a los (i+1) * huellaIntervaloMs ms */
  huella: number[];
  huellaIntervaloMs: number;
  msFueraDeApp: number;
  salidas: number;
  msFueraAntesDeEscribir: number;
  largoFinal: number;
  charsPegados: number;
  charsEditadosTrasUltimoPegado: number;
  /**
   * El crecimiento mas grande en un solo cambio del textarea, venga de donde
   * venga. Es la red para las entradas que no disparan ningun evento de
   * pegado: el hecho queda anotado aunque no sepamos clasificarlo.
   *
   * Opcional porque los documentos escritos antes del 8-ago-2026 no lo traen.
   */
  maxInsercionDeGolpe?: number;
  /**
   * Los `inputType` que el navegador uso para insertar, sin repetir. Es dato
   * sobre el teclado, no sobre la persona: se anota porque en Android no
   * disparo ni `paste` ni `insertFromPaste` y hacia falta saber como se llama
   * lo que si dispara.
   *
   * Opcional: los documentos anteriores al 8-ago-2026 no lo traen.
   */
  tiposDeInsercion?: string[];
}

/** El documento tal como queda en Firestore. */
export interface TelemetriaDoc extends TelemetriaCaptura {
  playerId: string;
  round: number;
  version: number;
}

/** "2 min 18 s", "41 s", "3 min". */
export function formatoReloj(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(total / 60);
  const seg = total % 60;
  if (min === 0) return `${seg} s`;
  if (seg === 0) return `${min} min`;
  return `${min} min ${seg} s`;
}

/**
 * Que fraccion del texto final llego pegada, entre 0 y 1. Se topa en 1 porque
 * alguien puede pegar 900 caracteres y dejar 400: la proporcion no significa
 * nada sobre 1, y un punto fuera del grafico si molesta.
 */
export function proporcionPegada(t: { charsPegados: number; largoFinal: number }): number {
  if (t.largoFinal <= 0) return 0;
  return Math.min(1, t.charsPegados / t.largoFinal);
}

/**
 * Que fraccion del texto final llego en un solo golpe, entre 0 y 1.
 *
 * Reemplaza a `proporcionPegada` como eje de la nube desde el 8-ago-2026, y la
 * razon es que en Android no dispara NINGUN evento de pegado: ni `paste` ni
 * `beforeinput` con `insertFromPaste`. Una respuesta traida entera desde otra
 * app se dibujaba abajo del todo, entre las tecleadas — el peor error posible
 * para este panel.
 *
 * Ojo con lo que este numero dice y lo que no. NO dice "pego": dice cuanto
 * texto entro de una vez, que es literalmente lo que se midio. Dictar o el
 * teclado deslizante insertan palabras sueltas, asi que sobre una respuesta de
 * varios cientos de caracteres se quedan abajo solos, sin que haya que poner
 * ningun umbral. La etiqueta del eje dice eso mismo.
 *
 * Los documentos anteriores no traen el salto: para esos cae en la proporcion
 * pegada, que era la medida que si tenian.
 */
export function proporcionDeGolpe(t: {
  maxInsercionDeGolpe?: number;
  charsPegados: number;
  largoFinal: number;
}): number {
  if (t.maxInsercionDeGolpe === undefined) return proporcionPegada(t);
  if (t.largoFinal <= 0) return 0;
  return Math.min(1, t.maxInsercionDeGolpe / t.largoFinal);
}

/**
 * Cuanto del texto tiene que haber entrado de una vez para que el punto salga
 * rojo. La mitad.
 *
 * El numero es arbitrario y no hay forma de que no lo sea: nadie tiene un set
 * etiquetado de respuestas copiadas contra el cual calibrarlo (ver el pendiente
 * del set de jueces). Se elige la mitad porque es el punto donde la frase «la
 * respuesta la escribio otra cosa» empieza a describir mejor lo que paso que
 * «la escribio el alumno», y porque es un numero que se puede decir en voz alta
 * ante un alumno que pregunte.
 */
export const UMBRAL_DE_GOLPE = 0.5;

/**
 * En que color va un punto de la nube.
 *
 * Hasta el 2026-08-10 todos los puntos iban del mismo color, a proposito: el
 * panel describia y no clasificaba. Naim decidio colorearlos. El umbral existe
 * ahora y esta escrito arriba, en vez de estar en la cabeza de quien mira la
 * nube — que es lo unico que cambio de verdad, porque el que miraba ya trazaba
 * la frontera con el ojo.
 *
 * El tercer estado es la parte que importa. `sin-medicion` NO es «limpio»: son
 * las respuestas donde el navegador no entrego con que medir — documentos
 * anteriores al 8-ago-2026, y los casos de Android donde no dispara ni `paste`
 * ni `beforeinput`. De las 12 respuestas que habia en Firestore el 10-ago-2026,
 * CUATRO caian ahi, y dos de esas cuatro habian pasado mas de 30 segundos fuera
 * de la app. Pintarlas de azul habria sido afirmar que estaban limpias cuando
 * nadie las midio, y un falso azul es peor que un falso rojo: el rojo se
 * revisa, el azul se cree.
 *
 * Lo que el rojo NO dice, y por eso el panel sigue sin escribir la palabra
 * «copio» en ningun lado: de donde salio el texto. Un LLM, los apuntes propios
 * y el mensaje de un companero entran todos por el portapapeles y se ven
 * exactamente iguales desde el navegador.
 */
export function clasificarPunto(t: {
  maxInsercionDeGolpe?: number;
  charsPegados: number;
  largoFinal: number;
  pegados: Array<{ ms: number; chars: number }>;
}): 'sospechoso' | 'no-sospechoso' | 'sin-medicion' {
  const seMidio = t.maxInsercionDeGolpe !== undefined || t.pegados.length > 0;
  if (!seMidio) return 'sin-medicion';
  return proporcionDeGolpe(t) >= UMBRAL_DE_GOLPE ? 'sospechoso' : 'no-sospechoso';
}

/** Margen interno del sparkline, para que el trazo no se coma el borde. */
const PADDING = 2;

/**
 * Los puntos de la polilinea de una respuesta, listos para el atributo
 * `points` de un <polyline>.
 *
 * Dos normalizaciones, y las dos importan:
 *
 * - La ALTURA se normaliza al largo maximo de esa misma respuesta. Se compara
 *   la forma, no el tamano: una respuesta de 200 caracteres bien escrita y una
 *   de 2000 bien escrita tienen que verse igual, porque la conducta es la
 *   misma.
 * - El ANCHO se normaliza a la duracion de la RONDA, no al largo de la huella.
 *   Quien envio al minuto 2 de 5 muestra una linea que se corta a la mitad, y
 *   eso es informacion: se fue temprano.
 */
export function puntosHuella(
  t: Pick<TelemetriaCaptura, 'huella' | 'huellaIntervaloMs' | 'msEnvio' | 'largoFinal'>,
  duracionMs: number,
  ancho: number,
  alto: number
): string {
  const muestras = [
    { ms: 0, largo: 0 },
    ...t.huella.map((largo, i) => ({ ms: (i + 1) * t.huellaIntervaloMs, largo })),
    { ms: t.msEnvio, largo: t.largoFinal },
  ];

  const maxLargo = Math.max(1, ...muestras.map((m) => m.largo));
  const span = Math.max(1, duracionMs);
  const x0 = PADDING;
  const x1 = ancho - PADDING;
  const yBase = alto - PADDING;
  const yTope = PADDING;

  return muestras
    .map((m) => {
      const x = x0 + Math.min(1, m.ms / span) * (x1 - x0);
      const y = yBase - (m.largo / maxLargo) * (yBase - yTope);
      return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
    })
    .join(' ');
}

/**
 * Donde cae una respuesta en la nube del curso. x = cuanto tardo en escribir la
 * primera letra, y = que proporcion del texto llego de una vez.
 *
 * Quien nunca escribio nada se ubica al final del eje: no tuvo primera tecla.
 */
export function posicionNube(
  t: {
    msPrimeraTecla: number | null;
    charsPegados: number;
    largoFinal: number;
    maxInsercionDeGolpe?: number;
  },
  duracionMs: number,
  ancho: number,
  alto: number
): { x: number; y: number } {
  const span = Math.max(1, duracionMs);
  const fx = t.msPrimeraTecla === null ? 1 : Math.min(1, t.msPrimeraTecla / span);
  const fy = proporcionDeGolpe(t);
  return {
    x: PADDING + fx * (ancho - 2 * PADDING),
    y: (alto - PADDING) - fy * (alto - 2 * PADDING),
  };
}

/** Separacion entre el punto y su anillo, para que el punto siga leyendose. */
const ANILLO_HOLGURA = 3;
/** Tope del anillo. Sin el, una salida de varios minutos tapa media nube. */
const ANILLO_MAX = 22;

/**
 * El radio del anillo que rodea a un punto: cuanto rato estuvo fuera de la app
 * ANTES de escribir la primera letra. `null` si no salio nunca — ese es el caso
 * normal y no se dibuja nada.
 *
 * ## Por que un anillo y no el tamano del punto ni una cola sobre el eje
 *
 * Medido sobre N9YHC5 (114 respuestas): las SIETE respuestas que el color marca
 * en rojo salieron ademas de la app antes de escribir. Las siete. O sea que
 * sobre los rojos este dato no agrega absolutamente nada — ya estaban marcados.
 *
 * Todo su valor esta en la masa de abajo: los que tecleraron a mano, quedaron
 * azules, y aun asi pasaron un rato afuera. En ese juego fue una sola respuesta
 * —23 segundos fuera, 3% de golpe— y hoy es invisible.
 *
 * Eso descarta las otras dos formas que se probaron. Una cola horizontal sobre
 * el eje se pierde justamente ahi: en una banda densa de puntos a la misma
 * altura, un segmento del mismo color se lee como una fila de puntos pegados. Y
 * el tamano del punto es peor todavia, porque un punto rojo y grande se lee como
 * "mas sospechoso" en vez de "estuvo mas rato afuera", que es lo unico que se
 * midio.
 *
 * El anillo funciona porque es de otra ESPECIE que el punto: va en tinta y
 * punteado, no en el color de la clasificacion. Un punto azul con anillo sigue
 * diciendo "esto lo escribio a mano" y agrega "y ademas estuvo afuera", sin que
 * lo segundo contamine lo primero. Es la unica de las tres que respeta el
 * encabezado de este archivo mientras se ve.
 *
 * La raiz cuadrada, y no el valor directo, porque el rango real va de 9 a 89
 * segundos: lineal dejaria a los cortos indistinguibles del punto pelado.
 */
export function radioAnillo(
  msFueraAntesDeEscribir: number,
  radioPunto: number
): number | null {
  if (!(msFueraAntesDeEscribir > 0)) return null;
  const segundos = msFueraAntesDeEscribir / 1000;
  return Math.min(ANILLO_MAX, radioPunto + ANILLO_HOLGURA + Math.sqrt(segundos) * 1.9);
}

export interface HechoDetalle {
  etiqueta: string;
  valor: string;
}

/** "300 y 482", "20 s, 1 min y 2 min 10 s" */
function lista(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * Los hechos de una respuesta, para el cajon de detalle.
 *
 * Devuelve HECHOS, no conclusiones: cuando paso cada cosa y de que tamano fue.
 * En ningun caso emite una etiqueta sobre la persona. Las categorias enteras
 * que no aplican se omiten en vez de mostrarse en cero (nadie salio de la
 * app, nadie pego nada) para que lo que quede en pantalla sea lo que
 * efectivamente ocurrio. Eso NO alcanza a un numero derivado que da cero
 * dentro de una categoria que si aplica: "Editó después de pegar" se muestra
 * aunque diga "0 caracteres", porque el cero ahi es un hecho en si mismo —
 * distingue a quien pego y no toco mas el texto de quien pego y siguio
 * editando, y esa distincion se pierde si la linea desaparece.
 */
export function hechosDetalle(t: TelemetriaCaptura, duracionMs: number): HechoDetalle[] {
  const hechos: HechoDetalle[] = [];

  hechos.push({
    etiqueta: 'Primera tecla',
    valor:
      t.msPrimeraTecla === null
        ? 'nunca escribió'
        : `a los ${formatoReloj(t.msPrimeraTecla)} de los ${formatoReloj(duracionMs)} de ronda`,
  });

  // El total y el tramo previo son DOS hechos, no uno.
  //
  // Hasta el 2026-08-11 esta linea elegia uno de los dos y descartaba el otro:
  // si habia salida antes de escribir mostraba solo esa y el total desaparecia.
  // Medido en N9YHC5: la salida mas larga de todo el juego fueron 1 min 34 s en
  // total, de los cuales solo 31 s cayeron antes de la primera tecla. El panel
  // mostraba "31 s" y se comia los otros 63, que ocurrieron con la respuesta ya
  // empezada — que es un hecho distinto y no menos interesante.
  if (t.salidas > 0) {
    const cuantas = `${t.salidas} ${t.salidas === 1 ? 'salida' : 'salidas'}`;
    const antes = t.msFueraAntesDeEscribir;
    const total = t.msFueraDeApp;
    // El tramo "despues" se calcula y no se mide aparte, asi que un dato viejo
    // inconsistente (antes > total) no puede producir un negativo en pantalla.
    const despues = Math.max(0, total - antes);

    let valor: string;
    if (antes <= 0) {
      valor = `${formatoReloj(total)}, ya escribiendo (${cuantas})`;
    } else if (despues <= 0) {
      valor = `${formatoReloj(total)}, toda antes de escribir (${cuantas})`;
    } else {
      valor = `${formatoReloj(total)} en total · ${formatoReloj(antes)} antes de escribir (${cuantas})`;
    }
    hechos.push({ etiqueta: 'Fuera de la app', valor });
  }

  if (t.pegados.length > 0) {
    hechos.push({
      etiqueta: 'Pegados',
      valor: `${t.pegados.length} · de ${lista(t.pegados.map((p) => String(p.chars)))} caracteres · a los ${lista(t.pegados.map((p) => formatoReloj(p.ms)))}`,
    });
    hechos.push({
      etiqueta: 'Editó después de pegar',
      valor: `${t.charsEditadosTrasUltimoPegado} caracteres`,
    });
  }

  // Se muestra siempre que el documento lo traiga, haya habido pegado o no.
  // Cuando no hubo ningun evento de pegado, esta linea es lo unico que queda
  // del texto que entro de golpe — y sigue siendo un hecho, no un veredicto:
  // un salto grande tambien lo produce el dictado o un teclado deslizante.
  if (t.maxInsercionDeGolpe !== undefined) {
    hechos.push({
      etiqueta: 'Mayor salto de una vez',
      valor: `${t.maxInsercionDeGolpe} caracteres`,
    });
  }

  hechos.push({ etiqueta: 'Largo final', valor: `${t.largoFinal} caracteres` });
  hechos.push({ etiqueta: 'Envió', valor: `a los ${formatoReloj(t.msEnvio)}` });

  return hechos;
}
