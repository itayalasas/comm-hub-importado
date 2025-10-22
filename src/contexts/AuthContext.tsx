import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const AUTH_URL = import.meta.env.VITE_AUTH_URL;
const AUTH_APP_ID = import.meta.env.VITE_AUTH_APP_ID;
const AUTH_API_KEY = import.meta.env.VITE_AUTH_API_KEY;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI;

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
    const authUrl = `${AUTH_URL}/login?` +
      `app_id=${AUTH_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `api_key=${AUTH_API_KEY}`;

    window.location.href = authUrl;
  };

  const register = () => {
    const authUrl = `${AUTH_URL}/register?` +
      `app_id=${AUTH_APP_ID}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `api_key=${AUTH_API_KEY}`;

    window.location.href = authUrl;
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    window.location.href = '/';
  };

  const handleCallback = async (tokenOrCode: string) => {
    try {
      let accessToken = tokenOrCode;

      if (!tokenOrCode.startsWith('eyJ')) {
        const tokenResponse = await fetch(`${AUTH_URL}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${AUTH_API_KEY}`,
          },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            code: tokenOrCode,
            redirect_uri: REDIRECT_URI,
            client_id: AUTH_APP_ID,
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

      const userInfoResponse = await fetch(`${AUTH_URL}/api/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();
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
