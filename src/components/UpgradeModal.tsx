import { createPortal } from 'react-dom';
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

  if (availablePlans.length > 0) {
    console.log('');
    console.log('🔍 DETAILED PLANS INSPECTION:');
    availablePlans.forEach((plan, index) => {
      console.log(`\n📦 Plan ${index + 1}: ${plan.name}`);
      console.log('  ├─ ID:', plan.id);
      console.log('  ├─ Price:', plan.price, plan.currency);
      console.log('  ├─ Billing:', plan.billing_cycle);
      console.log('  ├─ Is Upgrade:', plan.is_upgrade);
      console.log('  ├─ Price Diff:', plan.price_difference);
      console.log('  ├─ Features:', plan.entitlements?.features?.length || 0);
      console.log('  ├─ MP Init Point:', plan.mp_init_point ? '✅ ' + plan.mp_init_point.substring(0, 50) + '...' : '❌ Missing');
      console.log('  ├─ MP Back URL:', plan.mp_back_url ? '✅ ' + plan.mp_back_url.substring(0, 50) + '...' : '❌ Missing');
      console.log('  ├─ MP Plan ID:', plan.mp_preapproval_plan_id || '❌ Missing');
      console.log('  └─ MP Status:', plan.mp_status || '❌ Missing');
    });
    console.log('');
  }

  const handleUpgrade = (plan: AvailablePlan) => {
    console.log('=== UPGRADE ACTION ===');
    console.log('Plan:', plan.name);
    console.log('Plan ID:', plan.id);
    console.log('MP Init Point:', plan.mp_init_point);

    if (!plan.mp_init_point) {
      console.error('❌ No MP Init Point available for this plan');
      alert('Error: No se encontró el enlace de pago para este plan');
      return;
    }

    console.log('🚀 Redirecting to Mercado Pago...');
    console.log('URL:', plan.mp_init_point);

    window.location.href = plan.mp_init_point;
  };

  const getFeatureValue = (plan: AvailablePlan, code?: string): string | null => {
    if (!code) return null;
    const feature = plan.entitlements.features.find(f => f.code === code);
    return feature?.value || null;
  };

  const modalContent = (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200" style={{ margin: 0, left: 0, right: 0, top: 0, bottom: 0 }}>
      <div className="relative w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] bg-slate-900 rounded-xl sm:rounded-2xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-cyan-600/5 via-transparent to-transparent pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 p-2 sm:p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 transition-all z-20 group border border-slate-700"
        >
          <X className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
        </button>

        <div className="relative pt-6 sm:pt-8 px-4 sm:px-8 pb-4 sm:pb-6 flex-shrink-0">
          <div className="flex justify-center mb-4 sm:mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-full shadow-2xl shadow-cyan-500/30 flex items-center justify-center border-4 border-slate-800 animate-in zoom-in duration-300">
              <TrendingUp className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow-lg" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-2 tracking-tight">
            Mejora tu Plan
          </h2>
          <p className="text-sm sm:text-base text-slate-200 text-center mb-1">
            Tu plan actual incluye <span className="font-bold text-cyan-400">{currentLimit}</span> {featureName}
          </p>
          <p className="text-xs sm:text-sm text-slate-400 text-center mb-4 sm:mb-6">
            Desbloquea más capacidades actualizando a un plan superior
          </p>
        </div>

        <div className="relative flex-1 overflow-y-auto px-4 sm:px-8 pb-4 sm:pb-8 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
          {availablePlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {availablePlans.map((plan) => {
                const featureValue = getFeatureValue(plan, featureCode);

                return (
                  <div
                    key={plan.id}
                    className="relative bg-gradient-to-br from-slate-800 to-slate-800/90 backdrop-blur-sm rounded-xl p-6 border border-slate-600 hover:border-cyan-500 transition-all duration-300 group shadow-lg hover:shadow-cyan-500/20 flex flex-col"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none" />

                    <div className="relative flex-1 flex flex-col">
                      <div className="mb-4">
                        <h3 className="text-2xl font-bold text-white mb-1.5 group-hover:text-cyan-400 transition-colors">
                          {plan.name}
                        </h3>
                        <p className="text-slate-300 text-sm mb-4">{plan.description}</p>

                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-4xl font-bold bg-gradient-to-br from-white to-slate-200 bg-clip-text text-transparent">
                            ${plan.price}
                          </span>
                          <span className="text-slate-400 text-sm">
                            {plan.currency} / {plan.billing_cycle === 'monthly' ? 'mes' : 'año'}
                          </span>
                        </div>

                        {plan.is_upgrade && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border border-cyan-400/40 rounded-full">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                            <span className="text-xs font-semibold text-cyan-400">
                              +${plan.price_difference} desde tu plan actual
                            </span>
                          </div>
                        )}
                      </div>

                      {featureValue && (
                        <div className="mb-4 p-3 bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 rounded-lg border border-cyan-500/30">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                              <Check className="w-4 h-4 text-cyan-400" />
                            </div>
                            <span className="text-slate-100 text-sm">
                              <span className="font-bold text-white">{featureValue}</span> {featureName}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2.5 mb-6 flex-1">
                        {plan.entitlements.features.slice(0, 4).map((feature, index) => (
                          <div key={index} className="flex items-start gap-2.5 text-sm">
                            <div className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-cyan-500/15 flex items-center justify-center border border-cyan-500/40">
                              <Check className="w-3 h-3 text-cyan-400" />
                            </div>
                            <span className="text-slate-200 leading-relaxed">
                              <span className="font-semibold">{feature.name}</span>: {feature.value} {feature.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => handleUpgrade(plan)}
                        disabled={!plan.mp_init_point}
                        className={`w-full py-3.5 px-5 rounded-xl font-bold transition-all border mt-auto ${
                          plan.mp_init_point
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:scale-[1.02] active:scale-[0.98] border-cyan-400/20 cursor-pointer'
                            : 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {plan.mp_init_point ? 'Actualizar ahora' : 'No disponible'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-8">
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
        </div>

        <div className="relative px-8 py-4 border-t border-slate-700 bg-slate-900/50 flex-shrink-0">
          <p className="text-slate-300 text-center text-sm">
            ¿Necesitas ayuda para elegir?{' '}
            <button className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold underline decoration-cyan-400/30 hover:decoration-cyan-400/60">
              Contacta con soporte
            </button>
          </p>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(modalContent, modalRoot);
};
