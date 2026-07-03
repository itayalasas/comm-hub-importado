import { AlertTriangle, X, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UpgradeModal } from './UpgradeModal';

export const TrialBanner = () => {
  const { subscription } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    if (subscription?.status === 'trialing' && subscription.trial_end) {
      const trialEndDate = new Date(subscription.trial_end);
      const today = new Date();
      const diffTime = trialEndDate.getTime() - today.getTime();
      // Use floor so partial day doesn't add an extra "day remaining"
      const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      setDaysRemaining(diffDays);
    }
  }, [subscription]);

  // Only show banner when trialing AND trial has NOT expired
  // (expired trial is handled by the full-page blocker in Layout)
  if (!subscription || subscription.status !== 'trialing' || !isVisible) {
    return null;
  }

  const trialExpired = daysRemaining !== null && daysRemaining <= 0;

  // If trial expired, Layout will show the blocking screen — don't double-show banner
  if (trialExpired) return null;

  const getCurrentLimit = () => {
    if (!subscription?.entitlements?.features) return 0;
    const appFeature = subscription.entitlements.features.find(f => f.code === 'max_applications');
    return appFeature ? parseInt(appFeature.value) : 0;
  };

  const urgent = daysRemaining !== null && daysRemaining <= 3;

  return (
    <>
      <div className={`sticky top-16 z-30 backdrop-blur-sm border-b ${
        urgent
          ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
          : 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-center gap-3">
            {urgent
              ? <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              : <Clock className="w-5 h-5 text-amber-400 flex-shrink-0" />
            }
            <p className={`text-sm ${urgent ? 'text-red-100' : 'text-amber-100'}`}>
              <span className="font-semibold">Modo de Prueba:</span>{' '}
              {daysRemaining !== null ? (
                daysRemaining === 0 ? (
                  <>Tu período de prueba <span className={`font-bold ${urgent ? 'text-red-300' : 'text-amber-300'}`}>vence hoy</span>.</>
                ) : (
                  <>
                    Te {daysRemaining === 1 ? 'queda' : 'quedan'}{' '}
                    <span className={`font-bold ${urgent ? 'text-red-300' : 'text-amber-300'}`}>
                      {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                    </span>{' '}
                    de prueba.
                  </>
                )
              ) : (
                <>Estás usando una licencia de prueba.</>
              )}
            </p>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`text-sm font-semibold underline transition-colors whitespace-nowrap ${
                urgent ? 'text-red-300 hover:text-red-200' : 'text-amber-300 hover:text-amber-200'
              }`}
            >
              Actualizar Plan
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className={`p-1 rounded transition-colors flex-shrink-0 ml-2 ${
                urgent ? 'hover:bg-red-500/20' : 'hover:bg-amber-500/20'
              }`}
              aria-label="Cerrar banner"
            >
              <X className={`w-4 h-4 ${urgent ? 'text-red-300' : 'text-amber-300'}`} />
            </button>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentLimit={getCurrentLimit()}
        featureName="aplicaciones"
        featureCode="max_applications"
      />
    </>
  );
};
