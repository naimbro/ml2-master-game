/**
 * Analisis privado del ranking acumulado de un curso: los 26 completos, con la
 * matriz alumno x clase. NO es proyectable y no se sube a ninguna parte — el
 * fondo de la tabla no se muestra a los alumnos (ver el spec).
 *
 * Uso:
 *   npx tsx scripts/course-standings.ts                 # lista los cursos con datos
 *   npx tsx scripts/course-standings.ts dataviz_2026    # respeta standings.finalized
 *   npx tsx scripts/course-standings.ts dataviz_2026 --final   # fuerza el descarte (hipotetico)
 *
 * El descarte de las 2 peores NO depende de `--final`: depende del `finalized`
 * guardado en `standings/{courseId}`, que es el mismo campo que lee el
 * alumno. Si el semestre ya esta cerrado, corre igual sin la bandera y
 * muestra lo mismo que ve la app. `--final` sirve solo para FORZAR el
 * descarte cuando el semestre sigue abierto, a modo de vista previa
 * hipotetica de "que pasaria si cerrara ahora" — nunca para forzarlo apagado.
 *
 * Importa la MISMA aritmetica que usa la Cloud Function, para que la tabla del
 * alumno y esta no puedan discrepar.
 */
import admin from 'firebase-admin';
import { writeFileSync } from 'node:fs';
import {
  accumulate,
  pickOfficialGames,
  type GameResult,
  type GamePlayerInput,
  type StandingsEntry,
} from '../functions/src/lib/standings';

const PROJECT_ID = 'ml2-master-game';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

const SEQ = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec',
  '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95',
];

/**
 * Escapa para texto Y para atributos entre comillas dobles. `scripts/lib/report.ts`
 * (el patron de bt-rescore.ts) solo escapa &, < y > porque nunca mete texto en un
 * atributo; aca `sessionTitle` va dentro de `title="..."`, asi que las comillas
 * tambien se escapan. Nombres de alumnos y titulos de sesion son texto que puso
 * una persona (Google display name / titulo editado por el profesor en la UI),
 * no datos de confianza.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadGames(courseId: string, excluded: string[]): Promise<GameResult[]> {
  // Se proyectan solo los campos que se usan mas abajo: scenarios y
  // knowledgeBase son pesados y no hacen falta para el acumulado. Mismo
  // criterio que recomputeCourseStandings en functions/src/index.ts.
  const snap = await db
    .collection('games')
    .where('courseId', '==', courseId)
    .where('status', '==', 'finished')
    .select('finishedAt', 'updatedAt', 'players', 'sessionId', 'sessionConfig')
    .get();

  // Las submissions de cada juego son lecturas independientes entre si: se
  // piden en paralelo, igual que en la Cloud Function gemela.
  const includedDocs = snap.docs.filter((doc) => !excluded.includes(doc.id));
  const out: GameResult[] = await Promise.all(
    includedDocs.map(async (doc) => {
      const game = doc.data();
      const subs = await db.collection('games').doc(doc.id)
        .collection('submissions').select('playerId').get();
      const answered = new Set(subs.docs.map((s) => s.data().playerId as string));

      const players: GamePlayerInput[] = Object.entries(
        (game.players ?? {}) as Record<string, { name?: string; totalScore?: number }>
      ).map(([uid, pl]) => ({
        uid,
        name: pl.name || 'Sin nombre',
        totalScore: Number(pl.totalScore) || 0,
        answered: answered.has(uid),
      }));

      return {
        gameCode: doc.id,
        sessionId: game.sessionId || '',
        sessionTitle: game.sessionConfig?.title || game.sessionId || doc.id,
        finishedAtMs: game.finishedAt?.toMillis?.() ?? game.updatedAt?.toMillis?.() ?? 0,
        players,
      };
    })
  );
  return out.sort((a, b) => a.finishedAtMs - b.finishedAtMs);
}

function renderHtml(
  courseId: string,
  games: GameResult[],
  entries: StandingsEntry[],
  modeLabel: string
): string {
  // "worst" es la peor posicion ACUMULADA que aparece en la tabla (e.position).
  // paletteIndex(), en cambio, recibe posiciones POR JUEGO (e.positionsByGame),
  // que con empates en el fondo de un juego puntual pueden superar a "worst"
  // (p.ej. un juego sin empates reparte hasta la posicion N, pero el cierre del
  // semestre con empates puede dejar "worst" en menos de N). Sin acotar, esa
  // resta se va negativa y da un indice fuera de rango -> SEQ[i] es undefined
  // -> "background:undefined". Por eso el indice se recorta a los extremos
  // validos de la paleta con Math.min/Math.max antes de usarlo.
  //
  // Con un solo alumno, o cuando todos empataron, worst = 1: el rango entero
  // colapsa a un punto. La resta worst-1 se protege con Math.max(1, ...) para
  // no dividir por cero, y el color y el contraste del texto se derivan del
  // MISMO indice de la paleta (en vez de comparar "rank" contra una fraccion
  // de "worst" por separado), asi la decision de texto blanco/negro nunca se
  // desalinea de lo que realmente se pinto en el fondo — incluido el caso
  // worst=1, donde antes el fondo mas oscuro terminaba con letra negra encima.
  const worst = Math.max(1, ...entries.map((e) => e.position));
  const paletteIndex = (rank: number) => {
    const idx = Math.round((1 - (rank - 1) / Math.max(1, worst - 1)) * (SEQ.length - 1));
    return Math.min(SEQ.length - 1, Math.max(0, idx));
  };
  const cell = (rank: number) => SEQ[paletteIndex(rank)];
  // Umbral medido en contraste WCAG real (texto #0b0b0b o #ffffff sobre cada
  // tono, formula de luminancia relativa), no a ojo: del indice 0 al 7 el negro
  // gana o empata (5.41:1 en el 6, 4.46:1 en el 7); recien del 8 en adelante el
  // blanco pasa a ser claramente mejor (5.39:1 y sube hasta 8.10:1 en el 10).
  // El indice 7 es el unico que no llega a 4.5:1 con ninguno de los dos colores
  // (negro 4.46, blanco 4.42) — es el punto medio real de la paleta, no un bug;
  // se deja con negro por ser el mejor de los dos disponibles ahi.
  const dark = (rank: number) => paletteIndex(rank) >= 8;

  const head = games
    .map((g, i) => `<th title="${esc(g.gameCode)} — ${esc(g.sessionTitle)}">C${i + 1}</th>`)
    .join('');
  const rows = entries.map((e) => {
    const cells = e.positionsByGame.map((pos) =>
      pos === null
        ? '<td class="falto">faltó</td>'
        : `<td style="background:${cell(pos)};color:${dark(pos) ? '#ffffff' : '#0b0b0b'}">${pos}</td>`
    ).join('');
    return `<tr><td class="nm">${esc(e.name)}</td>${cells}<td class="tot">${e.points}</td><td class="tot">${e.position}º</td></tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Tabla acumulada — ${esc(courseId)}</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; color: #0b0b0b; background: #f9f9f7; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p.sub { color: #898781; margin: 0 0 24px; }
  table { border-collapse: separate; border-spacing: 2px; }
  th { font-size: 11px; color: #898781; font-weight: 700; padding: 4px 8px; }
  td { text-align: center; padding: 5px 10px; border-radius: 5px; font-size: 12px; font-variant-numeric: tabular-nums; }
  td.nm { text-align: left; background: none; font-weight: 600; }
  td.tot { background: none; font-weight: 800; }
  td.falto { color: #a8a49b; font-size: 11px; border: 1px dashed #dedbd2; }
  .warn { margin-top: 28px; padding: 12px 16px; border-left: 4px solid #eb6834; background: #fff4ee; color: #52514e; }
</style></head>
<body>
<h1>Tabla acumulada — ${esc(courseId)}</h1>
<p class="sub">${entries.length} alumnos · ${games.length} clases · azul oscuro = ir adelante</p>
<p class="sub"><b>${esc(modeLabel)}</b></p>
<table>
  <thead><tr><th></th>${head}<th>Puntos</th><th>Final</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="warn">
  <b>No proyectar.</b> Esta tabla incluye a todo el curso, y el fondo de la tabla no se le muestra a
  los alumnos ni en la app ni en clase. Para proyectar, usa la figura de los seis primeros que está
  en la pantalla del curso.
</div>
</body></html>`;
}

async function main(): Promise<void> {
  const courseId = process.argv[2];
  const forceFinal = process.argv.includes('--final');

  if (!courseId) {
    const snap = await db.collection('games').where('status', '==', 'finished').get();
    const counts = new Map<string, number>();
    snap.docs.forEach((d) => {
      const c = d.data().courseId as string | undefined;
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    console.log('Cursos con juegos terminados (pasa uno como argumento):\n');
    [...counts.entries()].sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`  ${c.padEnd(28)} ${n} juegos`));
    return;
  }

  const standingsDoc = await db.collection('standings').doc(courseId).get();
  const excluded: string[] = standingsDoc.data()?.excludedGameCodes ?? [];
  if (excluded.length) console.log(`Excluidos: ${excluded.join(', ')}`);

  const candidates = await loadGames(courseId, excluded);
  if (candidates.length === 0) {
    console.log(`No hay juegos terminados en ${courseId}.`);
    return;
  }

  // Misma regla que recomputeCourseStandings: una clase, un juego. Sin esto este
  // script mostraria una tabla distinta de la que ve el alumno, que es
  // exactamente lo que se queria evitar al compartir la aritmetica.
  const { official: games, discarded } = pickOfficialGames(candidates);
  if (discarded.length) {
    console.log(
      `Fuera por tener menos alumnos que el juego oficial de su clase: ${
        discarded.map((g) => `${g.gameCode} (${g.players.filter((p) => p.answered).length})`).join(', ')
      }`,
    );
  }

  // El descarte sigue al `finalized` guardado en standings/{courseId} — el
  // mismo campo que lee la app — para que este script nunca muestre un
  // numero distinto del que ve el alumno. `--final` NO es "aplicar el
  // descarte"; es forzarlo cuando el semestre sigue abierto, para previsualizar
  // el escenario hipotetico de "que pasaria si cerrara ahora". No existe la
  // bandera inversa (forzar el descarte apagado sobre un semestre ya cerrado):
  // eso mostraria un numero que la app nunca muestra.
  const semesterClosed = Boolean(standingsDoc.data()?.finalized);
  const applyDrop = semesterClosed || forceFinal;
  const modeLabel = semesterClosed
    ? 'Semestre CERRADO (standings.finalized = true): descarte de las 2 peores aplicado — esto es lo que ve el alumno.'
    : forceFinal
      ? 'Semestre ABIERTO todavia — vista HIPOTETICA forzada con --final (descarte de las 2 peores). Esto NO es lo que ve el alumno hoy.'
      : 'Semestre ABIERTO (standings.finalized = false o inexistente): sin descarte — esto es lo que ve el alumno.';
  const suffix = semesterClosed ? '-final' : forceFinal ? '-hipotetico' : '';

  const entries = accumulate(games, { dropWorst: applyDrop ? 2 : 0 });
  const outPath = `course-standings-${courseId}${suffix}.html`;
  writeFileSync(outPath, renderHtml(courseId, games, entries, modeLabel));

  console.log(`\n${modeLabel}`);
  console.log(`${entries.length} alumnos · ${games.length} clases${applyDrop ? ' · con descarte' : ''}`);
  entries.slice(0, 10).forEach((e) =>
    console.log(`  ${String(e.position).padStart(2)}º  ${e.name.padEnd(28)} ${e.points}`)
  );
  console.log(`\nEscrito: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
