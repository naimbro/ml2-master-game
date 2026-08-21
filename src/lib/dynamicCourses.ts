// Firestore I/O for professor-authored (dynamic) courses and sessions.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp,
  updateDoc, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { courseDocToCourse, sessionDocToOption } from './courseMappers';
import { leerColaboradores, normalizarMail } from './colaboradores';
import type { Course, SessionOption } from './courses';

export interface SessionWithStatus extends SessionOption {
  status: 'draft' | 'ready';
}

/**
 * Los cursos que le tocan a esta persona: los suyos, mas aquellos en los que
 * figura como colaboradora.
 *
 * Son DOS consultas y no una. Firestore sabe hacer un `or()` desde 2023, pero
 * cobra un indice compuesto por cada combinacion y falla en produccion —con el
 * indice sin crear— mucho despues de que la pantalla se vio bien en el
 * emulador. Dos `getDocs` en paralelo cuestan lo mismo y no dependen de nada
 * que haya que acordarse de desplegar aparte.
 *
 * El `mail` puede venir nulo (una sesion sin correo): en ese caso simplemente
 * no hay segunda consulta, en vez de mandar un `where` con undefined que
 * Firestore rechaza en tiempo de ejecucion.
 */
export async function fetchMyCourses(uid: string, mail?: string | null): Promise<Course[]> {
  const propios = getDocs(query(collection(db, 'courses'), where('professorId', '==', uid)));
  const normalizado = mail ? normalizarMail(mail) : '';
  const prestados = normalizado
    ? getDocs(query(collection(db, 'courses'), where('colaboradores', 'array-contains', normalizado)))
    : Promise.resolve(null);

  const [snapPropios, snapPrestados] = await Promise.all([propios, prestados]);

  // El dueno que ademas se puso en su propia lista saldria dos veces; el Map lo
  // resuelve sin que la pantalla tenga que saber nada de esto.
  const porId = new Map<string, Course>();
  for (const d of snapPropios.docs) porId.set(d.id, courseDocToCourse(d.id, d.data(), uid));
  for (const d of snapPrestados?.docs ?? []) {
    if (!porId.has(d.id)) porId.set(d.id, courseDocToCourse(d.id, d.data(), uid));
  }
  return [...porId.values()];
}

export interface ColaboradoresDelCurso {
  /** Mails con acceso, ya normalizados. */
  colaboradores: string[];
  /** Mail del dueno, si el curso lo guardo al crearse. */
  duenoMail: string | null;
  duenoUid: string | null;
}

export async function fetchColaboradores(courseId: string): Promise<ColaboradoresDelCurso> {
  const snap = await getDoc(doc(db, 'courses', courseId));
  const data = snap.exists() ? snap.data() : {};
  return {
    colaboradores: leerColaboradores(data.colaboradores),
    duenoMail: typeof data.professorEmail === 'string' ? data.professorEmail : null,
    duenoUid: typeof data.professorId === 'string' ? data.professorId : null,
  };
}

/**
 * Guarda la lista completa, no un delta. Es un campo de a lo mas cinco strings
 * y quien lo escribe es la unica persona mirandolo: un `arrayUnion` ahorraria
 * un escenario de choque que en la practica no ocurre, a cambio de dejar la
 * pantalla y el documento pudiendo discrepar.
 */
export async function saveColaboradores(courseId: string, colaboradores: string[]): Promise<void> {
  await updateDoc(doc(db, 'courses', courseId), { colaboradores, updatedAt: serverTimestamp() });
}

export async function fetchCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, 'courses', courseId));
  return snap.exists() ? courseDocToCourse(snap.id, snap.data()) : null;
}

export async function fetchSessions(courseId: string): Promise<SessionWithStatus[]> {
  const snap = await getDocs(collection(db, 'courses', courseId, 'sessions'));
  return snap.docs.map((d) => ({
    ...sessionDocToOption(courseId, d.id, d.data()),
    status: (d.data().status === 'ready' ? 'ready' : 'draft') as 'draft' | 'ready',
  }));
}

export async function fetchReadySessions(courseId: string): Promise<SessionOption[]> {
  return (await fetchSessions(courseId)).filter((s) => s.status === 'ready');
}

export async function deleteSession(courseId: string, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, 'courses', courseId, 'sessions', sessionId));
}

/**
 * Borra un curso, sus sesiones y sus jueces personalizados.
 *
 * Firestore NO borra en cascada: borrar `courses/{id}` deja la subcoleccion
 * `sessions` viva pero inalcanzable desde la UI — huerfana e invisible, que es
 * peor que dejarla. Por eso las sesiones se borran primero y una a una.
 *
 * Los juegos ya jugados NO se tocan y siguen funcionando: cada `games/{code}`
 * guarda su propia copia de `sessionConfig` y `scenarios` al crearse, asi que un
 * reporte historico no depende del curso que lo origino.
 */
export async function deleteCourse(courseId: string): Promise<void> {
  const sessions = await getDocs(collection(db, 'courses', courseId, 'sessions'));
  await Promise.all(sessions.docs.map((d) => deleteDoc(d.ref)));
  // Los overrides de jueces viven fuera del curso; sin esto quedan colgando y se
  // volverian a aplicar si el mismo id de curso se reutilizara.
  await deleteDoc(doc(db, 'judgeOverrides', courseId)).catch(() => {});
  await deleteDoc(doc(db, 'courses', courseId));
}

export async function createCourse(
  uid: string,
  input: { name: string; shortName: string; tagline: string; color: string },
  mail?: string | null,
): Promise<string> {
  const ref = await addDoc(collection(db, 'courses'), {
    ...input,
    professorId: uid,
    // Se guarda para poder decir de QUIEN es un curso prestado sin tener que ir
    // a buscar el perfil del profesor, que un colaborador no puede leer: la
    // regla de `professors/{uid}` es solo para su dueno y para el admin.
    professorEmail: mail ? normalizarMail(mail) : '',
    colaboradores: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
