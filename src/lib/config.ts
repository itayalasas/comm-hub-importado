const CONFIG_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const CONFIG_ACCESS_KEY = '4ceffb91030a93e1e3670ca95f8b63976517745a64ace0aa8b86e7861884ca45';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: {
    VITE_AUTH_API_KEY: string;
    VITE_AUTH_APP_ID: string;
    VITE_AUTH_URL: string;
    VITE_REDIRECT_URI: string;
    AUTH_VALIDA_TOKEN: string;
    API_URL: string;
    API_KEY: string;
    URL_HEALTH_CHECK: string;
    API_KEY_HEALTH_CHECK: string;
    FUNCTIONS_BASE_URL?: string;
    URL_HEALTH_CHECK_EMAIL?: string;
    URL_HEALTH_CHECK_PDF?: string;
    URL_HEALTH_CHECK_DB?: string;
    URL_HEALTH_CHECK_API?: string;
    AUTH_FUNCTIONS_BASE_URL?: string;
    VALIDATION_API_BASE_URL?: string;
    PLANS_API_URL?: string;
    CANCEL_SUBSCRIPTION_URL?: string;
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
      } catch (error) {
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
      return import.meta.env.AUTH_VALIDA_TOKEN || 'https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1/auth-exchange-code';
    }

    return value ?? '';
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

  get apiUrl(): string {
    try { return this.getVariable('API_URL') || ''; } catch { return ''; }
  }

  get apiKey(): string {
    try { return this.getVariable('API_KEY') || ''; } catch { return ''; }
  }

  get authFunctionsBaseUrl(): string {
    try {
      const explicit = this.config?.variables?.AUTH_FUNCTIONS_BASE_URL;
      if (explicit) return explicit;
      const tokenUrl = this.getVariable('AUTH_VALIDA_TOKEN');
      const match = tokenUrl.match(/^(https:\/\/.+\/functions\/v1)/);
      return match ? match[1] : '';
    } catch { return ''; }
  }

  get validationApiBaseUrl(): string {
    try {
      return this.config?.variables?.VALIDATION_API_BASE_URL ?? '';
    } catch { return ''; }
  }

  get plansApiUrl(): string {
    try {
      const explicit = this.config?.variables?.PLANS_API_URL;
      if (explicit) return explicit;
      const base = this.validationApiBaseUrl;
      return base ? `${base}/validation-api/plans` : '';
    } catch { return ''; }
  }

  get cancelSubscriptionUrl(): string {
    try {
      const explicit = this.config?.variables?.CANCEL_SUBSCRIPTION_URL;
      if (explicit) return explicit;
      const base = this.validationApiBaseUrl;
      return base ? `${base}/cancel-subscription` : '';
    } catch { return ''; }
  }

  get urlHealthCheck(): string {
    try { return this.getVariable('URL_HEALTH_CHECK') || ''; } catch { return ''; }
  }

  get apiKeyHealthCheck(): string {
    try { return this.getVariable('API_KEY_HEALTH_CHECK') || ''; } catch { return ''; }
  }

  get functionsBaseUrl(): string {
    try { return this.config?.variables?.FUNCTIONS_BASE_URL ?? ''; } catch { return ''; }
  }

  get urlHealthCheckEmail(): string {
    try { return this.config?.variables?.URL_HEALTH_CHECK_EMAIL ?? ''; } catch { return ''; }
  }

  get urlHealthCheckPdf(): string {
    try { return this.config?.variables?.URL_HEALTH_CHECK_PDF ?? ''; } catch { return ''; }
  }

  get urlHealthCheckDb(): string {
    try { return this.config?.variables?.URL_HEALTH_CHECK_DB ?? ''; } catch { return ''; }
  }

  get urlHealthCheckApi(): string {
    try { return this.config?.variables?.URL_HEALTH_CHECK_API ?? ''; } catch { return ''; }
  }

  isLoaded(): boolean {
    return this.config !== null;
  }
}

export const configManager = new ConfigManager();
