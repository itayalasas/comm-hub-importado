import { createPortal } from 'react-dom';
import { X, Check, Minus, TrendingUp, Loader2, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePlans } from '../hooks/usePlans';
import type { PlanFeature } from '../hooks/usePlans';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Legacy props kept for call-site compatibility but no longer required
  currentLimit?: number;
  featureName?: string;
  featureCode?: string;
}

const FEATURE_LABEL: Record<string, string> = {
  total_de_correos_mensuales: 'Emails / mes',
  pdf_generations_monthly:    'PDFs / mes',
  max_applications:           'Aplicaciones',
  max_users:                  'Usuarios',
  templates:                  'Templates',
  api_access:                 'Acceso API',
  two_factor_auth:            '2FA',
  priority_support:           'Soporte prioritario',
  advanced_reports:           'Reportes avanzados',
  custom_domain:              'Dominio pers.',
};

const FEATURE_ORDER = [
  'max_users',
  'total_de_correos_mensuales',
  'pdf_generations_monthly',
  'max_applications',
  'templates',
  'api_access',
  'two_factor_auth',
  'advanced_reports',
  'custom_domain',
  'priority_support',
];

function formatFeatureValue(f: PlanFeature): string {
  if (f.value_type === 'boolean') return '';
  const n = parseInt(f.value, 10);
  if (!isNaN(n)) {
    return n.toLocaleString('es-UY') + (f.unit ? ` ${f.unit}` : '');
  }
  return f.value + (f.unit ? ` ${f.unit}` : '');
}

export const UpgradeModal = ({ isOpen, onClose }: UpgradeModalProps) => {
  const { subscription } = useAuth();
  const { plans, loading } = usePlans();

  if (!isOpen) return null;

  // Sort plans by price ascending
  const sortedPlans = [...plans].sort((a, b) => a.price - b.price);

  // Identify current plan by matching plan_name
  const currentPlanName = subscription?.plan_name?.toLowerCase().trim() ?? '';

  const isCurrentPlan = (planName: string) =>
    planName.toLowerCase().trim() === currentPlanName;

  const handleSelect = (initPoint: string | null | undefined) => {
    if (!initPoint) return;
    window.location.href = initPoint;
  };

  // Collect all unique feature codes across all plans in defined order
  const allCodes = Array.from(
    new Set([
      ...FEATURE_ORDER,
      ...sortedPlans.flatMap(p => p.entitlements.features.map(f => f.code)),
    ])
  ).filter(code =>
    sortedPlans.some(p => p.entitlements.features.find(f => f.code === code))
  );

  const getFeature = (plan: typeof sortedPlans[0], code: string): PlanFeature | undefined =>
    plan.entitlements.features.find(f => f.code === code);

  const modalContent = (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md"
      style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <div className="relative w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        {/* Background accents */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/8 via-transparent to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-6 py-5 border-b border-slate-700/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Planes de suscripción</h2>
              <p className="text-xs text-slate-400 mt-0.5">Elige el plan que mejor se adapte a tus necesidades</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors border border-slate-700"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-slate-400 text-sm">Cargando planes...</p>
            </div>
          ) : sortedPlans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-400">No hay planes disponibles en este momento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse">
                {/* Plan headers */}
                <thead>
                  <tr>
                    <th className="text-left pb-4 pr-4 w-44">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Características</span>
                    </th>
                    {sortedPlans.map((plan) => {
                      const isCurrent = isCurrentPlan(plan.name);
                      return (
                        <th key={plan.id} className="pb-4 px-2 text-center align-bottom">
                          <div className={`relative rounded-2xl border p-4 transition-all ${
                            isCurrent
                              ? 'bg-cyan-500/10 border-cyan-500/40'
                              : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                          }`}>
                            {isCurrent && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <span className="inline-flex items-center gap-1 bg-cyan-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg shadow-cyan-500/30 whitespace-nowrap">
                                  <Star className="w-2.5 h-2.5 fill-current" />
                                  Plan actual
                                </span>
                              </div>
                            )}
                            <p className={`font-extrabold text-base mb-1 ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>
                              {plan.name}
                            </p>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-xl font-extrabold text-white">
                                {plan.currency} {plan.price.toLocaleString('es-UY')}
                              </span>
                              <span className="text-slate-400 text-xs">/mes</span>
                            </div>
                            {!isCurrent && (
                              <button
                                onClick={() => handleSelect(plan.mercadopago?.init_point)}
                                disabled={!plan.mercadopago?.init_point}
                                className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-all ${
                                  plan.mercadopago?.init_point
                                    ? 'bg-cyan-500 hover:bg-cyan-400 text-white hover:shadow-md hover:shadow-cyan-500/20'
                                    : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                }`}
                              >
                                {plan.mercadopago?.init_point ? 'Seleccionar' : 'No disponible'}
                              </button>
                            )}
                            {isCurrent && (
                              <div className="mt-3 w-full py-2 rounded-lg text-xs font-bold bg-cyan-500/10 text-cyan-400 text-center border border-cyan-500/20">
                                Plan activo
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Feature rows */}
                <tbody className="divide-y divide-slate-800">
                  {allCodes.map((code) => {
                    const label = FEATURE_LABEL[code] ?? code.replace(/_/g, ' ');
                    return (
                      <tr key={code} className="group">
                        <td className="py-3 pr-4 text-sm text-slate-400 font-medium group-hover:text-slate-300 transition-colors">
                          {label}
                        </td>
                        {sortedPlans.map((plan) => {
                          const feature = getFeature(plan, code);
                          const isCurrent = isCurrentPlan(plan.name);

                          if (!feature) {
                            return (
                              <td key={plan.id} className="py-3 px-2 text-center">
                                <span className="flex justify-center">
                                  <Minus className="w-4 h-4 text-slate-700" />
                                </span>
                              </td>
                            );
                          }

                          const isBool = feature.value_type === 'boolean';
                          const boolOn = isBool && (feature.value === 'true' || feature.value === '1');

                          return (
                            <td key={plan.id} className={`py-3 px-2 text-center ${isCurrent ? 'bg-cyan-500/5' : ''}`}>
                              {isBool ? (
                                <span className="flex justify-center">
                                  {boolOn ? (
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    </span>
                                  ) : (
                                    <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                      <Minus className="w-3 h-3 text-slate-600" />
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className={`text-sm font-semibold ${isCurrent ? 'text-cyan-400' : 'text-white'}`}>
                                  {formatFeatureValue(feature)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-6 py-4 border-t border-slate-700/80 bg-slate-900/80 flex-shrink-0">
          <p className="text-slate-500 text-center text-xs">
            Precios en pesos uruguayos (UYU) · Los límites son compartidos por todos los usuarios del tenant
          </p>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(modalContent, modalRoot);
};
