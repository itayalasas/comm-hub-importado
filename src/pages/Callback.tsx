import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const Callback = () => {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const code = params.get('code');
    const errorParam = params.get('error');

    console.log('=== CALLBACK DEBUG ===');
    console.log('Token:', token ? 'present' : 'null');
    console.log('Code:', code ? 'present' : 'null');
    console.log('All params:', Object.fromEntries(params.entries()));

    if (errorParam) {
      setError('Error al autenticar. Por favor intenta de nuevo.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return;
    }

    const authToken = token || code;

    if (!authToken) {
      setError('No se recibió código de autenticación.');
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 3000);
      return;
    }

    handleCallback(authToken)
      .then(() => {
        const storedUser = localStorage.getItem('user');
        const storedSubscription = localStorage.getItem('subscription');

        if (storedUser) {
          const user = JSON.parse(storedUser);
          console.log('=== DEBUG: USUARIO AUTENTICADO ===');
          console.log('Email:', user.email);
          console.log('Role:', user.role);
          console.log('Permisos completos:', JSON.stringify(user.permissions, null, 2));
          console.log('Menús disponibles:', Object.keys(user.permissions || {}));
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

        navigate('/dashboard', { replace: true });
      })
      .catch((err) => {
        console.error('Error in callback:', err);
        setError('Error al procesar la autenticación.');
        setTimeout(() => {
          navigate('/login', { replace: true });
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
