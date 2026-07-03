import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Seo } from '../components/Seo';
import { consumePendingWebAccessAttemptId, recordWebAccessAttempt } from '../lib/webAccessAnalytics';
import { getPostLoginRedirectPath } from '../lib/authNavigation';

export const Callback = () => {
  const { handleCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current || processing) return;

    hasProcessed.current = true;
    setProcessing(true);

    const safetyTimeout = setTimeout(() => {
      setError('El proceso de autenticación tomó demasiado tiempo. Por favor intenta de nuevo.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    }, 30000);

    let token = null;
    let code = null;
    let errorParam = null;

    if (window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      token = hashParams.get('token');
      code = hashParams.get('code');
      errorParam = hashParams.get('error');
    }

    if (!token && !code && !errorParam && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      token = params.get('token');
      code = params.get('code');
      errorParam = params.get('error');
    }

    if (errorParam) {
      clearTimeout(safetyTimeout);
      void recordWebAccessAttempt({
        event_type: 'login_failed',
        attempt_id: consumePendingWebAccessAttemptId() || undefined,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        error_message: errorParam,
        metadata: {
          source: 'callback.error_param',
        },
      });
      setError('Error al autenticar. Por favor intenta de nuevo.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      return;
    }

    const authToken = token || code;

    if (!authToken) {
      clearTimeout(safetyTimeout);
      void recordWebAccessAttempt({
        event_type: 'login_failed',
        attempt_id: consumePendingWebAccessAttemptId() || undefined,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        error_message: 'No se recibió código de autenticación.',
        metadata: {
          source: 'callback.missing_token',
        },
      });
      setError('No se recibió código de autenticación.');
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
      return;
    }

    handleCallback(authToken)
      .then(() => {
        clearTimeout(safetyTimeout);

        const storedUser = localStorage.getItem('user');
        let redirectPath = '/dashboard';

        if (storedUser) {
          try {
            const user = JSON.parse(storedUser);
            redirectPath = getPostLoginRedirectPath(user);
          } catch {
            redirectPath = '/dashboard';
          }
        }

        navigate(redirectPath, { replace: true });
      })
      .catch((err) => {
        clearTimeout(safetyTimeout);
        setError('Error al procesar la autenticación: ' + (err.message || 'Error desconocido'));
        setProcessing(false);
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      })
      .finally(() => {
        // no-op
      });
  }, [handleCallback, navigate, processing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <Seo
        title="Callback de autenticación"
        description="Procesando callback de autenticación de SendCraft."
        path="/callback"
        canonicalUrl="https://sendcraft.net/callback"
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
