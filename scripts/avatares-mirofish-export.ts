/**
 * Exporta una sala de avatares a MiroFish (spec 2026-11-07, M5).
 *
 *   MSYS_NO_PATHCONV=1 wsl.exe -e bash -lc "cd /mnt/c/.../ml2-master-game && npx tsx scripts/avatares-mirofish-export.ts <CODE>"
 *
 * Escribe en mirofish/projects/ayd14/runs/<CODE>/: panel.json, panel_spec.json e items.json.
 * Sale solo el texto seudonimizado de la planilla (sin nombre, uid, correo ni ciudad);
 * nunca los votos de los alumnos. Lee Firestore con las credenciales ADC de WSL.
 */
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { itemsDesdeInstrumento, panelDesdePlanillas } from '../src/lib/avatares/mirofishPuente';
import type { DocPlanilla } from '../src/lib/avatares/sala';
import { refDe } from '../src/lib/avatares/contrato';

const MIROFISH_RUNS = '/mnt/c/Users/naim.bro.k/claude_projects/mirofish/projects/ayd14/runs';
const code = (process.argv[2] ?? '').toUpperCase();
if (!code) throw new Error('uso: avatares-mirofish-export.ts <CODE>');
admin.initializeApp({ projectId: 'ml2-master-game' });
const db = admin.firestore();
const run = (await db.collection('avataresRuns').doc(code).get()).data();
if (!run) throw new Error(`sala ${code} no existe`);
const planillas = (await db.collection('avataresRuns').doc(code).collection('planillas').get()).docs
  // El ref se deriva del uid (id del doc), igual que en la Function: el del cliente no cuenta.
  .map((d) => ({ ...(d.data() as DocPlanilla), ref: refDe(d.id, code) }));
if (!planillas.length) throw new Error(`la sala ${code} no tiene planillas`);
const { panel, spec } = panelDesdePlanillas(planillas, code);
const items = itemsDesdeInstrumento(run.instrumento);
const dir = path.join(MIROFISH_RUNS, code);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'panel.json'), JSON.stringify(panel, null, 1));
fs.writeFileSync(path.join(dir, 'panel_spec.json'), JSON.stringify(spec, null, 1));
fs.writeFileSync(path.join(dir, 'items.json'), JSON.stringify(items, null, 1));
console.log(`exportado: ${panel.size} personas, ${items.items.length + 1} items -> ${dir}`);
