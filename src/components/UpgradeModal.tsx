import { X, Check, Globe } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimit: number;
  featureName: string;
  nextPlan?: {
    name: string;
    price: number;
    currency: string;
    features: string[];
  };
}

export const UpgradeModal = ({
  isOpen,
  onClose,
  currentLimit,
  featureName,
  nextPlan
}: UpgradeModalProps) => {
  if (!isOpen) return null;

  const handleUpgrade = () => {
    window.open('https://www.resend.com/pricing', '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl">
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <div className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center">
            <Globe className="w-8 h-8 text-slate-700" />
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5 text-slate-500" />
        </button>

        <div className="pt-12 px-8 pb-8">
          <h2 className="text-2xl font-semibold text-slate-900 text-center mb-2">
            Upgrade to add more {featureName}
          </h2>
          <p className="text-slate-600 text-center mb-8">
            Your plan includes {currentLimit} {featureName}. Get more capabilities by upgrading to add more.
          </p>

          {nextPlan && (
            <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900 mb-1">
                {nextPlan.name}
              </h3>
              <div className="text-3xl font-bold text-slate-900 mb-6">
                ${nextPlan.price} <span className="text-base font-normal text-slate-600">/ mo</span>
              </div>

              <div className="space-y-3 mb-6">
                {nextPlan.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </div>
                    <span className="text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleUpgrade}
                className="w-full py-3 px-4 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
              >
                Upgrade now
              </button>
            </div>
          )}

          <div className="text-center">
            <button
              onClick={() => window.open('https://www.resend.com/pricing', '_blank')}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Need a bigger plan? See all plans.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
