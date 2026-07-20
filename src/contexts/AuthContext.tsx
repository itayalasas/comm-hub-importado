import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  configManager,
  getLocalAuthLaunchConfig,
  logRuntimeConfig,
  resolveAuthLaunchConfig,
} from '../lib/config';
import { authClient } from '../lib/auth';
import { isSystemAdminEmail, isSystemAdminUser } from '../lib/systemAdmin';
import {
  clearDedicatedApiResolutionCache,
  isDedicatedApiEnabled,
  resolveDedicatedApiBaseUrl,
  type DedicatedApiResolutionResult,
} from '../lib/dedicatedApi';
import {
  consumePendingWebAccessAttemptId,
  recordWebAccessAttempt,
  startWebAccessAttempt,
} from '../lib/webAccessAnalytics';

type MenuPermission = 'create' | 'read' | 'update' | 'delete';

type MenuPermissions = {
  [menuSlug: string]: MenuPermission[];
};

interface PermissionsHierarchyEntry {
  actions: MenuPermission[];
  submenus?: { [submenuSlug: string]: MenuPermission[] };
}

type PermissionsHierarchy = {
  [menuSlug: string]: PermissionsHierarchyEntry;
};

interface Feature {
  code: string;
  name: string;
  description: string;
  value: string;
  value_type: 'number' | 'boolean' | 'string';
  unit?: string;
  category: string;
}

interface Subscription {
  id: string;
  status: string;
  plan_id?: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  trial_start?: string;
  trial_end?: string;
  period_start: string;
  period_end: string;
  current_period_start?: string;
  current_period_end?: string;
  next_payment_date?: string;
  entitlements: {
    features: Feature[];
  };
  mp_cancel_url?: string;
  mp_init_point?: string;
  mp_preapproval_plan_id?: string;
  mp_preapproval_id?: string;
  mp_status?: string;
  metadata?: Record<string, any>;
}

interface AvailablePlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  billing_cycle: string;
  entitlements: {
    features: Feature[];
  };
  is_upgrade: boolean;
  price_difference: number;
  mp_init_point?: string;
  mp_back_url?: string;
  mp_preapproval_plan_id?: string;
  mp_status?: string;
}

export type { Feature, Subscription, AvailablePlan };

type AuthProgressPhase =
  | 'bootstrapping'
  | 'authenticating'
  | 'refreshing'
  | 'syncing_subscription'
  | 'provisioning_dedicated_api'
  | 'ready';

interface AuthProgress {
  phase: AuthProgressPhase;
  message: string;
}

interface User {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  role?: string;
  permissions?: MenuPermissions;
  permissions_hierarchy?: PermissionsHierarchy;
  subscription?: Subscription;
  tenant_id?: string;
  tenant_name?: string;
  active_users_count?: number;
}

interface AuthContextType {
  user: User | null;
  isAuth: boolean;
  isLoading: boolean;
  authProgress: AuthProgress | null;
  isSystemAdmin: boolean;
  subscription: Subscription | null;
  subscriptionHasAccess: boolean | null;
  availablePlans: AvailablePlan[];
  login: () => Promise<void>;
  register: (planId?: string) => Promise<void>;
  logout: () => void;
  logoutAndRedirect: (redirectTo?: string) => Promise<void>;
  handleCallback: (tokenOrCode: string) => Promise<void>;
  hasPermission: (menu: string, permission: MenuPermission) => boolean;
  hasMenuAccess: (menu: string) => boolean;
  hasSubmenuAccess: (submenuKey: string) => boolean;
  refreshSubscription: (options?: { skipDedicatedProvisioning?: boolean }) => Promise<void>;
  applyCheckoutStatus: (status: {
    subscription?: any;
    available_plans?: any[];
    has_access?: boolean | null;
  }, options?: { skipDedicatedProvisioning?: boolean }) => Promise<void>;
}

type SubscriptionScopeCandidate = {
  [key: string]: any;
  metadata?: Record<string, any>;
};

const TRIAL_MAX_DAYS = 14;
const TRIAL_START_LOCK_STORAGE_PREFIX = 'subscription_trial_start_lock:';
const TRIAL_LOCK_STORAGE_PREFIX = 'subscription_trial_end_lock:';

function getSubscriptionScope(candidate?: SubscriptionScopeCandidate | null): string | null {
  if (!candidate || typeof candidate !== 'object') return null;

  const candidateAny = candidate as Record<string, any>;
  const metadata = candidateAny.metadata && typeof candidateAny.metadata === 'object' ? candidateAny.metadata : {};

  const scopeCandidates: Array<[string, unknown]> = [
    [
      'tenant',
      candidateAny.tenant_id ??
        candidateAny.tenantId ??
        candidateAny.tenant?.id ??
        metadata.tenant_id ??
        metadata.tenantId,
    ],
    [
      'user',
      candidateAny.sub ??
        candidateAny.user_id ??
        candidateAny.id ??
        metadata.user_id ??
        metadata.id,
    ],
    ['email', candidateAny.email ?? metadata.email],
  ];

  for (const [prefix, value] of scopeCandidates) {
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed) return `${prefix}:${trimmed}`;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${prefix}:${value}`;
    }
  }

  return null;
}

function getTrialLockStorageKey(candidate?: SubscriptionScopeCandidate | null): string | null {
  const scope = getSubscriptionScope(candidate);
  return scope ? `${TRIAL_LOCK_STORAGE_PREFIX}${scope}` : null;
}

function getTrialStartLockStorageKey(candidate?: SubscriptionScopeCandidate | null): string | null {
  const scope = getSubscriptionScope(candidate);
  return scope ? `${TRIAL_START_LOCK_STORAGE_PREFIX}${scope}` : null;
}

function addDaysToIsoDate(value: string, days: number): string | undefined {
  const baseTime = new Date(value).getTime();
  if (Number.isNaN(baseTime)) return undefined;

  const result = new Date(baseTime);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString();
}

function chooseEarlierDate(...values: Array<string | undefined | null>): string | undefined {
  let earliestValue: string | undefined;
  let earliestTime: number | null = null;

  for (const value of values) {
    if (typeof value !== 'string') continue;

    const trimmed = value.trim();
    if (!trimmed) continue;

    const time = new Date(trimmed).getTime();
    if (Number.isNaN(time)) continue;

    if (earliestTime === null || time < earliestTime) {
      earliestTime = time;
      earliestValue = trimmed;
    }
  }

  return earliestValue;
}

function readTrialLock(candidate?: SubscriptionScopeCandidate | null): string | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getTrialLockStorageKey(candidate);
  if (!storageKey) return null;

  const stored = localStorage.getItem(storageKey);
  return stored && !Number.isNaN(new Date(stored).getTime()) ? stored : null;
}

function readTrialStartLock(candidate?: SubscriptionScopeCandidate | null): string | null {
  if (typeof window === 'undefined') return null;

  const storageKey = getTrialStartLockStorageKey(candidate);
  if (!storageKey) return null;

  const stored = localStorage.getItem(storageKey);
  return stored && !Number.isNaN(new Date(stored).getTime()) ? stored : null;
}

function writeTrialLock(candidate: SubscriptionScopeCandidate | null | undefined, trialEnd: string): void {
  if (typeof window === 'undefined') return;

  const storageKey = getTrialLockStorageKey(candidate);
  if (!storageKey) return;

  const normalized = trialEnd.trim();
  if (!normalized) return;

  const current = localStorage.getItem(storageKey);
  const effective = chooseEarlierDate(current, normalized);

  if (!effective) return;
  if (current === effective) return;

  localStorage.setItem(storageKey, effective);
}

function writeTrialStartLock(candidate: SubscriptionScopeCandidate | null | undefined, trialStart: string): void {
  if (typeof window === 'undefined') return;

  const storageKey = getTrialStartLockStorageKey(candidate);
  if (!storageKey) return;

  const normalized = trialStart.trim();
  if (!normalized) return;

  const current = localStorage.getItem(storageKey);
  const effective = chooseEarlierDate(current, normalized);

  if (!effective) return;
  if (current === effective) return;

  localStorage.setItem(storageKey, effective);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionHasAccess, setSubscriptionHasAccess] = useState<boolean | null>(null);
  const [availablePlans, setAvailablePlans] = useState<AvailablePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [authProgress, setAuthProgress] = useState<AuthProgress | null>(null);

  const getStoredUserEmail = (): string => {
    if (typeof window === 'undefined') return '';

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return '';

      const parsedUser = JSON.parse(storedUser);
      return typeof parsedUser?.email === 'string' ? parsedUser.email.trim() : '';
    } catch {
      return '';
    }
  };

  const getStoredUserCandidate = (): User | null => {
    if (typeof window === 'undefined') return null;

    try {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return null;

      const parsedUser = JSON.parse(storedUser);
      return parsedUser && typeof parsedUser === 'object' ? (parsedUser as User) : null;
    } catch {
      return null;
    }
  };

  const isSystemAdminSession = (): boolean =>
    isSystemAdminEmail(user?.email) || isSystemAdminEmail(getStoredUserEmail());

  const updateAuthProgress = (phase: AuthProgressPhase, message: string) => {
    setAuthProgress({ phase, message });
  };

  const clearAuthProgress = () => {
    setAuthProgress(null);
  };

  const syncSystemAdminAccess = () => {
    clearDedicatedApiResolutionCache();
    clearAuthProgress();
    localStorage.setItem('subscription_has_access', JSON.stringify(true));
    setSubscriptionHasAccess(true);
    localStorage.removeItem('subscription');
    setSubscription(null);
  };

  const normalizeSystemAdminUser = (candidate: User): User => (
    isSystemAdminEmail(candidate.email)
      ? { ...candidate, role: 'administrador' }
      : candidate
  );

  const normalizeFeatures = (rawFeatures: any): Feature[] => {
    // Format 1: array of feature objects [{ code, name, value, value_type, ... }]
    if (Array.isArray(rawFeatures)) {
      return rawFeatures
        .filter((feature) => feature && typeof feature === 'object')
        .map((feature) => ({
          code: String(feature.code || ''),
          name: String(feature.name || feature.code || 'Feature'),
          description: String(feature.description || ''),
          value: String(feature.value ?? ''),
          value_type: (feature.value_type === 'number' || feature.value_type === 'boolean' || feature.value_type === 'string')
            ? feature.value_type
            : 'string',
          unit: feature.unit ? String(feature.unit) : undefined,
          category: String(feature.category || 'general'),
        }));
    }

    // Format 2: flat object { featureCode: value, ... } — e.g. from external auth system
    if (rawFeatures && typeof rawFeatures === 'object') {
      return Object.entries(rawFeatures).map(([key, val]) => {
        const rawVal = val as any;
        const isBoolean = typeof rawVal === 'boolean' || rawVal === 'true' || rawVal === 'false';
        const isNumber = !isBoolean && (typeof rawVal === 'number' || (typeof rawVal === 'string' && !isNaN(Number(rawVal)) && rawVal !== ''));
        return {
          code: key,
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          description: '',
          value: String(rawVal ?? ''),
          value_type: isBoolean ? 'boolean' : isNumber ? 'number' : 'string',
          unit: undefined,
          category: 'general',
        } as Feature;
      });
    }

    return [];
  };

  const normalizeSubscription = (
    rawSubscription: any,
    scopeCandidate?: SubscriptionScopeCandidate | null,
  ): Subscription | null => {
    if (!rawSubscription || typeof rawSubscription !== 'object') return null;

    if (!rawSubscription.id || !rawSubscription.status) {
      return null;
    }

    const normalizedStatus = String(rawSubscription.status).toLowerCase();
    const trialStart = rawSubscription.trial_start ? String(rawSubscription.trial_start) : undefined;
    const trialEnd = rawSubscription.trial_end ? String(rawSubscription.trial_end) : undefined;
    const trialStartCandidate = chooseEarlierDate(
      trialStart,
      readTrialStartLock(scopeCandidate ?? rawSubscription),
    );
    const trialCapFromStart = trialStartCandidate
      ? addDaysToIsoDate(trialStartCandidate, TRIAL_MAX_DAYS)
      : undefined;
    const trialLockCandidate = chooseEarlierDate(
      trialEnd,
      trialCapFromStart,
      readTrialLock(scopeCandidate ?? rawSubscription),
    );

    if (trialStartCandidate) {
      writeTrialStartLock(scopeCandidate ?? rawSubscription, trialStartCandidate);
    }

    if (trialLockCandidate) {
      writeTrialLock(scopeCandidate ?? rawSubscription, trialLockCandidate);
    }

    // Features can come as entitlements.features (array/object), as a flat object
    // at entitlements root, or directly as rawSubscription.features
    const rawFeatures =
      rawSubscription.entitlements?.features ??
      rawSubscription.features ??
      (rawSubscription.entitlements && typeof rawSubscription.entitlements === 'object' && !Array.isArray(rawSubscription.entitlements)
        ? rawSubscription.entitlements
        : undefined);

    return {
      id: String(rawSubscription.id),
      status: String(rawSubscription.status),
      plan_id: rawSubscription.plan_id ? String(rawSubscription.plan_id) : undefined,
      plan_name: String(rawSubscription.plan_name || 'Plan'),
      plan_price: Number(rawSubscription.plan_price || 0),
      plan_currency: String(rawSubscription.plan_currency || 'USD'),
      trial_start: normalizedStatus === 'trialing' ? trialStartCandidate : undefined,
      trial_end: normalizedStatus === 'trialing' ? trialLockCandidate : undefined,
      period_start: String(rawSubscription.period_start || ''),
      period_end: String(rawSubscription.period_end || ''),
      current_period_start: rawSubscription.current_period_start ? String(rawSubscription.current_period_start) : undefined,
      current_period_end: rawSubscription.current_period_end ? String(rawSubscription.current_period_end) : undefined,
      next_payment_date: rawSubscription.next_payment_date ? String(rawSubscription.next_payment_date) : undefined,
      entitlements: {
        features: normalizeFeatures(rawFeatures),
      },
      mp_cancel_url: rawSubscription.mp_cancel_url ? String(rawSubscription.mp_cancel_url) : undefined,
      mp_init_point: rawSubscription.mp_init_point ? String(rawSubscription.mp_init_point) : undefined,
      mp_preapproval_plan_id: rawSubscription.mp_preapproval_plan_id ? String(rawSubscription.mp_preapproval_plan_id) : undefined,
      mp_preapproval_id: rawSubscription.mp_preapproval_id ? String(rawSubscription.mp_preapproval_id) : undefined,
      mp_status: rawSubscription.mp_status ? String(rawSubscription.mp_status) : undefined,
      metadata: rawSubscription.metadata && typeof rawSubscription.metadata === 'object'
        ? rawSubscription.metadata
        : undefined,
    };
  };

  const persistSubscription = (
    rawSubscription: any,
    scopeCandidate?: SubscriptionScopeCandidate | null,
  ): Subscription | null => {
    const normalizedSubscription = normalizeSubscription(rawSubscription, scopeCandidate);
    if (normalizedSubscription) {
      localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
      setSubscription(normalizedSubscription);
    }

    return normalizedSubscription;
  };

  const normalizeAvailablePlans = (rawPlans: any): AvailablePlan[] => {
    if (!Array.isArray(rawPlans)) return [];

    return rawPlans
      .filter((plan) => plan && typeof plan === 'object' && plan.id)
      .map((plan) => ({
        id: String(plan.id),
        name: String(plan.name || 'Plan'),
        description: String(plan.description || ''),
        price: Number(plan.price || 0),
        currency: String(plan.currency || 'USD'),
        billing_cycle: String(plan.billing_cycle || 'monthly'),
        entitlements: {
          features: normalizeFeatures(plan.entitlements?.features),
        },
        is_upgrade: Boolean(plan.is_upgrade),
        price_difference: Number(plan.price_difference || 0),
        mp_init_point: plan.mp_init_point ? String(plan.mp_init_point) : undefined,
        mp_back_url: plan.mp_back_url ? String(plan.mp_back_url) : undefined,
        mp_preapproval_plan_id: plan.mp_preapproval_plan_id ? String(plan.mp_preapproval_plan_id) : undefined,
        mp_status: plan.mp_status ? String(plan.mp_status) : undefined,
      }));
  };

  const ensureDedicatedApiBase = async (
    subscriptionCandidate?: Subscription | null,
    scopeCandidate?: SubscriptionScopeCandidate | null,
    isSystemAdmin?: boolean,
  ): Promise<DedicatedApiResolutionResult | null> => {
    if (isSystemAdmin) {
      return null;
    }

    if (!subscriptionCandidate) {
      return null;
    }

    if (!isDedicatedApiEnabled(subscriptionCandidate)) {
      return null;
    }

    updateAuthProgress('provisioning_dedicated_api', 'Preparando tu servidor dedicado de APIs...');
    const result = await resolveDedicatedApiBaseUrl({
      subscription: subscriptionCandidate,
      user: scopeCandidate ?? getStoredUserCandidate() ?? user,
    });

    if (result?.status === 'provisioned') {
      updateAuthProgress(
        'provisioning_dedicated_api',
        `Servidor dedicado listo en ${result.publicHostname || result.baseUrl}.`,
      );
    } else if (result?.status === 'reused') {
      updateAuthProgress(
        'provisioning_dedicated_api',
        `Conectando con ${result.publicHostname || result.baseUrl}...`,
      );
    } else if (result?.status === 'fallback') {
      updateAuthProgress(
        'provisioning_dedicated_api',
        'No pudimos preparar tu servidor dedicado. Seguimos con la API base.',
      );
    }

    return result;
  };

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuthState = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('access_token');
      const storedSubscription = localStorage.getItem('subscription');
      const storedSubscriptionHasAccess = localStorage.getItem('subscription_has_access');
      const storedPlans = localStorage.getItem('available_plans');
      let bootstrapUser: User | null = null;

      if (storedUser || storedToken) {
        updateAuthProgress('bootstrapping', 'Restaurando tu sesión y tu configuración...');
      }

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (parsedUser && typeof parsedUser === 'object') {
            const normalizedUser = normalizeSystemAdminUser(parsedUser as User);
            bootstrapUser = normalizedUser;
            localStorage.setItem('user', JSON.stringify(normalizedUser));
            if (!cancelled) {
              setUser(normalizedUser);
            }
            if (isSystemAdminUser(normalizedUser)) {
              syncSystemAdminAccess();
            }
          }
        } catch {
          localStorage.removeItem('user');
        }
      }

      if (storedToken) {
        authClient.setAccessToken(storedToken);
      } else if (storedUser && localStorage.getItem('refresh_token')) {
        try {
          await configManager.loadConfig();
          const refreshedToken = await authClient.refreshAccessToken(configManager.authFunctionsBaseUrl);
          if (refreshedToken) {
            localStorage.setItem('access_token', refreshedToken);
            authClient.setAccessToken(refreshedToken);
          }
        } catch {
          // If cookie-based recovery is unavailable, keep the stored user visible.
        }
      }

      if (storedSubscription) {
        try {
          const parsedSubscription = JSON.parse(storedSubscription);
          if (!cancelled) {
            persistSubscription(parsedSubscription, bootstrapUser);
          }
        } catch {
          localStorage.removeItem('subscription');
        }
      }

      if (storedSubscriptionHasAccess !== null) {
        try {
          const parsedHasAccess = JSON.parse(storedSubscriptionHasAccess);
          if (!cancelled) {
            setSubscriptionHasAccess(typeof parsedHasAccess === 'boolean' ? parsedHasAccess : null);
          }
        } catch {
          localStorage.removeItem('subscription_has_access');
        }
      }

      if (storedPlans) {
        try {
          const parsedPlans = JSON.parse(storedPlans);
          if (!cancelled) {
            setAvailablePlans(normalizeAvailablePlans(parsedPlans));
          }
        } catch {
          localStorage.removeItem('available_plans');
        }
      }

      if (storedUser || storedToken) {
        try {
          await refreshSubscription();
        } catch {
          // Keep the bootstrap state if the sync request fails.
        }
      }

      if (!cancelled) {
        setIsLoading(false);
        clearAuthProgress();
      }
    };

    void bootstrapAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async () => {
    const localAuthConfig = getLocalAuthLaunchConfig();
    const { authUrl, authAppId, authApiKey, redirectUri } =
      localAuthConfig || await resolveAuthLaunchConfig();
    const attemptId = startWebAccessAttempt();

    void recordWebAccessAttempt({
      event_type: 'login_started',
      attempt_id: attemptId,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      metadata: {
        source: 'auth.login',
      },
    });

    if (!authUrl || !authAppId || !authApiKey || !redirectUri) {
      void recordWebAccessAttempt({
        event_type: 'login_failed',
        attempt_id: attemptId,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        error_message: 'No se pudo cargar la configuración de autenticación.',
        metadata: {
          source: 'auth.login.invalid_config',
        },
      });
      throw new Error('No se pudo cargar la configuración de autenticación.');
    }

    const authUrlFinal = `${authUrl}/login?` +
      `app_id=${authAppId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `api_key=${authApiKey}`;

    window.location.href = authUrlFinal;
  };

  const register = async (planId?: string) => {
    const localAuthConfig = getLocalAuthLaunchConfig();
    const { authUrl, authAppId, authApiKey, redirectUri } =
      localAuthConfig || await resolveAuthLaunchConfig();

    if (!authUrl || !authAppId || !authApiKey || !redirectUri) {
      throw new Error('No se pudo cargar la configuración de autenticación.');
    }

    let authUrlFinal = `${authUrl}/register-tenant?` +
      `app_id=${authAppId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `api_key=${authApiKey}`;

    if (planId) {
      authUrlFinal += `&plan_id=${planId}`;
    }

    window.location.href = authUrlFinal;
  };

  const performLogout = async (redirectTo: string = '/') => {
    try {
      await authClient.logout(configManager.authFunctionsBaseUrl);
    } catch {}
    clearDedicatedApiResolutionCache();
    clearAuthProgress();
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('subscription');
    localStorage.removeItem('subscription_has_access');
    setUser(null);
    setSubscription(null);
    setSubscriptionHasAccess(null);
    window.location.href = redirectTo;
  };

  const logout = async () => {
    await performLogout('/');
  };

  const logoutAndRedirect = async (redirectTo = '/login') => {
    await performLogout(redirectTo);
  };

  const decodeJWT = (token: string): any => {
    try {
      if (!token || typeof token !== 'string') return null;

      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      let jsonPayload: string;
      try {
        const rawString = atob(base64);
        jsonPayload = decodeURIComponent(escape(rawString));
      } catch {
        jsonPayload = atob(base64);
      }

      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  };

  const isRecord = (value: unknown): value is Record<string, any> => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  };

  const firstString = (...values: unknown[]): string => {
    for (const value of values) {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) return trimmed;
      }
    }
    return '';
  };

  const unwrapAuthPayload = (payload: any): Record<string, any> => {
    if (!isRecord(payload)) return {};
    return isRecord(payload.data) ? payload.data : payload;
  };

  const extractTokenCandidate = (payload: any, fallback = ''): string => {
    if (typeof payload === 'string') {
      const trimmed = payload.trim();
      return trimmed || fallback;
    }

    if (!isRecord(payload)) {
      return fallback;
    }

    const root = unwrapAuthPayload(payload);
    return firstString(
      root.access_token,
      root.token,
      root.jwt,
      root.id_token,
      payload.access_token,
      payload.token,
      payload.jwt,
      payload.id_token,
      payload.data?.access_token,
      payload.data?.token,
      payload.data?.jwt,
      payload.data?.id_token,
      fallback,
    );
  };

  const extractAuthState = (payload: any) => {
    const root = unwrapAuthPayload(payload);
    const claims = isRecord(root.claims) ? root.claims : null;
    const user = isRecord(root.user) ? root.user : null;
    const application = isRecord(root.application) ? root.application : null;
    const tenant = isRecord(root.tenant) ? root.tenant : null;

    const subscriptionSource =
      root.subscription ??
      user?.subscription ??
      claims?.subscription ??
      null;

    const availablePlansSource =
      root.available_plans ??
      user?.available_plans ??
      claims?.available_plans ??
      null;

    const hasAccess =
      typeof root.has_access === 'boolean'
        ? root.has_access
        : typeof user?.has_access === 'boolean'
          ? user.has_access
          : typeof claims?.has_access === 'boolean'
            ? claims.has_access
            : null;

    const refreshToken = firstString(
      payload?.refresh_token,
      payload?.data?.refresh_token,
      root.refresh_token,
      root.refreshToken,
    );

    return {
      root,
      claims,
      user,
      application,
      tenant,
      subscriptionSource,
      availablePlansSource,
      hasAccess,
      refreshToken: refreshToken || null,
    };
  };

  const buildUserInfo = (
    authState: ReturnType<typeof extractAuthState>,
    decodedToken: Record<string, any> | null,
  ): User => {
    const root = authState.root || {};
    const claims = authState.claims || {};
    const user = authState.user || {};
    const application = authState.application || {};
    const fallback = decodedToken || {};
    const primary = claims || user || root || fallback;
    const secondary = user || claims || root || fallback;

    const email = String(primary.email || secondary.email || '').trim();

    return {
      sub: String(primary.sub || secondary.id || secondary.sub || secondary.user_id || 'unknown'),
      name: String(primary.name || secondary.name || secondary.username || 'Usuario'),
      email,
      picture: primary.picture || secondary.picture || secondary.avatar,
      role: isSystemAdminEmail(email) ? 'administrador' : primary.role || secondary.role,
      permissions: primary.permissions || secondary.permissions || fallback.permissions || {},
      permissions_hierarchy: primary.permissions_hierarchy || secondary.permissions_hierarchy || fallback.permissions_hierarchy || undefined,
      tenant_id: primary.tenant_id || secondary.tenant_id || fallback.tenant_id || authState.tenant?.id || application.tenant_id || undefined,
      tenant_name: primary.tenant_name || secondary.tenant_name || fallback.tenant_name || authState.tenant?.name || authState.tenant?.organization_name || application.name || application.organization_name || undefined,
      active_users_count: secondary.active_users_count !== undefined
        ? Number(secondary.active_users_count)
        : primary.active_users_count !== undefined
        ? Number(primary.active_users_count)
        : fallback.active_users_count !== undefined
        ? Number(fallback.active_users_count)
        : undefined,
    };
  };

  const postJson = async (url: string, body: Record<string, unknown>, timeoutMs = 20000): Promise<any> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const rawText = await response.text();
      let parsed: any = {};

      if (rawText) {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = rawText;
        }
      }

      if (!response.ok) {
        const message = typeof parsed === 'string'
          ? parsed
          : parsed?.error || parsed?.message || response.statusText || `HTTP ${response.status}`;
        throw new Error(message);
      }

      return parsed;
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const syncSubscriptionAccess = (value: boolean | null | undefined) => {
    if (isSystemAdminSession()) {
      localStorage.setItem('subscription_has_access', JSON.stringify(true));
      setSubscriptionHasAccess(true);
      return;
    }

    if (typeof value === 'boolean') {
      localStorage.setItem('subscription_has_access', JSON.stringify(value));
      setSubscriptionHasAccess(value);
      return;
    }

    localStorage.removeItem('subscription_has_access');
    setSubscriptionHasAccess(null);
  };

  const exchangeCodeForToken = async (code: string): Promise<{ response: any; token: string; refreshToken: string | null }> => {
    if (!configManager.authValidaToken) {
      throw new Error('AUTH_VALIDA_TOKEN no está configurada.');
    }

    const response = await postJson(configManager.authValidaToken, {
      code,
      application_id: configManager.authAppId,
    });

    const token = extractTokenCandidate(response);
    if (!token) {
      throw new Error('La validación inicial no devolvió un token.');
    }

    return {
      response,
      token,
      refreshToken: firstString(
        response?.refresh_token,
        response?.data?.refresh_token,
        response?.data?.data?.refresh_token,
      ) || null,
    };
  };

  const validateTokenWithApi = async (token: string): Promise<any> => {
    if (!configManager.authTokenValida) {
      return null;
    }

    return postJson(configManager.authTokenValida, {
      token,
      application_id: configManager.authAppId,
      api_key: configManager.authApiKey,
    });
  };

  const handleCallback = async (tokenOrCode: string) => {
    try {
      updateAuthProgress('authenticating', 'Procesando tu autenticación...');
      await configManager.loadConfig();
      logRuntimeConfig('login');

      const finalizeLogin = (
        resolvedUser: User,
        resolvedSubscription: Subscription | null,
        systemAdmin: boolean,
        accessToken: string,
      ) => {
        localStorage.setItem('access_token', accessToken);
        authClient.setAccessToken(accessToken);

        localStorage.setItem('user', JSON.stringify(resolvedUser));
        setUser(resolvedUser);

        void recordWebAccessAttempt({
          event_type: 'login_success',
          attempt_id: consumePendingWebAccessAttemptId() || undefined,
          email: resolvedUser.email,
          path: typeof window !== 'undefined' ? window.location.pathname : undefined,
          metadata: {
            source: 'auth.handleCallback',
            is_system_admin: systemAdmin,
          },
        });

        if (systemAdmin || !resolvedSubscription) {
          clearAuthProgress();
          return;
        }

        updateAuthProgress('provisioning_dedicated_api', 'Preparando tu servidor dedicado de APIs...');
        void ensureDedicatedApiBase(resolvedSubscription, resolvedUser, systemAdmin).finally(() => {
          clearAuthProgress();
        });
      };

      {
        const isJwt = tokenOrCode.startsWith('eyJ');
        let exchangeResponse: any = null;
        let validationResponse: any = null;
        let accessToken = tokenOrCode;
        let refreshToken: string | null = null;

        if (!isJwt) {
          const exchangeResult = await exchangeCodeForToken(tokenOrCode);
          exchangeResponse = exchangeResult.response;
          accessToken = exchangeResult.token;
          refreshToken = exchangeResult.refreshToken;
        }

        if (configManager.authTokenValida) {
          validationResponse = await validateTokenWithApi(accessToken);
          const validatedToken = extractTokenCandidate(validationResponse);
          if (validatedToken) {
            accessToken = validatedToken;
          }
        }

        const authPayload = validationResponse ?? exchangeResponse ?? {};
        const authState = extractAuthState(authPayload);
        const decodedToken = decodeJWT(accessToken);
        const userInfo = normalizeSystemAdminUser(buildUserInfo(authState, decodedToken));
        const systemAdmin = isSystemAdminUser(userInfo);

        if (authState.root && authState.root.valid === false) {
          throw new Error(firstString(authState.root.error, authState.root.message, 'Token inválido') || 'Token inválido');
        }

        const refreshTokenCandidate = refreshToken || authState.refreshToken;
        if (refreshTokenCandidate) {
          localStorage.setItem('refresh_token', refreshTokenCandidate);
        }

        let normalizedSubscription: Subscription | null = null;
        if (authState.subscriptionSource && !systemAdmin) {
          normalizedSubscription = persistSubscription(authState.subscriptionSource, userInfo);
        }

        if (Array.isArray(authState.availablePlansSource)) {
          const normalizedPlans = normalizeAvailablePlans(authState.availablePlansSource);
          localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
          setAvailablePlans(normalizedPlans);
        }

        if (systemAdmin) {
          syncSystemAdminAccess();
        } else if (typeof authState.hasAccess === 'boolean') {
          syncSubscriptionAccess(authState.hasAccess);
        } else {
          syncSubscriptionAccess(null);
        }

        if (!accessToken) {
          throw new Error('No access token available');
        }

        finalizeLogin(userInfo, normalizedSubscription, systemAdmin, accessToken);
        return;
      }

      let accessToken = tokenOrCode;
      let authResponse = null;
      let normalizedSubscription: Subscription | null = null;

      if (!tokenOrCode.startsWith('eyJ')) {
        const requestBody = {
          code: tokenOrCode,
          application_id: configManager.authAppId,
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        let tokenResponse;
        try {
          tokenResponse = await fetch(configManager.authValidaToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('La solicitud de autenticación tardó demasiado. Por favor verifica tu conexión e intenta de nuevo.');
          }
          throw new Error(`Error de red al intercambiar código: ${fetchError.message}`);
        }

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          throw new Error(`Failed to exchange code for token: ${tokenResponse.status} - ${errorText}`);
        }

        authResponse = await tokenResponse.json();
        accessToken = authResponse.access_token || authResponse.data?.access_token;

        const refreshToken = authResponse.refresh_token || authResponse.data?.refresh_token;
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        const earlySystemAdmin = isSystemAdminEmail(
          authResponse.data?.user?.email ||
          authResponse.data?.email ||
          ''
        );

        // Save subscription from exchange response immediately (before JWT decode)
        if (!earlySystemAdmin) {
          const earlyRawSub =
            authResponse.subscription ??
            authResponse.data?.subscription ??
            authResponse.data?.user?.subscription;
          if (earlyRawSub) {
            persistSubscription(earlyRawSub, authResponse.data?.user ?? authResponse.data ?? null);
          }
 
          const earlyHasAccess =
            typeof authResponse.has_access === 'boolean'
              ? authResponse.has_access
              : typeof authResponse.data?.has_access === 'boolean'
              ? authResponse.data.has_access
              : undefined;
          if (typeof earlyHasAccess === 'boolean') {
            syncSubscriptionAccess(earlyHasAccess);
          } else {
            syncSubscriptionAccess(null);
          }
        } else {
          syncSystemAdminAccess();
        }

        // Save available_plans from exchange response
        const earlyPlans =
          authResponse.available_plans ??
          authResponse.data?.available_plans ??
          authResponse.data?.user?.available_plans;
        if (earlyPlans && Array.isArray(earlyPlans)) {
          const normalizedPlans = normalizeAvailablePlans(earlyPlans);
          localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
          setAvailablePlans(normalizedPlans);
        }

      }

      if (!accessToken) {
        throw new Error('No access token available');
      }

      // Persist access token so the session survives browser refreshes.
      localStorage.setItem('access_token', accessToken || '');
      authClient.setAccessToken(accessToken);

      let decodedToken = decodeJWT(accessToken);
      let userInfo: User;

      if (!decodedToken && authResponse?.data) {
        const userData = authResponse.data.user || authResponse.data;
        userInfo = normalizeSystemAdminUser({
          sub: userData.id || userData.user_id || userData.sub || 'unknown',
          name: userData.name || userData.username || 'Usuario',
          email: userData.email || '',
          picture: userData.picture || userData.avatar,
          role: userData.role,
          permissions: userData.permissions || {},
          permissions_hierarchy: userData.permissions_hierarchy || undefined,
          tenant_id: userData.tenant_id || undefined,
          tenant_name: userData.tenant_name || undefined,
          active_users_count: userData.active_users_count !== undefined ? Number(userData.active_users_count) : undefined,
        });

        if (isSystemAdminUser(userInfo)) {
          syncSystemAdminAccess();
        } else {
          const subSource = authResponse.data.subscription ?? authResponse.data.user?.subscription;
          if (subSource) {
            normalizedSubscription = persistSubscription(subSource, userInfo);
          }

          const authHasAccess =
            typeof authResponse?.has_access === 'boolean'
              ? authResponse.has_access
              : typeof authResponse?.data?.has_access === 'boolean'
              ? authResponse.data.has_access
              : typeof decodedToken?.has_access === 'boolean'
              ? decodedToken.has_access
              : undefined;
          if (typeof authHasAccess === 'boolean') {
            syncSubscriptionAccess(authHasAccess);
          } else {
            syncSubscriptionAccess(null);
          }
        }
      } else if (decodedToken) {
        const tokenUser = authResponse?.data?.user || decodedToken.user || decodedToken;
        const tenantObj = authResponse?.data?.tenant;
        userInfo = normalizeSystemAdminUser({
          sub: tokenUser.id || tokenUser.sub || tokenUser.user_id,
          name: tokenUser.name || tokenUser.username || 'Usuario',
          email: tokenUser.email || '',
          picture: tokenUser.picture || tokenUser.avatar,
          role: tokenUser.role,
          permissions: tokenUser.permissions || decodedToken.permissions || {},
          permissions_hierarchy: tokenUser.permissions_hierarchy || decodedToken.permissions_hierarchy || undefined,
          tenant_id: tokenUser.tenant_id || decodedToken.tenant_id || tenantObj?.id || undefined,
          tenant_name: tokenUser.tenant_name || decodedToken.tenant_name || tenantObj?.name || tenantObj?.organization_name || undefined,
          active_users_count: tenantObj?.active_users_count !== undefined
            ? Number(tenantObj.active_users_count)
            : tokenUser.active_users_count !== undefined
            ? Number(tokenUser.active_users_count)
            : decodedToken.active_users_count !== undefined
            ? Number(decodedToken.active_users_count)
            : undefined,
        });

        const rawPlans =
          authResponse?.available_plans ??
          authResponse?.data?.available_plans ??
          authResponse?.data?.user?.available_plans ??
          decodedToken.available_plans;

        if (rawPlans && Array.isArray(rawPlans)) {
          const normalizedPlans = normalizeAvailablePlans(rawPlans);
          localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
          setAvailablePlans(normalizedPlans);
        }

        if (!isSystemAdminUser(userInfo)) {
          const rawSub =
            authResponse?.subscription ??
            authResponse?.data?.subscription ??
            authResponse?.data?.user?.subscription ??
            decodedToken.subscription;

          if (rawSub) {
            normalizedSubscription = persistSubscription(rawSub, userInfo);
          }

          const rawHasAccess =
            typeof authResponse?.has_access === 'boolean'
              ? authResponse.has_access
              : typeof authResponse?.data?.has_access === 'boolean'
              ? authResponse.data.has_access
              : typeof decodedToken?.has_access === 'boolean'
              ? decodedToken.has_access
              : undefined;

          if (typeof rawHasAccess === 'boolean') {
            syncSubscriptionAccess(rawHasAccess);
          } else {
            syncSubscriptionAccess(null);
          }
        } else {
          syncSystemAdminAccess();
        }
      } else {
        throw new Error('Failed to get user info from token or auth response');
      }

      const normalizedUser = normalizeSystemAdminUser(userInfo);
      const systemAdmin = isSystemAdminUser(normalizedUser);

      finalizeLogin(normalizedUser, normalizedSubscription, systemAdmin, accessToken);
    } catch (error) {
      void recordWebAccessAttempt({
        event_type: 'login_failed',
        attempt_id: consumePendingWebAccessAttemptId() || undefined,
        path: typeof window !== 'undefined' ? window.location.pathname : undefined,
        error_message: error instanceof Error ? error.message : String(error),
        metadata: {
          source: 'auth.handleCallback',
        },
      });
      throw error;
    }
  };

  const hasPermission = (menu: string, permission: MenuPermission): boolean => {
    if (isSystemAdminSession()) return true;
    if (!user || !user.permissions) return false;
    // Support submenu keys like "templates.correos" directly from flat permissions map
    const menuPermissions = user.permissions[menu];
    if (menuPermissions) return menuPermissions.includes(permission);

    // Fallback: check permissions_hierarchy submenus
    if (user.permissions_hierarchy && menu.includes('.')) {
      const [parentKey, submenuKey] = menu.split('.', 2);
      const parentEntry = user.permissions_hierarchy[parentKey];
      if (parentEntry?.submenus) {
        const submenuPerms = parentEntry.submenus[menu] ?? parentEntry.submenus[submenuKey];
        if (submenuPerms) return submenuPerms.includes(permission);
      }
    }

    return false;
  };

  const hasMenuAccess = (menu: string): boolean => {
    if (isSystemAdminSession()) return true;
    if (!user) return false;
    // Marketplace is always accessible to authenticated users
    if (menu === 'marketplace') return true;

    // Check direct permission key first
    if (hasPermission(menu, 'read')) return true;

    // Legacy aliases for backward compatibility
    const menuAliases: Record<string, string[]> = {
      'dashboard':     ['dashboard', 'analytics', 'inicio'],
      'templates':     ['templates', 'plantillas'],
      'statistics':    ['statistics', 'estadisticas', 'stats'],
      'tareas':        ['tareas'],
      'automatizaciones': ['automatizaciones', 'automation', 'automations'],
      'documentation': ['documentation', 'documentacion', 'docs'],
      'settings':      ['settings', 'configuracion', 'config'],
      'api_explorer':  ['api_explorer'],
    };

    const aliases = menuAliases[menu];
    if (aliases) return aliases.some(key => hasPermission(key, 'read'));

    return false;
  };

  const hasSubmenuAccess = (submenuKey: string): boolean => {
    if (isSystemAdminSession()) return true;
    if (!user) return false;
    return hasPermission(submenuKey, 'read');
  };

  // Re-exchange the stored refresh_token to get a fresh subscription state
  const refreshSubscription = async (
    options?: { skipDedicatedProvisioning?: boolean },
  ): Promise<void> => {
    const shouldProvisionDedicatedApi = !options?.skipDedicatedProvisioning;

    try {
      if (isSystemAdminSession()) {
        syncSystemAdminAccess();
        return;
      }

      updateAuthProgress('refreshing', 'Sincronizando tu suscripción...');

      // Prefer in-memory access token; if absent, try refresh via cookie
      await configManager.loadConfig();

      {
        let accessToken = authClient.getAccessToken();
        if (!accessToken) {
          accessToken = await authClient.refreshAccessToken(configManager.authFunctionsBaseUrl);
        }
        if (!accessToken) return;

        let validationResponse: any = null;
        if (configManager.authTokenValida) {
          validationResponse = await validateTokenWithApi(accessToken);
          const validatedToken = extractTokenCandidate(validationResponse);
          if (validatedToken) {
            accessToken = validatedToken;
          }
        } else if (configManager.authValidaToken) {
          validationResponse = await postJson(configManager.authValidaToken, {
            code: accessToken,
            application_id: configManager.authAppId,
          });
        }

        const decodedToken = decodeJWT(accessToken);
        const authState = extractAuthState(validationResponse ?? {});

        if (authState.root && authState.root.valid === false) {
          return;
        }

        const rawSub = authState.subscriptionSource ?? decodedToken?.subscription;
        const rawHasAccess =
          typeof authState.hasAccess === 'boolean'
            ? authState.hasAccess
            : typeof decodedToken?.has_access === 'boolean'
            ? decodedToken.has_access
            : undefined;
        const rawPlans = authState.availablePlansSource ?? decodedToken?.available_plans;
        const refreshSubscriptionCandidate = user ?? getStoredUserCandidate();
        let normalizedSubscription: Subscription | null = null;

        if (rawSub) {
          normalizedSubscription = persistSubscription(rawSub, refreshSubscriptionCandidate);
        } else {
          localStorage.removeItem('subscription');
          setSubscription(null);
        }

        if (Array.isArray(rawPlans)) {
          const normalizedPlans = normalizeAvailablePlans(rawPlans);
          localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
          setAvailablePlans(normalizedPlans);
        }

        if (typeof rawHasAccess === 'boolean') {
          syncSubscriptionAccess(rawHasAccess);
        } else {
          syncSubscriptionAccess(null);
        }

        if (shouldProvisionDedicatedApi) {
          await ensureDedicatedApiBase(normalizedSubscription, refreshSubscriptionCandidate, isSystemAdminSession());
        }

        localStorage.setItem('access_token', accessToken);
        authClient.setAccessToken(accessToken);
        return;
      }

      let accessToken = authClient.getAccessToken();
      if (!accessToken) {
        accessToken = await authClient.refreshAccessToken(configManager.authFunctionsBaseUrl);
      }
      if (!accessToken) return;

      const res = await fetch(configManager.authValidaToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: accessToken,
          application_id: configManager.authAppId,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      const rawSub =
        data.subscription ??
        data.data?.subscription ??
        data.data?.user?.subscription;
      const rawHasAccess =
        typeof data.has_access === 'boolean'
          ? data.has_access
          : typeof data.data?.has_access === 'boolean'
          ? data.data.has_access
          : undefined;
      const refreshSubscriptionCandidate = user ?? getStoredUserCandidate();
      let normalizedSubscription: Subscription | null = null;

      if (rawSub) {
        normalizedSubscription = persistSubscription(rawSub, refreshSubscriptionCandidate);
      } else {
        localStorage.removeItem('subscription');
        setSubscription(null);
      }

      if (typeof rawHasAccess === 'boolean') {
        syncSubscriptionAccess(rawHasAccess);
      } else {
        syncSubscriptionAccess(null);
      }

      if (shouldProvisionDedicatedApi) {
        await ensureDedicatedApiBase(normalizedSubscription, refreshSubscriptionCandidate, isSystemAdminSession());
      }

      localStorage.setItem('access_token', accessToken || '');
    } catch {
      // Silently fail — caller decides what to do next
    } finally {
      clearAuthProgress();
    }
  };
  const applyCheckoutStatus = async (status: {
    subscription?: any;
    available_plans?: any[];
    has_access?: boolean | null;
  }, options?: { skipDedicatedProvisioning?: boolean }): Promise<void> => {
    if (isSystemAdminSession()) {
      syncSystemAdminAccess();
      return;
    }

    const checkoutSubscription = status.subscription
      ? persistSubscription(status.subscription, user ?? getStoredUserCandidate())
      : null;

    if (!status.subscription) {
      localStorage.removeItem('subscription');
      setSubscription(null);
    }

    if (Array.isArray(status.available_plans)) {
      const normalizedPlans = normalizeAvailablePlans(status.available_plans);
      localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
      setAvailablePlans(normalizedPlans);
    }

    if (typeof status.has_access === 'boolean') {
      syncSubscriptionAccess(status.has_access);
    } else {
      syncSubscriptionAccess(null);
    }

    if (!options?.skipDedicatedProvisioning) {
      await ensureDedicatedApiBase(checkoutSubscription, user ?? getStoredUserCandidate(), isSystemAdminSession());
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user,
        isLoading,
        authProgress,
        isSystemAdmin: isSystemAdminSession(),
        subscription,
        subscriptionHasAccess,
        availablePlans,
        login,
        register,
        logout,
        logoutAndRedirect,
        handleCallback,
        hasPermission,
        hasMenuAccess,
        hasSubmenuAccess,
        refreshSubscription,
        applyCheckoutStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
