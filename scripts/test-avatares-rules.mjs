/**
 * Reglas de avatares contra el emulador (npm run test:rules). Lo que importa y
 * no se puede probar jugando solo: el ANFITRION lee la planilla de OTRO, un
 * alumno NO lee la de otro, nadie escribe personas desde el cliente.
 */
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import fs from 'node:fs';

const HOST = 'host-1', ANA = 'ana', BETO = 'beto', RUN = 'AVT001';
const testEnv = await initializeTestEnvironment({
  projectId: 'avatares-rules-test',
  firestore: { rules: fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
});
await testEnv.clearFirestore();
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'professors', HOST), { status: 'approved' });
  await setDoc(doc(db, 'avataresRuns', RUN), { code: RUN, hostId: HOST, fase: 'planilla', participantes: {} });
  await setDoc(doc(db, 'avataresRuns', RUN, 'planillas', ANA), { uid: ANA, ref: 'r1', campos: {}, texto: '' });
});
const como = (uid) => testEnv.authenticatedContext(uid).firestore();
let ok = 0;
const t = async (nombre, p) => { await p; ok++; console.log(`  ok  ${nombre}`); };

await t('el anfitrion lee la planilla de otro', assertSucceeds(getDoc(doc(como(HOST), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno no lee la planilla de otro', assertFails(getDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno lee la suya', assertSucceeds(getDoc(doc(como(ANA), 'avataresRuns', RUN, 'planillas', ANA))));
await t('un alumno escribe su planilla dos veces', (async () => {
  await assertSucceeds(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', BETO), { uid: BETO, ref: 'r2', campos: { a: '1' }, texto: '' }));
  await assertSucceeds(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', BETO), { uid: BETO, ref: 'r2', campos: { a: '2' }, texto: '' }));
})());
await t('un alumno no escribe la planilla de otro', assertFails(setDoc(doc(como(BETO), 'avataresRuns', RUN, 'planillas', ANA), { uid: BETO })));
await t('un alumno escribe sus votos con merge', assertSucceeds(setDoc(doc(como(ANA), 'avataresRuns', RUN, 'humanos', ANA), { uid: ANA, ref: 'r1', votos: { p1: 4 } }, { merge: true })));
await t('el anfitrion lee los votos de otro', assertSucceeds(getDoc(doc(como(HOST), 'avataresRuns', RUN, 'humanos', ANA))));
await t('un alumno no lee los votos de otro', assertFails(getDoc(doc(como(BETO), 'avataresRuns', RUN, 'humanos', ANA))));
await t('nadie escribe personas desde el cliente', assertFails(setDoc(doc(como(HOST), 'avataresRuns', RUN, 'personas', 'a_m_r1'), { votos: {} })));
await t('un alumno no lee personas', assertFails(getDoc(doc(como(ANA), 'avataresRuns', RUN, 'personas', 'a_m_r1'))));
await t('un alumno no cambia la fase', assertFails(updateDoc(doc(como(ANA), 'avataresRuns', RUN), { fase: 'resultados' })));
await t('un alumno actualiza participantes', assertSucceeds(updateDoc(doc(como(ANA), 'avataresRuns', RUN), { [`participantes.${ANA}.planilla`]: true })));
await t('el anfitrion cambia la fase', assertSucceeds(updateDoc(doc(como(HOST), 'avataresRuns', RUN), { fase: 'encuesta' })));
await t('un profesor aprobado crea una sala propia', assertSucceeds(setDoc(doc(como(HOST), 'avataresRuns', 'AVT002'), { code: 'AVT002', hostId: HOST, participantes: {} })));
await t('un alumno no crea salas', assertFails(setDoc(doc(como(ANA), 'avataresRuns', 'AVT003'), { code: 'AVT003', hostId: ANA })));

await testEnv.cleanup();
console.log(`${ok} pruebas de avatares en verde`);
