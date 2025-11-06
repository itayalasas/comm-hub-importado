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

  console.log('=== UPGRADE MODAL ===');
  console.log('Available plans:', availablePlans);
  console.log('Plans count:', availablePlans.length);
  console.log('Feature code:', featureCode);
  console.log('Feature name:', featureName);
  console.log('Current limit:', currentLimit);

  const handleUpgrade = (planId: string) => {
    console.log('Upgrading to plan:', planId);
  };

  const getFeatureValue = (plan: AvailablePlan, code?: string): string | null => {
    if (!code) return null;
    const feature = plan.entitlements.features.find(f => f.code === code);
    return feature?.value || null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-600/5 via-transparent to-transparent pointer-events-none" />

        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-full shadow-2xl shadow-cyan-500/30 flex items-center justify-center border-4 border-slate-900 animate-in zoom-in duration-300">
            <TrendingUp className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-all z-10 group border border-slate-700"
        >
          <X className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
        </button>

        <div className="relative pt-20 px-10 pb-10">
          <h2 className="text-4xl font-bold text-white text-center mb-3 tracking-tight">
            Mejora tu Plan
          </h2>
          <p className="text-slate-200 text-center mb-1 text-lg">
            Tu plan actual incluye <span className="font-bold text-cyan-400">{currentLimit}</span> {featureName}
          </p>
          <p className="text-slate-400 text-center mb-10">
            Desbloquea más capacidades actualizando a un plan superior
          </p>

          {availablePlans.length > 0 ? (
            <div className="grid gap-5 mb-8">
              {availablePlans.map((plan) => {
                const featureValue = getFeatureValue(plan, featureCode);

                return (
                  <div
                    key={plan.id}
                    className="relative bg-gradient-to-br from-slate-800 to-slate-800/90 backdrop-blur-sm rounded-xl p-7 border border-slate-600 hover:border-cyan-500 transition-all duration-300 group shadow-lg hover:shadow-cyan-500/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />

                    <div className="relative">
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex-1">
                          <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                            {plan.name}
                          </h3>
                          <p className="text-slate-300 text-sm mb-4">{plan.description}</p>

                          <div className="flex items-baseline gap-2 mb-3">
                            <span className="text-5xl font-bold bg-gradient-to-br from-white to-slate-200 bg-clip-text text-transparent">
                              ${plan.price}
                            </span>
                            <span className="text-slate-400 text-base">
                              {plan.currency} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                            </span>
                          </div>

                          {plan.is_upgrade && (
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border border-cyan-400/40 rounded-full">
                              <Zap className="w-4 h-4 text-cyan-400" />
                              <span className="text-sm font-semibold text-cyan-400">
                                +${plan.price_difference} desde tu plan actual
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {featureValue && (
                        <div className="mb-5 p-4 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 rounded-lg border border-cyan-500/30">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                              <Check className="w-5 h-5 text-cyan-400" />
                            </div>
                            <span className="text-slate-100 text-base">
                              <span className="font-bold text-white text-lg">{featureValue}</span> {featureName}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 mb-6">
                        {plan.entitlements.features.slice(0, 5).map((feature, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-500/40">
                              <Check className="w-3.5 h-3.5 text-cyan-400" />
                            </div>
                            <span className="text-slate-200">
                              <span className="font-semibold">{feature.name}</span>: {feature.value} {feature.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        className="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white rounded-xl font-bold text-base transition-all shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] active:scale-[0.98] border border-cyan-400/20"
                      >
                        Actualizar ahora
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 px-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 border border-slate-700 mb-4">
                <Zap className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-300 text-lg mb-2 font-medium">
                No hay planes disponibles
              </p>
              <p className="text-slate-500 text-sm">
                Los planes de actualización se cargarán después de iniciar sesión
              </p>
            </div>
          )}

          <div className="text-center pt-6 border-t border-slate-700">
            <p className="text-slate-300">
              ¿Necesitas ayuda para elegir?{' '}
              <button className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold underline decoration-cyan-400/30 hover:decoration-cyan-400/60">
                Contacta con soporte
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
