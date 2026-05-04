import { createPortal } from 'react-dom';
import { X, CreditCard, Calendar, Check, Minus, Clock, AlertTriangle, Zap, Users, FileText, LayoutGrid, Mail, FileOutput } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UpgradeModal } from './UpgradeModal';
import { useSubscriptionLimits } from '../hooks/useSubscriptionLimits';
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

function formatNumber(value: string | number, unit?: string | null): string {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!isNaN(n)) {
    const formatted = n.toLocaleString('es-UY');
    return unit ? `${formatted} ${unit}` : formatted;
  }
  return unit ? `${value} ${unit}` : String(value);
}

export const SubscriptionModal = ({ onClose }: SubscriptionModalProps) => {
  const { subscription, user } = useAuth();
  const { applicationCount, templateCount, emailsThisMonth, pdfsThisMonth } = useSubscriptionLimits();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';
  const activeUsersCount = user?.active_users_count ?? 0;

  const features = subscription?.entitlements?.features ?? [];
  const planPrice = typeof subscription?.plan_price === 'number' ? subscription.plan_price : 0;
  const planCurrency = subscription?.plan_currency || 'UYU';

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-UY', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const now = new Date();
  const trialExpired = isTrialing && trialEndDate !== null && trialEndDate < now;
  const trialActive  = isTrialing && trialEndDate !== null && trialEndDate >= now;

  const daysRemaining = trialActive && trialEndDate
    ? Math.max(0, Math.floor((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const isTrial = planPrice === 0 || isTrialing;

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
              <h3 className="text-lg font-semibold text-white mb-2">Sin Suscripción Activa</h3>
              <p className="text-slate-400 text-sm mb-6">No tienes una suscripción activa en este momento.</p>
              {isAdmin && (
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors font-semibold"
                >
                  Ver Planes Disponibles
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Plan header card */}
              <div className={`rounded-xl p-5 border ${
                isActive
                  ? 'bg-gradient-to-br from-cyan-500/10 to-teal-500/5 border-cyan-500/25'
                  : trialExpired
                  ? 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/20'
                  : 'bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20'
              }`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-2xl font-extrabold text-white leading-tight">
                      {isTrialing ? 'Trial' : subscription.plan_name}
                    </h3>
                    {isTrialing && (
                      <p className="text-slate-400 text-xs mt-0.5">Prueba del plan {subscription.plan_name}</p>
                    )}
                  </div>
                  <span className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${
                    isActive
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : trialExpired
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}>
                    {isActive ? 'Activa' : trialExpired ? 'Trial vencido' : 'En prueba'}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  {isTrial ? (
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
                  <p className="text-xs font-semibold text-slate-400 mb-1">Período actual</p>
                  <p className="text-sm text-white">
                    {formatDate(subscription.period_start)} — {formatDate(subscription.period_end)}
                  </p>
                </div>
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
                  <button
                    onClick={() => setShowUpgradeModal(true)}
                    className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl font-bold text-sm transition-all hover:shadow-lg hover:shadow-cyan-500/25"
                  >
                    {trialExpired ? 'Suscribirse ahora' : 'Actualizar Plan'}
                  </button>
                ) : (
                  <div className="flex-1 flex items-center gap-2 px-4 py-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl">
                    <span className="text-xs text-slate-400">Solo un Administrador puede cambiar el plan</span>
                  </div>
                )}
                {(!trialExpired || !isAdmin) && (
                  <button
                    onClick={onClose}
                    className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold text-sm transition-colors"
                  >
                    Cerrar
                  </button>
                )}
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
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
};
