import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useProfessor } from './useProfessor';

/**
 * Cuantas solicitudes de acceso estan esperando revision.
 *
 * No existe ningun aviso por correo cuando alguien pide acceso: la solicitud se
 * queda en `professors/{uid}` con status 'pending' hasta que el admin entre a
 * mirarla. Este contador es el aviso — vive en el link de Admin del panel, que
 * es la primera pantalla que ve el admin al entrar.
 *
 * Sale 0 para cualquiera que no sea admin, y ni siquiera abre la suscripcion:
 * `firestore.rules` sólo deja listar la coleccion al admin, asi que un profesor
 * normal generaria un error de permisos por cada render.
 */
export function usePendingProfessorCount(): number {
  const { access } = useProfessor();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (access !== 'admin') {
      setCount(0);
      return;
    }
    const unsubscribe = onSnapshot(
      query(collection(db, 'professors'), where('status', '==', 'pending')),
      (snap) => setCount(snap.size),
      (error) => {
        // Un fallo acá no puede romper el panel: sin contador se sigue pudiendo
        // entrar a /professor/admin y ver la lista.
        console.error('Error contando solicitudes pendientes:', error);
        setCount(0);
      },
    );
    return () => unsubscribe();
  }, [access]);

  return count;
}
