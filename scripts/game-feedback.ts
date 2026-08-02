/**
 * Lee el feedback que los alumnos dejan al final de cada juego: la nota de 1 a 7
 * y el comentario. Es el canal para que Naim y Claude Code lo procesen DESPUES y
 * vayan mejorando el juego.
 *
 * No existe ninguna pantalla que muestre esto, y es deliberado: las reglas de
 * Firestore dejan leer cada feedback solo a su dueno, asi que ni el profesor lo
 * ve desde el navegador. Verlo proyectado, con nombre y delante del curso,
 * cambia lo que la gente se atreve a escribir.
 *
 * Uso:
 *   npx tsx scripts/game-feedback.ts                  # todo, agrupado por sesion
 *   npx tsx scripts/game-feedback.ts dataviz_2026     # solo ese curso
 *   npx tsx scripts/game-feedback.ts --anonimo        # sin nombres, para pegar en otra parte
 */
import admin from 'firebase-admin';

const PROJECT_ID = 'ml2-master-game';
admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore();

interface Fila {
  courseId: string;
  sessionId: string;
  gameCode: string;
  playerName: string;
  rating: number | null;
  comment: string;
  submittedAtMs: number;
}

function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const anonimo = args.includes('--anonimo');
  const cursoPedido = args.find((a) => !a.startsWith('--'));

  const snap = await db.collectionGroup('feedback').get();
  if (snap.empty) {
    console.log('Todavia no hay feedback de ningun juego.');
    return;
  }

  // Los juegos se leen una sola vez cada uno: varios feedback comparten juego.
  const codigos = [...new Set(snap.docs.map((d) => d.ref.parent.parent!.id))];
  const juegos = new Map<string, { courseId: string; sessionId: string }>();
  await Promise.all(
    codigos.map(async (code) => {
      const g = (await db.collection('games').doc(code).get()).data();
      juegos.set(code, {
        courseId: (g?.courseId as string) || '(sin curso)',
        sessionId: (g?.sessionId as string) || '(sin sesion)',
      });
    })
  );

  const filas: Fila[] = snap.docs.map((d) => {
    const x = d.data();
    const code = d.ref.parent.parent!.id;
    const meta = juegos.get(code)!;
    return {
      courseId: meta.courseId,
      sessionId: meta.sessionId,
      gameCode: code,
      playerName: (x.playerName as string) || 'Sin nombre',
      rating: typeof x.rating === 'number' ? x.rating : null,
      comment: ((x.comment as string) || '').trim(),
      submittedAtMs: x.submittedAt?.toMillis?.() ?? 0,
    };
  });

  const visibles = cursoPedido ? filas.filter((f) => f.courseId === cursoPedido) : filas;
  if (visibles.length === 0) {
    console.log(`No hay feedback para ${cursoPedido}.`);
    console.log('Cursos con feedback:', [...new Set(filas.map((f) => f.courseId))].join(', '));
    return;
  }

  const porSesion = new Map<string, Fila[]>();
  for (const f of visibles) {
    const clave = `${f.courseId} / ${f.sessionId}`;
    porSesion.set(clave, [...(porSesion.get(clave) ?? []), f]);
  }

  for (const [clave, grupo] of [...porSesion.entries()].sort()) {
    const notas = grupo.map((f) => f.rating).filter((r): r is number => r !== null);
    const avg = promedio(notas);
    console.log(`\n=== ${clave} ===`);
    console.log(
      `${grupo.length} respuestas · ${notas.length} con nota · promedio ${
        avg === null ? '—' : avg.toFixed(1)
      } de 7`
    );
    if (notas.length > 0) {
      const cuenta = new Map<number, number>();
      notas.forEach((n) => cuenta.set(n, (cuenta.get(n) ?? 0) + 1));
      const barras = [...cuenta.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([n, c]) => `${n}:${'#'.repeat(c)}`)
        .join('  ');
      console.log(`distribucion  ${barras}`);
    }

    const conComentario = grupo
      .filter((f) => f.comment.length > 0)
      .sort((a, b) => a.submittedAtMs - b.submittedAtMs);

    if (conComentario.length === 0) {
      console.log('\n(nadie escribio un comentario)');
      continue;
    }
    console.log('');
    for (const f of conComentario) {
      const quien = anonimo ? 'anonimo' : f.playerName;
      const nota = f.rating === null ? 'sin nota' : `${f.rating}/7`;
      console.log(`  [${nota}] ${quien} · juego ${f.gameCode}`);
      console.log(`    ${f.comment.replace(/\n/g, '\n    ')}`);
    }
  }

  console.log(`\nTotal: ${visibles.length} respuestas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
