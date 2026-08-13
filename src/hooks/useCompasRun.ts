import { useCallback, useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './useAuth';
import { compasDe, posicionPath } from '../lib/compasContent';
import {
  arquetipoDe,
  posicionDe,
  posicionesDeCohorte,
  posicionesPreviasDeCohorte,
  timonDe,
} from '../lib/compas';
import type { CompasAnswers, CompasPosicion } from '../types/compas';

/**
 * A compass run: the class answering the instrument together, one item at a
 * time, paced by the host.
 *
 * Lives in its OWN collection, not in `games/`. A game doc carries scenarios,
 * judges, scores and a leaderboard, and a compass has none of those — dropping
 * it in there would mean a `modo` flag read by every screen in the engine, and
 * the first time someone forgot to check it the compass would show up in the
 * course standings as a session where everybody scored zero.
 */

export type CompasStatus = 'waiting' | 'active' | 'finished';

export interface CompasParticipante {
  nombre: string;
  respondidas: number;
}

export interface CompasRun {
  code: string;
  courseId: string;
  instrumentId: string;
  /** Which of the three applications this is. Positions are stored per application. */
  aplicacion: number;
  hostId: string;
  hostName: string;
  status: CompasStatus;
  /** 0 = not started; 1..N = the item on screen right now. */
  itemIndex: number;
  totalItems: number;
  participantes: Record<string, CompasParticipante>;
}

/** One student's answers. Read by the host only — see firestore.rules. */
export interface CompasRespuestaDoc {
  playerId: string;
  nombre: string;
  answers: CompasAnswers;
}

export function useCompasRun(code: string | undefined) {
  const { user } = useAuth();
  // El snapshot lleva adentro DE QUE codigo es. Asi `loading` y `run` se derivan
  // por comparacion en vez de escribirse desde el cuerpo del efecto, que es lo
  // que dispara renders en cascada (react-hooks/set-state-in-effect) y ademas
  // deja ver un instante el run anterior cuando se cambia de sala.
  const [snap, setSnap] = useState<{ code: string; run: CompasRun | null; error: string | null } | null>(
    null,
  );
  const [todasLasRespuestas, setTodasLasRespuestas] = useState<CompasRespuestaDoc[]>([]);
  const [misRespuestas, setMisRespuestas] = useState<CompasAnswers>({});

  const vigente = !!code && snap?.code === code;
  const run = vigente ? snap!.run : null;
  const error = vigente ? snap!.error : null;
  const loading = !!code && !vigente;

  const isHost = !!user && !!run && user.uid === run.hostId;
  const pack = compasDe(run?.courseId);
  // Nunca se expone la sala entera a quien no es anfitrion, ni siquiera si un
  // snapshot viejo quedo en memoria al cambiar de rol.
  const respuestas = isHost ? todasLasRespuestas : [];

  useEffect(() => {
    if (!code) return;
    return onSnapshot(
      doc(db, 'compasRuns', code),
      (s) =>
        setSnap({
          code,
          run: s.exists() ? (s.data() as CompasRun) : null,
          error: s.exists() ? null : 'No existe ese compás',
        }),
      (e) => setSnap({ code, run: null, error: e.message }),
    );
  }, [code]);

  // The whole class's answers. Only the host can read this subcollection: a
  // student watching their classmates answer in real time is a student who
  // answers what the room is answering, and the instrument stops measuring what
  // it claims to measure.
  useEffect(() => {
    if (!code || !isHost) return;
    return onSnapshot(collection(db, 'compasRuns', code, 'respuestas'), (s) => {
      setTodasLasRespuestas(s.docs.map((d) => d.data() as CompasRespuestaDoc));
    });
  }, [code, isHost]);

  // Their own answers come back from the server too, so reloading mid-run or
  // switching phones does not lose what they already said.
  useEffect(() => {
    if (!code || !user) return;
    return onSnapshot(doc(db, 'compasRuns', code, 'respuestas', user.uid), (s) => {
      setMisRespuestas(s.exists() ? ((s.data() as CompasRespuestaDoc).answers ?? {}) : {});
    });
  }, [code, user]);

  const unirse = useCallback(
    async (nombre: string) => {
      if (!code || !user) throw new Error('Debe iniciar sesión');
      await updateDoc(doc(db, 'compasRuns', code), {
        [`participantes.${user.uid}`]: { nombre, respondidas: 0 },
        updatedAt: serverTimestamp(),
      });
    },
    [code, user],
  );

  const responder = useCallback(
    async (itemId: string, optionId: string) => {
      if (!code || !user || !run) return;
      const nuevas = { ...misRespuestas, [itemId]: optionId };
      // Optimistic: the tap has to feel instant on a phone on classroom wifi.
      setMisRespuestas(nuevas);
      await setDoc(
        doc(db, 'compasRuns', code, 'respuestas', user.uid),
        {
          playerId: user.uid,
          nombre: run.participantes?.[user.uid]?.nombre ?? '',
          answers: nuevas,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      await updateDoc(doc(db, 'compasRuns', code), {
        [`participantes.${user.uid}.respondidas`]: Object.keys(nuevas).length,
      });
    },
    [code, user, run, misRespuestas],
  );

  const avanzar = useCallback(async () => {
    if (!code || !isHost || !run) return;
    const siguiente = run.itemIndex + 1;
    if (siguiente > run.totalItems) return;
    await updateDoc(doc(db, 'compasRuns', code), {
      status: 'active' as CompasStatus,
      itemIndex: siguiente,
      updatedAt: serverTimestamp(),
    });
  }, [code, isHost, run]);

  const retroceder = useCallback(async () => {
    if (!code || !isHost || !run || run.itemIndex <= 1) return;
    await updateDoc(doc(db, 'compasRuns', code), {
      itemIndex: run.itemIndex - 1,
      updatedAt: serverTimestamp(),
    });
  }, [code, isHost, run]);

  const cerrar = useCallback(async () => {
    if (!code || !isHost) return;
    await updateDoc(doc(db, 'compasRuns', code), {
      status: 'finished' as CompasStatus,
      updatedAt: serverTimestamp(),
    });
  }, [code, isHost]);

  /**
   * Persist the student's final position where the pre/post comparison can find
   * it — keyed by course and application, NOT by run code. Week 3 and week 15
   * are two different runs months apart; hanging the position off the run that
   * produced it would make the comparison unqueryable.
   */
  const guardarPosicion = useCallback(async () => {
    if (!user || !run || !pack) return;
    const pos = posicionDe(misRespuestas, pack.instrumento.items);
    if (!pos) return;
    const arq = arquetipoDe(pos, timonDe(misRespuestas, pack.instrumento.items), pack.arquetipos);
    await setDoc(
      doc(
        db,
        posicionPath(run.courseId, run.instrumentId, run.aplicacion),
        user.uid,
      ),
      {
        playerId: user.uid,
        courseId: run.courseId,
        instrumentId: run.instrumentId,
        aplicacion: run.aplicacion,
        runCode: run.code,
        magnitud: pos.magnitud,
        direccion: pos.direccion,
        respondidas: pos.respondidas,
        total: pos.total,
        arquetipoId: arq?.id ?? null,
        guardadaEn: Timestamp.now(),
      },
      { merge: true },
    );
  }, [user, run, pack, misRespuestas]);

  /** Everyone's position right now. Host only — `respuestas` is empty otherwise. */
  const posicionesDelCurso = (): Array<{ id: string; pos: CompasPosicion }> =>
    pack && run ? posicionesDeCohorte(respuestas, pack.instrumento.items, run.itemIndex) : [];

  /** The same, one item back — what draws the trails. */
  const posicionesPrevias = (): Record<string, CompasPosicion> =>
    pack && run ? posicionesPreviasDeCohorte(respuestas, pack.instrumento.items, run.itemIndex) : {};

  return {
    run,
    pack,
    loading,
    error,
    isHost,
    misRespuestas,
    respuestas,
    unirse,
    responder,
    avanzar,
    retroceder,
    cerrar,
    guardarPosicion,
    posicionesDelCurso,
    posicionesPrevias,
  };
}

/** Creates a run. Host only; the code is what goes on the projector. */
export async function crearCompasRun(params: {
  code: string;
  courseId: string;
  aplicacion: number;
  hostId: string;
  hostName: string;
}): Promise<void> {
  const pack = compasDe(params.courseId);
  if (!pack) throw new Error(`No hay compás para ${params.courseId}`);
  await setDoc(doc(db, 'compasRuns', params.code), {
    code: params.code,
    courseId: params.courseId,
    instrumentId: pack.instrumento.instrumentId,
    aplicacion: params.aplicacion,
    hostId: params.hostId,
    hostName: params.hostName,
    status: 'waiting' as CompasStatus,
    itemIndex: 0,
    totalItems: pack.instrumento.items.length,
    participantes: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
