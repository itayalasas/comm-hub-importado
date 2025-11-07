const CONFIG_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const CONFIG_ACCESS_KEY = '4ceffb91030a93e1e3670ca95f8b63976517745a64ace0aa8b86e7861884ca45';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: {
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    VITE_AUTH_API_KEY: string;
    VITE_AUTH_APP_ID: string;
    VITE_AUTH_URL: string;
    VITE_REDIRECT_URI: string;
    AUTH_VALIDA_TOKEN: string;
  };
  updated_at: string;
}

class ConfigManager {
  private config: EnvConfig | null = null;
  private loading: Promise<void> | null = null;

  async loadConfig(): Promise<void> {
    if (this.config) {
      return;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = (async () => {
      try {
        const response = await fetch(CONFIG_API_URL, {
          method: 'GET',
          headers: {
            'X-Access-Key': CONFIG_ACCESS_KEY,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load config: ${response.status}`);
        }

        this.config = await response.json();
        console.log('[Config] Loaded configuration for:', this.config?.project_name);
      } catch (error) {
        console.error('[Config] Failed to load configuration:', error);
        throw error;
      }
    })();

    return this.loading;
  }

  getVariable(key: keyof EnvConfig['variables']): string {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    const value = this.config.variables[key];

    if (!value && key === 'AUTH_VALIDA_TOKEN') {
      const fallback = import.meta.env.AUTH_VALIDA_TOKEN || 'https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code';
      console.log(`[Config] Using fallback for ${key}:`, fallback);
      return fallback;
    }

    return value;
  }

  get supabaseUrl(): string {
    return this.getVariable('VITE_SUPABASE_URL');
  }

  get supabaseAnonKey(): string {
    return this.getVariable('VITE_SUPABASE_ANON_KEY');
  }

  get authApiKey(): string {
    return this.getVariable('VITE_AUTH_API_KEY');
  }

  get authAppId(): string {
    return this.getVariable('VITE_AUTH_APP_ID');
  }

  get authUrl(): string {
    return this.getVariable('VITE_AUTH_URL');
  }

  get redirectUri(): string {
    return this.getVariable('VITE_REDIRECT_URI');
  }

  get authValidaToken(): string {
    return this.getVariable('AUTH_VALIDA_TOKEN');
  }

  isLoaded(): boolean {
    return this.config !== null;
  }
}

export const configManager = new ConfigManager();
