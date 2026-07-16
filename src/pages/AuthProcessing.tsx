import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Seo } from '../components/Seo';
import { consumePendingWebAccessAttemptId, recordWebAccessAttempt } from '../lib/webAccessAnalytics';
import { getPostLoginRedirectPath } from '../lib/authNavigation';

export const AuthProcessing = () => {
  const { handleCallback, authProgress } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const processAuth = async () => {
      if (isProcessing) return;

      setIsProcessing(true);

      const authCallbackData = sessionStorage.getItem('authCallback');

      if (!authCallbackData) {
        void recordWebAccessAttempt({
          event_type: 'login_failed',
          attempt_id: consumePendingWebAccessAttemptId() || undefined,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          error_message: 'No se encontraron datos de autenticación.',
          metadata: {
            source: 'auth-processing.missing_data',
          },
        });
        setError('No se encontraron datos de autenticación.');
        setTimeout(() => navigate('/login', { replace: true }), 2000);
        return;
      }

      try {
        const { token, code, timestamp } = JSON.parse(authCallbackData);

        const age = Date.now() - timestamp;

        if (age > 60000) {
          void recordWebAccessAttempt({
            event_type: 'login_failed',
            attempt_id: consumePendingWebAccessAttemptId() || undefined,
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
            error_message: 'Los datos de autenticación han expirado.',
            metadata: {
              source: 'auth-processing.expired',
            },
          });
          setError('Los datos de autenticación han expirado.');
          sessionStorage.removeItem('authCallback');
          setTimeout(() => navigate('/login', { replace: true }), 2000);
          return;
        }

        const authToken = token || code;
        if (!authToken) {
          void recordWebAccessAttempt({
            event_type: 'login_failed',
            attempt_id: consumePendingWebAccessAttemptId() || undefined,
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
            error_message: 'Datos de autenticación inválidos.',
            metadata: {
              source: 'auth-processing.invalid_data',
            },
          });
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
          try {
            const user = JSON.parse(storedUser);
            redirectPath = getPostLoginRedirectPath(user);
          } catch {
            redirectPath = '/dashboard';
          }
        }

        navigate(redirectPath, { replace: true });
      } catch (err: any) {
        const pendingAttemptId = consumePendingWebAccessAttemptId();
        if (pendingAttemptId) {
          void recordWebAccessAttempt({
            event_type: 'login_failed',
            attempt_id: pendingAttemptId,
            path: typeof window !== 'undefined' ? window.location.pathname : undefined,
            error_message: err?.message || 'Error desconocido',
            metadata: {
              source: 'auth-processing.catch',
            },
          });
        }

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
        title="Procesando autenticación"
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
            <div className="text-white text-lg">
              {authProgress?.message || 'Procesando autenticación...'}
            </div>
            <div className="text-slate-400 text-sm mt-2 max-w-sm">
              {authProgress?.phase === 'provisioning_dedicated_api'
                ? 'Tu servidor dedicado está en camino. Esto puede tardar unos segundos.'
                : 'Cargando credenciales, sesión y permisos del usuario.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
