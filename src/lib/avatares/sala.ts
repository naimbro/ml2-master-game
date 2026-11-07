// La sala de avatares en Firestore (spec M1). No es un juego: no puntua.
//   avataresRuns/{code}                     estado, fase, instrumento (copia), modelos
//   avataresRuns/{code}/planillas/{uid}     la planilla; la lee solo el anfitrion
//   avataresRuns/{code}/humanos/{uid}       los votos del alumno; los lee solo el anfitrion
//   avataresRuns/{code}/personas/{id}       avatares e importaciones de MiroFish; solo admin escribe
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { idHumano, refDe, type Instrumento, type Matriz, type Persona, type Voto } from './contrato';
import { INSTRUMENTOS } from './instrumentos';
import { planillaComoTexto, type Planilla } from './planilla';

export type Fase = 'lobby' | 'planilla' | 'encuesta' | 'resultados';
export interface ModeloAvatar { provider: 'openai' | 'anthropic' | 'gemini'; model: string }
export interface AvataresRun {
  code: string; hostId: string; courseId: string; instrumentoId: string; instrumento: Instrumento; fase: Fase;
  modelos: ModeloAvatar[];
  participantes: Record<string, { inscrito?: boolean; planilla?: boolean; votos?: number }>;
  avatares?: { estado: 'corriendo' | 'listo' | 'error'; n: number; fallos: string[] };
}
export interface DocPlanilla { uid: string; ref: string; campos: Planilla; texto: string }
export interface DocHumano { uid: string; ref: string; votos: Record<string, number> }
export interface DocPersona extends Persona { votos: Record<string, number>; faltantes?: string[] }

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codigoNuevo(r: () => number = Math.random): string {
  return Array.from({ length: 6 }, () => ALFABETO[Math.floor(r() * ALFABETO.length)]).join('');
}

const esVoto = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;

export function aMatriz(inst: Instrumento, humanos: DocHumano[], personas: DocPersona[]): Matriz {
  const validas = new Set(inst.propuestas.map((p) => p.id));
  const ps: Persona[] = [];
  const vs: Voto[] = [];
  for (const h of humanos) {
    const id = idHumano(h.ref);
    ps.push({ id, ref: h.ref, fuente: 'humano', via: 'app' });
    for (const [prop, v] of Object.entries(h.votos ?? {}))
      if (validas.has(prop) && esVoto(v)) vs.push({ persona: id, propuesta: prop, valor: v });
  }
  for (const p of personas) {
    const persona: Persona = { id: p.id, ref: p.ref, fuente: p.fuente, via: p.via };
    if (p.modelo !== undefined) persona.modelo = p.modelo;
    if (p.replica !== undefined) persona.replica = p.replica;
    if (p.condicion !== undefined) persona.condicion = p.condicion;
    ps.push(persona);
    for (const [prop, v] of Object.entries(p.votos ?? {}))
      if (validas.has(prop) && esVoto(v)) vs.push({ persona: p.id, propuesta: prop, valor: v });
  }
  return { instrumento: inst, personas: ps, votos: vs };
}

export async function crearSala(hostId: string, instrumentoId: string, modelos: ModeloAvatar[]): Promise<string> {
  const pack = INSTRUMENTOS[instrumentoId];
  if (!pack) throw new Error(`instrumento desconocido: ${instrumentoId}`);
  for (let intento = 0; intento < 5; intento++) {
    const code = codigoNuevo();
    const ref = doc(db, 'avataresRuns', code);
    if ((await getDoc(ref)).exists()) continue;
    await setDoc(ref, {
      code, hostId, courseId: pack.courseId, instrumentoId, instrumento: pack.instrumento, fase: 'lobby',
      modelos, participantes: {}, creadoEn: serverTimestamp(),
    });
    return code;
  }
  throw new Error('no se pudo generar un codigo libre');
}

export async function inscribirse(code: string, uid: string) {
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.inscrito`]: true });
}

/** Idempotente: escribe el doc completo por uid; enviar dos veces sobrescribe. */
export async function guardarPlanilla(code: string, inst: Instrumento, uid: string, campos: Planilla) {
  const d: DocPlanilla = { uid, ref: refDe(uid, code), campos, texto: planillaComoTexto(inst, campos) };
  await setDoc(doc(db, 'avataresRuns', code, 'planillas', uid), d);
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.planilla`]: true });
}

/** Idempotente: merge por propuesta. */
export async function guardarVoto(code: string, uid: string, propuestaId: string, valor: number, totalVotados: number) {
  await setDoc(doc(db, 'avataresRuns', code, 'humanos', uid),
    { uid, ref: refDe(uid, code), votos: { [propuestaId]: valor } }, { merge: true });
  await updateDoc(doc(db, 'avataresRuns', code), { [`participantes.${uid}.votos`]: totalVotados });
}

export async function cambiarFase(code: string, fase: Fase) {
  await updateDoc(doc(db, 'avataresRuns', code), { fase });
}
