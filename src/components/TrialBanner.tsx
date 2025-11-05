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
    <div className="sticky top-16 z-30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-amber-500/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-100">
            <span className="font-semibold">Modo de Prueba:</span>{' '}
            {daysRemaining !== null && (
              <>
                Te quedan{' '}
                <span className="font-bold text-amber-300">
                  {daysRemaining} {daysRemaining === 1 ? 'día' : 'días'}
                </span>{' '}
                de prueba.
              </>
            )}
            {daysRemaining === null && (
              <>Estás usando una licencia de prueba.</>
            )}
          </p>
          <a
            href="#"
            className="text-sm font-semibold text-amber-300 hover:text-amber-200 underline transition-colors whitespace-nowrap"
          >
            Actualizar Plan
          </a>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-amber-500/20 rounded transition-colors flex-shrink-0 ml-2"
            aria-label="Cerrar banner"
          >
            <X className="w-4 h-4 text-amber-300" />
          </button>
        </div>
      </div>
    </div>
  );
};
