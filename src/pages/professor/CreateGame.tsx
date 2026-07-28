import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, BookOpen, Clock, Copy, Check } from 'lucide-react';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { QRCodeSVG } from 'qrcode.react';
import { currentJoinUrl } from '../../lib/joinUrl';
import {
  COURSES,
  SESSIONS,
  getCourse,
  getSessionsForCourse,
  type SessionOption,
} from '../../lib/courses';
import { fetchCourse, fetchReadySessions } from '../../lib/dynamicCourses';
import type { Course } from '../../lib/courses';

function generateGameCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function CreateGame() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId?: string }>();
  const [selectedSession, setSelectedSession] = useState<SessionOption | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createdGame, setCreatedGame] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const builtinCourse = courseId ? getCourse(courseId) : null;
  const [dynCourse, setDynCourse] = useState<Course | null>(null);
  const [dynSessions, setDynSessions] = useState<SessionOption[]>([]);
  const [dynLoading, setDynLoading] = useState(Boolean(courseId && !builtinCourse));

  useEffect(() => {
    if (!courseId || builtinCourse) return;
    Promise.all([fetchCourse(courseId), fetchReadySessions(courseId)])
      .then(([c, s]) => { setDynCourse(c); setDynSessions(s); })
      .catch((err) => console.error('Error loading dynamic course:', err))
      .finally(() => setDynLoading(false));
  }, [courseId, builtinCourse]);

  const course = builtinCourse ?? dynCourse;
  const sessionsForCourse = courseId
    ? (builtinCourse ? getSessionsForCourse(courseId) : dynSessions)
    : SESSIONS;

  const handleCreateGame = async () => {
    if (!selectedSession || !user) return;

    setIsCreating(true);

    try {
      const gameCode = generateGameCode();
      const gameRef = doc(db, 'games', gameCode);

      await setDoc(gameRef, {
        gameCode,
        courseId: selectedSession.courseId,
        sessionId: selectedSession.id,
        hostId: user.uid,
        hostName: user.displayName || user.email || 'Profesor',

        status: 'waiting',
        currentRound: 0,
        totalRounds: selectedSession.scenarios.length,
        roundDurationSeconds: selectedSession.config.roundDurationSeconds ?? selectedSession.duration * 60,

        sessionConfig: { ...selectedSession.config, rubric: selectedSession.rubric },
        scenarios: selectedSession.scenarios,
        knowledgeBase: selectedSession.knowledgeBase,

        players: {
          [user.uid]: {
            id: user.uid,
            name: user.displayName || user.email || 'Profesor',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            joinedAt: Timestamp.now(),
            isReady: false,
            totalScore: 0,
          }
        },
        playerCount: 1,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setCreatedGame({ code: gameCode });
    } catch (err) {
      console.error('Error creating game:', err);
      alert('Error al crear el juego. Intenta de nuevo.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCode = () => {
    if (createdGame) {
      navigator.clipboard.writeText(createdGame.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleGoToLobby = () => {
    if (createdGame) {
      navigate(`/game/${createdGame.code}/lobby`);
    }
  };

  // Game created successfully screen
  if (createdGame) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="dramatic-card p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-onaccent" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Juego Creado</h1>
          <p className="text-muted mb-6">
            Comparte este codigo con tus estudiantes
          </p>

          <div className="bg-surface-2 rounded-xl p-6 mb-6">
            <p className="text-5xl font-mono font-bold tracking-widest text-cyan-400 mb-4">
              {createdGame.code}
            </p>

            {/* El QR va tambien aca, no solo en el lobby: esta es la pantalla que dice
                "comparte este codigo", o sea el momento en que el profesor lo muestra. */}
            <div className="mb-4">
              <div className="inline-block bg-white rounded-xl p-3 border-2 border-line">
                <QRCodeSVG
                  value={currentJoinUrl(createdGame.code)}
                  size={160}
                  level="M"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p className="text-muted text-xs mt-2">
                o escanea para entrar desde el telefono
              </p>
            </div>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 mx-auto px-4 py-2 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar codigo</span>
                </>
              )}
            </button>
          </div>

          <button onClick={handleGoToLobby} className="primary-button w-full py-4 text-lg">
            Ir al Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  if (dynLoading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If a courseId was given but doesn't match any course, show error
  if (courseId && !course) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-ink-soft mb-4">Curso no encontrado: {courseId}</p>
          <Link to="/professor" className="text-cyan-400 hover:underline">
            Volver al panel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-main">
      {/* Header */}
      <header className="p-4">
        <Link
          to="/professor"
          className="flex items-center gap-2 text-ink-soft hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al panel
        </Link>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {course ? (
            <>
              <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-2">
                {course.name}
              </p>
              <h1 className="text-3xl font-bold mb-2">Crear Nuevo Juego</h1>
              <p className="text-muted mb-8">
                Selecciona una sesion de este curso
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold mb-2">Crear Nuevo Juego</h1>
              <p className="text-muted mb-8">
                Selecciona una sesion para comenzar
              </p>
            </>
          )}

          {/* Session Selection */}
          {course ? (
            // Course-scoped: just list sessions
            <div className="space-y-4 mb-8">
              {sessionsForCourse.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  selected={selectedSession?.id === session.id}
                  onSelect={() => setSelectedSession(session)}
                />
              ))}
            </div>
          ) : (
            // Fallback: no course in route, group by course
            <div className="space-y-8 mb-8">
              {COURSES.map((c) => {
                const list = getSessionsForCourse(c.id);
                if (list.length === 0) return null;
                return (
                  <div key={c.id}>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3 px-1">
                      {c.name}
                    </h2>
                    <div className="space-y-4">
                      {list.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          selected={selectedSession?.id === session.id}
                          onSelect={() => setSelectedSession(session)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Button */}
          <button
            onClick={handleCreateGame}
            disabled={!selectedSession || isCreating}
            className="primary-button w-full py-4 text-lg flex items-center justify-center gap-3"
          >
            {isCreating ? (
              <>
                <div className="w-5 h-5 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                Creando juego...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Crear Juego
              </>
            )}
          </button>
        </motion.div>
      </main>
    </div>
  );
}

function SessionCard({
  session,
  selected,
  onSelect,
}: {
  session: SessionOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`dramatic-card p-6 cursor-pointer transition-all ${
        selected ? 'ring-2 ring-cyan-400 bg-cyan-500/10' : 'hover:bg-surface-2'
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            selected ? 'bg-cyan-500' : 'bg-surface-2'
          }`}
        >
          <BookOpen className="w-6 h-6" />
        </div>

        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">{session.title}</h3>
          <p className="text-muted text-sm mb-3">{session.description}</p>

          <div className="flex gap-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              {session.rounds} rondas
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {session.duration} min/ronda
            </span>
          </div>
        </div>

        <div
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
            selected ? 'border-cyan-400 bg-cyan-400' : 'border-line'
          }`}
        >
          {selected && <Check className="w-4 h-4 text-black" />}
        </div>
      </div>
    </div>
  );
}
