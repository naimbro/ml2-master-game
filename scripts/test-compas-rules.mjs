/**
 * Las reglas del compas, probadas contra el emulador.
 *
 *   npm run test:rules
 *
 * Existe por una razon que costo dos corridas en seco descubrir. Las dos ramas
 * que de verdad importan son el ANFITRION leyendo la respuesta de OTRO y el
 * ANFITRION escribiendo la posicion de OTRO, y ninguna de las dos se puede
 * probar jugando solo: si el anfitrion usa su propia cuenta, `isOwner(playerId)`
 * calza primero y las tapa. Probarlas en vivo necesita dos personas, dos
 * cuentas y una sala abierta.
 *
 * Y fallan en silencio, que es lo peor: si la lectura se cae, el plano del
 * anfitrion queda en blanco sin decir por que; si se cae la escritura, `cerrar`
 * no guarda a nadie salvo al propio anfitrion y la comparacion de fin de
 * semestre aparece con huecos meses despues, cuando ya no hay como recuperar
 * las respuestas.
 *
 * Estas 17 pruebas cubren eso en segundos y sin dos humanos. Lo que NO cubren es
 * si las reglas desplegadas son estas: `npx firebase deploy --only
 * firestore:rules` no acepta un diff contra produccion, asi que despues de
 * tocar firestore.rules hay que desplegar igual.
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import fs from 'node:fs';

const HOST = 'host-uid-1';
const OTRO_HOST = 'host-uid-2';
const ANA = 'alumna-ana';
const BETO = 'alumno-beto';

const RUN = 'TEST01';
const RUN_AJENO = 'TEST02';
const CURSO = 'ai_democracy_2026';
const APLIC = 'ai_democracy_2026_compas_v1_a1';

const testEnv = await initializeTestEnvironment({
  projectId: 'compas-rules-test',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.clearFirestore();

// Sembrado por debajo de las reglas: el estado del que parten las pruebas.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'compasRuns', RUN), {
    code: RUN, courseId: CURSO, instrumentId: 'ai_democracy_2026_compas_v1',
    aplicacion: 1, hostId: HOST, hostName: 'Anfitrion', status: 'active',
    itemIndex: 3, totalItems: 10, participantes: {},
  });
  await setDoc(doc(db, 'compasRuns', RUN_AJENO), {
    code: RUN_AJENO, courseId: CURSO, instrumentId: 'ai_democracy_2026_compas_v1',
    aplicacion: 1, hostId: OTRO_HOST, hostName: 'Otro', status: 'active',
    itemIndex: 1, totalItems: 10, participantes: {},
  });
  await setDoc(doc(db, 'compasRuns', RUN, 'respuestas', ANA), {
    playerId: ANA, nombre: 'Ana', answers: { c01_backlash: 'A' },
  });
  await setDoc(doc(db, 'compasRuns', RUN, 'respuestas', BETO), {
    playerId: BETO, nombre: 'Beto', answers: { c01_backlash: 'C' },
  });
});

const resultados = [];
async function prueba(nombre, critica, fn) {
  try {
    await fn();
    resultados.push({ nombre, critica, ok: true });
  } catch (e) {
    resultados.push({ nombre, critica, ok: false, msg: e.message });
  }
}

const como = (uid) => testEnv.authenticatedContext(uid).firestore();
const posicion = (extra = {}) => ({
  playerId: ANA, courseId: CURSO, instrumentId: 'ai_democracy_2026_compas_v1',
  aplicacion: 1, runCode: RUN, magnitud: 5.1, direccion: -1.4,
  respondidas: 10, total: 10, arquetipoId: 'realista', ...extra,
});

// ── respuestas: lo que dijo cada quien ───────────────────────────────────────

await prueba('anfitrion LEE la respuesta de otra persona', true, () =>
  assertSucceeds(getDoc(doc(como(HOST), 'compasRuns', RUN, 'respuestas', ANA))));

await prueba('anfitrion LISTA todas las respuestas de su sala', true, () =>
  assertSucceeds(getDocs(collection(como(HOST), 'compasRuns', RUN, 'respuestas'))));

await prueba('una alumna NO puede leer la respuesta de otro', true, () =>
  assertFails(getDoc(doc(como(ANA), 'compasRuns', RUN, 'respuestas', BETO))));

await prueba('una alumna NO puede listar las respuestas de la sala', true, () =>
  assertFails(getDocs(collection(como(ANA), 'compasRuns', RUN, 'respuestas'))));

await prueba('una alumna lee la suya (recargar el telefono)', false, () =>
  assertSucceeds(getDoc(doc(como(ANA), 'compasRuns', RUN, 'respuestas', ANA))));

await prueba('una alumna escribe la suya', false, () =>
  assertSucceeds(setDoc(doc(como(ANA), 'compasRuns', RUN, 'respuestas', ANA),
    { playerId: ANA, nombre: 'Ana', answers: { c01_backlash: 'B' } }, { merge: true })));

await prueba('una alumna NO puede escribir sobre la respuesta de otro', true, () =>
  assertFails(setDoc(doc(como(ANA), 'compasRuns', RUN, 'respuestas', BETO),
    { playerId: BETO, nombre: 'Beto', answers: { c01_backlash: 'E' } }, { merge: true })));

await prueba('el anfitrion NO puede escribir la respuesta de nadie', false, () =>
  assertFails(setDoc(doc(como(HOST), 'compasRuns', RUN, 'respuestas', ANA),
    { playerId: ANA, nombre: 'Ana', answers: { c01_backlash: 'E' } }, { merge: true })));

// ── posiciones durables: lo que hace comparable marzo con noviembre ──────────

await prueba('anfitrion ESCRIBE la posicion de otra persona al cerrar', true, () =>
  assertSucceeds(setDoc(doc(como(HOST), 'compas', CURSO, APLIC, ANA), posicion(), { merge: true })));

await prueba('la alumna escribe la suya (respaldo del telefono)', false, () =>
  assertSucceeds(setDoc(doc(como(ANA), 'compas', CURSO, APLIC, ANA), posicion(), { merge: true })));

await prueba('un alumno cualquiera NO escribe la posicion de otro', true, () =>
  assertFails(setDoc(doc(como(BETO), 'compas', CURSO, APLIC, ANA), posicion(), { merge: true })));

await prueba('el anfitrion de OTRA sala NO escribe posiciones de esta', true, () =>
  assertFails(setDoc(doc(como(OTRO_HOST), 'compas', CURSO, APLIC, ANA), posicion(), { merge: true })));

await prueba('nadie escribe una posicion con id que no calza con el payload', true, () =>
  assertFails(setDoc(doc(como(HOST), 'compas', CURSO, APLIC, BETO), posicion(), { merge: true })));

await prueba('el mapa del curso se puede leer y proyectar', false, () =>
  assertSucceeds(getDocs(collection(como(BETO), 'compas', CURSO, APLIC))));

// ── la sala ──────────────────────────────────────────────────────────────────

await prueba('un alumno lee el doc de la sala (para entrar)', false, () =>
  assertSucceeds(getDoc(doc(como(ANA), 'compasRuns', RUN))));

await prueba('sin sesion NO se lee nada de la sala', true, () =>
  assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'compasRuns', RUN))));

await prueba('un alumno NO puede crear una sala', true, () =>
  assertFails(setDoc(doc(como(ANA), 'compasRuns', 'PIRATA'), {
    code: 'PIRATA', courseId: CURSO, hostId: ANA, status: 'waiting',
  })));

// ── informe ──────────────────────────────────────────────────────────────────

console.log('\n  REGLAS DEL COMPAS — contra el emulador\n');
let fallos = 0;
for (const r of resultados) {
  const marca = r.ok ? ' ok ' : 'FALLA';
  const sello = r.critica ? '!' : ' ';
  if (!r.ok) fallos++;
  console.log(`  ${marca} ${sello} ${r.nombre}`);
  if (!r.ok) console.log(`         ${r.msg.split('\n')[0]}`);
}
console.log(`\n  ${resultados.length - fallos}/${resultados.length} en verde` +
  (fallos ? `  — ${fallos} FALLAN` : '') + '\n  (! = rama que la corrida en solitario no pudo tocar)\n');

await testEnv.cleanup();
process.exit(fallos ? 1 : 0);
