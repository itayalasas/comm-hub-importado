import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Callback = () => {
  const { handleCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const errorParam = params.get('error');

    if (errorParam) {
      setError('Error al autenticar. Por favor intenta de nuevo.');
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      return;
    }

    if (!code) {
      setError('No se recibió código de autenticación.');
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
      return;
    }

    handleCallback(code)
      .then(() => {
        window.location.href = '/dashboard';
      })
      .catch((err) => {
        console.error('Error in callback:', err);
        setError('Error al procesar la autenticación.');
        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      });
  }, [handleCallback]);

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
