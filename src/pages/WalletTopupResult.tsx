import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import { getRuntimeConfig, configManager } from '../lib/config';
import {
  clearPendingWalletTopup,
  getWalletTopupStatus,
  readPendingWalletTopup,
} from '../lib/walletCheckout';

type ResultState = 'loading' | 'success' | 'pending' | 'error';

export const WalletTopupResult = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState<ResultState>('loading');
  const [message, setMessage] = useState('Estamos verificando el estado de tu recarga.');
  const [balance, setBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState('UYU');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const sessionIdFromUrl = searchParams.get('checkout_session_id');
        const stored = readPendingWalletTopup();
        const checkoutSessionId = sessionIdFromUrl || stored?.checkout_session_id;

        if (!checkoutSessionId) {
          setState('error');
          setMessage('No se encontró la sesión de recarga. Por favor intenta nuevamente.');
          return;
        }

        await configManager.loadConfig();
        const { authAppId, authApiKey } = getRuntimeConfig();
        if (!authAppId || !authApiKey) {
          throw new Error('No se encontraron las credenciales de la aplicación.');
        }

        const result = await getWalletTopupStatus({
          applicationId: authAppId,
          apiKey: authApiKey,
          checkoutSessionId,
        });

        if (cancelled) return;

        clearPendingWalletTopup();

        const status = String(result.checkout_session?.status || '').toLowerCase();
        setBalance(result.wallet?.balance ?? null);
        setCurrency(result.wallet?.currency || 'UYU');

        if (status === 'completed') {
          setState('success');
          setMessage('Tu saldo fue acreditado correctamente.');
        } else if (status === 'failed' || status === 'cancelled') {
          setState('error');
          setMessage('No se pudo confirmar la recarga.');
        } else {
          setState('pending');
          setMessage('Tu pago está siendo procesado. Te notificaremos cuando se acredite el saldo.');
        }
      } catch (error) {
        if (cancelled) return;
        clearPendingWalletTopup();
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Error al verificar el estado del pago.');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const goToDashboard = () => navigate('/dashboard', { replace: true });

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="relative bg-white/[0.04] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent mb-8" />

          {state === 'loading' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Verificando recarga</h2>
              <p className="text-slate-400 text-sm">Estamos confirmando el estado de tu pago...</p>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Saldo acreditado</h2>
              {balance !== null && (
                <p className="text-slate-300 text-sm mb-1">
                  Saldo actual: <span className="font-semibold text-emerald-400">{currency} {balance.toLocaleString('es-UY')}</span>
                </p>
              )}
              <p className="text-slate-400 text-sm mb-8">{message}</p>
              <button
                onClick={goToDashboard}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25"
              >
                Ir al panel
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {state === 'pending' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-amber-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Pago en proceso</h2>
              <p className="text-slate-400 text-sm mb-8">{message}</p>
              <button
                onClick={goToDashboard}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-sm transition-all hover:shadow-lg hover:shadow-amber-500/25"
              >
                Ir al panel
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Recarga no confirmada</h2>
              <p className="text-slate-400 text-sm mb-8">{message}</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={goToDashboard}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm transition-all"
                >
                  Ir al panel
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="mailto:soporte@sendcraft.app"
                  className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
                >
                  Contactar soporte
                </a>
              </div>
            </>
          )}

          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent mt-8" />
        </div>
      </div>
    </div>
  );
};

export default WalletTopupResult;
