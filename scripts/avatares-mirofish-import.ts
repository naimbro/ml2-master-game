/**
 * Importa los resultados de MiroFish a una sala de avatares (spec 2026-11-07, M5).
 *
 *   MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/.../ml2-master-game && npx tsx scripts/avatares-mirofish-import.ts <CODE>"
 *
 * Lee mirofish/results/ayd14/<CODE>/resultados_contrato.json (python -m ayd14.mirofish resultados <CODE>),
 * valida refs y propuestas contra la sala y escribe las personas. Ids deterministas: correrlo
 * dos veces sobrescribe, no duplica.
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import { validarResultadosMirofish } from '../src/lib/avatares/mirofishPuente';
import type { DocPlanilla } from '../src/lib/avatares/sala';

const code = (process.argv[2] ?? '').toUpperCase();
if (!code) throw new Error('uso: avatares-mirofish-import.ts <CODE>');
const archivo = `/mnt/c/Users/naim.bro.k/claude_projects/mirofish/results/ayd14/${code}/resultados_contrato.json`;
if (!fs.existsSync(archivo)) throw new Error(`no existe ${archivo}: corra primero «python -m ayd14.mirofish resultados ${code}»`);
admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();
const runRef = db.collection('avataresRuns').doc(code);
const run = (await runRef.get()).data();
if (!run) throw new Error(`sala ${code} no existe`);
const refs = new Set((await runRef.collection('planillas').get()).docs.map((d) => (d.data() as DocPlanilla).ref));
const props = new Set<string>(run.instrumento.propuestas.map((p: { id: string }) => p.id));
const { personas, errores } = validarResultadosMirofish(JSON.parse(fs.readFileSync(archivo, 'utf8')), refs, props);
for (const e of errores) console.warn('aviso:', e);
if (!personas.length) throw new Error('ninguna persona valida para importar');
const batch = db.batch();
for (const p of personas) batch.set(runRef.collection('personas').doc(p.id), p);
await batch.commit();
console.log(`importadas ${personas.length} personas de MiroFish en ${code}`);
