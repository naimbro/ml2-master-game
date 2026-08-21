/**
 * Las reglas de COLABORADORES, probadas contra el emulador.
 *
 *   npm run test:rules
 *
 * Existe por la misma razon que las del compas: la rama que importa no se puede
 * probar jugando solo. Un profesor que abre su propio curso entra por
 * `professorId` y nunca toca la lista de colaboradores; para ver si el ayudante
 * entra hay que ser el ayudante, con otra cuenta de Google y en otro navegador.
 *
 * Y falla en silencio de las dos formas posibles, que es lo peor:
 *
 *  - Si el permiso NO alcanza, el ayudante ve un panel vacio o un "permiso
 *    denegado" sin explicacion, y como ninguna pantalla dice de que depende el
 *    acceso, la conclusion natural es que la plataforma esta rota.
 *  - Si el permiso alcanza DE MAS —un `professorId` que se puede reescribir, un
 *    mail que calza sin estar verificado— nadie se entera nunca, porque el
 *    sintoma es que todo funciona.
 *
 * Las dos trampas concretas que estas pruebas cuidan:
 *
 *  1. MAYUSCULAS. Google manda el mail tal como lo escribio su dueno y la
 *     comparacion de las reglas es literal. Sin `.lower()` en la punta de la
 *     sesion, un ayudante con el mail capitalizado queda afuera para siempre.
 *  2. EL CAMPO QUE NO EXISTE. Todos los cursos creados antes de esto no tienen
 *     `colaboradores`, y en las reglas leer un campo inexistente hace fallar la
 *     regla ENTERA: sin el `get('colaboradores', [])`, el estreno de esta
 *     funcion le quitaba a cada profesor sus propios cursos.
 *
 * Lo que estas pruebas NO dicen es si las reglas desplegadas son estas. Despues
 * de tocar firestore.rules hay que desplegar igual:
 *   npx firebase deploy --only firestore:rules
 */
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'node:fs';

const FELIPE = 'uid-felipe';
const FRAN = 'uid-francisco';
const AJENO = 'uid-otro-profesor';
const ANA = 'alumna-ana';

const MAIL_FELIPE = 'felipe@uc.cl';
// Guardado en minusculas —como lo deja normalizarMail()— pero la sesion de
// Google lo trae capitalizado. Esa diferencia es la prueba.
const MAIL_FRAN = 'franciscoflorescaillet@gmail.com';
const MAIL_FRAN_COMO_LO_MANDA_GOOGLE = 'FranciscoFloresCaillet@Gmail.com';

const CURSO = 'curso-de-felipe';
const CURSO_VIEJO = 'curso-sin-el-campo';
const CURSO_AJENO = 'curso-de-otro';

const testEnv = await initializeTestEnvironment({
  projectId: 'colaboradores-rules-test',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});

await testEnv.clearFirestore();

// Sembrado por debajo de las reglas: el estado del que parten las pruebas.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'professors', FELIPE), { uid: FELIPE, email: MAIL_FELIPE, status: 'approved' });
  await setDoc(doc(db, 'professors', FRAN), { uid: FRAN, email: MAIL_FRAN, status: 'approved' });
  await setDoc(doc(db, 'professors', AJENO), { uid: AJENO, email: 'otro@uc.cl', status: 'approved' });

  await setDoc(doc(db, 'courses', CURSO), {
    name: 'Machine Learning II', professorId: FELIPE, professorEmail: MAIL_FELIPE,
    colaboradores: [MAIL_FRAN],
  });
  // El curso que ya existia cuando esto se programo: sin el campo.
  await setDoc(doc(db, 'courses', CURSO_VIEJO), {
    name: 'Curso de antes', professorId: FELIPE, professorEmail: MAIL_FELIPE,
  });
  await setDoc(doc(db, 'courses', CURSO_AJENO), {
    name: 'Curso de otro', professorId: AJENO, professorEmail: 'otro@uc.cl', colaboradores: [],
  });

  await setDoc(doc(db, 'courses', CURSO, 'sessions', 'S1'), { title: 'Clase 1', status: 'ready' });
  await setDoc(doc(db, 'courses', CURSO, 'analytics', 'A1'), { promedio: 62 });
  await setDoc(doc(db, 'students', ANA, 'courseData', CURSO), { courseId: CURSO, promedio: 71 });
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

const como = (uid, email, verificado = true) =>
  testEnv.authenticatedContext(uid, { email, email_verified: verificado }).firestore();

const felipe = () => como(FELIPE, MAIL_FELIPE);
const fran = () => como(FRAN, MAIL_FRAN_COMO_LO_MANDA_GOOGLE);
const franSinVerificar = () => como(FRAN, MAIL_FRAN_COMO_LO_MANDA_GOOGLE, false);
const ajeno = () => como(AJENO, 'otro@uc.cl');

// ── el dueno sigue siendo el dueno ───────────────────────────────────────────

await prueba('el dueno escribe una sesion de su curso', false, () =>
  assertSucceeds(setDoc(doc(felipe(), 'courses', CURSO, 'sessions', 'S2'), { title: 'Clase 2' })));

await prueba('el dueno de un curso SIN el campo colaboradores no perdio su curso', true, () =>
  assertSucceeds(setDoc(doc(felipe(), 'courses', CURSO_VIEJO, 'sessions', 'S9'), { title: 'Clase 9' })));

await prueba('el dueno de un curso SIN el campo puede editar el curso', true, () =>
  assertSucceeds(updateDoc(doc(felipe(), 'courses', CURSO_VIEJO), { tagline: 'nueva bajada' })));

// ── el colaborador entra ─────────────────────────────────────────────────────

await prueba('el colaborador escribe una sesion, con el mail capitalizado como lo manda Google', true, () =>
  assertSucceeds(setDoc(doc(fran(), 'courses', CURSO, 'sessions', 'S3'), { title: 'Clase 3' })));

await prueba('el colaborador lee las analiticas del curso', true, () =>
  assertSucceeds(getDoc(doc(fran(), 'courses', CURSO, 'analytics', 'A1'))));

await prueba('el colaborador lee los datos de una alumna del curso', true, () =>
  assertSucceeds(getDoc(doc(fran(), 'students', ANA, 'courseData', CURSO))));

await prueba('el colaborador edita el curso', true, () =>
  assertSucceeds(updateDoc(doc(fran(), 'courses', CURSO), { tagline: 'la cambio el ayudante' })));

await prueba('el colaborador agrega a otro colaborador', false, () =>
  assertSucceeds(updateDoc(doc(fran(), 'courses', CURSO), { colaboradores: [MAIL_FRAN, 'tercero@uc.cl'] })));

// ── y no entra nadie mas ─────────────────────────────────────────────────────

await prueba('un profesor cualquiera NO escribe sesiones de un curso ajeno', true, () =>
  assertFails(setDoc(doc(ajeno(), 'courses', CURSO, 'sessions', 'S4'), { title: 'Colada' })));

await prueba('un profesor cualquiera NO lee las analiticas de un curso ajeno', true, () =>
  assertFails(getDoc(doc(ajeno(), 'courses', CURSO, 'analytics', 'A1'))));

await prueba('un profesor cualquiera NO lee los datos de una alumna de un curso ajeno', true, () =>
  assertFails(getDoc(doc(ajeno(), 'students', ANA, 'courseData', CURSO))));

await prueba('el mismo mail SIN verificar no sirve de nada', true, () =>
  assertFails(setDoc(doc(franSinVerificar(), 'courses', CURSO, 'sessions', 'S5'), { title: 'Colada' })));

await prueba('el colaborador de un curso NO entra a otro curso del mismo profesor', true, () =>
  assertFails(setDoc(doc(fran(), 'courses', CURSO_VIEJO, 'sessions', 'S6'), { title: 'Colada' })));

await prueba('estar en la lista de un curso no abre el curso de al lado', false, () =>
  assertFails(updateDoc(doc(fran(), 'courses', CURSO_AJENO), { tagline: 'colada' })));

// ── lo unico que un colaborador NO puede: quedarse con el curso ──────────────

await prueba('el colaborador NO puede ponerse de dueno', true, () =>
  assertFails(updateDoc(doc(fran(), 'courses', CURSO), { professorId: FRAN })));

await prueba('ni el propio dueno puede reescribir professorId', false, () =>
  assertFails(updateDoc(doc(felipe(), 'courses', CURSO), { professorId: AJENO })));

// ── forma del campo ──────────────────────────────────────────────────────────

await prueba('colaboradores no puede quedar como un string suelto', true, () =>
  assertFails(updateDoc(doc(felipe(), 'courses', CURSO), { colaboradores: MAIL_FRAN })));

await prueba('colaboradores no puede pasar del tope', false, () =>
  assertFails(updateDoc(doc(felipe(), 'courses', CURSO), {
    colaboradores: ['a@b.cl', 'c@d.cl', 'e@f.cl', 'g@h.cl', 'i@j.cl', 'k@l.cl'],
  })));

// ── borrar: un colaborador puede, y por eso la pantalla lo avisa ─────────────

await prueba('el colaborador puede borrar el curso (mismo poder que el dueno)', false, () =>
  assertSucceeds(deleteDoc(doc(fran(), 'courses', CURSO))));

await prueba('un profesor cualquiera NO puede borrar un curso ajeno', true, () =>
  assertFails(deleteDoc(doc(ajeno(), 'courses', CURSO_VIEJO))));

// ── informe ──────────────────────────────────────────────────────────────────

console.log('\n  REGLAS DE COLABORADORES — contra el emulador\n');
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
