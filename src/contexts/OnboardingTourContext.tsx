import { createContext, useContext, useMemo, useState, ReactNode } from 'react';

interface OnboardingTourContextValue {
  stepIndex: number | null;
  startTour: () => void;
  goToStep: (index: number) => void;
  endTour: () => void;
}

const OnboardingTourContext = createContext<OnboardingTourContextValue | null>(null);

export function OnboardingTourProvider({ children }: { children: ReactNode }) {
  const [stepIndex, setStepIndex] = useState<number | null>(null);

  const value = useMemo<OnboardingTourContextValue>(() => ({
    stepIndex,
    startTour: () => setStepIndex(0),
    goToStep: (index: number) => setStepIndex(index),
    endTour: () => setStepIndex(null),
  }), [stepIndex]);

  return (
    <OnboardingTourContext.Provider value={value}>
      {children}
    </OnboardingTourContext.Provider>
  );
}

export function useOnboardingTour(): OnboardingTourContextValue {
  const ctx = useContext(OnboardingTourContext);
  if (!ctx) {
    throw new Error('useOnboardingTour must be used within an OnboardingTourProvider');
  }
  return ctx;
}
