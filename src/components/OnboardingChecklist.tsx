import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOnboardingTour } from '../contexts/OnboardingTourContext';
import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import { dismissOnboardingChecklist, isOnboardingChecklistDismissed } from '../lib/onboarding';

interface OnboardingChecklistProps {
  applicationIds: string[];
}

export function OnboardingChecklist({ applicationIds }: OnboardingChecklistProps) {
  const { user } = useAuth();
  const { startTour } = useOnboardingTour();
  const { steps, allDone, loading } = useOnboardingProgress(applicationIds);
  const [dismissed, setDismissed] = useState(() => isOnboardingChecklistDismissed(user?.sub || ''));

  if (loading || allDone || dismissed) return null;

  const doneCount = steps.filter((s) => s.done).length;

  const handleDismiss = () => {
    if (user?.sub) dismissOnboardingChecklist(user.sub);
    setDismissed(true);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-cyan-500/20 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-base font-semibold text-white">Primeros pasos</h2>
          <span className="text-xs text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-full">
            {doneCount}/{steps.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={startTour}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Ver tour guiado
          </button>
          <button onClick={handleDismiss} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
              step.done ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-700 bg-slate-900/40'
            }`}
          >
            {step.done ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Circle className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${step.done ? 'text-slate-400 line-through' : 'text-white'}`}>
                {step.title}
              </div>
              <div className="text-xs text-slate-500 truncate">{step.description}</div>
            </div>
            {!step.done && (
              <Link
                to={step.route}
                className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 flex-shrink-0 transition-colors"
              >
                Ir <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
