import { createPortal } from 'react-dom';
import { X, CreditCard, Calendar, Package, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SubscriptionModalProps {
  onClose: () => void;
}

export const SubscriptionModal = ({ onClose }: SubscriptionModalProps) => {
  const { subscription } = useAuth();

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';
  const trialEnded = subscription?.trial_end && new Date(subscription.trial_end) < new Date();

  const modalContent = (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4" style={{ margin: 0, left: 0, right: 0 }}>
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CreditCard className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Suscripción</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!subscription ? (
            <div className="text-center py-12">
              <CreditCard className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Sin Suscripción Activa</h3>
              <p className="text-slate-400 mb-6">
                No tienes una suscripción activa en este momento.
              </p>
              <button className="px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors">
                Ver Planes Disponibles
              </button>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-white">{subscription.plan_name}</h3>
                  <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
                    isActive
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : isTrialing
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {isTrialing ? 'Período de Prueba' : isActive ? 'Activa' : subscription.status}
                  </span>
                </div>

                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold text-white">
                    {subscription.plan_price.toFixed(2)}
                  </span>
                  <span className="text-xl text-slate-400">{subscription.plan_currency}</span>
                  <span className="text-slate-400">/mes</span>
                </div>
              </div>

              {isTrialing && subscription.trial_end && (
                <div className={`border rounded-lg p-4 ${
                  trialEnded
                    ? 'bg-red-500/10 border-red-500/20'
                    : 'bg-blue-500/10 border-blue-500/20'
                }`}>
                  <div className="flex items-start space-x-3">
                    <Calendar className={`w-5 h-5 mt-0.5 ${trialEnded ? 'text-red-400' : 'text-blue-400'}`} />
                    <div className="flex-1">
                      <h4 className={`font-semibold mb-1 ${trialEnded ? 'text-red-400' : 'text-blue-400'}`}>
                        {trialEnded ? 'Período de Prueba Finalizado' : 'Período de Prueba Activo'}
                      </h4>
                      <p className="text-sm text-slate-300">
                        {trialEnded
                          ? `Tu período de prueba finalizó el ${formatDate(subscription.trial_end)}`
                          : `Tu período de prueba finaliza el ${formatDate(subscription.trial_end)}`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Calendar className="w-5 h-5 text-cyan-400" />
                    <h4 className="font-semibold text-white">Período Actual</h4>
                  </div>
                  <p className="text-sm text-slate-400 mb-1">
                    Inicio: {formatDate(subscription.period_start)}
                  </p>
                  <p className="text-sm text-slate-400">
                    Fin: {formatDate(subscription.period_end)}
                  </p>
                </div>

                <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                  <div className="flex items-center space-x-3 mb-2">
                    <Package className="w-5 h-5 text-cyan-400" />
                    <h4 className="font-semibold text-white">Recursos</h4>
                  </div>
                  <p className="text-sm text-slate-400 mb-1">
                    Usuarios: {subscription.entitlements.max_users}
                  </p>
                  <p className="text-sm text-slate-400">
                    Almacenamiento: {subscription.entitlements.max_storage_gb} GB
                  </p>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  <TrendingUp className="w-5 h-5 text-cyan-400" />
                  <h4 className="font-semibold text-white">Características</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Acceso API</span>
                    <span className={`text-sm font-semibold ${
                      subscription.entitlements.features.api_access
                        ? 'text-green-400'
                        : 'text-slate-500'
                    }`}>
                      {subscription.entitlements.features.api_access ? '✓ Incluido' : '✗ No incluido'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Reportes Avanzados</span>
                    <span className={`text-sm font-semibold ${
                      subscription.entitlements.features.advanced_reports
                        ? 'text-green-400'
                        : 'text-slate-500'
                    }`}>
                      {subscription.entitlements.features.advanced_reports ? '✓ Incluido' : '✗ No incluido'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">Soporte Prioritario</span>
                    <span className={`text-sm font-semibold ${
                      subscription.entitlements.features.priority_support
                        ? 'text-green-400'
                        : 'text-slate-500'
                    }`}>
                      {subscription.entitlements.features.priority_support ? '✓ Incluido' : '✗ No incluido'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button className="flex-1 px-6 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors">
                  Actualizar Plan
                </button>
                <button className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  Gestionar Pago
                </button>
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(modalContent, modalRoot);
};
