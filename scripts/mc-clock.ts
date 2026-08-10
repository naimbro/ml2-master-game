/**
 * ¿Alcanzo el reloj de las preguntas de alternativas?
 *
 * La contraparte medida de la regla que vive en el skill `autor-de-contenido`:
 * el reloj de una pregunta se escribe a ojo antes de jugar, y esta es la unica
 * forma de saber si estuvo bien. Correr esto despues de cada clase.
 *
 * **El numero que manda es el % del limite que consumio la MEDIANA del curso.**
 * Medido en XNTUHB (dataviz clase 2, 37 alumnos, 2026-08-10):
 *
 *   R1 52%  R2 45%  R3 50%   ->  3, 3 y 2 respuestas perdidas
 *   R7 63%  R6 69%  R5 89%   ->  6, 5 y 8 respuestas perdidas
 *
 * El corte esta claramente entre 50% y 63%. Por eso el umbral es 60%: por
 * debajo, la gente contesta y le sobra; por encima, empieza a quedar gente sin
 * responder y el acierto se desploma (R5 cayo al 43%).
 *
 * La carga de lectura NO sirve para esto y no se reporta como diagnostico:
 * en el mismo juego, la pregunta con MAS caracteres por segundo (R1, 18,4) fue
 * la mas facil de todas, con 97% de acierto y la mitad del reloj sin usar.
 *
 * Uso:
 *   npx tsx scripts/mc-clock.ts            # todos los juegos con >= 10 jugadores
 *   npx tsx scripts/mc-clock.ts XNTUHB     # uno solo
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'ml2-master-game';
/** Sobre esto, el reloj quedo corto. Ver el encabezado. */
const UMBRAL_APRETADO = 0.6;
/** Debajo de esto un juego es una prueba del profesor, no una clase. */
const MIN_JUGADORES = 10;

admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

interface Fila {
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

async function analizar(code: string): Promise<void> {
  const snap = await db.collection('games').doc(code).get();
  if (!snap.exists) {
    console.error(`El juego "${code}" no existe.`);
    process.exitCode = 1;
    return;
  }
  const game = snap.data()!;
  const scenarios: any[] = game.scenarios || [];
  const jugadores = Object.keys(game.players || {}).length;

  const subs = await db.collection('games').doc(code).collection('submissions').get();
  const filas: Fila[] = [];

  for (const [i, sc] of scenarios.entries()) {
    if (sc?.type !== 'multiple_choice' || !sc.mcQuestions?.length) continue;
    // Una pregunta por escenario es la regla del repo; si alguna sesion vieja
    // trae un bloque, se mide igual pero con la primera, que es la que fija el
    // ritmo de la ronda.
    const q = sc.mcQuestions[0];
    const limite = Number(q.timeLimitSeconds);
    if (!Number.isFinite(limite) || limite <= 0) continue;

    const tiempos: number[] = [];
    let aciertos = 0;
    let perdidas = 0;
    for (const d of subs.docs) {
      const s = d.data();
      if (Number(s.round) !== i + 1) continue;
      const r = (s.mcResponses || [])[0];
      // Una submission sin alternativa elegida es una respuesta PERDIDA, no una
      // ausencia: el bloque se envio solo, o sea que el navegador estaba vivo y
      // la persona no alcanzo a apretar.
      if (r?.selectedOptionId) {
        tiempos.push(r.responseTimeMs / 1000);
        if (r.correct) aciertos++;
      } else {
        perdidas++;
      }
    }
    if (tiempos.length === 0) continue;

    tiempos.sort((a, b) => a - b);
    const pct = (p: number) => tiempos[Math.min(tiempos.length - 1, Math.floor(p * tiempos.length))];
    const mediana = pct(0.5);
    filas.push({
      ronda: i + 1,
      titulo: String(sc.title || sc.id || ''),
      limite,
      contestaron: tiempos.length,
      perdidas,
      medianaS: mediana,
      p90S: pct(0.9),
      usoMediana: mediana / limite,
      aciertoPct: (100 * aciertos) / tiempos.length,
      alFilo: tiempos.filter((t) => t > limite - 3).length,
    });
  }

  if (filas.length === 0) return;

  console.log(`\n${'═'.repeat(76)}`);
  console.log(`${code} · ${game.sessionId || ''} · ${jugadores} jugadores`);
  console.log('─'.repeat(76));
  console.log('ronda  limite  contest  perdid  mediana  %limite  p90   acierto  ultimos 3s');
  for (const f of filas) {
    const apretado = f.usoMediana > UMBRAL_APRETADO;
    console.log(
      `  R${String(f.ronda).padEnd(3)} ${String(f.limite + 's').padStart(6)} ` +
      `${String(f.contestaron).padStart(8)} ${String(f.perdidas).padStart(7)} ` +
      `${(f.medianaS.toFixed(1) + 's').padStart(8)} ${(Math.round(f.usoMediana * 100) + '%').padStart(8)}` +
      `${(f.p90S.toFixed(1) + 's').padStart(7)} ${(Math.round(f.aciertoPct) + '%').padStart(8)} ` +
      `${String(f.alFilo).padStart(10)}${apretado ? '   <-- CORTO' : ''}`,
    );
  }

  const cortas = filas.filter((f) => f.usoMediana > UMBRAL_APRETADO);
  if (cortas.length === 0) {
    console.log(`\n  Ningun reloj paso el ${Math.round(UMBRAL_APRETADO * 100)}%. No hay nada que subir.`);
    return;
  }
  console.log(`\n  ${cortas.length} de ${filas.length} rondas con el reloj corto. ` +
    `Perdieron ${cortas.reduce((a, f) => a + f.perdidas, 0)} respuestas entre todas.`);
  console.log('  Sugerencia (deja la mediana justo en el 60%):');
  for (const f of cortas) {
    // Se redondea hacia arriba a multiplos de 5: los relojes se escriben a mano
    // en scenarios.json y un 37 se lee como un numero calculado con falsa
    // precision sobre una muestra de treinta personas.
    const sugerido = Math.ceil(f.medianaS / UMBRAL_APRETADO / 5) * 5;
    console.log(`    R${f.ronda}  ${f.limite}s -> ${sugerido}s   ${f.titulo.slice(0, 44)}`);
  }
  console.log('  Despues de editar timeLimitSeconds: node scripts/recompute-mc-durations.cjs --write');
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (arg) {
    await analizar(arg.toUpperCase());
    return;
  }
  const snap = await db.collection('games').where('status', '==', 'finished').select('players').get();
  const codes = snap.docs
    .filter((d) => Object.keys(d.data().players || {}).length >= MIN_JUGADORES)
    .map((d) => d.id);
  if (codes.length === 0) {
    console.log(`No hay juegos terminados con ${MIN_JUGADORES}+ jugadores.`);
    return;
  }
  for (const code of codes) await analizar(code);
}

main()
  .then(() => process.exit(process.exitCode || 0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
