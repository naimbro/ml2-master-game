import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { compasDe, compasDeInstrumento, posicionPath } from '../lib/compasContent';
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
  /**
   * Cual compas del registro se abrio. OPCIONAL: las salas creadas antes de que
   * un curso pudiera tener varios no lo traen, y el pack se resuelve igual por
   * `instrumentId`, que si esta en todas.
   */
  compasId?: string;
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
  // Por INSTRUMENTO y no por curso: un curso puede tener varios compases --el
  // de semestre y el de una clase-- y el que produjo estas respuestas es el que
  // tiene que interpretarlas. Ademas sirve para las salas abiertas antes de que
  // el registro pasara a estar indexado por compas, que solo guardaron esto.
  const pack = compasDeInstrumento(run?.instrumentId);
  // Nunca se expone la sala entera a quien no es anfitrion, ni siquiera si un
  // snapshot viejo quedo en memoria al cambiar de rol. Memoizado porque el `[]`
  // literal seria un array nuevo en cada render, y eso invalidaba el useCallback
  // de `cerrar` —que escribe las posiciones de todos— en cada pasada.
  const respuestas = useMemo(
    () => (isHost ? todasLasRespuestas : []),
    [isHost, todasLasRespuestas],
  );

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

  /**
   * Cierra la sala Y guarda la posicion de TODOS, desde el anfitrion.
   *
   * Antes cada telefono guardaba la suya al ver `finished`, y eso perdia a
   * quien cerro la pestana antes de que el profesor cerrara: sus respuestas
   * quedaban en la sala pero su posicion durable no se escribia nunca, y la
   * comparacion de noviembre aparecia con huecos sin decir por que. El
   * anfitrion tiene todas las respuestas a la vista, asi que puede escribirlas
   * todas.
   *
   * El telefono sigue guardando la suya como respaldo: si esta escritura falla
   * a medias, la del alumno presente igual queda.
   */
  const cerrar = useCallback(async () => {
    if (!code || !isHost || !run || !pack) return;

    const items = pack.instrumento.items;
    const destino = posicionPath(run.courseId, run.instrumentId, run.aplicacion);

    const escrituras = respuestas.map(async (r) => {
      const pos = posicionDe(r.answers ?? {}, items);
      if (!pos) return; // no contesto nada: no hay posicion que inventar
      const arq = arquetipoDe(pos, timonDe(r.answers ?? {}, items), pack.arquetipos);
      await setDoc(
        doc(db, destino, r.playerId),
        {
          playerId: r.playerId,
          courseId: run.courseId,
          instrumentId: run.instrumentId,
          aplicacion: run.aplicacion,
          runCode: run.code,
          magnitud: pos.magnitud,
          direccion: pos.direccion,
          agencia: pos.agencia,
          agenciaRespondidas: pos.agenciaRespondidas,
          respondidas: pos.respondidas,
          total: pos.total,
          arquetipoId: arq?.id ?? null,
          guardadaEn: Timestamp.now(),
        },
        { merge: true },
      );
    });
    await Promise.all(escrituras);

    await updateDoc(doc(db, 'compasRuns', code), {
      status: 'finished' as CompasStatus,
      updatedAt: serverTimestamp(),
    });
  }, [code, isHost, run, pack, respuestas]);

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
        // Tercer eje. Se guarda aunque sea null: null significa "no dijo nada
        // sobre quien conduce", que es un dato, y un 0 en su lugar lo pondria
        // en "en disputa" sin que lo haya dicho nunca.
        agencia: pos.agencia,
        agenciaRespondidas: pos.agenciaRespondidas,
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
  /** Cual de los compases del registro, no cual curso: un curso tiene varios. */
  compasId: string;
  aplicacion: number;
  hostId: string;
  hostName: string;
}): Promise<void> {
  const pack = compasDe(params.compasId);
  if (!pack) throw new Error(`No hay compás ${params.compasId}`);
  await setDoc(doc(db, 'compasRuns', params.code), {
    code: params.code,
    compasId: pack.compasId,
    // El curso sale del pack y no del formulario: es lo que arma la ruta de las
    // posiciones, y escribirlo por separado permitiria abrir una sala cuyo
    // instrumento guarda bajo un curso que no es el suyo.
    courseId: pack.courseId,
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
