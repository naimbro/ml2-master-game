/**
 * Qué pasó en un juego, y qué hay que cambiarle al SIGUIENTE.
 *
 * Reemplaza a `scripts/mc-clock.ts` —que sólo medía las rondas de
 * alternativas— y agrega lo que faltaba: las ABIERTAS, que son las que se
 * comen el reloj.
 *
 * El origen: el 21-sep-2026 la clase 7 de dataviz (9XR4Z6, 24 jugadores, seis
 * rondas abiertas de código R) sacó 4,50/7, la nota más baja del año, y los
 * quince comentarios de los alumnos hablaban de falta de tiempo. No había
 * ninguna forma de medir eso. Midiendo a mano las 36 rondas abiertas del año
 * con la telemetría del repo salieron las tres cosas que este script reporta:
 *
 *  1. La mediana del curso tarda en escribir su primer carácter lo que el
 *     enunciado mide: corr(palabras, segundos hasta la 1ª tecla) = 0,91, con
 *     la recta `13 s + 0,32 s × palabra` (n = 35). El cálculo vive en
 *     `src/lib/abiertaTiming.ts` y se importa de ahí, nunca se copia.
 *  2. **El residual de esa recta es el detector de mala redacción.** Una
 *     pregunta que cuesta mucho más de lo que su largo predice es una pregunta
 *     confusa. Las peores del año: +31 s, +22 s, +18 s.
 *  3. «Cuántos seguían escribiendo al final» sirve para CÓDIGO y no para
 *     prosa. En prosa ese número es 76-100% en los cinco cursos —en un ensayo
 *     la gente escribe hasta la chicharra por definición—, así que una sola
 *     métrica para los dos tipos habría dado una falsa alarma permanente en
 *     dos cursos. Por eso se imprime SÓLO si `answerFormat === 'code'`.
 *
 * Lo que este script NO reporta, a propósito: la carga de lectura en
 * caracteres por segundo. Medido en XNTUHB, la pregunta con MÁS caracteres por
 * segundo (R1, 18,4) fue la más fácil de todas, con 97% de acierto y la mitad
 * del reloj sin usar. Es un número que suena a diagnóstico y no diagnostica
 * nada.
 *
 * Uso:
 *   npm run diagnostico 9XR4Z6        # un juego
 *   npm run diagnostico               # todos los juegos con >= 10 jugadores
 *   npm run diagnostico -- --calibrar # reajusta la recta con TODOS los juegos
 *
 * Ver docs/superpowers/specs/2026-09-21-diagnostico-de-clase-design.md
 */
import admin from 'firebase-admin';
import {
  palabrasDelEnunciado,
  costoDeLectura,
  formatoDe,
  relojDerivadoAbierta,
  relojEfectivoDeRonda,
  EXTENSION_SEGUNDOS,
  type FormatoDeRespuesta,
  type Dificultad,
  type EscenarioAbiertoLike,
} from '../src/lib/abiertaTiming';

const PROJECT_ID = 'ml2-master-game';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();
// NO es opcional: sin esto los scripts de análisis mueren mudos en el primer
// .get() de una subcolección.
db.settings({ preferRest: true });

/** Debajo de esto un juego es una prueba del profesor, no una clase. */
const MIN_JUGADORES = 10;

/**
 * La ventana en la que «seguía escribiendo» significa que el reloj no alcanzó.
 * Veinte segundos porque la huella se muestrea cada uno o dos segundos y con
 * menos ventana el número lo decide el ruido del último tecleo.
 */
const VENTANA_FINAL_MS = 20_000;

/** Crecimiento del texto, en caracteres, que cuenta como «seguía escribiendo». */
const CRECIMIENTO_MINIMO_CHARS = 20;

/** Con menos de cinco respuestas la mediana de una ronda es ruido. */
const MIN_TELEMETRIA = 5;

/**
 * El % del límite consumido por la MEDIANA sobre el cual el reloj de una MC
 * quedó corto. Medido en XNTUHB (dataviz clase 2, 37 alumnos, 2026-08-10):
 *
 *   R1 52%  R2 45%  R3 50%   ->  3, 3 y 2 respuestas perdidas
 *   R7 63%  R6 69%  R5 89%   ->  6, 5 y 8 respuestas perdidas
 *
 * El corte está claramente entre 50% y 63%. Por debajo la gente contesta y le
 * sobra; por encima empieza a quedar gente sin responder y el acierto se
 * desploma (R5 cayó al 43%).
 */
const UMBRAL_APRETADO = 0.6;

/** Sobre este residual, el enunciado confunde. Ver el encabezado. */
const RESIDUAL_MALA_REDACCION = 15;

/** Sobre este % colgando (sólo código), el reloj no alcanzó. */
const COLGANDO_RELOJ_CORTO = 40;

/** El presupuesto de pared de un juego entero. */
const PARED_PRESUPUESTO_MIN = 20;

/**
 * Overhead por ronda: el montaje, la revelación, el leaderboard y los jueces.
 * Medido: la pared sale 1,7-2,4× la suma de los relojes.
 */
const OVERHEAD_POR_RONDA_S = 120;

/**
 * Cuánto puede quedar sin usar del reloj ofrecido antes de que valga la pena
 * decirlo. Por debajo de esto es latencia y desfase de relojes entre
 * teléfonos, no una decisión del anfitrión.
 */
const MARGEN_CIERRE_SEGUNDOS = 10;

/**
 * Un enunciado más largo que esto no es un punto de la recta de lectura: es
 * otra cosa, y encima decide sola la pendiente de todo el ajuste.
 *
 * El caso concreto: NPX5EE R1 (ai_democracy clase 7) tenía **421 palabras** y
 * 187 s de lectura. El siguiente enunciado más largo del repo tiene 179. Con
 * ese punto adentro el ajuste da `b = 0,391`; sin él da `a = 13,3 s`,
 * `b = 0,319`, n = 35, RMSE 11,9 — que es exactamente la recta que hoy vive en
 * `src/lib/abiertaTiming.ts`. O sea que la recta del repo se ajustó sin él, y
 * `--calibrar` tiene que hacer lo mismo o no está recalibrando lo mismo.
 *
 * El punto no se esconde: se imprime aparte, con su nombre, y el ajuste que
 * lo incluye también.
 */
const PALABRAS_FUERA_DE_RANGO = 300;

// ───────────────────────────────────────────────────────────────────────────
// Las formas de los documentos de Firestore. Son parciales a propósito: sólo
// los campos que este script mira.
// ───────────────────────────────────────────────────────────────────────────

/** Lo poco que hace falta de un Timestamp de Firestore. */
interface Marca {
  toMillis(): number;
  toDate(): Date;
}

interface PreguntaMC {
  timeLimitSeconds?: number;
}

interface EscenarioGuardado extends EscenarioAbiertoLike {
  id?: string;
  title?: string;
  type?: string;
  difficulty?: Dificultad;
  durationSeconds?: number;
  mcQuestions?: PreguntaMC[];
}

interface JuegoDoc {
  sessionId?: string;
  courseId?: string;
  players?: Record<string, unknown>;
  scenarios?: EscenarioGuardado[];
  roundDurationSeconds?: number;
  /** Mapa ronda -> segundos que el anfitrión agregó en vivo con «+30 s». */
  roundExtensions?: Record<string, number>;
  startedAt?: Marca;
  finishedAt?: Marca;
  createdAt?: Marca;
  updatedAt?: Marca;
}

interface TelemetriaFila {
  round?: number;
  playerId?: string;
  msPrimeraTecla?: number | null;
  msEnvio?: number;
  /** (montaje del alumno) − game.roundStartTime. Negativo si montó antes. */
  roundStartOffsetMs?: number;
  huella?: number[];
  huellaIntervaloMs?: number;
  largoFinal?: number;
}

interface RespuestaMC {
  selectedOptionId?: string;
  responseTimeMs?: number;
  correct?: boolean;
}

interface SubmissionFila {
  round?: number;
  mcResponses?: RespuestaMC[];
}

interface FeedbackFila {
  playerName?: string;
  rating?: number;
  comment?: string;
  submittedAt?: Marca;
}

// ───────────────────────────────────────────────────────────────────────────
// El corazón del cálculo
// ───────────────────────────────────────────────────────────────────────────

interface FilaAbierta {
  ronda: number;
  titulo: string;
  formato: FormatoDeRespuesta;
  palabras: number;
  lecturaPredicha: number;
  lecturaReal: number;
  residual: number;
  escritura: number;
  /** null en prosa: ver el punto 3 del encabezado. */
  colgando: number | null;
  relojEscrito: number;
  relojEfectivo: number;
  /**
   * Cuánto duró la ronda DE VERDAD, medido en los relojes de los alumnos:
   * el último envío, contado desde `roundStartTime`.
   *
   * Existe porque `relojEfectivoDeRonda()` sobreestima cuando el anfitrión
   * extiende y después corta a mano con «Terminar Ronda»: `roundExtensions`
   * anota los 30 s y la ronda usó cinco. No hay ningún cierre por ronda
   * guardado en Firestore —`rounds/round_N.processedAt` es cuándo terminaron
   * los jueces, no cuándo cerró la ronda— así que esto es lo más cerca que se
   * puede llegar del número exacto.
   *
   * LIMITACIÓN, que hay que tener presente antes de leerlo como «la cortaron»:
   * es el ÚLTIMO envío, no el cierre. Si nadie estaba escribiendo cuando sonó
   * la chicharra —porque todos enviaron antes por su cuenta— este número queda
   * corto sin que nadie haya cortado nada. Por eso el veredicto dice las dos
   * posibilidades y no elige.
   */
  cierre: number;
  relojQuePedia: number;
  n: number;
}

const mediana = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Cuántas veces se apretó «+30 s» en esa ronda. */
function extensionesDe(game: JuegoDoc, ronda: number): number {
  const seg = game.roundExtensions?.[String(ronda)] ?? 0;
  return Math.round(seg / EXTENSION_SEGUNDOS);
}

function medirRondaAbierta(
  sc: EscenarioGuardado,
  ronda: number,
  ts: TelemetriaFila[],
  game: JuegoDoc,
): FilaAbierta | null {
  const utiles = ts.filter((t) => (t.largoFinal ?? 0) > 0 && t.msPrimeraTecla != null);
  if (utiles.length < MIN_TELEMETRIA) return null;

  // Se normaliza con `formatoDe` y no con una comparación a mano, para que el
  // script y el validador del build no puedan discrepar.
  const formato = formatoDe(sc);
  const palabras = palabrasDelEnunciado(sc);
  const lecturaPredicha = costoDeLectura(palabras, formato);
  const lecturaReal = Math.round(mediana(utiles.map((t) => t.msPrimeraTecla! / 1000)));

  const escrituras: number[] = [];
  let colgaron = 0;
  for (const t of utiles) {
    const h: number[] = t.huella || [];
    const iv: number = t.huellaIntervaloMs || 1000;
    const largoFinal = t.largoFinal ?? 0;
    const msEnvio = t.msEnvio ?? 0;

    // Cuándo alcanzó el 95% de lo que terminó escribiendo: el «ya está».
    const i95 = h.findIndex((v) => v >= 0.95 * largoFinal);
    if (i95 >= 0) escrituras.push(((i95 + 1) * iv - t.msPrimeraTecla!) / 1000);

    // ¿Seguía creciendo el texto en los últimos 20 s antes de enviar?
    const nUlt = Math.min(h.length, Math.floor(msEnvio / iv));
    const atras = Math.max(1, Math.round(VENTANA_FINAL_MS / iv));
    const fin = h[Math.max(0, nUlt - 1)] ?? largoFinal;
    const antes = h[Math.max(0, nUlt - 1 - atras)] ?? 0;
    if (fin - antes > CRECIMIENTO_MINIMO_CHARS) colgaron++;
  }

  // El cierre se estima con TODAS las telemetrías de la ronda, no sólo las
  // útiles: quien no escribió nada también envió cuando se cerró, y su envío
  // marca el cierre igual de bien.
  const cierres = ts.map((t) => ((t.msEnvio ?? 0) + (t.roundStartOffsetMs ?? 0)) / 1000);

  const relojEscrito = Number(sc.durationSeconds ?? game.roundDurationSeconds ?? 0);
  return {
    ronda,
    titulo: String(sc.title || sc.id || ''),
    formato,
    palabras,
    lecturaPredicha,
    lecturaReal,
    residual: lecturaReal - lecturaPredicha,
    escritura: escrituras.length ? Math.round(mediana(escrituras)) : 0,
    // En prosa este número es 76-100% en los cinco cursos: la gente escribe
    // hasta la chicharra por definición. Reportarlo sería una falsa alarma
    // permanente, así que en prosa no existe.
    colgando: formato === 'code' ? Math.round((100 * colgaron) / utiles.length) : null,
    relojEscrito,
    relojEfectivo: relojEfectivoDeRonda(relojEscrito, game.roundExtensions, ronda),
    cierre: cierres.length ? Math.round(Math.max(...cierres)) : 0,
    relojQuePedia: relojDerivadoAbierta(sc),
    n: utiles.length,
  };
}

interface FilaMC {
  ronda: number;
  titulo: string;
  limite: number;
  contestaron: number;
  perdidas: number;
  medianaS: number;
  p90S: number;
  usoMediana: number;
  aciertoPct: number;
  alFilo: number;
}

function medirRondaMC(
  sc: EscenarioGuardado,
  ronda: number,
  subs: SubmissionFila[],
): FilaMC | null {
  // Una pregunta por escenario es la regla del repo; si alguna sesión vieja
  // trae un bloque, se mide igual pero con la primera, que es la que fija el
  // ritmo de la ronda.
  const q = sc.mcQuestions?.[0];
  const limite = Number(q?.timeLimitSeconds);
  if (!Number.isFinite(limite) || limite <= 0) return null;

  const tiempos: number[] = [];
  let aciertos = 0;
  let perdidas = 0;
  for (const s of subs) {
    if (Number(s.round) !== ronda) continue;
    const r = (s.mcResponses || [])[0];
    // Una submission sin alternativa elegida es una respuesta PERDIDA, no una
    // ausencia: el bloque se envió solo, o sea que el navegador estaba vivo y
    // la persona no alcanzó a apretar.
    if (r?.selectedOptionId) {
      tiempos.push((r.responseTimeMs ?? 0) / 1000);
      if (r.correct) aciertos++;
    } else {
      perdidas++;
    }
  }
  if (tiempos.length === 0) return null;

  tiempos.sort((a, b) => a - b);
  const pct = (p: number) => tiempos[Math.min(tiempos.length - 1, Math.floor(p * tiempos.length))];
  const med = pct(0.5);
  return {
    ronda,
    titulo: String(sc.title || sc.id || ''),
    limite,
    contestaron: tiempos.length,
    perdidas,
    medianaS: med,
    p90S: pct(0.9),
    usoMediana: med / limite,
    aciertoPct: (100 * aciertos) / tiempos.length,
    alFilo: tiempos.filter((t) => t > limite - 3).length,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Leer un juego
// ───────────────────────────────────────────────────────────────────────────

interface Juego {
  code: string;
  game: JuegoDoc;
  abiertas: FilaAbierta[];
  mc: FilaMC[];
  /** Todas las rondas del juego con su reloj ofrecido, para el presupuesto. */
  relojes: number[];
  feedback: FeedbackFila[];
  paredMs: number;
  /** true cuando faltó startedAt/finishedAt y la pared salió de createdAt/updatedAt. */
  paredAproximada: boolean;
  inicio: Date | null;
}

async function leerJuego(code: string): Promise<Juego | null> {
  const snap = await db.collection('games').doc(code).get();
  if (!snap.exists) return null;
  const game = snap.data() as JuegoDoc;
  const ref = db.collection('games').doc(code);

  const [telSnap, subSnap, fbSnap] = await Promise.all([
    ref.collection('telemetria').get(),
    ref.collection('submissions').get(),
    ref.collection('feedback').get(),
  ]);
  const tel = telSnap.docs.map((d) => d.data() as TelemetriaFila);
  const subs = subSnap.docs.map((d) => d.data() as SubmissionFila);
  const feedback = fbSnap.docs.map((d) => d.data() as FeedbackFila);

  const abiertas: FilaAbierta[] = [];
  const mc: FilaMC[] = [];
  const relojes: number[] = [];
  for (const [i, sc] of (game.scenarios || []).entries()) {
    const ronda = i + 1;
    const escrito = Number(sc.durationSeconds ?? game.roundDurationSeconds ?? 0);
    relojes.push(relojEfectivoDeRonda(escrito, game.roundExtensions, ronda));
    if (sc.type === 'multiple_choice' && sc.mcQuestions?.length) {
      const f = medirRondaMC(sc, ronda, subs);
      if (f) mc.push(f);
      continue;
    }
    const f = medirRondaAbierta(
      sc,
      ronda,
      tel.filter((t) => Number(t.round) === ronda),
      game,
    );
    if (f) abiertas.push(f);
  }

  // `startedAt` no existe en los juegos de antes del cambio de esquema, así
  // que la pared cae a createdAt/updatedAt y se avisa: createdAt es cuando se
  // CREÓ la sala, que puede ser bastante antes de que empezara a jugarse.
  const desde = game.startedAt ?? game.createdAt ?? null;
  const hasta = game.finishedAt ?? game.updatedAt ?? null;
  const paredAproximada = !game.startedAt || !game.finishedAt;

  return {
    code,
    game,
    abiertas,
    mc,
    relojes,
    feedback,
    paredMs: desde && hasta ? hasta.toMillis() - desde.toMillis() : 0,
    paredAproximada,
    inicio: desde ? desde.toDate() : null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Imprimir
// ───────────────────────────────────────────────────────────────────────────

const ANCHO = 100;
const s = (n: number) => `${n}s`;
const firmado = (n: number) => `${n >= 0 ? '+' : ''}${n}s`;

function fecha(d: Date | null): string {
  if (!d) return 'sin fecha';
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

function encabezadoJuego(j: Juego): string {
  const jugadores = Object.keys(j.game.players || {}).length;
  return (
    `${j.code} · ${j.game.courseId || '(sin curso)'} / ${j.game.sessionId || '(sin sesión)'}` +
    ` · ${jugadores} jugadores · ${fecha(j.inicio)}`
  );
}

/** Las etiquetas de extensión de una ronda: `+30 s × 2`, o ''. */
function etiquetaExtension(game: JuegoDoc, ronda: number): string {
  const veces = extensionesDe(game, ronda);
  return veces > 0 ? `+${EXTENSION_SEGUNDOS} s × ${veces}` : '';
}

function imprimirAbiertas(j: Juego): void {
  if (j.abiertas.length === 0) return;
  console.log('\nRONDAS ABIERTAS');
  console.log(
    'ronda  fmt   pal   pred   real  resid  tecleo  colg   reloj  ofrec  cierre   pedía    n',
  );
  for (const f of j.abiertas) {
    const ext = etiquetaExtension(j.game, f.ronda);
    console.log(
      `  R${String(f.ronda).padEnd(3)} ${f.formato.padEnd(6)}` +
        `${String(f.palabras).padStart(4)} ${s(f.lecturaPredicha).padStart(6)} ` +
        `${s(f.lecturaReal).padStart(6)} ${firmado(f.residual).padStart(6)} ` +
        `${s(f.escritura).padStart(7)} ${(f.colgando === null ? '—' : `${f.colgando}%`).padStart(5)} ` +
        `${s(f.relojEscrito).padStart(7)} ${s(f.relojEfectivo).padStart(6)} ` +
        `${s(f.cierre).padStart(7)} ${s(f.relojQuePedia).padStart(7)} ` +
        `${String(f.n).padStart(4)}${ext ? `  ${ext}` : ''}`,
    );
  }
  console.log(
    '\n  pal    palabras del enunciado (context ?? prompt, más question)\n' +
      '  pred   lectura que la recta predice: 13 s + 0,32 s/palabra (0,25 en código)\n' +
      '  real   lectura medida: mediana de los segundos hasta la primera tecla\n' +
      '  resid  real − pred. EL DETECTOR DE MALA REDACCIÓN: positivo grande = la\n' +
      '         pregunta cuesta más de lo que su largo explica\n' +
      '  tecleo mediana de los segundos entre la primera tecla y el 95% del texto final\n' +
      '  colg   % que seguía escribiendo en los últimos 20 s. SÓLO EN CÓDIGO: en prosa\n' +
      '         es 76-100% siempre y sería una falsa alarma permanente\n' +
      '  reloj  durationSeconds escrito en la sesión\n' +
      '  ofrec  el escrito más lo que el anfitrión agregó en vivo con «+30 s»\n' +
      '  cierre último envío medido en los relojes de los alumnos (ver el comentario\n' +
      '         de `cierre` en el script: es el último envío, no el cierre)\n' +
      '  pedía  el piso que relojDerivadoAbierta() exige hoy',
  );
}

function imprimirMC(j: Juego): void {
  if (j.mc.length === 0) return;
  console.log('\nRONDAS DE ALTERNATIVAS');
  console.log('ronda  limite  contest  perdid  mediana  %limite    p90   acierto  ultimos 3s');
  for (const f of j.mc) {
    const apretado = f.usoMediana > UMBRAL_APRETADO;
    console.log(
      `  R${String(f.ronda).padEnd(3)} ${s(f.limite).padStart(6)} ` +
        `${String(f.contestaron).padStart(8)} ${String(f.perdidas).padStart(7)} ` +
        `${(f.medianaS.toFixed(1) + 's').padStart(8)} ${(Math.round(f.usoMediana * 100) + '%').padStart(8)}` +
        `${(f.p90S.toFixed(1) + 's').padStart(7)} ${(Math.round(f.aciertoPct) + '%').padStart(8)} ` +
        `${String(f.alFilo).padStart(10)}${apretado ? '   <-- CORTO' : ''}`,
    );
  }
  const cortas = j.mc.filter((f) => f.usoMediana > UMBRAL_APRETADO);
  if (cortas.length === 0) {
    console.log(`\n  Ningún reloj pasó el ${Math.round(UMBRAL_APRETADO * 100)}%. No hay nada que subir.`);
    return;
  }
  console.log(
    `\n  ${cortas.length} de ${j.mc.length} rondas con el reloj corto. ` +
      `Perdieron ${cortas.reduce((a, f) => a + f.perdidas, 0)} respuestas entre todas.`,
  );
  console.log(`  Sugerencia (deja la mediana justo en el ${Math.round(UMBRAL_APRETADO * 100)}%):`);
  for (const f of cortas) {
    // Se redondea hacia arriba a múltiplos de 5: los relojes se escriben a
    // mano en scenarios.json y un 37 se lee como un número calculado con falsa
    // precisión sobre una muestra de treinta personas.
    const sugerido = Math.ceil(f.medianaS / UMBRAL_APRETADO / 5) * 5;
    console.log(`    R${f.ronda}  ${f.limite}s -> ${sugerido}s   ${f.titulo.slice(0, 44)}`);
  }
  console.log('  Después de editar timeLimitSeconds: node scripts/recompute-mc-durations.cjs --write');
}

/** Pared contra presupuesto. Devuelve los minutos, para reusarlos en el resumen. */
function presupuesto(j: Juego): { paredMin: number; presupuestoMin: number } {
  const rondas = (j.game.scenarios || []).length;
  const suma = j.relojes.reduce((a, b) => a + b, 0);
  return {
    paredMin: j.paredMs / 60_000,
    presupuestoMin: (suma + OVERHEAD_POR_RONDA_S * rondas) / 60,
  };
}

function imprimirJuegoEntero(j: Juego): void {
  const rondas = (j.game.scenarios || []).length;
  const suma = j.relojes.reduce((a, b) => a + b, 0);
  const { paredMin, presupuestoMin } = presupuesto(j);

  console.log('\nEL JUEGO ENTERO');
  console.log(
    `  pared        ${paredMin.toFixed(1)} min` +
      (j.paredAproximada ? '   (APROXIMADA: falta startedAt/finishedAt, sale de createdAt/updatedAt)' : ''),
  );
  console.log(
    `  presupuesto  ${presupuestoMin.toFixed(1)} min  = ${Math.round(suma / 60)} min de relojes` +
      ` + 2 min × ${rondas} rondas   (techo ${PARED_PRESUPUESTO_MIN} min)`,
  );
  if (presupuestoMin > PARED_PRESUPUESTO_MIN) {
    console.log(
      `  -> El presupuesto YA no cabía antes de jugar: ${presupuestoMin.toFixed(1)} min contra ` +
        `${PARED_PRESUPUESTO_MIN}. Sobra ${(presupuestoMin - PARED_PRESUPUESTO_MIN).toFixed(1)} min, ` +
        'que son una ronda.',
    );
  } else if (paredMin > PARED_PRESUPUESTO_MIN) {
    console.log(
      `  -> El presupuesto cabía y la pared no: el overhead por ronda fue mayor que los 2 min.`,
    );
  }

  const notas = j.feedback
    .map((f) => f.rating)
    .filter((r): r is number => typeof r === 'number');
  // Se imprimen TODAS las respuestas de feedback, incluidas las que dejaron la
  // nota y no escribieron nada: un 2 de 7 sin comentario es un dato, y
  // esconderlo deja la sección diciendo un número de respuestas distinto del
  // que informa la línea de la nota.
  const comentarios = [...j.feedback].sort(
    (a, b) => (a.submittedAt?.toMillis() ?? 0) - (b.submittedAt?.toMillis() ?? 0),
  );

  if (j.feedback.length === 0) {
    console.log('  nota         (nadie dejó feedback)');
    return;
  }
  const prom = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  console.log(
    `  nota         ${prom === null ? '—' : prom.toFixed(2)} de 7` +
      `   (${notas.length} notas de ${j.feedback.length} respuestas)`,
  );
  if (notas.length > 0) {
    const cuenta = new Map<number, number>();
    notas.forEach((n) => cuenta.set(n, (cuenta.get(n) ?? 0) + 1));
    const barras = [...cuenta.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, c]) => `${n}:${'#'.repeat(c)}`)
      .join('  ');
    console.log(`  distribución ${barras}`);
  }

  // Los comentarios van COMPLETOS y sin resumir. Quince comentarios se leen en
  // un minuto, y el promedio esconde justo lo que sirve: en 9XR4Z6 la nota
  // decía 4,5 y los comentarios decían, casi todos, «faltó tiempo».
  console.log(`\nLAS ${comentarios.length} RESPUESTAS DE FEEDBACK, COMPLETAS`);
  for (const f of comentarios) {
    const nota = typeof f.rating === 'number' ? `${f.rating}/7` : 'sin nota';
    const texto = (f.comment || '').trim();
    console.log(`  [${nota}] ${f.playerName || 'Sin nombre'}`);
    console.log(`    ${texto ? texto.replace(/\n/g, '\n    ') : '(sin comentario)'}`);
  }
}

/**
 * Las reglas de lectura, en una sola función para que el resumen de todos los
 * juegos y el detalle de uno digan exactamente lo mismo.
 */
function veredictos(j: Juego): string[] {
  const out: string[] = [];
  for (const f of j.abiertas) {
    const veces = extensionesDe(j.game, f.ronda);
    if (f.residual > RESIDUAL_MALA_REDACCION) {
      out.push(
        `R${f.ronda} EL ENUNCIADO CONFUNDE: ${firmado(f.residual)} sobre lo que sus ` +
          `${f.palabras} palabras predicen. Reescribirlo, no alargar el reloj.`,
      );
    }
    if (f.colgando !== null && f.colgando > COLGANDO_RELOJ_CORTO) {
      out.push(
        `R${f.ronda} EL RELOJ NO ALCANZÓ: ${f.colgando}% seguía escribiendo en los ` +
          `últimos 20 s de los ${f.relojEfectivo} s que tuvo.`,
      );
    }
    if (veces > 0) {
      out.push(
        `R${f.ronda} EL RELOJ ESCRITO ESTABA MAL POR ${veces * EXTENSION_SEGUNDOS} s: el ` +
          `anfitrión apretó «+${EXTENSION_SEGUNDOS} s» ${veces} ${veces === 1 ? 'vez' : 'veces'}. ` +
          'No es una opinión.',
      );
    }
    if (f.relojEscrito < f.relojQuePedia) {
      out.push(
        `R${f.ronda} NO PASARÍA EL VALIDADOR DE HOY: ${f.relojEscrito} s escritos contra ` +
          `${f.relojQuePedia} s que pide relojDerivadoAbierta().`,
      );
    }
    const sinUsar = f.relojEfectivo - f.cierre;
    if (sinUsar > MARGEN_CIERRE_SEGUNDOS) {
      out.push(
        `R${f.ronda} TERMINÓ ${sinUsar} s ANTES del reloj ofrecido: o se cortó a mano con ` +
          '«Terminar Ronda», o todos habían enviado ya. El cierre por ronda no se guarda en ' +
          'Firestore, así que el script no puede distinguirlos.',
      );
    }
  }
  for (const f of j.mc) {
    if (f.usoMediana > UMBRAL_APRETADO) {
      out.push(
        `R${f.ronda} (MC) RELOJ CORTO: la mediana consumió ${Math.round(f.usoMediana * 100)}% de ` +
          `${f.limite} s y se perdieron ${f.perdidas} respuestas.`,
      );
    }
  }
  return out;
}

function imprimirVeredicto(j: Juego): void {
  const v = veredictos(j);
  console.log('\nVEREDICTO POR RONDA');
  if (v.length === 0) {
    console.log('  Ninguna ronda disparó una regla. El reloj y los enunciados estuvieron bien.');
    return;
  }
  for (const linea of v) console.log(`  ${linea}`);
}

function imprimirDetalle(j: Juego): void {
  console.log(`\n${'═'.repeat(ANCHO)}`);
  console.log(encabezadoJuego(j));
  console.log('═'.repeat(ANCHO));
  imprimirAbiertas(j);
  imprimirMC(j);
  imprimirJuegoEntero(j);
  imprimirVeredicto(j);
  console.log('');
}

/**
 * El resumen de todos los juegos imprime SÓLO lo que disparó una regla. Con
 * veinticuatro juegos, una tabla completa por cada uno es exactamente el
 * formato que no se lee.
 */
function imprimirResumen(j: Juego): void {
  const { paredMin, presupuestoMin } = presupuesto(j);
  const notas = j.feedback.map((f) => f.rating).filter((r): r is number => typeof r === 'number');
  const prom = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  console.log(`\n${'─'.repeat(ANCHO)}`);
  console.log(encabezadoJuego(j));
  console.log(
    `  ${j.abiertas.length} abiertas · ${j.mc.length} MC · pared ${paredMin.toFixed(1)} min ` +
      `contra ${presupuestoMin.toFixed(1)} de presupuesto · nota ${prom === null ? '—' : prom.toFixed(2)}` +
      `${j.paredAproximada ? ' · pared aproximada' : ''}`,
  );
  const v = veredictos(j);
  if (v.length === 0) {
    console.log('  sin alarmas');
    return;
  }
  for (const linea of v) console.log(`  ${linea}`);
}

// ───────────────────────────────────────────────────────────────────────────
// --calibrar
// ───────────────────────────────────────────────────────────────────────────

/**
 * Reajusta `lectura ~ a + b × palabras` con todos los juegos que hay.
 *
 * IMPRIME y no escribe `src/lib/abiertaTiming.ts` a propósito: cambiar esa
 * recta mueve el piso de reloj de todas las sesiones del repo a la vez —el
 * validador de contenido la espeja y falla el build— y eso es un commit
 * deliberado de una persona, no el efecto secundario de correr un análisis.
 *
 * El ajuste es POOLED, prosa y código juntos, porque así se estimó la recta
 * original (n = 35, RMSE 12 s). Los dos ajustes por formato se imprimen
 * abajo como referencia, y el de prosa es el que manda si algún día se cambia.
 */
async function calibrar(codes: string[]): Promise<void> {
  const puntos: { palabras: number; lectura: number; formato: FormatoDeRespuesta; code: string; ronda: number }[] = [];
  for (const code of codes) {
    const j = await leerJuego(code);
    if (!j) continue;
    for (const f of j.abiertas) {
      puntos.push({ palabras: f.palabras, lectura: f.lecturaReal, formato: f.formato, code, ronda: f.ronda });
    }
  }

  console.log(`\n${'═'.repeat(ANCHO)}`);
  console.log('CALIBRAR  ·  lectura ~ a + b × palabras, por mínimos cuadrados');
  console.log('═'.repeat(ANCHO));

  const ajustar = (ps: typeof puntos, etiqueta: string): void => {
    const n = ps.length;
    if (n < 3) {
      console.log(`  ${etiqueta.padEnd(14)} n = ${n}: muy pocos puntos para ajustar nada.`);
      return;
    }
    const mx = ps.reduce((a, p) => a + p.palabras, 0) / n;
    const my = ps.reduce((a, p) => a + p.lectura, 0) / n;
    const sxy = ps.reduce((a, p) => a + (p.palabras - mx) * (p.lectura - my), 0);
    const sxx = ps.reduce((a, p) => a + (p.palabras - mx) ** 2, 0);
    const b = sxx === 0 ? 0 : sxy / sxx;
    const a = my - b * mx;
    const rmse = Math.sqrt(
      ps.reduce((acc, p) => acc + (p.lectura - (a + b * p.palabras)) ** 2, 0) / n,
    );
    const syy = ps.reduce((acc, p) => acc + (p.lectura - my) ** 2, 0);
    const r = sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy);
    console.log(
      `  ${etiqueta.padEnd(14)} a = ${a.toFixed(1)} s   b = ${b.toFixed(3)} s/palabra   ` +
        `n = ${n}   RMSE = ${rmse.toFixed(1)} s   corr = ${r.toFixed(2)}`,
    );
  };

  const enRango = puntos.filter((p) => p.palabras <= PALABRAS_FUERA_DE_RANGO);
  const fuera = puntos.filter((p) => p.palabras > PALABRAS_FUERA_DE_RANGO);

  ajustar(enRango, 'POOLED');
  ajustar(enRango.filter((p) => p.formato === 'prose'), 'sólo prosa');
  ajustar(enRango.filter((p) => p.formato === 'code'), 'sólo código');

  if (fuera.length > 0) {
    console.log(
      `\n  Fuera del ajuste por pasar las ${PALABRAS_FUERA_DE_RANGO} palabras ` +
        `(${fuera.length} ${fuera.length === 1 ? 'ronda' : 'rondas'}):`,
    );
    for (const p of fuera) {
      console.log(`    ${p.code} R${p.ronda}  ${p.palabras} palabras, ${p.lectura} s de lectura`);
    }
    ajustar(puntos, 'con todos');
  }

  console.log(
    `\n  Hoy en src/lib/abiertaTiming.ts: a = 13 s, b = 0,32 (prosa) / 0,25 (código).\n` +
      '  Este comando NO escribe ese archivo. Si b se movió, es una decisión: mueve el\n' +
      '  piso de reloj de todas las sesiones del repo a la vez.',
  );

  // Las cinco rondas de peor residual son la lista de enunciados a reescribir,
  // y salen de acá gratis: ya están todos los puntos en memoria.
  const conResidual = puntos
    .map((p) => ({ ...p, residual: p.lectura - costoDeLectura(p.palabras, p.formato) }))
    .sort((x, y) => y.residual - x.residual)
    .slice(0, 5);
  console.log('\n  Los peores residuales del repo (los enunciados a reescribir):');
  for (const p of conResidual) {
    console.log(
      `    ${p.code} R${p.ronda}  ${firmado(p.residual).padStart(6)}  ` +
        `(${p.palabras} palabras, ${p.formato})`,
    );
  }
  console.log('');
}

// ───────────────────────────────────────────────────────────────────────────

/** Los juegos terminados que son una clase de verdad y no una prueba. */
async function codigosDeClase(): Promise<string[]> {
  const snap = await db
    .collection('games')
    .where('status', '==', 'finished')
    .select('players')
    .get();
  return snap.docs
    .filter((d) => Object.keys((d.data() as JuegoDoc).players || {}).length >= MIN_JUGADORES)
    .map((d) => d.id);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const quiereCalibrar = args.includes('--calibrar');
  const code = args.find((a) => !a.startsWith('--'));

  if (quiereCalibrar) {
    await calibrar(code ? [code.toUpperCase()] : await codigosDeClase());
    return;
  }

  if (code) {
    const j = await leerJuego(code.toUpperCase());
    if (!j) {
      console.error(`El juego "${code.toUpperCase()}" no existe.`);
      process.exitCode = 1;
      return;
    }
    imprimirDetalle(j);
    return;
  }

  const codes = await codigosDeClase();
  if (codes.length === 0) {
    console.log(`No hay juegos terminados con ${MIN_JUGADORES}+ jugadores.`);
    return;
  }
  console.log(
    `${codes.length} juegos terminados con ${MIN_JUGADORES}+ jugadores. ` +
      'Sólo se imprime lo que disparó una regla; para el detalle de uno: npm run diagnostico <CÓDIGO>',
  );
  for (const c of codes) {
    const j = await leerJuego(c);
    if (j) imprimirResumen(j);
  }
  console.log('');
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
