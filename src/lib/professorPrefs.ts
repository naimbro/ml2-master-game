// Preferencias de presentacion de cada profesor.
//
// Documento aparte de `professors/{uid}` a proposito. Ese documento guarda el
// ESTADO DE ACCESO y su regla dice que solo el admin lo escribe; aflojarla para
// que cada uno guarde su propio orden de tarjetas abriria la puerta a que
// alguien se ponga status 'approved' solo. Una coleccion nueva sin nada
// sensible adentro cuesta una regla de tres lineas y no toca esa superficie.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface ProfessorPrefs {
  /** Ids de curso en el orden elegido. Ver `courseOrder.ts`. */
  courseOrder?: string[];
}

export async function fetchProfessorPrefs(uid: string): Promise<ProfessorPrefs> {
  const snap = await getDoc(doc(db, 'professorPrefs', uid));
  if (!snap.exists()) return {};

  const order = snap.data().courseOrder;
  // El documento lo escribe solo esta app, pero es de escritura del propio
  // usuario: se valida la forma antes de dejarla entrar al render.
  return {
    courseOrder: Array.isArray(order)
      ? order.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
}

export async function saveCourseOrder(uid: string, courseOrder: string[]): Promise<void> {
  await setDoc(doc(db, 'professorPrefs', uid), { courseOrder }, { merge: true });
}
