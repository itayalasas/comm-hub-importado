import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configManager } from '../lib/config';

type MenuPermission = 'create' | 'read' | 'update' | 'delete';

type MenuPermissions = {
  [menuSlug: string]: MenuPermission[];
};

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
    features: {
      api_access: boolean;
      advanced_reports: boolean;
      priority_support: boolean;
    };
    max_users: number;
    max_storage_gb: number;
  };
}

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('access_token');
    const storedSubscription = localStorage.getItem('subscription');

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
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  };

  const handleCallback = async (tokenOrCode: string) => {
    try {
      let accessToken = tokenOrCode;
      let authResponse = null;

      if (!tokenOrCode.startsWith('eyJ')) {
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
          throw new Error('Failed to exchange code for token');
        }

        authResponse = await tokenResponse.json();
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

      localStorage.setItem('access_token', accessToken);

      const decodedToken = decodeJWT(accessToken);

      if (!decodedToken) {
        throw new Error('Failed to decode token');
      }

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

      const userInfo: User = {
        sub: decodedToken.sub || decodedToken.user_id || decodedToken.id,
        name: decodedToken.name || decodedToken.username || 'Usuario',
        email: decodedToken.email || '',
        picture: decodedToken.picture || decodedToken.avatar,
        role: decodedToken.role,
        permissions: decodedToken.permissions || {},
      };

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
      console.log(`hasPermission(${menu}, ${permission}): No user or permissions`);
      return false;
    }
    const menuPermissions = user.permissions[menu];
    const result = menuPermissions ? menuPermissions.includes(permission) : false;
    console.log(`hasPermission(${menu}, ${permission}):`, result, 'menuPermissions:', menuPermissions);
    return result;
  };

  const hasMenuAccess = (menu: string): boolean => {
    const result = hasPermission(menu, 'read');
    console.log(`hasMenuAccess(${menu}):`, result);
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user,
        isLoading,
        subscription,
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
