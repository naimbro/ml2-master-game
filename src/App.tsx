import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

// Student Pages
import Home from './pages/student/Home';
import JoinGame from './pages/student/JoinGame';
import Lobby from './pages/student/Lobby';
import Round from './pages/student/Round';
import Results from './pages/student/Results';
import End from './pages/student/End';
import CourseStandings from './pages/student/CourseStandings';

// Professor Pages
import Dashboard from './pages/professor/Dashboard';
import CreateGame from './pages/professor/CreateGame';
import ClassReport from './pages/professor/ClassReport';
import RequestAccess from './pages/professor/RequestAccess';
import AdminPanel from './pages/professor/AdminPanel';
import CourseForm from './pages/professor/CourseForm';
import CourseHome from './pages/professor/CourseHome';
import CourseJudges from './pages/professor/CourseJudges';
import CourseRanking from './pages/professor/CourseRanking';
import SessionBuilder from './pages/professor/SessionBuilder';
import SessionEditor from './pages/professor/SessionEditor';

// Dev/preview
import RevealPreview from './pages/RevealPreview';
import MCRepartoPreview from './pages/MCRepartoPreview';
import CompasPreview from './pages/CompasPreview';

// Compas — instrumento de posicionamiento, hermano del juego
import CompasSala from './pages/compas/CompasSala';
import CompasJugar from './pages/compas/CompasJugar';
import CrearCompas from './pages/professor/CrearCompas';
import CompasComparacion from './pages/compas/CompasComparacion';
import CompasCampos from './pages/compas/CompasCampos';

// Auth context
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useProfessor } from './hooks/useProfessor';
import { canUsePlatform } from './lib/professorAccess';
import SoundToggle from './components/SoundToggle';

/**
 * Manda a iniciar sesion SIN perder a donde iba.
 *
 * `<Navigate to="/">` a secas descartaba el destino, y en el telefono de un
 * alumno esa es la ruta normal y no la excepcion: nadie llega con la sesion
 * abierta. El que escaneaba el QR del compas caia en la portada sin el codigo,
 * sin explicacion, y sin forma de volver — el codigo solo estaba en el QR que
 * ya habia dejado de mirar.
 */
function ConSesion({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  if (user) return <>{children}</>;
  return <Navigate to={`/?destino=${encodeURIComponent(pathname + search)}`} replace />;
}

// Wraps professor routes: approved professors and the admin pass through;
// everyone else sees the access-request flow.
function ProfessorGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { access, loading } = useProfessor();

  if (!user) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!canUsePlatform(access)) return <RequestAccess access={access} />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-main flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink-soft">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/preview-reveal" element={<RevealPreview />} />
      <Route path="/preview-mc" element={<MCRepartoPreview />} />
      <Route path="/preview-compas" element={<CompasPreview />} />

      {/* Compas: el alumno entra por /compas/:code, el anfitrion proyecta /compas/:code/sala */}
      <Route path="/compas/:code" element={<ConSesion><CompasJugar /></ConSesion>} />
      <Route path="/compas/:code/sala" element={<ConSesion><CompasSala /></ConSesion>} />
      <Route path="/compas/:code/campos" element={<ConSesion><CompasCampos /></ConSesion>} />
      <Route
        path="/professor/compas/nuevo"
        element={user ? <CrearCompas /> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/compas/:courseId/comparacion"
        element={user ? <CompasComparacion /> : <Navigate to="/" replace />}
      />

      {/* Student routes (require auth) */}
      <Route path="/join" element={<ConSesion><JoinGame /></ConSesion>} />
      <Route
        path="/game/:gameCode/lobby"
        element={user ? <Lobby /> : <Navigate to="/" replace />}
      />
      <Route
        path="/game/:gameCode/round"
        element={user ? <Round /> : <Navigate to="/" replace />}
      />
      <Route
        path="/game/:gameCode/results"
        element={user ? <Results /> : <Navigate to="/" replace />}
      />
      <Route
        path="/game/:gameCode/end"
        element={user ? <End /> : <Navigate to="/" replace />}
      />
      <Route
        path="/curso/:courseId/tabla"
        element={user ? <CourseStandings /> : <Navigate to="/" replace />}
      />

      {/* Professor routes */}
      <Route
        path="/professor"
        element={user ? <ProfessorGate><Dashboard /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/create"
        element={user ? <ProfessorGate><CreateGame /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/new"
        element={user ? <ProfessorGate><CourseForm /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId"
        element={user ? <ProfessorGate><CourseHome /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/create"
        element={user ? <ProfessorGate><CreateGame /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/sessions/new"
        element={user ? <ProfessorGate><SessionBuilder /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/sessions/:sessionId/edit"
        element={user ? <ProfessorGate><SessionEditor /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/judges"
        element={user ? <ProfessorGate><CourseJudges /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/courses/:courseId/tabla"
        element={user ? <ProfessorGate><CourseRanking /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/report/:gameCode"
        element={user ? <ProfessorGate><ClassReport /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/admin"
        element={user ? <ProfessorGate><AdminPanel /></ProfessorGate> : <Navigate to="/" replace />}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <SoundToggle />
    </AuthProvider>
  );
}

export default App;
