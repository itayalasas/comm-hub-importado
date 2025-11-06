import { X, Check, Zap, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { AvailablePlan } from '../contexts/AuthContext';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit: number;
  featureName: string;
  featureCode?: string;
}

export const UpgradeModal = ({
  isOpen,
  onClose,
  currentLimit,
  featureName,
  featureCode
}: UpgradeModalProps) => {
  const { availablePlans } = useAuth();

  if (!isOpen) return null;

  const handleUpgrade = (planId: string) => {
    console.log('Upgrading to plan:', planId);
  };

  const getFeatureValue = (plan: AvailablePlan, code?: string): string | null => {
    if (!code) return null;
    const feature = plan.entitlements.features.find(f => f.code === code);
    return feature?.value || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent pointer-events-none" />

        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
          <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-full shadow-xl flex items-center justify-center border-4 border-slate-900 animate-in zoom-in duration-300">
            <TrendingUp className="w-10 h-10 text-white" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-700/50 transition-all z-10 group"
        >
          <X className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
        </button>

        <div className="relative pt-16 px-8 pb-8">
          <h2 className="text-3xl font-bold text-white text-center mb-2">
            Mejora tu Plan
          </h2>
          <p className="text-slate-300 text-center mb-2">
            Tu plan actual incluye <span className="font-semibold text-cyan-400">{currentLimit}</span> {featureName}
          </p>
          <p className="text-slate-400 text-sm text-center mb-8">
            Desbloquea más capacidades actualizando a un plan superior
          </p>

          {availablePlans.length > 0 ? (
            <div className="grid gap-4 mb-6">
              {availablePlans.map((plan) => {
                const featureValue = getFeatureValue(plan, featureCode);

                return (
                  <div
                    key={plan.id}
                    className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 hover:border-cyan-500/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                          {plan.name}
                        </h3>
                        <p className="text-slate-400 text-sm mb-3">{plan.description}</p>

                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-white">
                            ${plan.price}
                          </span>
                          <span className="text-slate-400">
                            {plan.currency} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                          </span>
                        </div>

                        {plan.is_upgrade && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs font-medium text-cyan-400">
                              +${plan.price_difference} desde tu plan actual
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {featureValue && (
                      <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-cyan-400" />
                          <span className="text-slate-300">
                            <span className="font-semibold text-white">{featureValue}</span> {featureName}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-6">
                      {plan.entitlements.features.slice(0, 4).map((feature, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/30">
                            <Check className="w-3 h-3 text-cyan-400" />
                          </div>
                          <span className="text-slate-300">
                            {feature.name}: <span className="text-white font-medium">{feature.value} {feature.unit}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-lg font-semibold transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Actualizar ahora
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-400 mb-4">
                No hay planes disponibles en este momento
              </p>
            </div>
          )}

          <div className="text-center pt-4 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              ¿Necesitas ayuda para elegir?
              <button className="ml-1 text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                Contacta con soporte
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
