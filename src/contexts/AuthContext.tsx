import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configManager } from '../lib/config';

type MenuPermission = 'create' | 'read' | 'update' | 'delete';

type MenuPermissions = {
  [menuSlug: string]: MenuPermission[];
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
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  trial_start?: string;
  trial_end?: string;
  period_start: string;
  period_end: string;
  entitlements: {
    features: Feature[];
  };
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
  subscription?: Subscription;
  tenant_id?: string;
  tenant_name?: string;
}

interface AuthContextType {
  user: User | null;
  isAuth: boolean;
  isLoading: boolean;
  subscription: Subscription | null;
  availablePlans: AvailablePlan[];
  login: () => void;
  register: () => void;
  logout: () => void;
  handleCallback: (tokenOrCode: string) => Promise<void>;
  hasPermission: (menu: string, permission: MenuPermission) => boolean;
  hasMenuAccess: (menu: string) => boolean;
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
      plan_name: String(rawSubscription.plan_name || 'Plan'),
      plan_price: Number(rawSubscription.plan_price || 0),
      plan_currency: String(rawSubscription.plan_currency || 'USD'),
      trial_start: rawSubscription.trial_start ? String(rawSubscription.trial_start) : undefined,
      trial_end: rawSubscription.trial_end ? String(rawSubscription.trial_end) : undefined,
      period_start: String(rawSubscription.period_start || ''),
      period_end: String(rawSubscription.period_end || ''),
      entitlements: {
        features: normalizeFeatures(rawFeatures),
      },
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
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('access_token');
    const storedSubscription = localStorage.getItem('subscription');
    const storedPlans = localStorage.getItem('available_plans');

    if (storedUser && storedToken) {
      const parsedUser = JSON.parse(storedUser);
      console.log('=== LOADING USER FROM LOCALSTORAGE ===');
      console.log('User:', parsedUser.email);
      console.log('Role:', parsedUser.role);
      console.log('All Permissions:', JSON.stringify(parsedUser.permissions, null, 2));
      console.log('Menus with access:', Object.keys(parsedUser.permissions || {}));
      setUser(parsedUser);
    }

    if (storedSubscription) {
      const parsedSubscription = JSON.parse(storedSubscription);
      const normalizedSubscription = normalizeSubscription(parsedSubscription);
      setSubscription(normalizedSubscription);
    }

    if (storedPlans) {
      const parsedPlans = JSON.parse(storedPlans);
      console.log('=== LOADING AVAILABLE PLANS FROM LOCALSTORAGE ===');
      console.log('Plans count:', parsedPlans.length);
      setAvailablePlans(normalizeAvailablePlans(parsedPlans));
    }

    setIsLoading(false);
  }, []);

  const login = () => {
    console.log('=== LOGIN REDIRECT ===');
    console.log('Auth URL:', configManager.authUrl);
    console.log('App ID:', configManager.authAppId);
    console.log('Redirect URI:', configManager.redirectUri);
    console.log('API Key:', configManager.authApiKey);

    const authUrl = `${configManager.authUrl}/login?` +
      `app_id=${configManager.authAppId}&` +
      `redirect_uri=${encodeURIComponent(configManager.redirectUri)}&` +
      `api_key=${configManager.authApiKey}`;

    console.log('Full auth URL:', authUrl);
    window.location.href = authUrl;
  };

  const register = () => {
    const authUrl = `${configManager.authUrl}/register-tenant?` +
      `app_id=${configManager.authAppId}&` +
      `redirect_uri=${encodeURIComponent(configManager.redirectUri)}&` +
      `api_key=${configManager.authApiKey}`;

    window.location.href = authUrl;
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('subscription');
    setUser(null);
    setSubscription(null);
    window.location.href = '/';
  };

  const decodeJWT = (token: string): any => {
    try {
      if (!token || typeof token !== 'string') {
        console.error('Invalid token: not a string or empty');
        return null;
      }

      const parts = token.split('.');
      console.log('JWT parts count:', parts.length);

      if (parts.length !== 3) {
        console.error('Invalid JWT: expected 3 parts, got', parts.length);
        return null;
      }

      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      let jsonPayload: string;
      try {
        const rawString = atob(base64);
        jsonPayload = decodeURIComponent(escape(rawString));
      } catch (uriError) {
        console.warn('Failed with decodeURIComponent+escape, trying direct atob');
        jsonPayload = atob(base64);
      }

      const decoded = JSON.parse(jsonPayload);
      console.log('JWT decoded successfully. Keys:', Object.keys(decoded));
      return decoded;
    } catch (error) {
      console.error('Error decoding JWT:', error);
      console.error('Token was:', token?.substring(0, 100) + '...');
      return null;
    }
  };

  const handleCallback = async (tokenOrCode: string) => {
    try {
      console.log('=== HANDLE CALLBACK START ===');
      console.log('Token/Code received:', tokenOrCode.substring(0, 50) + '...');
      console.log('Token/Code starts with eyJ:', tokenOrCode.startsWith('eyJ'));
      console.log('Token/Code length:', tokenOrCode.length);
      console.log('Config loaded:', configManager.isLoaded());

      if (configManager.isLoaded()) {
        console.log('Config values available:');
        console.log('- Auth URL:', configManager.authUrl);
        console.log('- Auth App ID:', configManager.authAppId);
        console.log('- Auth Valida Token:', configManager.authValidaToken);
      } else {
        console.error('ConfigManager not loaded yet!');
      }

      let accessToken = tokenOrCode;
      let authResponse = null;

      if (!tokenOrCode.startsWith('eyJ')) {
        console.log('=== CODE EXCHANGE PROCESS ===');
        console.log('Exchanging code for token...');
        console.log('Using AUTH_VALIDA_TOKEN:', configManager.authValidaToken);
        console.log('Code:', tokenOrCode);
        console.log('Application ID:', configManager.authAppId);

        const requestBody = {
          code: tokenOrCode,
          application_id: configManager.authAppId,
        };
        console.log('Request body:', JSON.stringify(requestBody, null, 2));

        console.log('Making fetch request...');
        console.log('Fetch URL:', configManager.authValidaToken);
        console.log('Fetch starting at:', new Date().toISOString());

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error('=== FETCH TIMEOUT (20s) ===');
          controller.abort();
        }, 20000);

        let tokenResponse;
        try {
          tokenResponse = await fetch(configManager.authValidaToken, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          console.log('Fetch completed at:', new Date().toISOString());
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            console.error('=== FETCH ABORTED - TIMEOUT ===');
            throw new Error('La solicitud de autenticación tardó demasiado. Por favor verifica tu conexión e intenta de nuevo.');
          }
          console.error('=== FETCH ERROR ===');
          console.error('Error:', fetchError);
          throw new Error(`Error de red al intercambiar código: ${fetchError.message}`);
        }

        console.log('Response status:', tokenResponse.status);
        console.log('Response ok:', tokenResponse.ok);
        console.log('Response headers:', Object.fromEntries(tokenResponse.headers.entries()));

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('=== TOKEN EXCHANGE FAILED ===');
          console.error('Status:', tokenResponse.status);
          console.error('Error text:', errorText);
          throw new Error(`Failed to exchange code for token: ${tokenResponse.status} - ${errorText}`);
        }

        authResponse = await tokenResponse.json();
        console.log('=== TOKEN EXCHANGE SUCCESS ===');
        console.log('Auth response received:', JSON.stringify(authResponse, null, 2));

        accessToken = authResponse.access_token || authResponse.data?.access_token;

        const refreshToken = authResponse.refresh_token || authResponse.data?.refresh_token;
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        if (authResponse.subscription || authResponse.data?.subscription) {
          const rawSubscription = authResponse.subscription || authResponse.data.subscription;
          const normalizedSubscription = normalizeSubscription(rawSubscription);

          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        }
      }

      console.log('Access token to decode:', accessToken?.substring(0, 50) + '...');

      if (!accessToken) {
        throw new Error('No access token available');
      }

      localStorage.setItem('access_token', accessToken);

      let decodedToken = decodeJWT(accessToken);
      console.log('Decoded token:', decodedToken ? 'SUCCESS' : 'FAILED');

      if (decodedToken) {
        console.log('Token payload preview:', {
          sub: decodedToken.sub,
          email: decodedToken.email,
          name: decodedToken.name,
          hasSubscription: !!decodedToken.subscription,
          hasPermissions: !!decodedToken.permissions,
          hasAvailablePlans: !!decodedToken.available_plans,
          availablePlansCount: Array.isArray(decodedToken.available_plans) ? decodedToken.available_plans.length : 0
        });

        if (decodedToken.available_plans) {
          console.log('Available plans raw data:', JSON.stringify(decodedToken.available_plans, null, 2));
        }
      }

      let userInfo: User;

      if (!decodedToken && authResponse?.data) {
        console.log('=== TOKEN NO ES JWT, USANDO DATA DE AUTH RESPONSE ===');
        // The auth response may nest user data under authResponse.data.user or flat in authResponse.data
        const userData = authResponse.data.user || authResponse.data;
        userInfo = {
          sub: userData.id || userData.user_id || userData.sub || 'unknown',
          name: userData.name || userData.username || 'Usuario',
          email: userData.email || '',
          picture: userData.picture || userData.avatar,
          role: userData.role,
          permissions: userData.permissions || {},
          tenant_id: userData.tenant_id || undefined,
          tenant_name: userData.tenant_name || undefined,
        };

        if (authResponse.data.subscription) {
          const normalizedSubscription = normalizeSubscription(authResponse.data.subscription);
          console.log('=== SUBSCRIPTION INFO FROM AUTH RESPONSE ===');
          console.log('Status:', authResponse.data.subscription.status);
          console.log('Plan:', authResponse.data.subscription.plan_name);
          console.log('Trial End:', authResponse.data.subscription.trial_end);
          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        }
      } else if (decodedToken) {
        if (decodedToken.subscription) {
          const normalizedSubscription = normalizeSubscription(decodedToken.subscription);
          console.log('=== SUBSCRIPTION INFO FROM TOKEN ===');
          console.log('Status:', decodedToken.subscription.status);
          console.log('Plan:', decodedToken.subscription.plan_name);
          console.log('Trial Start:', decodedToken.subscription.trial_start);
          console.log('Trial End:', decodedToken.subscription.trial_end);
          console.log('Full subscription:', JSON.stringify(decodedToken.subscription, null, 2));
          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        } else if (authResponse?.data?.subscription) {
          const normalizedSubscription = normalizeSubscription(authResponse.data.subscription);
          console.log('=== SUBSCRIPTION INFO FROM AUTH RESPONSE ===');
          console.log('Status:', authResponse.data.subscription.status);
          console.log('Plan:', authResponse.data.subscription.plan_name);
          console.log('Trial End:', authResponse.data.subscription.trial_end);

          if (normalizedSubscription) {
            localStorage.setItem('subscription', JSON.stringify(normalizedSubscription));
            setSubscription(normalizedSubscription);
          }
        }

        if (decodedToken.available_plans && Array.isArray(decodedToken.available_plans)) {
          console.log('=== AVAILABLE PLANS FROM TOKEN ===');
          console.log('Plans count:', decodedToken.available_plans.length);
          console.log('');

          decodedToken.available_plans.forEach((plan: any, index: number) => {
            console.log(`📦 Plan ${index + 1}:`, plan.name);
            console.log('  ├─ ID:', plan.id);
            console.log('  ├─ Description:', plan.description);
            console.log('  ├─ Price:', plan.price, plan.currency);
            console.log('  ├─ Billing Cycle:', plan.billing_cycle);
            console.log('  ├─ Is Upgrade:', plan.is_upgrade);
            console.log('  ├─ Price Difference:', plan.price_difference);
            console.log('  ├─ Features Count:', plan.entitlements?.features?.length || 0);
            console.log('  ├─ MP Init Point:', plan.mp_init_point ? '✅ Present' : '❌ Missing');
            console.log('  ├─ MP Back URL:', plan.mp_back_url ? '✅ Present' : '❌ Missing');
            console.log('  ├─ MP Preapproval Plan ID:', plan.mp_preapproval_plan_id || '❌ Missing');
            console.log('  └─ MP Status:', plan.mp_status || '❌ Missing');

            if (plan.entitlements?.features) {
              console.log('  📋 Features:');
              plan.entitlements.features.forEach((feature: any) => {
                console.log(`     - ${feature.name} (${feature.code}): ${feature.value} ${feature.unit || ''}`);
              });
            }
            console.log('');
          });

          console.log('💾 Full plans JSON:');
          console.log(JSON.stringify(decodedToken.available_plans, null, 2));

          const normalizedPlans = normalizeAvailablePlans(decodedToken.available_plans);
          localStorage.setItem('available_plans', JSON.stringify(normalizedPlans));
          setAvailablePlans(normalizedPlans);
        }

        // tenant data may be directly in token or nested under token.user
        const tokenUser = decodedToken.user || decodedToken;
        userInfo = {
          sub: tokenUser.id || tokenUser.sub || tokenUser.user_id,
          name: tokenUser.name || tokenUser.username || 'Usuario',
          email: tokenUser.email || '',
          picture: tokenUser.picture || tokenUser.avatar,
          role: tokenUser.role,
          permissions: tokenUser.permissions || decodedToken.permissions || {},
          tenant_id: tokenUser.tenant_id || decodedToken.tenant_id || undefined,
          tenant_name: tokenUser.tenant_name || decodedToken.tenant_name || undefined,
        };
      } else {
        throw new Error('Failed to get user info from token or auth response');
      }

      console.log('=== USER PERMISSIONS LOADED ===');
      console.log('User:', userInfo.email);
      console.log('Role:', userInfo.role);
      console.log('All Permissions:', JSON.stringify(userInfo.permissions, null, 2));
      console.log('Menus with access:', Object.keys(userInfo.permissions || {}));

      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
    } catch (error) {
      console.error('=== ERROR IN HANDLECALLBACK ===');
      console.error('Error:', error);
      console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw error;
    }
  };

  const hasPermission = (menu: string, permission: MenuPermission): boolean => {
    if (!user || !user.permissions) {
      return false;
    }
    const menuPermissions = user.permissions[menu];
    return menuPermissions ? menuPermissions.includes(permission) : false;
  };

  const hasMenuAccess = (menu: string): boolean => {
    console.log(`🔍 hasMenuAccess("${menu}") called`);
    console.log('👤 Current user state:', user);
    console.log('🔐 User permissions:', user?.permissions);

    const menuAliases: Record<string, string[]> = {
      'dashboard': ['dashboard', 'analytics', 'inicio'],
      'templates': ['templates', 'plantillas'],
      'statistics': ['statistics', 'estadisticas', 'stats'],
      'documentation': ['documentation', 'documentacion', 'docs'],
      'settings': ['settings', 'configuracion', 'config'],
    };

    const possibleKeys = menuAliases[menu] || [menu];
    console.log(`🔑 Checking keys for "${menu}":`, possibleKeys);

    for (const key of possibleKeys) {
      const hasReadPermission = hasPermission(key, 'read');
      console.log(`  - Checking "${key}": ${hasReadPermission ? '✅ HAS ACCESS' : '❌ NO ACCESS'}`);
      if (hasReadPermission) {
        console.log(`✅ Access granted to "${menu}" via key "${key}"`);
        return true;
      }
    }

    console.log(`❌ Access denied to "${menu}"`);
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user,
        isLoading,
        subscription,
        availablePlans,
        login,
        register,
        logout,
        handleCallback,
        hasPermission,
        hasMenuAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
