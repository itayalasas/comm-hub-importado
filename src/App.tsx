import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/ToastContainer';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Templates } from './pages/Templates';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import Documentation from './pages/Documentation';


const ProtectedRoute = ({ children, requiredMenu }: { children: React.ReactNode; requiredMenu?: string }) => {
  const { isAuth, isLoading, hasMenuAccess } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredMenu && !hasMenuAccess(requiredMenu)) {
    console.error(`🚫 ACCESO DENEGADO - Menu: ${requiredMenu}`);

    const userFromStorage = (window as any).localStorage.getItem('user');
    const userObj = userFromStorage ? JSON.parse(userFromStorage) : null;

    console.log('📦 User from localStorage:', userObj);
    console.log('🔐 Permissions from localStorage:', userObj?.permissions);

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p className="text-slate-400 mb-4">
            No tienes permisos para acceder a la sección: <strong className="text-cyan-400">{requiredMenu}</strong>
          </p>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-slate-400 mb-2">📧 Usuario:</p>
            <p className="text-white text-sm mb-3">{userObj?.email || 'No disponible'}</p>

            <p className="text-sm text-slate-400 mb-2">👤 Rol:</p>
            <p className="text-white text-sm mb-3">{userObj?.role || 'No disponible'}</p>

            <p className="text-sm text-slate-400 mb-2">🔐 Permisos disponibles:</p>
            <pre className="text-xs text-slate-300 overflow-auto max-h-60 bg-slate-900/50 p-3 rounded">
              {JSON.stringify(userObj?.permissions || {}, null, 2)}
            </pre>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-6 text-left">
            <p className="text-xs text-yellow-300">
              💡 <strong>Debug:</strong> Revisa la consola del navegador para ver más detalles sobre la validación de permisos.
            </p>
          </div>

          <button
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const HomeRedirect = () => {
  const { isAuth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  return isAuth ? <Navigate to="/dashboard" replace /> : <Home />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredMenu="dashboard">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates"
        element={
          <ProtectedRoute requiredMenu="templates">
            <Templates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/statistics"
        element={
          <ProtectedRoute requiredMenu="statistics">
            <Statistics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/documentation"
        element={
          <ProtectedRoute requiredMenu="documentation">
            <Documentation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredMenu="settings">
            <Settings />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer>
          <AppRoutes />
        </ToastContainer>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
