import { Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';

// Student Pages
import Home from './pages/student/Home';
import JoinGame from './pages/student/JoinGame';
import Lobby from './pages/student/Lobby';
import Round from './pages/student/Round';
import Results from './pages/student/Results';
import End from './pages/student/End';

// Professor Pages
import Dashboard from './pages/professor/Dashboard';
import CreateGame from './pages/professor/CreateGame';
import ClassReport from './pages/professor/ClassReport';
import RequestAccess from './pages/professor/RequestAccess';

// Dev/preview
import RevealPreview from './pages/RevealPreview';

// Auth context
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useProfessor } from './hooks/useProfessor';
import { canUsePlatform } from './lib/professorAccess';
import SoundToggle from './components/SoundToggle';

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
          <p className="text-white/70">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/preview-reveal" element={<RevealPreview />} />

      {/* Student routes (require auth) */}
      <Route
        path="/join"
        element={user ? <JoinGame /> : <Navigate to="/" replace />}
      />
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
        path="/professor/courses/:courseId/create"
        element={user ? <ProfessorGate><CreateGame /></ProfessorGate> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/report/:gameCode"
        element={user ? <ProfessorGate><ClassReport /></ProfessorGate> : <Navigate to="/" replace />}
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
