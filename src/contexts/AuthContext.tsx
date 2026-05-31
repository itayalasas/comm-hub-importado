import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configManager, logRuntimeConfig } from '../lib/config';
import { authClient } from '../lib/auth';

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
  subscription: Subscription | null;
  subscriptionHasAccess: boolean | null;
  availablePlans: AvailablePlan[];
  login: () => void;
  register: (planId?: string) => void;
  logout: () => void;
  handleCallback: (tokenOrCode: string) => Promise<void>;
  hasPermission: (menu: string, permission: MenuPermission) => boolean;
  hasMenuAccess: (menu: string) => boolean;
  hasSubmenuAccess: (submenuKey: string) => boolean;
  refreshSubscription: () => Promise<void>;
  applyCheckoutStatus: (status: {
    subscription?: any;
    available_plans?: any[];
    has_access?: boolean | null;
  }) => void;
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

  const normalizeSubscription = (rawSubscription: any): Subscription | null => {
    if (!rawSubscription || typeof rawSubscription !== 'object') return null;

    if (!rawSubscription.id || !rawSubscription.status) {
      return null;
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
      trial_start: rawSubscription.trial_start ? String(rawSubscription.trial_start) : undefined,
      trial_end: rawSubscription.trial_end ? String(rawSubscription.trial_end) : undefined,
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

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuthState = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('access_token');
      const storedSubscription = localStorage.getItem('subscription');
      const storedSubscriptionHasAccess = localStorage.getItem('subscription_has_access');
      const storedPlans = localStorage.getItem('available_plans');

      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          if (!cancelled) {
            setUser(parsedUser);
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
          const refreshedToken = await authClient.refreshAccessToken(configManager.functionsBaseUrl);
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
          const normalizedSubscription = normalizeSubscription(parsedSubscription);
          if (!cancelled) {
            setSubscription(normalizedSubscription);
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

      if (!cancelled) {
        setIsLoading(false);
      }
    };

    void bootstrapAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = () => {
    const authUrl = `${configManager.authUrl}/login?` +
      `app_id=${configManager.authAppId}&` +
      `redirect_uri=${encodeURIComponent(configManager.redirectUri)}&` +
      `api_key=${configManager.authApiKey}`;

    window.location.href = authUrl;
  };

  const register = (planId?: string) => {
    let authUrl = `${configManager.authUrl}/register-tenant?` +
      `app_id=${configManager.authAppId}&` +
      `redirect_uri=${encodeURIComponent(configManager.redirectUri)}&` +
      `api_key=${configManager.authApiKey}`;

    if (planId) {
      authUrl += `&plan_id=${planId}`;
    }

    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      await authClient.logout(configManager.functionsBaseUrl);
    } catch {}
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('subscription');
    localStorage.removeItem('subscription_has_access');
    setUser(null);
    setSubscription(null);
    setSubscriptionHasAccess(null);
    window.location.href = '/';
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

  const handleCallback = async (tokenOrCode: string) => {
    try {
      await configManager.loadConfig();
      logRuntimeConfig('login');

      let accessToken = tokenOrCode;
      let authResponse = null;

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

        // Save subscription from exchange response immediately (before JWT decode)
        const earlyRawSub =
          authResponse.subscription ??
          authResponse.data?.subscription ??
          authResponse.data?.user?.subscription;
        if (earlyRawSub) {
          const normalizedSubscription = normalizeSubscription(earlyRawSub);
          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        }

        const earlyHasAccess =
          typeof authResponse.has_access === 'boolean'
            ? authResponse.has_access
            : typeof authResponse.data?.has_access === 'boolean'
            ? authResponse.data.has_access
            : undefined;
        if (typeof earlyHasAccess === 'boolean') {
          localStorage.setItem('subscription_has_access', JSON.stringify(earlyHasAccess));
          setSubscriptionHasAccess(earlyHasAccess);
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
      localStorage.setItem('access_token', accessToken);
      authClient.setAccessToken(accessToken);

      let decodedToken = decodeJWT(accessToken);
      let userInfo: User;

      if (!decodedToken && authResponse?.data) {
        const userData = authResponse.data.user || authResponse.data;
        userInfo = {
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
        };

        const subSource = authResponse.data.subscription ?? authResponse.data.user?.subscription;
        if (subSource) {
          const normalizedSubscription = normalizeSubscription(subSource);
          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
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
          localStorage.setItem('subscription_has_access', JSON.stringify(authHasAccess));
          setSubscriptionHasAccess(authHasAccess);
        }
      } else if (decodedToken) {
        const rawSub =
          authResponse?.subscription ??
          authResponse?.data?.subscription ??
          authResponse?.data?.user?.subscription ??
          decodedToken.subscription;

        if (rawSub) {
          const normalizedSubscription = normalizeSubscription(rawSub);
          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        }

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

        const tokenUser = authResponse?.data?.user || decodedToken.user || decodedToken;
        const tenantObj = authResponse?.data?.tenant;
        userInfo = {
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
        };
      } else {
        throw new Error('Failed to get user info from token or auth response');
      }

      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
    } catch (error) {
      throw error;
    }
  };

  const hasPermission = (menu: string, permission: MenuPermission): boolean => {
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
      'documentation': ['documentation', 'documentacion', 'docs'],
      'settings':      ['settings', 'configuracion', 'config'],
      'api_explorer':  ['api_explorer'],
    };

    const aliases = menuAliases[menu];
    if (aliases) return aliases.some(key => hasPermission(key, 'read'));

    return false;
  };

  const hasSubmenuAccess = (submenuKey: string): boolean => {
    if (!user) return false;
    return hasPermission(submenuKey, 'read');
  };

  // Re-exchange the stored refresh_token to get a fresh subscription state
  const refreshSubscription = async (): Promise<void> => {
    try {
      // Prefer in-memory access token; if absent, try refresh via cookie
      await configManager.loadConfig();
      let accessToken = authClient.getAccessToken();
      if (!accessToken) {
        accessToken = await authClient.refreshAccessToken(configManager.functionsBaseUrl);
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

      if (rawSub) {
        const normalized = normalizeSubscription(rawSub);
        if (normalized) {
          localStorage.setItem('subscription', JSON.stringify(normalized));
          setSubscription(normalized);
        }
      } else {
        localStorage.removeItem('subscription');
        setSubscription(null);
      }

      if (typeof rawHasAccess === 'boolean') {
        localStorage.setItem('subscription_has_access', JSON.stringify(rawHasAccess));
        setSubscriptionHasAccess(rawHasAccess);
      }

      localStorage.setItem('access_token', accessToken);
    } catch {
      // Silently fail — caller decides what to do next
    }
  };

  const applyCheckoutStatus = (status: {
    subscription?: any;
    available_plans?: any[];
    has_access?: boolean | null;
  }): void => {
    if (status.subscription) {
      const normalized = normalizeSubscription(status.subscription);
      if (normalized) {
        localStorage.setItem('subscription', JSON.stringify(normalized));
        setSubscription(normalized);
      }
    }

    if (Array.isArray(status.available_plans)) {
      const normalizedPlans = normalizeAvailablePlans(status.available_plans);
      localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
      setAvailablePlans(normalizedPlans);
    }

    if (typeof status.has_access === 'boolean') {
      localStorage.setItem('subscription_has_access', JSON.stringify(status.has_access));
      setSubscriptionHasAccess(status.has_access);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user,
        isLoading,
        subscription,
        subscriptionHasAccess,
        availablePlans,
        login,
        register,
        logout,
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
