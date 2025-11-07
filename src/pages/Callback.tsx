import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Callback = () => {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) {
      console.log('Callback already processed, skipping...');
      return;
    }

    hasProcessed.current = true;

    let token = null;
    let code = null;
    let errorParam = null;

    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get('token');
      code = hashParams.get('code');
      errorParam = hashParams.get('error');
      console.log('=== USING HASH PARAMS ===');
    } else {
      const params = new URLSearchParams(window.location.search);
      token = params.get('token');
      code = params.get('code');
      errorParam = params.get('error');
      console.log('=== USING QUERY PARAMS ===');
    }

    console.log('=== CALLBACK DEBUG ===');
    console.log('Full URL:', window.location.href);
    console.log('Token present:', token ? 'YES' : 'NO');
    if (token) {
      console.log('Token length:', token.length);
      console.log('Token first 50 chars:', token.substring(0, 50));
      console.log('Token last 50 chars:', token.substring(token.length - 50));
      console.log('Token starts with eyJ:', token.startsWith('eyJ'));
      const tokenParts = token.split('.');
      console.log('Token parts:', tokenParts.length);
    }
    console.log('Code:', code ? 'present' : 'null');

    if (errorParam) {
      console.error('Error param received:', errorParam);
      setError('Error al autenticar. Por favor intenta de nuevo.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return;
    }

    const authToken = token || code;

    if (!authToken) {
      console.error('No auth token found in URL');
      console.log('Hash:', window.location.hash);
      console.log('Search:', window.location.search);
      setError('No se recibió código de autenticación.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return;
    }

    console.log('Auth token found, processing...');

    handleCallback(authToken)
      .then(() => {
        const storedUser = localStorage.getItem('user');
        const storedSubscription = localStorage.getItem('subscription');

        let redirectPath = '/';

        if (storedUser) {
          const user = JSON.parse(storedUser);
          console.log('=== DEBUG: USUARIO AUTENTICADO ===');
          console.log('Email:', user.email);
          console.log('Role:', user.role);
          console.log('Permisos completos:', JSON.stringify(user.permissions, null, 2));
          console.log('Menús disponibles:', Object.keys(user.permissions || {}));

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
            console.log(`🎯 Redirecting to first available menu: ${redirectPath}`);
          }
        }

        if (storedSubscription) {
          const subscription = JSON.parse(storedSubscription);
          console.log('=== DEBUG: SUSCRIPCIÓN ===');
          console.log('Status:', subscription.status);
          console.log('Plan:', subscription.plan_name);
          console.log('Trial End:', subscription.trial_end);
        } else {
          console.warn('No subscription found in localStorage');
        }

        navigate(redirectPath, { replace: true });
      })
      .catch((err) => {
        console.error('Error in callback:', err);
        setError('Error al procesar la autenticación.');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      });
  }, [handleCallback, navigate]);

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
