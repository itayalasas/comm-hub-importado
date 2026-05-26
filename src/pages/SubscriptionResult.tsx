import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../hooks/usePlans';
import { getRuntimeConfig } from '../lib/config';
import {
  clearPendingSubscriptionCheckout,
  getManagedCheckoutStatus,
  readPendingSubscriptionCheckout,
} from '../lib/subscriptionCheckout';

type ViewState = 'loading' | 'success' | 'pending' | 'error';

interface CheckoutResultView {
  subscription: any | null;
  hasAccess: boolean | null;
  message: string;
}

function isTrialStillActive(subscription: any | null): boolean {
  if (!subscription || subscription.status !== 'trialing' || !subscription.trial_end) {
    return false;
  }

  const trialEndDate = new Date(subscription.trial_end);
  return !Number.isNaN(trialEndDate.getTime()) && trialEndDate > new Date();
}

function isSubscriptionActive(subscription: any | null, checkoutSession: any | null): boolean {
  const subscriptionStatus = String(subscription?.status ?? '').toLowerCase();
  const checkoutStatus = String(checkoutSession?.status ?? '').toLowerCase();
  const providerStatus = String(checkoutSession?.provider_status ?? '').toLowerCase();

  return (
    subscriptionStatus === 'active' ||
    checkoutStatus === 'completed' ||
    providerStatus === 'active'
  );
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString('es-UY', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const SubscriptionResult = () => {
  const location = useLocation();
  const { applyCheckoutStatus } = useAuth();
  const { plans, checkout } = usePlans();
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckoutResultView>({
    subscription: null,
    hasAccess: null,
    message: 'Estamos verificando el estado de tu suscripcion.',
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryPlanId = queryParams.get('plan_id');
  const querySubscriptionState = queryParams.get('subscription_state');
  const queryProviderSubscriptionId = queryParams.get('provider_subscription_id');
  const planFromCatalog = queryPlanId
    ? plans.find((plan) => plan.id === queryPlanId) ?? null
    : null;
  const isLoading = viewState === 'loading';
  const trialActive = isTrialStillActive(result.subscription);
  const currentPlanName =
    result.subscription?.plan_name ||
    result.subscription?.name ||
    planFromCatalog?.name ||
    'Plan actual';
  const subscriptionApplied =
    viewState === 'success' &&
    !trialActive &&
    (result.hasAccess === true || result.subscription?.status === 'active');

  const statusLabel = trialActive
    ? 'En prueba'
    : subscriptionApplied
    ? 'Actualizado'
    : viewState === 'pending'
    ? 'En proceso'
    : viewState === 'error'
    ? 'Error'
    : 'Verificando';

  const statusClass = trialActive
    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
    : subscriptionApplied
    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20'
    : viewState === 'pending'
    ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20'
    : 'bg-slate-700/50 text-slate-300 border border-slate-600/50';

  const accessLabel =
    result.hasAccess === true
      ? 'Acceso disponible'
      : result.hasAccess === false
      ? 'Acceso pendiente'
      : 'Acceso desconocido';

  const accessDescription =
    result.hasAccess === true
      ? 'Puedes seguir entrando al panel.'
      : result.hasAccess === false
      ? 'Estamos terminando de sincronizarlo.'
      : 'Aun no pudimos confirmar el acceso.';
  const displayMessage = isLoading
    ? 'Estamos verificando el estado de tu suscripcion.'
    : result.message;

  useEffect(() => {
    let cancelled = false;

    const loadCheckoutStatus = async () => {
      setViewState('loading');
      setError(null);
      setResult({
        subscription: null,
        hasAccess: null,
        message: 'Estamos verificando el estado de tu suscripcion.',
      });

      try {
        const { authAppId, authApiKey } = getRuntimeConfig();
        if (!authAppId || !authApiKey) {
          throw new Error('No se encontraron las credenciales de la aplicacion');
        }

        const stored = readPendingSubscriptionCheckout();
        const externalReference = queryParams.get('external_reference');
        const externalReferenceCheckoutSessionId =
          externalReference?.startsWith('checkout:')
            ? externalReference.slice('checkout:'.length)
            : null;
        const checkoutSessionId =
          queryParams.get('checkout_session_id') ||
          externalReferenceCheckoutSessionId ||
          stored?.checkout_session_id ||
          null;

        if (!checkoutSessionId) {
          throw new Error('No se encontro checkout_session_id para consultar el estado.');
        }

        const status = await getManagedCheckoutStatus({
          applicationId: authAppId,
          apiKey: authApiKey,
          checkoutSessionId,
          endpoint: checkout?.status_endpoint,
        });

        if (cancelled) return;

        console.log('[subscription-result] checkout status response', {
          checkoutSessionId,
          status,
        });

        const rawSubscription = status.subscription ?? status.data?.subscription ?? null;
        const rawCheckoutSession =
          status.checkout_session ??
          status.data?.checkout_session ??
          null;
        const availablePlans = status.available_plans ?? status.data?.available_plans ?? [];
        const hasAccess =
          typeof status.has_access === 'boolean'
            ? status.has_access
            : typeof status.data?.has_access === 'boolean'
            ? status.data.has_access
            : null;
        const derivedAccess = isSubscriptionActive(rawSubscription, rawCheckoutSession);
        const effectiveHasAccess =
          derivedAccess ? true : hasAccess === true ? true : hasAccess === false ? false : null;
        const resolvedPlan =
          planFromCatalog ||
          (Array.isArray(availablePlans)
            ? availablePlans.find((plan: any) => plan?.id === queryPlanId) ?? null
            : null);
        const resolvedSubscriptionId =
          rawSubscription?.id ??
          rawSubscription?.subscription_id ??
          rawCheckoutSession?.subscription_id ??
          rawCheckoutSession?.id ??
          queryProviderSubscriptionId ??
          checkoutSessionId;
        const resolvedStatus =
          querySubscriptionState ||
          rawSubscription?.status ||
          rawSubscription?.subscription_state ||
          rawCheckoutSession?.provider_status ||
          rawCheckoutSession?.status ||
          'active';
        const resolvedSubscription = {
          ...(rawSubscription ?? {}),
          id: resolvedSubscriptionId,
          status: resolvedStatus,
          plan_id: queryPlanId || rawSubscription?.plan_id || resolvedPlan?.id || undefined,
          plan_name: resolvedPlan?.name || rawSubscription?.plan_name || rawSubscription?.name || queryPlanId || 'Plan',
          plan_price: typeof resolvedPlan?.price === 'number'
            ? resolvedPlan.price
            : typeof rawSubscription?.plan_price === 'number'
            ? rawSubscription.plan_price
            : 0,
          plan_currency: resolvedPlan?.currency || rawSubscription?.plan_currency || 'USD',
          mp_preapproval_id: queryProviderSubscriptionId || rawSubscription?.mp_preapproval_id || undefined,
        };

        applyCheckoutStatus({
          subscription: resolvedSubscription,
          available_plans: Array.isArray(availablePlans) ? availablePlans : [],
          has_access: effectiveHasAccess,
        });

        clearPendingSubscriptionCheckout();

        const trialActiveResponse = isTrialStillActive(resolvedSubscription);
        const message = trialActiveResponse
          ? `Tu plan actual sigue en prueba hasta el ${formatDate(resolvedSubscription?.trial_end)}.`
          : effectiveHasAccess === false
          ? 'El pago llego y estamos terminando de sincronizar tu acceso.'
          : 'Tu suscripcion quedo activa.';

        setResult({
          subscription: resolvedSubscription,
          hasAccess: effectiveHasAccess,
          message,
        });

        if (trialActiveResponse || effectiveHasAccess === false) {
          setViewState('pending');
        } else {
          setViewState('success');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'No se pudo consultar el checkout.');
        setViewState('error');
      }
    };

    loadCheckoutStatus();

    return () => {
      cancelled = true;
    };
  }, [checkout?.status_endpoint, plans, queryParams, refreshKey]);

  const handleRetry = () => {
    setRefreshKey((current) => current + 1);
  };

  const subtitle =
    isLoading
      ? 'Estamos verificando el estado de tu suscripcion.'
      : trialActive
      ? `Tu plan actual sigue siendo ${currentPlanName} mientras dure la prueba.`
      : subscriptionApplied
      ? 'Tu suscripcion quedo activa. Puedes seguir usando SendCraft.'
      : viewState === 'pending'
      ? 'El pago llego y estamos sincronizando tu acceso.'
      : viewState === 'error'
      ? 'Hubo un problema al sincronizar la suscripcion.'
      : 'Estamos verificando el estado de tu suscripcion.';

  return (
    <div className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[420px] h-[420px] bg-cyan-500/10 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[420px] h-[420px] bg-blue-500/10 blur-[140px]" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="p-8 sm:p-10">
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                viewState === 'error'
                  ? 'bg-red-500/15 border border-red-500/20'
                  : viewState === 'pending'
                  ? 'bg-amber-500/15 border border-amber-500/20'
                  : 'bg-emerald-500/15 border border-emerald-500/20'
              }`}
            >
              {viewState === 'loading' ? (
                <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
              ) : viewState === 'error' ? (
                <AlertTriangle className="w-6 h-6 text-red-400" />
              ) : viewState === 'pending' ? (
                <RefreshCw className="w-6 h-6 text-amber-400" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Estado de suscripcion</h1>
              <p className="text-sm text-slate-400">{subtitle}</p>
            </div>
          </div>

          {error ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
                {error}
              </div>
              <button
                onClick={handleRetry}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-white hover:bg-cyan-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-[#071225] p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resumen</span>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusClass}`}>{statusLabel}</span>
                </div>

                <div
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    isLoading
                      ? 'border-white/10 bg-white/5 text-slate-200'
                      : trialActive
                      ? 'border-amber-500/20 bg-amber-500/10 text-amber-100'
                      : subscriptionApplied
                      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100'
                      : viewState === 'pending'
                      ? 'border-blue-500/20 bg-blue-500/10 text-blue-100'
                      : 'border-white/10 bg-white/5 text-slate-200'
                  }`}
                >
                  {displayMessage}
                </div>

                {isLoading ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-slate-400 text-sm">
                      Todavia no tenemos la confirmacion final. Espera un momento mientras sincronizamos la
                      suscripcion.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                      <p className="text-slate-500 text-xs mb-1">Plan actual</p>
                      <p className="text-white font-medium">{currentPlanName}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {trialActive
                          ? `Sigue vigente hasta el ${formatDate(result.subscription?.trial_end)}.`
                          : 'Ya quedo aplicado a tu cuenta.'}
                      </p>
                    </div>

                    <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4">
                      <p className="text-slate-500 text-xs mb-1">Acceso</p>
                      <p className="text-white font-medium">{accessLabel}</p>
                      <p className="text-slate-400 text-sm mt-1">{accessDescription}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {viewState === 'success' && (
                  <button
                    onClick={() => window.location.replace('/dashboard')}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-white hover:bg-cyan-400 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Ir al panel
                  </button>
                )}
                {(viewState === 'pending' || viewState === 'error') && (
                  <button
                    onClick={handleRetry}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-slate-200 hover:bg-white/[0.06] transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {viewState === 'pending' ? 'Consultar de nuevo' : 'Reintentar'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
