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

  if (t.salidas > 0) {
    const cuantas = `${t.salidas} ${t.salidas === 1 ? 'salida' : 'salidas'}`;
    hechos.push({
      etiqueta: 'Fuera de la app',
      valor: t.msFueraAntesDeEscribir > 0
        ? `${formatoReloj(t.msFueraAntesDeEscribir)} antes de escribir (${cuantas})`
        : `${formatoReloj(t.msFueraDeApp)} en total (${cuantas})`,
    });
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
