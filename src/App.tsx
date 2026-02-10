import { Routes, Route, Navigate } from 'react-router-dom';

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

// Auth context
import { AuthProvider, useAuth } from './hooks/useAuth';

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
        element={user ? <Dashboard /> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/create"
        element={user ? <CreateGame /> : <Navigate to="/" replace />}
      />
      <Route
        path="/professor/report/:gameCode"
        element={user ? <ClassReport /> : <Navigate to="/" replace />}
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
    </AuthProvider>
  );
}

export default App;
