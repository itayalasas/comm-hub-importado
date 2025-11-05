import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const TrialBanner = () => {
  const { subscription } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (subscription?.status === 'trialing' && subscription.trial_end) {
      const trialEndDate = new Date(subscription.trial_end);
      const today = new Date();
      const diffTime = trialEndDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      setDaysRemaining(diffDays);
    }
  }, [subscription]);

  if (!subscription || subscription.status !== 'trialing' || !isVisible) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-amber-100">
                <span className="font-semibold">Licencia de Prueba:</span>{' '}
                {daysRemaining !== null && (
                  <>
                    Te quedan{' '}
                    <span className="font-bold text-amber-300">
                      {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                    </span>{' '}
                    de tu período de prueba del plan{' '}
                    <span className="font-semibold">{subscription.plan_name}</span>.
                  </>
                )}
                {daysRemaining === null && (
                  <>
                    Estás usando una licencia de prueba del plan{' '}
                    <span className="font-semibold">{subscription.plan_name}</span>.
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 ml-4 p-1 hover:bg-amber-500/20 rounded transition-colors"
            aria-label="Cerrar banner"
          >
            <X className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
