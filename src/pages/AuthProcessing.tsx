import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const AuthProcessing = () => {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processAuth = async () => {
      if (isProcessing) {
        console.log('Already processing auth, skipping...');
        return;
      }

      setIsProcessing(true);
      console.log('=== AUTH PROCESSING PAGE LOADED ===');

      const authCallbackData = sessionStorage.getItem('authCallback');
      console.log('Auth callback data from sessionStorage:', authCallbackData);

      if (!authCallbackData) {
        console.error('No auth callback data found in sessionStorage');
        setError('No se encontraron datos de autenticación.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        const { token, code, timestamp } = JSON.parse(authCallbackData);
        console.log('Parsed auth data:', { token: token ? 'YES' : 'NO', code: code ? 'YES' : 'NO', timestamp });

        const age = Date.now() - timestamp;
        console.log('Auth data age (ms):', age);

        if (age > 60000) {
          console.error('Auth data is too old (>60s)');
          setError('Los datos de autenticación han expirado.');
          sessionStorage.removeItem('authCallback');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        const authToken = token || code;
        if (!authToken) {
          console.error('No token or code in auth data');
          setError('Datos de autenticación inválidos.');
          sessionStorage.removeItem('authCallback');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        console.log('Processing auth token...');
        await handleCallback(authToken);

        sessionStorage.removeItem('authCallback');
        console.log('=== AUTH SUCCESSFUL ===');

        const storedUser = localStorage.getItem('user');
        let redirectPath = '/dashboard';

        if (storedUser) {
          const user = JSON.parse(storedUser);
          console.log('User:', user.email, 'Role:', user.role);

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
            console.log('Redirecting to:', redirectPath);
          }
        }

        navigate(redirectPath, { replace: true });
      } catch (err: any) {
        console.error('=== AUTH PROCESSING ERROR ===');
        console.error('Error:', err);
        setError('Error al procesar la autenticación: ' + (err.message || 'Error desconocido'));
        sessionStorage.removeItem('authCallback');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    processAuth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
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
