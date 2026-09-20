const TOUR_SEEN_KEY_PREFIX = 'sendcraft_onboarding_tour_seen_';
const CHECKLIST_DISMISSED_KEY_PREFIX = 'sendcraft_onboarding_checklist_dismissed_';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore (private mode / storage disabled)
  }
}

export function hasSeenOnboardingTour(userId: string): boolean {
  if (!userId) return true;
  return safeGet(TOUR_SEEN_KEY_PREFIX + userId) === '1';
}

export function markOnboardingTourSeen(userId: string): void {
  if (!userId) return;
  safeSet(TOUR_SEEN_KEY_PREFIX + userId, '1');
}

export function isOnboardingChecklistDismissed(userId: string): boolean {
  if (!userId) return false;
  return safeGet(CHECKLIST_DISMISSED_KEY_PREFIX + userId) === '1';
}

export function dismissOnboardingChecklist(userId: string): void {
  if (!userId) return;
  safeSet(CHECKLIST_DISMISSED_KEY_PREFIX + userId, '1');
}
