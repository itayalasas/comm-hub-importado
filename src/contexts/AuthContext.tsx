import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configManager } from '../lib/config';

interface User {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isAuth: boolean;
  isLoading: boolean;
  login: () => void;
  register: () => void;
  logout: () => void;
  handleCallback: (tokenOrCode: string) => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('access_token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
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
    setUser(null);
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

        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;
        if (tokens.refresh_token) {
          localStorage.setItem('refresh_token', tokens.refresh_token);
        }
      }

      localStorage.setItem('access_token', accessToken);

      const decodedToken = decodeJWT(accessToken);

      if (!decodedToken) {
        throw new Error('Failed to decode token');
      }

      const userInfo: User = {
        sub: decodedToken.sub || decodedToken.user_id || decodedToken.id,
        name: decodedToken.name || decodedToken.username || 'Usuario',
        email: decodedToken.email || '',
        picture: decodedToken.picture || decodedToken.avatar,
      };

      localStorage.setItem('user', JSON.stringify(userInfo));
      setUser(userInfo);
    } catch (error) {
      console.error('Error in handleCallback:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuth: !!user,
        isLoading,
        login,
        register,
        logout,
        handleCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
