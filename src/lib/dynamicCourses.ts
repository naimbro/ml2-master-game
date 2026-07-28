// Firestore I/O for professor-authored (dynamic) courses and sessions.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { courseDocToCourse, sessionDocToOption } from './courseMappers';
import type { Course, SessionOption } from './courses';

export interface SessionWithStatus extends SessionOption {
  status: 'draft' | 'ready';
}

export async function fetchMyCourses(uid: string): Promise<Course[]> {
  const snap = await getDocs(query(collection(db, 'courses'), where('professorId', '==', uid)));
  return snap.docs.map((d) => courseDocToCourse(d.id, d.data()));
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
): Promise<string> {
  const ref = await addDoc(collection(db, 'courses'), {
    ...input,
    professorId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
