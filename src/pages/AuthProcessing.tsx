import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Seo } from '../components/Seo';

export const AuthProcessing = () => {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processAuth = async () => {
      if (isProcessing) return;

      setIsProcessing(true);

      const authCallbackData = sessionStorage.getItem('authCallback');

      if (!authCallbackData) {
        setError('No se encontraron datos de autenticación.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        const { token, code, timestamp } = JSON.parse(authCallbackData);

        const age = Date.now() - timestamp;

        if (age > 60000) {
          setError('Los datos de autenticación han expirado.');
          sessionStorage.removeItem('authCallback');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        const authToken = token || code;
        if (!authToken) {
          setError('Datos de autenticación inválidos.');
          sessionStorage.removeItem('authCallback');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        await handleCallback(authToken);

        sessionStorage.removeItem('authCallback');

        const storedUser = localStorage.getItem('user');
        let redirectPath = '/dashboard';

        if (storedUser) {
          const user = JSON.parse(storedUser);
          const availableMenus = Object.keys(user.permissions || {});
          if (availableMenus.length > 0) {
            const menuMapping: Record<string, string> = {
              'analytics': 'dashboard',
              'inicio': 'dashboard',
              'plantillas': 'templates',
              'estadisticas': 'statistics',
              'stats': 'statistics',
              'documentacion': 'documentation',
              'docs': 'documentation',
              'configuracion': 'settings',
              'config': 'settings',
            };

            const firstMenu = availableMenus[0];
            redirectPath = `/${menuMapping[firstMenu] || firstMenu}`;
          }
        }

        navigate(redirectPath, { replace: true });
      } catch (err: any) {
        setError('Error al procesar la autenticación: ' + (err.message || 'Error desconocido'));
        sessionStorage.removeItem('authCallback');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    processAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <Seo
        title="Procesando autenticacion"
        description="Procesando el acceso a SendCraft."
        path="/auth-processing"
        canonicalUrl="https://sendcraft.net/auth-processing"
        noIndex
      />
      <div className="text-center">
        {error ? (
          <div className="text-red-400 text-lg">{error}</div>
        ) : (
          <>
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-700 border-t-cyan-400 mb-4"></div>
            <div className="text-white text-lg">Procesando autenticación...</div>
          </>
        )}
      </div>
    </div>
  );
};
