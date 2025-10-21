import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastContainer } from './components/ToastContainer';
import { Landing } from './pages/Landing';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Templates } from './pages/Templates';
import { Statistics } from './pages/Statistics';
import { Settings } from './pages/Settings';
import Documentation from './pages/Documentation';

const Router = () => {
  const { isAuth, isLoading } = useAuth();
  const path = window.location.pathname;

  useEffect(() => {
    if (!isLoading && isAuth && path === '/') {
      window.location.href = '/dashboard';
    }
  }, [isAuth, isLoading, path]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  if (path === '/callback') {
    return <Callback />;
  }

  if (!isAuth) {
    return <Landing />;
  }

  switch (path) {
    case '/dashboard':
      return <Dashboard />;
    case '/templates':
      return <Templates />;
    case '/statistics':
      return <Statistics />;
    case '/documentation':
      return <Documentation />;
    case '/settings':
      return <Settings />;
    default:
      return <Dashboard />;
  }
};

function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <Router />
    </AuthProvider>
  );
}

export default App;
