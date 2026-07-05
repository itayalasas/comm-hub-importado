const CONFIG_API_URL = (() => {
  const raw = (import.meta.env.VITE_CONFIG_API_URL || 'https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/get-env')
    .trim()
    .replace(/\/+$/, '');

  return raw.endsWith('/get-env') ? raw : `${raw}/get-env`;
})();
const CONFIG_ACCESS_KEY = '4ceffb91030a93e1e3670ca95f8b63976517745a64ace0aa8b86e7861884ca45';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: Record<string, string>;
  updated_at: string;
}

function shouldLogConfig(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 12) return '***';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function trimBaseUrl(value: string): string {
  return (value || '').trim().replace(/\/+$/, '');
}

export function normalizeFunctionsBaseUrl(value: string): string {
  const trimmed = trimBaseUrl(value);
  if (!trimmed) return '';

  return trimmed
    .replace(/\/functions\/v1$/i, '')
    .replace(/\/functions$/i, '')
    .replace(/\/v1$/i, '');
}

function resolveAuthBaseUrlFromEnv(env: Record<string, string | undefined>): string {
  return normalizeFunctionsBaseUrl(
    env.VITE_AUTH_URL ||
    env.AUTH_URL ||
    env.AUTH_FUNCTIONS_BASE_URL ||
    env.AUTH_EDGE_FUNCTIONS_BASE_URL ||
    '',
  );
}

function buildAuthEndpoint(baseUrl: string, path: string): string {
  const normalizedBase = normalizeFunctionsBaseUrl(baseUrl);
  if (!normalizedBase) return '';

  return `${normalizedBase}/${path.replace(/^\/+/, '')}`;
}

export function buildFunctionsUrl(endpoint: string, baseUrl?: string): string {
  const resolvedBaseUrl = normalizeFunctionsBaseUrl(
    baseUrl || getRuntimeConfig().functionsBaseUrlRaw || '',
  );

  if (!resolvedBaseUrl) {
    throw new Error('Missing functions base URL');
  }

  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const cleanedPath = endpoint
    .replace(/^\/+/, '')
    .replace(/^(functions\/v1\/)+/i, '');

  return `${resolvedBaseUrl}/${cleanedPath}`;
}

function formatEnvValue(key: string, value: string): string {
  if (!value) return '';
  if (/(KEY|TOKEN|SECRET|ANON|PASSWORD)/i.test(key)) {
    return maskSecret(value);
  }
  return value;
}

function buildConfigRows(config: EnvConfig) {
  return Object.entries(config.variables).map(([key, value]) => ({
    variable: key,
    value: formatEnvValue(key, value),
  }));
}

function logLoadedConfig(source: 'remote' | 'fallback', config: EnvConfig) {
  if (!shouldLogConfig()) return;

  console.groupCollapsed(`[config] Variables cargadas desde /get-env (${source})`);
  console.log('project_name:', config.project_name || '(sin nombre)');
  console.log('updated_at:', config.updated_at);
  console.table(buildConfigRows(config));
  console.groupEnd();
}

function readFallbackEnv(key: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const authBaseUrl = resolveAuthBaseUrlFromEnv(env);

  switch (key) {
    case 'VITE_FUNCTIONS_BASE_URL':
      return env.VITE_FUNCTIONS_BASE_URL || env.FUNCTIONS_BASE_URL || '';
    case 'VITE_CONFIG_API_URL':
      return env.VITE_CONFIG_API_URL || '';
    case 'FUNCTIONS_BASE_URL':
      return env.FUNCTIONS_BASE_URL || env.VITE_FUNCTIONS_BASE_URL || '';
    case 'VITE_QUERY_API_URL':
      return env.VITE_QUERY_API_URL || env.QUERY_API_URL || '';
    case 'PLANS_API_URL':
      return env.PLANS_API_URL || env.VITE_PLANS_API_URL || '';
    case 'VITE_PLANS_API_URL':
      return env.VITE_PLANS_API_URL || env.PLANS_API_URL || '';
    case 'API_KEY':
      return env.API_KEY || env.VITE_API_KEY || '';
    case 'API_KEY_USER_EMBED':
      return env.API_KEY_USER_EMBED || '';
    case 'VITE_AUTH_API_KEY':
      return env.VITE_AUTH_API_KEY || '';
    case 'VITE_AUTH_APP_ID':
      return env.VITE_AUTH_APP_ID || '';
    case 'VITE_AUTH_URL':
      return env.VITE_AUTH_URL || env.AUTH_URL || env.AUTH_FUNCTIONS_BASE_URL || env.AUTH_EDGE_FUNCTIONS_BASE_URL || '';
    case 'AUTH_URL':
      return env.AUTH_URL || env.VITE_AUTH_URL || env.AUTH_FUNCTIONS_BASE_URL || env.AUTH_EDGE_FUNCTIONS_BASE_URL || '';
    case 'AUTH_FUNCTIONS_BASE_URL':
      return env.AUTH_FUNCTIONS_BASE_URL || env.AUTH_EDGE_FUNCTIONS_BASE_URL || env.VITE_AUTH_URL || env.AUTH_URL || '';
    case 'VITE_REDIRECT_URI':
      return env.VITE_REDIRECT_URI || '';
    case 'AUTH_VALIDA_TOKEN':
      return env.AUTH_VALIDA_TOKEN || env.AUTH_EXCHANGE_URL || buildAuthEndpoint(authBaseUrl, 'auth-exchange-code');
    case 'AUTH_EXCHANGE_URL':
      return env.AUTH_EXCHANGE_URL || env.AUTH_VALIDA_TOKEN || buildAuthEndpoint(authBaseUrl, 'auth-exchange-code');
    case 'AUTH_TOKEN_VALIDA':
      return env.AUTH_TOKEN_VALIDA || env.AUTH_VERIFY_URL || buildAuthEndpoint(authBaseUrl, 'auth-verify-token');
    case 'AUTH_VERIFY_URL':
      return env.AUTH_VERIFY_URL || env.AUTH_TOKEN_VALIDA || buildAuthEndpoint(authBaseUrl, 'auth-verify-token');
    case 'AUTH_REFRESH_URL':
      return env.AUTH_REFRESH_URL || buildAuthEndpoint(authBaseUrl, 'auth-refresh');
    case 'AUTH_LOGOUT_URL':
      return env.AUTH_LOGOUT_URL || buildAuthEndpoint(authBaseUrl, 'auth-logout');
    case 'URL_HEALTH_CHECK_API':
      return env.URL_HEALTH_CHECK_API || '';
    case 'VALIDATION_API_BASE_URL':
      return env.VALIDATION_API_BASE_URL || '';
    case 'CANCEL_SUBSCRIPTION_URL':
      return env.CANCEL_SUBSCRIPTION_URL || '';
    default:
      return '';
  }
}

function buildFallbackConfig(): EnvConfig {
  const env = import.meta.env as Record<string, string | undefined>;
  const functionsBaseUrl = normalizeFunctionsBaseUrl(
    readFallbackEnv('VITE_FUNCTIONS_BASE_URL') || readFallbackEnv('FUNCTIONS_BASE_URL'),
  );
  const authBaseUrl = resolveAuthBaseUrlFromEnv(env);
  const queryApiUrl = readFallbackEnv('VITE_QUERY_API_URL') || (functionsBaseUrl ? `${functionsBaseUrl}/query` : '');
  const plansApiUrl = readFallbackEnv('PLANS_API_URL') || (functionsBaseUrl ? `${functionsBaseUrl}/application-plans` : '');
  const plansApiUrlVite = readFallbackEnv('VITE_PLANS_API_URL') || plansApiUrl;
  const authExchangeUrl = readFallbackEnv('AUTH_VALIDA_TOKEN') || readFallbackEnv('AUTH_EXCHANGE_URL');
  const authVerifyUrl = readFallbackEnv('AUTH_TOKEN_VALIDA') || readFallbackEnv('AUTH_VERIFY_URL');
  const authRefreshUrl = readFallbackEnv('AUTH_REFRESH_URL');
  const authLogoutUrl = readFallbackEnv('AUTH_LOGOUT_URL');

  return {
    project_name: '',
    description: '',
    variables: {
      VITE_FUNCTIONS_BASE_URL: functionsBaseUrl,
      VITE_CONFIG_API_URL: readFallbackEnv('VITE_CONFIG_API_URL'),
      FUNCTIONS_BASE_URL: functionsBaseUrl,
      VITE_QUERY_API_URL: queryApiUrl,
      PLANS_API_URL: plansApiUrl,
      VITE_PLANS_API_URL: plansApiUrlVite,
      API_KEY: readFallbackEnv('API_KEY'),
      API_KEY_USER_EMBED: readFallbackEnv('API_KEY_USER_EMBED'),
      VITE_AUTH_API_KEY: readFallbackEnv('VITE_AUTH_API_KEY'),
      VITE_AUTH_APP_ID: readFallbackEnv('VITE_AUTH_APP_ID'),
      VITE_AUTH_URL: authBaseUrl,
      AUTH_URL: authBaseUrl,
      AUTH_FUNCTIONS_BASE_URL: authBaseUrl,
      VITE_REDIRECT_URI: readFallbackEnv('VITE_REDIRECT_URI'),
      AUTH_VALIDA_TOKEN: authExchangeUrl,
      AUTH_EXCHANGE_URL: authExchangeUrl,
      AUTH_TOKEN_VALIDA: authVerifyUrl,
      AUTH_VERIFY_URL: authVerifyUrl,
      AUTH_REFRESH_URL: authRefreshUrl,
      AUTH_LOGOUT_URL: authLogoutUrl,
      URL_HEALTH_CHECK_API: readFallbackEnv('URL_HEALTH_CHECK_API'),
      VALIDATION_API_BASE_URL: readFallbackEnv('VALIDATION_API_BASE_URL'),
      CANCEL_SUBSCRIPTION_URL: readFallbackEnv('CANCEL_SUBSCRIPTION_URL'),
    },
    updated_at: new Date().toISOString(),
  };
}

class ConfigManager {
  private config: EnvConfig | null = null;
  private loading: Promise<void> | null = null;

  getSnapshot(): EnvConfig {
    return this.config ?? buildFallbackConfig();
  }

  async loadConfig(): Promise<void> {
    if (this.config) return;
    if (this.loading) return this.loading;

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

        const remoteConfig = await response.json().catch(() => ({}));
        const fallbackConfig = buildFallbackConfig();
        const remoteVariables = (remoteConfig?.variables ?? {}) as Record<string, string>;
        const mergedVariables = {
          ...fallbackConfig.variables,
          ...remoteVariables,
        } as Record<string, string | undefined>;
        const functionsBaseUrl = normalizeFunctionsBaseUrl(
          mergedVariables.VITE_FUNCTIONS_BASE_URL ||
          mergedVariables.FUNCTIONS_BASE_URL ||
          '',
        );
        const authBaseUrl = resolveAuthBaseUrlFromEnv(mergedVariables);
        const queryApiUrl = functionsBaseUrl
          ? `${functionsBaseUrl}/query`
          : remoteVariables.VITE_QUERY_API_URL ||
            remoteVariables.QUERY_API_URL ||
            fallbackConfig.variables.VITE_QUERY_API_URL;
        const plansApiUrl = functionsBaseUrl
          ? remoteVariables.PLANS_API_URL ||
            remoteVariables.VITE_PLANS_API_URL ||
            fallbackConfig.variables.PLANS_API_URL ||
            `${functionsBaseUrl}/application-plans`
          : remoteVariables.PLANS_API_URL ||
            remoteVariables.VITE_PLANS_API_URL ||
            fallbackConfig.variables.PLANS_API_URL;
        const authExchangeUrl = remoteVariables.AUTH_VALIDA_TOKEN ||
            remoteVariables.AUTH_EXCHANGE_URL ||
            fallbackConfig.variables.AUTH_VALIDA_TOKEN ||
            fallbackConfig.variables.AUTH_EXCHANGE_URL;
        const authVerifyUrl = remoteVariables.AUTH_TOKEN_VALIDA ||
            remoteVariables.AUTH_VERIFY_URL ||
            fallbackConfig.variables.AUTH_TOKEN_VALIDA ||
            fallbackConfig.variables.AUTH_VERIFY_URL;
        const authRefreshUrl = remoteVariables.AUTH_REFRESH_URL ||
          fallbackConfig.variables.AUTH_REFRESH_URL;
        const authLogoutUrl = remoteVariables.AUTH_LOGOUT_URL ||
          fallbackConfig.variables.AUTH_LOGOUT_URL;

        const resolvedConfig: EnvConfig = {
          ...fallbackConfig,
          ...remoteConfig,
          variables: {
            ...fallbackConfig.variables,
            ...remoteVariables,
            VITE_FUNCTIONS_BASE_URL: functionsBaseUrl,
            VITE_CONFIG_API_URL: remoteVariables.VITE_CONFIG_API_URL || fallbackConfig.variables.VITE_CONFIG_API_URL,
            FUNCTIONS_BASE_URL: functionsBaseUrl,
            VITE_QUERY_API_URL: queryApiUrl,
            PLANS_API_URL: plansApiUrl,
            VITE_PLANS_API_URL: remoteVariables.VITE_PLANS_API_URL || fallbackConfig.variables.VITE_PLANS_API_URL || plansApiUrl,
            API_KEY: remoteVariables.API_KEY || fallbackConfig.variables.API_KEY,
            API_KEY_USER_EMBED: remoteVariables.API_KEY_USER_EMBED || fallbackConfig.variables.API_KEY_USER_EMBED,
            VITE_AUTH_API_KEY: remoteVariables.VITE_AUTH_API_KEY || fallbackConfig.variables.VITE_AUTH_API_KEY,
            VITE_AUTH_APP_ID: remoteVariables.VITE_AUTH_APP_ID || fallbackConfig.variables.VITE_AUTH_APP_ID,
            VITE_AUTH_URL: authBaseUrl,
            AUTH_URL: authBaseUrl,
            AUTH_FUNCTIONS_BASE_URL: authBaseUrl,
            VITE_REDIRECT_URI: remoteVariables.VITE_REDIRECT_URI || fallbackConfig.variables.VITE_REDIRECT_URI,
            AUTH_VALIDA_TOKEN: authExchangeUrl,
            AUTH_EXCHANGE_URL: authExchangeUrl,
            AUTH_TOKEN_VALIDA: authVerifyUrl,
            AUTH_VERIFY_URL: authVerifyUrl,
            AUTH_REFRESH_URL: authRefreshUrl,
            AUTH_LOGOUT_URL: authLogoutUrl,
            URL_HEALTH_CHECK_API: remoteVariables.URL_HEALTH_CHECK_API || fallbackConfig.variables.URL_HEALTH_CHECK_API,
            VALIDATION_API_BASE_URL: remoteVariables.VALIDATION_API_BASE_URL || fallbackConfig.variables.VALIDATION_API_BASE_URL,
            CANCEL_SUBSCRIPTION_URL: remoteVariables.CANCEL_SUBSCRIPTION_URL || fallbackConfig.variables.CANCEL_SUBSCRIPTION_URL,
          },
        };

        this.config = resolvedConfig;
        logLoadedConfig('remote', resolvedConfig);
      } catch {
        const fallbackConfig = buildFallbackConfig();
        this.config = fallbackConfig;
        logLoadedConfig('fallback', fallbackConfig);
      }
    })();

    return this.loading;
  }

  getVariable(key: string): string {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call loadConfig() first.');
    }

    return this.config.variables[key] || '';
  }

  get functionsBaseUrl(): string {
    return normalizeFunctionsBaseUrl(
      this.getVariable('VITE_FUNCTIONS_BASE_URL') ||
      this.getVariable('FUNCTIONS_BASE_URL'),
    );
  }

  get apiKey(): string {
    return this.getVariable('API_KEY');
  }

  get apiKeyUserEmbed(): string {
    return this.getVariable('API_KEY_USER_EMBED');
  }

  get authApiKey(): string {
    return this.getVariable('VITE_AUTH_API_KEY');
  }

  get authFunctionsBaseUrl(): string {
    return normalizeFunctionsBaseUrl(
      this.getVariable('VITE_AUTH_URL') ||
      this.getVariable('AUTH_URL') ||
      this.getVariable('AUTH_FUNCTIONS_BASE_URL') ||
      this.getVariable('AUTH_EDGE_FUNCTIONS_BASE_URL'),
    );
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

  get authTokenValida(): string {
    return this.getVariable('AUTH_TOKEN_VALIDA');
  }

  get apiUrl(): string {
    const base = this.getVariable('VITE_QUERY_API_URL') || `${this.functionsBaseUrl}/query`;
    return base;
  }

  get urlHealthCheckEmail(): string {
    return this.getVariable('URL_HEALTH_CHECK_API') || (this.functionsBaseUrl ? `${this.functionsBaseUrl}/health-check-email` : '');
  }

  get urlHealthCheckPdf(): string {
    return this.functionsBaseUrl ? `${this.functionsBaseUrl}/health-check-pdf` : '';
  }

  get urlHealthCheckDb(): string {
    return this.functionsBaseUrl ? `${this.functionsBaseUrl}/health-check-bd` : '';
  }

  get validationApiBaseUrl(): string {
    return this.getVariable('VALIDATION_API_BASE_URL');
  }

  get plansApiUrl(): string {
    return this.getVariable('PLANS_API_URL') ||
      this.getVariable('VITE_PLANS_API_URL') ||
      (this.functionsBaseUrl ? `${this.functionsBaseUrl}/application-plans` : '');
  }

  get cancelSubscriptionUrl(): string {
    return this.getVariable('CANCEL_SUBSCRIPTION_URL') || (this.validationApiBaseUrl ? `${this.validationApiBaseUrl}/cancel-subscription` : '');
  }

  isLoaded(): boolean {
    return this.config !== null;
  }
}

export const configManager = new ConfigManager();

export function getRuntimeConfig() {
  const snapshot = configManager.getSnapshot();
  const functionsBaseUrlRaw = normalizeFunctionsBaseUrl(
    snapshot.variables.VITE_FUNCTIONS_BASE_URL ||
    snapshot.variables.FUNCTIONS_BASE_URL ||
    '',
  );
  const functionsBaseUrl = functionsBaseUrlRaw;

  return {
    functionsBaseUrlRaw,
    functionsBaseUrl,
    queryApiUrl: snapshot.variables.VITE_QUERY_API_URL || (functionsBaseUrlRaw ? `${functionsBaseUrlRaw}/query` : ''),
    plansApiUrl: snapshot.variables.PLANS_API_URL || snapshot.variables.VITE_PLANS_API_URL || (functionsBaseUrlRaw ? `${functionsBaseUrlRaw}/application-plans` : ''),
    apiKey: snapshot.variables.API_KEY || '',
    apiKeyUserEmbed: snapshot.variables.API_KEY_USER_EMBED || '',
    authApiKey: snapshot.variables.VITE_AUTH_API_KEY || '',
    authAppId: snapshot.variables.VITE_AUTH_APP_ID || '',
    authUrl: snapshot.variables.VITE_AUTH_URL || snapshot.variables.AUTH_URL || snapshot.variables.AUTH_FUNCTIONS_BASE_URL || '',
    redirectUri: snapshot.variables.VITE_REDIRECT_URI || '',
    authValidaToken: snapshot.variables.AUTH_VALIDA_TOKEN || snapshot.variables.AUTH_EXCHANGE_URL || '',
    authExchangeUrl: snapshot.variables.AUTH_EXCHANGE_URL || snapshot.variables.AUTH_VALIDA_TOKEN || '',
    authTokenValida: snapshot.variables.AUTH_TOKEN_VALIDA || snapshot.variables.AUTH_VERIFY_URL || '',
    authVerifyUrl: snapshot.variables.AUTH_VERIFY_URL || snapshot.variables.AUTH_TOKEN_VALIDA || '',
    authRefreshUrl: snapshot.variables.AUTH_REFRESH_URL || '',
    authLogoutUrl: snapshot.variables.AUTH_LOGOUT_URL || '',
  };
}

export function logRuntimeConfig(context = 'runtime') {
  if (!shouldLogConfig()) return;

  const snapshot = configManager.getSnapshot();

  console.group(`[config] Variables al autenticar (${context})`);
  console.log('project_name:', snapshot.project_name || '(sin nombre)');
  console.log('updated_at:', snapshot.updated_at);
  console.table(buildConfigRows(snapshot));
  console.groupEnd();
}

export async function resolveAuthLaunchConfig(): Promise<ReturnType<typeof getRuntimeConfig>> {
  const runtime = getRuntimeConfig();

  if (runtime.authUrl && runtime.authAppId && runtime.authApiKey && runtime.redirectUri) {
    void configManager.loadConfig().catch(() => {});
    return runtime;
  }

  await configManager.loadConfig();
  return getRuntimeConfig();
}
