import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/ToastContainer';
import { Landing } from './pages/Landing';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Templates } from './pages/Templates';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import Documentation from './pages/Documentation';

const ROUTE_TO_PERMISSION_MAP: Record<string, string> = {
  'dashboard': 'dashboard',
  'templates': 'templates',
  'statistics': 'estadisticas',
  'documentation': 'documentacion',
  'settings': 'configuracion',
};

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
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requiredMenu) {
    const permissionKey = ROUTE_TO_PERMISSION_MAP[requiredMenu] || requiredMenu;
    console.log('=== PROTECTED ROUTE CHECK ===');
    console.log('Required Menu (route):', requiredMenu);
    console.log('Permission Key (mapped):', permissionKey);

    if (!hasMenuAccess(permissionKey)) {
      console.log('ACCESS DENIED for', permissionKey);
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-white text-center">
            <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
            <p className="text-slate-400">No tienes permisos para acceder a esta sección</p>
            <p className="text-xs text-slate-500 mt-2">Ruta: {requiredMenu} → Permiso: {permissionKey}</p>
            <button
              onClick={() => window.history.back()}
              className="mt-6 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
            >
              Volver
            </button>
          </div>
        </div>
      );
    }
    console.log('ACCESS GRANTED for', permissionKey);
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

  return isAuth ? <Navigate to="/dashboard" replace /> : <Landing />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
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
