import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, setDoc, collection, query, where, addDoc, Timestamp, serverTimestamp, deleteField } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import type { Game, Player, Submission, RoundResults, GameStatus, MCResponse } from '../types/game';
import { useAuth } from './useAuth';
import { mcTimeline, mcGateSeconds, shouldCutQuestion } from '../lib/mcTiming';

interface UseGameReturn {
  game: Game | null;
  loading: boolean;
  error: string | null;
  isHost: boolean;
  currentPlayer: Player | null;

  // Actions
  joinGame: (gameCode: string, playerName: string) => Promise<void>;
  startGame: () => Promise<void>;
  submitAnswer: (response: string) => Promise<void>;
  submitMCBlock: (mcResponses: MCResponse[], blockScore: number) => Promise<void>;
  nextRound: () => Promise<void>;
  endGame: () => Promise<void>;
  recalibrateRound: (round: number) => Promise<void>;
  /** MC: avisa que este jugador ya contesto una pregunta, para que el host corte. */
  markAnswered: (questionIndex: number) => Promise<void>;

  // Round data
  submissions: Submission[];
  roundResults: RoundResults | null;
}

export function useGame(gameCode: string | undefined): UseGameReturn {
  const { user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  /** Quienes contestaron cada pregunta de la ronda actual, por indice de pregunta. */
  const [answeredByQuestion, setAnsweredByQuestion] = useState<Record<number, string[]>>({});
  const [roundResults, setRoundResults] = useState<RoundResults | null>(null);

  // Subscribe to game document
  useEffect(() => {
    if (!gameCode) {
      setLoading(false);
      return;
    }

    const gameRef = doc(db, 'games', gameCode);
    const unsubscribe = onSnapshot(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setGame({ gameCode, ...snapshot.data() } as Game);
          setError(null);
        } else {
          setError('Juego no encontrado');
          setGame(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Game subscription error:', err);
        setError('Error al cargar el juego');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [gameCode]);

  // Subscribe to submissions for current round
  useEffect(() => {
    if (!gameCode || !game) return;

    const submissionsRef = collection(db, 'games', gameCode, 'submissions');
    const q = query(submissionsRef, where('round', '==', game.currentRound));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Submission[];
      setSubmissions(subs);
    });

    return () => unsubscribe();
  }, [gameCode, game?.currentRound]);

  // "Ya conteste la pregunta N de esta ronda", un doc por jugador y pregunta.
  // Existe SOLO para que el host sepa cuando cortar: las submissions no sirven,
  // porque se escriben recien cuando la timeline llega a 'done' — o sea siempre
  // despues del instante en que habria que cortar.
  //
  // Se filtra por ronda en la query y por pregunta en memoria: dos igualdades en
  // la query exigirian un indice compuesto, y el conjunto por ronda es de a lo
  // mas (jugadores x preguntas del bloque) documentos.
  useEffect(() => {
    if (!gameCode || !game) return;

    const q = query(
      collection(db, 'games', gameCode, 'answers'),
      where('round', '==', game.currentRound),
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      // Se guardan los ids, no un contador: el host tiene que descartar a quien
      // no este en `players` (un profesor que hostea sin jugar podria disparar el
      // corte antes de que respondieran los alumnos).
      const perQuestion: Record<number, string[]> = {};
      snap.docs.forEach((d) => {
        const { questionIndex, playerId } = d.data() as { questionIndex?: unknown; playerId?: unknown };
        const qi = Number(questionIndex);
        if (!Number.isFinite(qi) || typeof playerId !== 'string') return;
        (perQuestion[qi] ||= []).push(playerId);
      });
      setAnsweredByQuestion(perQuestion);
    });
    return () => unsubscribe();
  }, [gameCode, game?.currentRound]);

  /** Marca que este jugador ya contesto una pregunta concreta. Idempotente. */
  const markAnswered = useCallback(async (questionIndex: number) => {
    if (!gameCode || !user || !game) return;
    const id = `${game.currentRound}_${questionIndex}_${user.uid}`;
    try {
      await setDoc(doc(db, 'games', gameCode, 'answers', id), {
        playerId: user.uid,
        round: game.currentRound,
        questionIndex,
        at: serverTimestamp(),
      });
    } catch (e) {
      // Perder este aviso solo significa que la ronda espera al reloj, que es el
      // respaldo de siempre. No puede romperle la ronda al jugador.
      console.error('markAnswered:', e);
    }
  }, [gameCode, user, game?.currentRound]);

  // Subscribe to round results
  useEffect(() => {
    if (!gameCode || !game || game.status !== 'round_end') return;

    const roundRef = doc(db, 'games', gameCode, 'rounds', `round_${game.currentRound}`);
    const unsubscribe = onSnapshot(roundRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoundResults(snapshot.data() as RoundResults);
      }
    });

    return () => unsubscribe();
  }, [gameCode, game?.currentRound, game?.status]);

  // Computed values
  const isHost = user?.uid === game?.hostId;
  const currentPlayer = user && game?.players?.[user.uid] ? game.players[user.uid] : null;

  // Actions
  const joinGame = useCallback(async (code: string, playerName: string) => {
    if (!user) throw new Error('Debe iniciar sesion');

    const gameRef = doc(db, 'games', code);

    const player: Player = {
      id: user.uid,
      name: playerName,
      email: user.email || '',
      photoURL: user.photoURL || undefined,
      joinedAt: Timestamp.now(),
      isReady: false,
      totalScore: 0,
    };

    await updateDoc(gameRef, {
      [`players.${user.uid}`]: player,
      playerCount: (game?.playerCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });
  }, [user, game?.playerCount]);

  const startGame = useCallback(async () => {
    if (!gameCode || !isHost) return;

    const gameRef = doc(db, 'games', gameCode);
    const now = Timestamp.now();
    const firstScenario = game?.scenarios?.[0];
    const duration = firstScenario?.durationSeconds || game?.roundDurationSeconds || 300;
    const endTime = new Timestamp(
      now.seconds + duration,
      now.nanoseconds
    );

    await updateDoc(gameRef, {
      status: 'active' as GameStatus,
      currentRound: 1,
      roundStartTime: now,
      roundEndTime: endTime,
      mcAllAnsweredAt: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }, [gameCode, isHost, game?.roundDurationSeconds, game?.scenarios]);

  const submitAnswer = useCallback(async (response: string) => {
    if (!gameCode || !user || !game) return;

    const submissionsRef = collection(db, 'games', gameCode, 'submissions');

    const submission: Omit<Submission, 'id'> = {
      gameCode,
      playerId: user.uid,
      playerName: currentPlayer?.name || user.displayName || 'Anonimo',
      round: game.currentRound,
      response,
      submittedAt: Timestamp.now(),
      evaluated: false,
    };

    const docRef = await addDoc(submissionsRef, submission);

    // Fire-and-forget: evaluate immediately, don't block the UI
    const evaluate = httpsCallable(functions, 'evaluateSubmission');
    evaluate({ gameCode, round: game.currentRound, submissionId: docRef.id }).catch(err => {
      console.error('Background evaluation error:', err);
    });
  }, [gameCode, user, game, currentPlayer]);

  const submitMCBlock = useCallback(async (mcResponses: MCResponse[], blockScore: number) => {
    if (!gameCode || !user || !game) return;

    const submissionsRef = collection(db, 'games', gameCode, 'submissions');

    const submission: Omit<Submission, 'id'> = {
      gameCode,
      playerId: user.uid,
      playerName: currentPlayer?.name || user.displayName || 'Anonimo',
      round: game.currentRound,
      response: '',  // empty for MC
      submittedAt: Timestamp.now(),
      evaluated: true,  // no AI eval needed
      mcResponses,
      mcBlockScore: blockScore,
      evaluation: {
        finalScore: blockScore,
        evaluations: [],
        conceptsIdentified: [],
        processedAt: Timestamp.now(),
      },
    };

    await addDoc(submissionsRef, submission);
    // NO fire-and-forget evaluateSubmission call for MC blocks
  }, [gameCode, user, game, currentPlayer]);

  // El acumulado del curso se recalcula al cerrar el juego. Si la llamada falla
  // (el anfitrion cerro el navegador, por ejemplo), la tabla queda vieja hasta
  // el boton "Recalcular" de la pantalla del profesor. No bloquea el cierre.
  const triggerStandingsRecompute = useCallback(async (courseId: string | undefined) => {
    if (!courseId) return;
    try {
      const fn = httpsCallable(functions, 'recomputeCourseStandings');
      await fn({ courseId });
    } catch (err) {
      console.error('No se pudo recalcular la tabla del curso:', err);
    }
  }, []);

  const nextRound = useCallback(async () => {
    if (!gameCode || !isHost || !game) return;

    const gameRef = doc(db, 'games', gameCode);
    const nextRoundNum = game.currentRound + 1;

    if (nextRoundNum > game.totalRounds) {
      // End the game
      await updateDoc(gameRef, {
        status: 'finished' as GameStatus,
        finishedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await triggerStandingsRecompute(game.courseId);
    } else {
      // Start next round
      const now = Timestamp.now();
      const nextScenario = game.scenarios?.[nextRoundNum - 1];
      const duration = nextScenario?.durationSeconds || game.roundDurationSeconds || 300;
      const endTime = new Timestamp(
        now.seconds + duration,
        now.nanoseconds
      );

      await updateDoc(gameRef, {
        status: 'active' as GameStatus,
        currentRound: nextRoundNum,
        roundStartTime: now,
        roundEndTime: endTime,
        // El corte es por ronda: sin esto la ronda nueva nace ya truncada.
        mcAllAnsweredAt: deleteField(),
        updatedAt: serverTimestamp(),
      });

      setRoundResults(null);
    }
  }, [gameCode, isHost, game, triggerStandingsRecompute]);

  const endGame = useCallback(async () => {
    if (!gameCode || !isHost) return;

    const gameRef = doc(db, 'games', gameCode);
    await updateDoc(gameRef, {
      status: 'finished' as GameStatus,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await triggerStandingsRecompute(game?.courseId);
  }, [gameCode, isHost, game, triggerStandingsRecompute]);

  const recalibrateRound = useCallback(async (round: number) => {
    if (!gameCode) return;
    const fn = httpsCallable(functions, 'recalibrateRound');
    await fn({ gameCode, round });
  }, [gameCode]);

  // End the current round (called when timer expires)
  const endRound = useCallback(async () => {
    if (!gameCode || !isHost) return;

    const gameRef = doc(db, 'games', gameCode);
    await updateDoc(gameRef, {
      status: 'round_end' as GameStatus,
      updatedAt: serverTimestamp(),
    });
  }, [gameCode, isHost]);

  // Auto-end round when timer expires (host only)
  useEffect(() => {
    if (!isHost || !game || game.status !== 'active' || !game.roundEndTime) return;

    const checkTimer = () => {
      const now = Date.now();
      const endTime = game.roundEndTime!.toMillis();
      if (now >= endTime) {
        endRound();
      }
    };

    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [isHost, game?.status, game?.roundEndTime, endRound]);

  // Cut an MC question short once every player has answered (host only).
  //
  // Nobody should watch a clock run out on a question that has nothing left to
  // decide. When the last player ANSWERS (subcoleccion `answers`, escrita en el
  // click), the host stamps `mcAllAnsweredAt` on the game doc; mcTimeline()
  // truncates the running question at that instant on EVERY screen at once. It is
  // written, not computed locally, precisely so the projector and the phones cut
  // together.
  //
  // It moves the reveal earlier, it never skips it: the correct answer is shared,
  // so the full feedback window still plays after the cut.
  //
  // Only MC. Open rounds keep their full clock: there, thinking time is the point.
  useEffect(() => {
    if (!isHost || !gameCode || !game || game.status !== 'active' || !game.roundStartTime) return;

    const scenario = game.scenarios?.[game.currentRound - 1];
    if (scenario?.type !== 'multiple_choice' || !scenario.mcQuestions?.length) return;

    const { phase, questionIndex } = mcTimeline({
      roundStartMs: game.roundStartTime.toMillis(),
      nowMs: Date.now(),
      gateSeconds: mcGateSeconds(scenario.media),
      questions: scenario.mcQuestions,
      allAnsweredAtMs: game.mcAllAnsweredAt?.toMillis() ?? null,
    });

    // El conteo viene de la subcoleccion `answers`, NO de submissions: una
    // submission se escribe recien en 'done', o sea siempre despues del instante
    // en que habria que cortar. Contar submissions dejaba el corte muerto.
    const players = game.players || {};
    const answered = (answeredByQuestion[questionIndex] || []).filter((id) => id in players);
    if (!shouldCutQuestion({
      phase,
      answeredCount: new Set(answered).size,
      playerCount: Object.keys(players).length,
      alreadyCut: Boolean(game.mcAllAnsweredAt),
    })) return;

    updateDoc(doc(db, 'games', gameCode), { mcAllAnsweredAt: Timestamp.now() })
      .catch((e) => console.error('mcAllAnsweredAt:', e));
  }, [isHost, gameCode, game?.status, game?.currentRound, game?.roundStartTime,
      game?.mcAllAnsweredAt, game?.scenarios, game?.players, answeredByQuestion]);

  // Close the round once the shared timeline says the block is done (host only).
  // Kept separate from the cut above: this one also fires for a player who never
  // answers at all, where the round timer is the only backstop.
  useEffect(() => {
    if (!isHost || !game || game.status !== 'active' || !game.roundStartTime) return;

    const scenario = game.scenarios?.[game.currentRound - 1];
    if (scenario?.type !== 'multiple_choice' || !scenario.mcQuestions?.length) return;

    const playerCount = Object.keys(game.players || {}).length;
    if (playerCount === 0 || submissions.length < playerCount) return;

    const check = () => {
      const { phase } = mcTimeline({
        roundStartMs: game.roundStartTime!.toMillis(),
        nowMs: Date.now(),
        gateSeconds: mcGateSeconds(scenario.media),
        questions: scenario.mcQuestions!,
        allAnsweredAtMs: game.mcAllAnsweredAt?.toMillis() ?? null,
      });
      if (phase === 'done') endRound();
    };

    check();
    const interval = setInterval(check, 500);
    return () => clearInterval(interval);
  }, [isHost, game?.status, game?.currentRound, game?.roundStartTime, game?.mcAllAnsweredAt,
      game?.scenarios, game?.players, submissions.length, endRound]);

  return {
    game,
    loading,
    error,
    isHost,
    currentPlayer,
    joinGame,
    startGame,
    submitAnswer,
    submitMCBlock,
    nextRound,
    endGame,
    recalibrateRound,
    submissions,
    roundResults,
    markAnswered,
  };
}
