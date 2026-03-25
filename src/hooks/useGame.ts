import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, updateDoc, collection, query, where, addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../lib/firebase';
import type { Game, Player, Submission, RoundResults, GameStatus, MCResponse } from '../types/game';
import { useAuth } from './useAuth';

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
        updatedAt: serverTimestamp(),
      });

      setRoundResults(null);
    }
  }, [gameCode, isHost, game]);

  const endGame = useCallback(async () => {
    if (!gameCode || !isHost) return;

    const gameRef = doc(db, 'games', gameCode);
    await updateDoc(gameRef, {
      status: 'finished' as GameStatus,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }, [gameCode, isHost]);

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
    submissions,
    roundResults,
  };
}
