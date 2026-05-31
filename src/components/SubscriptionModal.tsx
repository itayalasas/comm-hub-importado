import { createPortal } from 'react-dom';
import { X, CreditCard, Calendar, Check, Minus, Clock, AlertTriangle, Zap, Users, FileText, LayoutGrid, Mail, FileOutput, RefreshCw, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UpgradeModal } from './UpgradeModal';
import { usePlans } from '../hooks/usePlans';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
import { buildFunctionsUrl } from '../lib/config';
import { useState } from 'react';

interface SubscriptionModalProps {
  onClose: () => void;
}

const FEATURE_LABEL: Record<string, string> = {
  total_de_correos_mensuales: 'Emails mensuales',
  pdf_generations_monthly:    'PDFs mensuales',
  max_applications:           'Aplicaciones',
  max_users:                  'Máximo de usuarios',
  templates:                  'Templates',
  api_access:                 'Acceso API',
  two_factor_auth:            '2FA',
  priority_support:           'Soporte prioritario',
  advanced_reports:           'Reportes avanzados',
  custom_domain:              'Dominio personalizado',
};

const FEATURE_ICON: Record<string, React.ElementType> = {
  max_users:                  Users,
  templates:                  FileText,
  max_applications:           LayoutGrid,
  total_de_correos_mensuales: Mail,
  pdf_generations_monthly:    FileOutput,
};

const CANCEL_REASON_OPTIONS = [
  { value: 'price', label: 'El plan quedó caro' },
  { value: 'usage', label: 'Ya no lo estoy usando' },
  { value: 'alternative', label: 'Encontré otra solución' },
  { value: 'support', label: 'Tuve problemas con el servicio' },
  { value: 'temporary', label: 'Es solo temporal' },
  { value: 'other', label: 'Otra razón' },
] as const;

function formatNumber(value: string | number, unit?: string | null): string {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!isNaN(n)) {
    const formatted = n.toLocaleString('es-UY');
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return unit ? `${value} ${unit}` : String(value);
}

export const SubscriptionModal = ({ onClose }: SubscriptionModalProps) => {
  const { subscription, user, applyCheckoutStatus, subscriptionHasAccess } = useAuth();
  const { plans } = usePlans();
  const { applicationCount, templateCount, emailsThisMonth, pdfsThisMonth } = useSubscriptionLimits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelActiveUntil, setCancelActiveUntil] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [cancelReasonDetails, setCancelReasonDetails] = useState('');

  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';
  const activeUsersCount = user?.active_users_count ?? 0;

  const features = subscription?.entitlements?.features ?? [];
  const currentPlanById = plans.find((plan) => plan.id === subscription?.plan_id) ?? null;
  const currentPlanByName = plans.find((plan) => plan.name === subscription?.plan_name) ?? null;
  const currentPlan = currentPlanById ?? currentPlanByName;
  const normalizedStatus = String(subscription?.status ?? '').toLowerCase();
  const subscriptionPlanPrice =
    typeof subscription?.plan_price === 'number'
      ? subscription.plan_price
      : currentPlan?.price ?? null;
  const accessUntilSource =
    subscription?.current_period_end ||
    subscription?.period_end ||
    subscription?.next_payment_date ||
    subscription?.trial_end ||
    null;
  const isPaidSubscription =
    subscriptionHasAccess === true ||
    normalizedStatus === 'authorized' ||
    (normalizedStatus === 'active' && subscriptionPlanPrice === 0);
  const isTrialing = normalizedStatus === 'trialing';
  const planPrice = currentPlan?.price ?? (typeof subscription?.plan_price === 'number' ? subscription.plan_price : 0);
  const planCurrency = currentPlan?.currency || subscription?.plan_currency || 'UYU';
  const planName = currentPlan?.name || subscription?.plan_name || 'Plan actual';

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-UY', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const now = new Date();
  const trialExpired = isTrialing && trialEndDate !== null && trialEndDate < now;
  const trialActive  = isTrialing && trialEndDate !== null && trialEndDate >= now;
  const accessUntilDate = accessUntilSource ? new Date(accessUntilSource) : null;
  const accessWindowActive =
    accessUntilDate !== null &&
    !Number.isNaN(accessUntilDate.getTime()) &&
    accessUntilDate >= now;
  const isCancellationScheduled =
    normalizedStatus === 'cancelled' ||
    normalizedStatus === 'canceled';
  const isCancellationPending = isCancellationScheduled && accessWindowActive;
  const hasAccess = isPaidSubscription || accessWindowActive || trialActive;
  const isActive = (isPaidSubscription || accessWindowActive || trialActive) && !isTrialing;

  const daysRemaining = trialActive && trialEndDate
    ? Math.max(0, Math.floor((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const periodStart =
    subscription?.current_period_start ||
    subscription?.period_start ||
    subscription?.trial_start ||
    null;
  const periodEnd =
    subscription?.current_period_end ||
    subscription?.period_end ||
    subscription?.next_payment_date ||
    subscription?.trial_end ||
    null;
  const periodLabel = trialActive && trialEndDate
    ? `Prueba vigente hasta ${formatDate(subscription?.trial_end)}`
    : isCancellationPending && accessUntilSource
    ? `Cancelada, vigente hasta ${formatDate(accessUntilSource)}`
    : periodStart && periodEnd
    ? `${formatDate(periodStart)} - ${formatDate(periodEnd)}`
    : periodEnd
    ? `Vigente hasta ${formatDate(periodEnd)}`
    : hasAccess
    ? 'Se actualizará cuando el servidor confirme la suscripción.'
    : 'Se actualizará cuando termine la sincronización.';
  const isFreePlan = planPrice === 0 && !isTrialing;

  const canCancelSubscription = !!subscription?.id && normalizedStatus !== 'cancelled' && normalizedStatus !== 'canceled';
  const activeUntilLabel = cancelActiveUntil || periodEnd || subscription?.next_payment_date || subscription?.trial_end || null;
  const selectedCancelReason = CANCEL_REASON_OPTIONS.find((option) => option.value === cancelReason);
  const cancelReasonText =
    cancelReason === 'other'
      ? cancelReasonDetails.trim()
      : selectedCancelReason?.label ?? '';
  const canSubmitCancellation = !cancelling && cancelReasonText.length > 0;
  const resetCancelForm = () => {
    setCancelReason('');
    setCancelReasonDetails('');
    setCancelError(null);
    setCancelDone(false);
    setCancelActiveUntil(null);
  };
  const openCancelModal = () => {
    setShowUpgradeModal(false);
    resetCancelForm();
    setShowCancelModal(true);
  };
  const closeCancelModal = () => {
    if (cancelling) return;
    setShowCancelModal(false);
    resetCancelForm();
  };

  const handleCancelSubscription = async () => {
    if (!subscription?.id) return;
    if (!cancelReasonText) {
      setCancelError('Selecciona un motivo para continuar.');
      return;
    }
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(buildFunctionsUrl('cancel-subscription'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mp_preapproval_id: subscription.mp_preapproval_id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.success === false) {
        throw new Error(body?.message || body?.error || `Error ${res.status}`);
      }
      const responseData = body?.data ?? body ?? {};
      const responseSubscription = responseData.subscription ?? responseData.license ?? {};
      const activeUntil: string | undefined =
        responseSubscription?.current_period_end ??
        responseSubscription?.period_end ??
        responseSubscription?.next_payment_date ??
        responseData?.next_payment_date ??
        responseData?.license?.current_period_end ??
        responseData?.license?.period_end ??
        responseData?.license?.next_payment_date ??
        periodEnd ??
        null;
      setCancelActiveUntil(activeUntil ?? null);
      applyCheckoutStatus({
        subscription: {
          ...subscription,
          ...responseSubscription,
          current_period_end: activeUntil ?? responseSubscription?.current_period_end ?? subscription?.current_period_end,
          period_end: activeUntil ?? responseSubscription?.period_end ?? subscription?.period_end,
          next_payment_date: activeUntil ?? responseSubscription?.next_payment_date ?? subscription?.next_payment_date,
        },
        available_plans: responseData?.available_plans,
        has_access: typeof responseData?.has_access === 'boolean' ? responseData.has_access : undefined,
      });
      setCancelDone(true);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Error al cancelar. Intenta nuevamente.');
    } finally {
      setCancelling(false);
    }
  };

  // Returns actual current usage for a given feature code
  const getRealUsage = (featureCode: string): number => {
    switch (featureCode) {
      case 'max_applications':           return applicationCount;
      case 'templates':                  return templateCount;
      case 'max_users':                  return activeUsersCount;
      case 'total_de_correos_mensuales': return emailsThisMonth;
      case 'pdf_generations_monthly':    return pdfsThisMonth;
      default:                           return -1; // -1 signals "no usage data for this feature"
    }
  };

  const getUsageLabel = (featureCode: string): string => {
    switch (featureCode) {
      case 'max_applications':           return 'usadas';
      case 'templates':                  return 'creados';
      case 'max_users':                  return 'activos';
      case 'total_de_correos_mensuales': return 'enviados';
      case 'pdf_generations_monthly':    return 'generados';
      default:                           return 'usados';
    }
  };

  const getUsagePercent = (current: number, max: number): number =>
    Math.min(100, Math.round((current / max) * 100));

  const getUsageColor = (pct: number): string => {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-cyan-500';
  };

  const getUsageTextColor = (pct: number): string => {
    if (pct >= 90) return 'text-red-400';
    if (pct >= 70) return 'text-amber-400';
    return 'text-cyan-400';
  };

  const modalContent = !showUpgradeModal && (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      style={{ margin: 0, left: 0, right: 0 }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700/80 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Suscripción</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!subscription ? (
            <div className="text-center py-12">
              <CreditCard className="w-14 h-14 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin suscripción activa</h3>
              <p className="text-slate-400 text-sm mb-6">No tienes una suscripción activa ahora mismo.</p>
              {isAdmin && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Ver planes disponibles
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Plan header card */}
              <div className={`rounded-xl p-5 border ${
                isCancellationPending
                  ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/25'
                  : isActive
                  ? 'bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/25'
                  : trialExpired
                  ? 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20'
                  : 'bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-2xl font-extrabold text-white leading-tight">
                      {planName}
                    </h3>
                    {isTrialing && (
                      <p className="text-slate-400 text-xs mt-0.5">Prueba del plan {planName}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${
                    isCancellationPending
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : isActive
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : trialExpired
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {isCancellationPending
                      ? 'Se cancela al vencer'
                      : isActive
                      ? 'Activa'
                      : trialExpired
                      ? 'Trial vencido'
                      : 'En prueba'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  {isFreePlan ? (
                    <>
                      <span className="text-3xl font-extrabold text-white">Gratis</span>
                      <span className="text-slate-400 text-sm">· período de prueba</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl font-extrabold text-white">
                        {planCurrency} {planPrice.toLocaleString('es-UY')}
                      </span>
                      <span className="text-slate-400 text-sm">/mes</span>
                    </>
                  )}
                </div>
              </div>

              {/* Trial status */}
              {isTrialing && trialEndDate && (
                <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
                  trialExpired
                    ? 'bg-red-500/8 border-red-500/20'
                    : daysRemaining !== null && daysRemaining <= 3
                    ? 'bg-amber-500/8 border-amber-500/20'
                    : 'bg-blue-500/8 border-blue-500/20'
                }`}>
                  {trialExpired
                    ? <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    : <Clock className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${trialExpired ? 'text-red-400' : 'text-blue-300'}`}>
                      {trialExpired ? 'Período de prueba finalizado' : `${daysRemaining} ${daysRemaining === 1 ? 'día restante' : 'días restantes'}`}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {trialExpired
                        ? `Venció el ${formatDate(subscription.trial_end)}`
                        : `Vence el ${formatDate(subscription.trial_end)}`
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Period */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl px-4 py-3 flex items-center gap-3">
                <Calendar className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-1">Período vigente</p>
                  <p className="text-sm text-white">{periodLabel}</p>
                </div>

                {isCancellationPending && (
                  <p className="mt-2 text-xs text-amber-300">
                    Se canceló, pero seguirá vigente hasta que termine el período actual.
                  </p>
                )}
              </div>

              {/* Features with real usage */}
              {features.length > 0 && (
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">Límites y uso actual</h4>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-700 border border-slate-600" />
                      Límite del plan
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm bg-cyan-500/40 border border-cyan-500/30" />
                      Uso actual
                    </span>
                  </div>
                  <div className="space-y-4">
                    {features.map((feature) => {
                      const isBool = feature.value_type === 'boolean';
                      const boolOn = isBool && (feature.value === 'true' || feature.value === '1');
                      const label = FEATURE_LABEL[feature.code] ?? feature.name;
                      const Icon = FEATURE_ICON[feature.code];
                      const rawUsage = getRealUsage(feature.code);
                      const hasUsageData = rawUsage >= 0; // -1 means no tracking for this feature
                      const realUsage = hasUsageData ? rawUsage : 0;
                      const usageLabel = getUsageLabel(feature.code);
                      const planMax = !isBool ? parseInt(feature.value, 10) : null;
                      const pct = hasUsageData && planMax !== null && planMax > 0
                        ? getUsagePercent(realUsage, planMax)
                        : null;

                      return (
                        <div key={feature.code}>
                          <div className="flex items-center justify-between gap-4 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />}
                              <span className="text-sm text-slate-300 truncate">{label}</span>
                            </div>

                            {isBool ? (
                              <span className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full border ${
                                boolOn
                                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                  : 'bg-slate-700/60 border-slate-600 text-slate-500'
                              }`}>
                                {boolOn ? <Check className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                              </span>
                            ) : (
                              <div className="flex-shrink-0 flex items-center gap-2 text-right">
                                <span className={`text-xs font-semibold ${pct !== null ? getUsageTextColor(pct) : 'text-slate-400'}`}>
                                  {realUsage.toLocaleString('es-UY')} {usageLabel}
                                </span>
                                <span className="text-slate-600 text-xs">/</span>
                                <span className="text-sm font-bold text-white whitespace-nowrap">
                                  {formatNumber(feature.value, feature.unit)}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Progress bar for numeric features */}
                          {!isBool && planMax !== null && planMax > 0 && (
                            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct !== null ? getUsageColor(pct) : 'bg-slate-600'}`}
                                style={{ width: pct !== null ? `${pct}%` : '0%' }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                {isAdmin ? (
                  <>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold text-sm transition-all hover:shadow-lg hover:shadow-cyan-500/25"
                    >
                      {trialExpired ? 'Suscribirse ahora' : 'Actualizar plan'}
                    </button>
                    {canCancelSubscription ? (
                      <button
                        onClick={openCancelModal}
                        className="px-5 py-2.5 border border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
                      >
                        Cancelar suscripción
                      </button>
                    ) : (
                      <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
                      >
                        Cerrar
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                      <span className="text-xs text-slate-400">Solo un Administrador puede cambiar el plan</span>
                    </div>
                    <button
                      onClick={onClose}
                      className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-colors whitespace-nowrap"
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const cancelModalContent = showCancelModal && (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[210] p-4"
      style={{ margin: 0, left: 0, right: 0 }}
      onClick={closeCancelModal}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-slate-700/80 px-4 sm:px-5 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">Cancelar suscripción</h3>
              <p className="text-xs text-slate-400 max-w-[28rem]">
                Tu plan seguirá activo hasta que termine el período vigente.
              </p>
            </div>
          </div>
          <button
            onClick={closeCancelModal}
            disabled={cancelling}
            className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3 sm:space-y-4">
          {cancelDone ? (
            <>
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-300">Cancelación confirmada</p>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Tu suscripción seguirá activa hasta{' '}
                    <span className="font-medium text-white">{formatDate(activeUntilLabel ?? undefined)}</span>.
                    Después de esa fecha, el acceso se bloqueará automáticamente.
                  </p>
                </div>
              </div>

              <button
                onClick={closeCancelModal}
                className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-colors"
              >
                Cerrar
              </button>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-red-500/15 bg-red-500/5 px-4 py-3">
                <p className="text-sm font-semibold text-red-300">Antes de cancelar</p>
                <p className="text-xs text-slate-400 mt-1">
                El plan seguirá activo hasta que termine el período actual. Después de esa fecha, el acceso se bloqueará.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-300 mb-2">¿Por qué cancelas?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                  {CANCEL_REASON_OPTIONS.map((option) => {
                    const isSelected = cancelReason === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setCancelReason(option.value);
                          setCancelError(null);
                          if (option.value !== 'other') {
                            setCancelReasonDetails('');
                          }
                        }}
                        className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                          isSelected
                            ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-200'
                            : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70'
                        }`}
                      >
                        <span className="block text-sm font-medium leading-snug">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {cancelReason === 'other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Cuéntanos un poco más
                  </label>
                  <textarea
                    value={cancelReasonDetails}
                    onChange={(event) => setCancelReasonDetails(event.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400/50 min-h-[84px]"
                    placeholder="Escribe el motivo de la cancelación..."
                  />
                </div>
              )}

              {cancelError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <p className="text-xs text-red-300">{cancelError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <button
                  onClick={closeCancelModal}
                  className="w-full sm:flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-colors"
                >
                  Mantener suscripción
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={!canSubmitCancellation}
                  className="w-full sm:flex-1 py-2.5 border border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cancelling ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Confirmar cancelación
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return (
    <>
      {modalContent && createPortal(modalContent, modalRoot)}
      {cancelModalContent && createPortal(cancelModalContent, modalRoot)}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
};

