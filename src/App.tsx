import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/ToastContainer';
import { Home } from './pages/Home';
import { getDefaultAuthenticatedPath } from './lib/authNavigation';

const Landing = lazy(() => import('./pages/Landing'));
const Callback = lazy(() => import('./pages/Callback').then((module) => ({ default: module.Callback })));
const AuthProcessing = lazy(() =>
  import('./pages/AuthProcessing').then((module) => ({ default: module.AuthProcessing }))
);
const SubscriptionResult = lazy(() => import('./pages/SubscriptionResult'));
const WalletTopupResult = lazy(() => import('./pages/WalletTopupResult'));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Templates = lazy(() => import('./pages/Templates').then((module) => ({ default: module.Templates })));
const Statistics = lazy(() => import('./pages/Statistics').then((module) => ({ default: module.Statistics })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const Terms = lazy(() => import('./pages/Terms').then((module) => ({ default: module.Terms })));
const Privacy = lazy(() => import('./pages/Privacy').then((module) => ({ default: module.Privacy })));
const Documentation = lazy(() => import('./pages/Documentation'));
const ApiExplorer = lazy(() => import('./pages/ApiExplorer'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const MarketplaceEmbed = lazy(() => import('./pages/MarketplaceEmbed'));
const AutomatizacionesProgramados = lazy(() => import('./pages/AutomatizacionesProgramados'));
const AutomatizacionesBatch = lazy(() => import('./pages/AutomatizacionesBatch'));
const AutomatizacionesMonitoreo = lazy(() => import('./pages/AutomatizacionesMonitoreo'));
const WhatsApp = lazy(() => import('./pages/WhatsApp').then((module) => ({ default: module.WhatsApp })));
const WhatsAppTemplates = lazy(() =>
  import('./pages/WhatsAppTemplates').then((module) => ({ default: module.WhatsAppTemplates }))
);
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard }))
);

const AppLoader = () => {
  const { authProgress } = useAuth();

  return (
    <div className="min-h-screen bg-[#020c1b] flex flex-col items-center justify-center gap-8 px-6">
    <div className="relative">
      {/* Outer ring */}
      <div className="w-20 h-20 rounded-2xl border border-cyan-500/20 absolute inset-0 animate-ping opacity-20" />
      {/* Icon container */}
      <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30">
        <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
          <rect x="5" y="8" width="22" height="16" rx="3" stroke="white" strokeWidth="2"/>
          <path d="M6 11L16 18.5L26 11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M21.7 3.5L22.5 5.3L24.3 6.1L22.5 6.9L21.7 8.7L20.9 6.9L19.1 6.1L20.9 5.3L21.7 3.5Z" fill="#BAE6FD"/>
        </svg>
      </div>
    </div>
    <div className="text-center max-w-md">
      <p className="text-white text-lg font-semibold">
        {authProgress?.message || 'Preparando tu acceso...'}
      </p>
        <p className="text-slate-500 text-sm mt-2">
          {authProgress?.phase === 'provisioning_dedicated_api'
            ? 'Estamos levantando tu servidor dedicado de APIs y ajustando la URL base.'
          : 'Cargando configuraci\u00f3n, sesi\u00f3n y permisos del tenant.'}
        </p>
      </div>
    {/* Loading bar */}
    <div className="w-56 h-0.5 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-[loading_1.4s_ease-in-out_infinite]" style={{width: '40%'}} />
    </div>
    <p className="text-slate-500 text-xs tracking-[0.35em] uppercase">SendCraft</p>
    <style>{`
      @keyframes loading {
        0%   { transform: translateX(-200%); }
        100% { transform: translateX(400%); }
      }
    `}</style>
  </div>
);
};

const ProtectedRoute = ({
  children,
  requiredMenu,
  requireSystemAdmin = false,
}: {
  children: ReactNode;
  requiredMenu?: string;
  requireSystemAdmin?: boolean;
}) => {
  const { isAuth, isLoading, hasMenuAccess, logout, isSystemAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <AppLoader />;
  }

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if ((requireSystemAdmin && !isSystemAdmin) || (requiredMenu && !hasMenuAccess(requiredMenu))) {
    const userFromStorage = (window as any).localStorage.getItem('user');
    const userObj = userFromStorage ? JSON.parse(userFromStorage) : null;
    const adminOnlyMessage = requireSystemAdmin && !isSystemAdmin;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-white text-center max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p className="text-slate-400 mb-4">
            {adminOnlyMessage ? (
              'Este panel es exclusivo para la cuenta administradora.'
            ) : (
              <>
                No tienes permisos para acceder a la secci{'\u00f3'}n: <strong className="text-cyan-400">{requiredMenu}</strong>
              </>
            )}
          </p>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 text-left">
            <p className="text-sm text-slate-400 mb-2">Usuario:</p>
            <p className="text-white text-sm mb-3">{userObj?.email || 'No disponible'}</p>

            <p className="text-sm text-slate-400 mb-2">Rol:</p>
            <p className="text-white text-sm mb-3">{userObj?.role || 'No disponible'}</p>

            <p className="text-sm text-slate-400 mb-2">Permisos disponibles:</p>
            <pre className="text-xs text-slate-300 overflow-auto max-h-60 bg-slate-900/50 p-3 rounded">
              {JSON.stringify(userObj?.permissions || {}, null, 2)}
            </pre>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                const availableMenus = Object.keys(userObj?.permissions || {});
                if (availableMenus.length > 0) {
                  window.location.href = `/${availableMenus[0]}`;
                } else {
                  logout();
                }
              }}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 rounded-lg transition-colors"
            >
              Ir a mis secciones
            </button>
            <button
              onClick={logout}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
            >
              Cerrar sesi{'\u00f3'}n
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { isAuth, isLoading, hasMenuAccess, isSystemAdmin } = useAuth();

  if (isLoading) {
    return <AppLoader />;
  }

  if (isAuth) {
    return <Navigate to={getDefaultAuthenticatedPath(hasMenuAccess, isSystemAdmin)} replace />;
  }

  return <>{children}</>;
};

const DashboardRedirect = () => {
  const { isAuth, isLoading, hasMenuAccess, isSystemAdmin } = useAuth();

  if (isLoading) {
    return <AppLoader />;
  }

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={getDefaultAuthenticatedPath(hasMenuAccess, isSystemAdmin)} replace />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <PublicRoute>
            <Home />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Landing />
          </PublicRoute>
        }
      />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/app" element={<DashboardRedirect />} />
      <Route
        path="/automatizaciones"
        element={<Navigate to="/automatizaciones/programados" replace />}
      />
      <Route path="/callback" element={<Callback />} />
      <Route path="/auth-processing" element={<AuthProcessing />} />
      <Route path="/subscription/result" element={<SubscriptionResult />} />
      <Route path="/wallet/result" element={<WalletTopupResult />} />
      <Route path="/embed/marketplace" element={<MarketplaceEmbed />} />
      <Route path="/docs" element={<Documentation publicView />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredMenu="dashboard">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute requireSystemAdmin>
            <AdminDashboard />
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
        path="/automatizaciones/programados"
        element={
          <ProtectedRoute requiredMenu="automatizaciones">
            <AutomatizacionesProgramados />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automatizaciones/en-lote"
        element={
          <ProtectedRoute requiredMenu="automatizaciones">
            <AutomatizacionesBatch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automatizaciones/monitoreo"
        element={
          <ProtectedRoute requiredMenu="automatizaciones">
            <AutomatizacionesMonitoreo />
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
            <Settings tab="apps" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/apps"
        element={
          <ProtectedRoute requiredMenu="settings">
            <Settings tab="apps" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/email"
        element={
          <ProtectedRoute requiredMenu="settings">
            <Settings tab="email" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/embed"
        element={
          <ProtectedRoute requiredMenu="settings">
            <Settings tab="embed" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/api-explorer"
        element={
          <ProtectedRoute requiredMenu="documentation">
            <ApiExplorer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketplace"
        element={
          <ProtectedRoute requiredMenu="marketplace">
            <Marketplace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/whatsapp"
        element={
          <ProtectedRoute requiredMenu="statistics">
            <WhatsApp />
          </ProtectedRoute>
        }
      />
      <Route
        path="/templates/whatsapp"
        element={
          <ProtectedRoute requiredMenu="templates">
            <WhatsAppTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={
          <PublicRoute>
            <Navigate to="/" replace />
          </PublicRoute>
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
          <Suspense fallback={<AppLoader />}>
            <AppRoutes />
          </Suspense>
        </ToastContainer>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
