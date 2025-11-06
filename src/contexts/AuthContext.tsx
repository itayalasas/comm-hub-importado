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
      setSubscription(parsedSubscription);
    }

    if (storedPlans) {
      const parsedPlans = JSON.parse(storedPlans);
      console.log('=== LOADING AVAILABLE PLANS FROM LOCALSTORAGE ===');
      console.log('Plans count:', parsedPlans.length);
      setAvailablePlans(parsedPlans);
    }

    setIsLoading(false);
  }, []);

  const login = () => {
    const authUrl = `${configManager.authUrl}/login?` +
      `app_id=${configManager.authAppId}&` +
      `redirect_uri=${encodeURIComponent(configManager.redirectUri)}&` +
      `api_key=${configManager.authApiKey}`;

    window.location.href = authUrl;
  };

  const register = () => {
    const authUrl = `${configManager.authUrl}/register?` +
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
      let accessToken = tokenOrCode;
      let authResponse = null;

      console.log('=== HANDLE CALLBACK START ===');
      console.log('Token/Code starts with eyJ:', tokenOrCode.startsWith('eyJ'));
      console.log('Token/Code length:', tokenOrCode.length);

      if (!tokenOrCode.startsWith('eyJ')) {
        console.log('Exchanging code for token...');
        const tokenResponse = await fetch(`${configManager.authUrl}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${configManager.authApiKey}`,
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: tokenOrCode,
            redirect_uri: configManager.redirectUri,
            client_id: configManager.authAppId,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('Token exchange failed:', errorText);
          throw new Error('Failed to exchange code for token');
        }

        authResponse = await tokenResponse.json();
        console.log('Auth response received:', authResponse);
        accessToken = authResponse.data?.access_token || authResponse.access_token;

        const refreshToken = authResponse.data?.refresh_token || authResponse.refresh_token;
        if (refreshToken) {
          localStorage.setItem('refresh_token', refreshToken);
        }

        if (authResponse.data?.subscription) {
          localStorage.setItem('subscription', JSON.stringify(authResponse.data.subscription));
          setSubscription(authResponse.data.subscription);
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
        userInfo = {
          sub: authResponse.data.user_id || authResponse.data.sub || authResponse.data.id || 'unknown',
          name: authResponse.data.name || authResponse.data.username || 'Usuario',
          email: authResponse.data.email || '',
          picture: authResponse.data.picture || authResponse.data.avatar,
          role: authResponse.data.role,
          permissions: authResponse.data.permissions || {},
        };

        if (authResponse.data.subscription) {
          console.log('=== SUBSCRIPTION INFO FROM AUTH RESPONSE ===');
          console.log('Status:', authResponse.data.subscription.status);
          console.log('Plan:', authResponse.data.subscription.plan_name);
          console.log('Trial End:', authResponse.data.subscription.trial_end);
          localStorage.setItem('subscription', JSON.stringify(authResponse.data.subscription));
          setSubscription(authResponse.data.subscription);
        }
      } else if (decodedToken) {
        if (decodedToken.subscription) {
          console.log('=== SUBSCRIPTION INFO FROM TOKEN ===');
          console.log('Status:', decodedToken.subscription.status);
          console.log('Plan:', decodedToken.subscription.plan_name);
          console.log('Trial Start:', decodedToken.subscription.trial_start);
          console.log('Trial End:', decodedToken.subscription.trial_end);
          console.log('Full subscription:', JSON.stringify(decodedToken.subscription, null, 2));
          localStorage.setItem('subscription', JSON.stringify(decodedToken.subscription));
          setSubscription(decodedToken.subscription);
        } else if (authResponse?.data?.subscription) {
          console.log('=== SUBSCRIPTION INFO FROM AUTH RESPONSE ===');
          console.log('Status:', authResponse.data.subscription.status);
          console.log('Plan:', authResponse.data.subscription.plan_name);
          console.log('Trial End:', authResponse.data.subscription.trial_end);
        }

        if (decodedToken.available_plans && Array.isArray(decodedToken.available_plans)) {
          console.log('=== AVAILABLE PLANS FROM TOKEN ===');
          console.log('Plans count:', decodedToken.available_plans.length);
          localStorage.setItem('available_plans', JSON.stringify(decodedToken.available_plans));
          setAvailablePlans(decodedToken.available_plans);
        }

        userInfo = {
          sub: decodedToken.sub || decodedToken.user_id || decodedToken.id,
          name: decodedToken.name || decodedToken.username || 'Usuario',
          email: decodedToken.email || '',
          picture: decodedToken.picture || decodedToken.avatar,
          role: decodedToken.role,
          permissions: decodedToken.permissions || {},
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
      console.error('Error in handleCallback:', error);
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
