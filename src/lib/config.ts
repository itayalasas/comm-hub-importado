const CONFIG_API_URL = 'https://ffihaeatoundrjzgtpzk.supabase.co/functions/v1/get-env';
const CONFIG_ACCESS_KEY = '4ceffb91030a93e1e3670ca95f8b63976517745a64ace0aa8b86e7861884ca45';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: {
    VITE_FUNCTIONS_BASE_URL: string;
    VITE_QUERY_API_URL: string;
    PLANS_API_URL: string;
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    API_KEY: string;
    VITE_AUTH_API_KEY: string;
    VITE_AUTH_APP_ID: string;
    VITE_AUTH_URL: string;
    VITE_REDIRECT_URI: string;
    AUTH_VALIDA_TOKEN: string;
  };
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

export function normalizeFunctionsBaseUrl(value: string): string {
  const trimmed = (value || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  return trimmed
    .replace(/\/functions\/v1$/i, '')
    .replace(/\/functions$/i, '')
    .replace(/\/v1$/i, '');
}

function trimBaseUrl(value: string): string {
  return (value || '').trim().replace(/\/+$/, '');
}

export function buildFunctionsUrl(endpoint: string, baseUrl?: string): string {
  const resolvedBaseUrl = trimBaseUrl(
    baseUrl || getRuntimeConfig().functionsBaseUrlRaw || getRuntimeConfig().supabaseUrl || ''
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

  if (/(KEY|TOKEN|SECRET|ANON)/i.test(key)) {
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

function readEnvFallback(key: keyof EnvConfig['variables']): string {
  switch (key) {
    case 'VITE_FUNCTIONS_BASE_URL':
      return import.meta.env.VITE_FUNCTIONS_BASE_URL ?? import.meta.env.VITE_SUPABASE_URL ?? '';
    case 'VITE_QUERY_API_URL':
      return import.meta.env.VITE_QUERY_API_URL ?? '';
    case 'PLANS_API_URL':
      return import.meta.env.PLANS_API_URL ?? import.meta.env.VITE_PLANS_API_URL ?? '';
    case 'VITE_SUPABASE_URL':
      return import.meta.env.VITE_SUPABASE_URL ?? '';
    case 'VITE_SUPABASE_ANON_KEY':
      return import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
    case 'API_KEY':
      return import.meta.env.VITE_API_KEY ?? import.meta.env.API_KEY ?? '';
    case 'VITE_AUTH_API_KEY':
      return import.meta.env.VITE_AUTH_API_KEY ?? '';
    case 'VITE_AUTH_APP_ID':
      return import.meta.env.VITE_AUTH_APP_ID ?? '';
    case 'VITE_AUTH_URL':
      return import.meta.env.VITE_AUTH_URL ?? '';
    case 'VITE_REDIRECT_URI':
      return import.meta.env.VITE_REDIRECT_URI ?? '';
    case 'AUTH_VALIDA_TOKEN':
      return import.meta.env.AUTH_VALIDA_TOKEN ?? 'https://sfqtmnncgiqkveaoqckt.supabase.co/v1/auth-exchange-code';
    default:
      return '';
  }
}

function buildFallbackConfig(): EnvConfig {
  const functionsBaseUrl = trimBaseUrl(readEnvFallback('VITE_FUNCTIONS_BASE_URL') || readEnvFallback('VITE_SUPABASE_URL'));
  const queryApiUrl = readEnvFallback('VITE_QUERY_API_URL') || (functionsBaseUrl ? `${functionsBaseUrl}/query` : '');
  const plansApiUrl = readEnvFallback('PLANS_API_URL') || (functionsBaseUrl ? `${functionsBaseUrl}/application-plans` : '');

  return {
    project_name: '',
    description: '',
    variables: {
      VITE_FUNCTIONS_BASE_URL: functionsBaseUrl,
      VITE_QUERY_API_URL: queryApiUrl,
      PLANS_API_URL: plansApiUrl,
      VITE_SUPABASE_URL: readEnvFallback('VITE_SUPABASE_URL'),
      VITE_SUPABASE_ANON_KEY: readEnvFallback('VITE_SUPABASE_ANON_KEY'),
      API_KEY: readEnvFallback('API_KEY'),
      VITE_AUTH_API_KEY: readEnvFallback('VITE_AUTH_API_KEY'),
      VITE_AUTH_APP_ID: readEnvFallback('VITE_AUTH_APP_ID'),
      VITE_AUTH_URL: readEnvFallback('VITE_AUTH_URL'),
      VITE_REDIRECT_URI: readEnvFallback('VITE_REDIRECT_URI'),
      AUTH_VALIDA_TOKEN: readEnvFallback('AUTH_VALIDA_TOKEN'),
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

        const remoteConfig = await response.json();
        const fallbackConfig = buildFallbackConfig();
        const remoteVariables = (remoteConfig?.variables ?? {}) as Record<string, string>;
        const functionsBaseUrl =
          trimBaseUrl(
          remoteVariables.VITE_FUNCTIONS_BASE_URL ??
          remoteVariables.FUNCTIONS_BASE_URL ??
          remoteVariables.VITE_SUPABASE_URL ??
          fallbackConfig.variables.VITE_FUNCTIONS_BASE_URL ??
          fallbackConfig.variables.VITE_SUPABASE_URL,
          );
        const queryApiUrl =
          remoteVariables.VITE_QUERY_API_URL ??
          remoteVariables.QUERY_API_URL ??
          (functionsBaseUrl ? `${functionsBaseUrl}/query` : fallbackConfig.variables.VITE_QUERY_API_URL);
        const plansApiUrl =
          remoteVariables.PLANS_API_URL ??
          remoteVariables.VITE_PLANS_API_URL ??
          (functionsBaseUrl ? `${functionsBaseUrl}/application-plans` : fallbackConfig.variables.PLANS_API_URL);
        const resolvedConfig: EnvConfig = {
          ...fallbackConfig,
          ...remoteConfig,
          variables: {
            ...fallbackConfig.variables,
            ...remoteVariables,
            VITE_FUNCTIONS_BASE_URL: functionsBaseUrl,
            VITE_QUERY_API_URL: queryApiUrl,
            PLANS_API_URL: plansApiUrl,
            VITE_SUPABASE_URL: remoteVariables.VITE_SUPABASE_URL || fallbackConfig.variables.VITE_SUPABASE_URL,
            API_KEY: remoteVariables.API_KEY || fallbackConfig.variables.API_KEY,
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

  getVariable(key: keyof EnvConfig['variables']): string {
    return this.config?.variables[key] || readEnvFallback(key);
  }

  get functionsBaseUrl(): string {
    return normalizeFunctionsBaseUrl(this.getVariable('VITE_FUNCTIONS_BASE_URL') || this.getVariable('VITE_SUPABASE_URL'));
  }

  get queryApiUrl(): string {
    const explicitQueryApiUrl = this.getVariable('VITE_QUERY_API_URL');
    if (explicitQueryApiUrl) return explicitQueryApiUrl;
    const rawBaseUrl = trimBaseUrl(this.getVariable('VITE_FUNCTIONS_BASE_URL') || this.getVariable('VITE_SUPABASE_URL'));
    return rawBaseUrl ? `${rawBaseUrl}/query` : '';
  }

  get plansApiUrl(): string {
    const explicitPlansApiUrl = this.getVariable('PLANS_API_URL');
    if (explicitPlansApiUrl) return explicitPlansApiUrl;
    const rawBaseUrl = trimBaseUrl(this.getVariable('VITE_FUNCTIONS_BASE_URL') || this.getVariable('VITE_SUPABASE_URL'));
    return rawBaseUrl ? `${rawBaseUrl}/application-plans` : '';
  }

  get supabaseUrl(): string {
    return this.getVariable('VITE_SUPABASE_URL');
  }

  get supabaseAnonKey(): string {
    return this.getVariable('VITE_SUPABASE_ANON_KEY');
  }

  get apiKey(): string {
    return this.getVariable('API_KEY');
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

export function getRuntimeConfig() {
  const snapshot = configManager.getSnapshot();
  const functionsBaseUrlRaw = trimBaseUrl(snapshot.variables.VITE_FUNCTIONS_BASE_URL || snapshot.variables.VITE_SUPABASE_URL);
  const functionsBaseUrl = normalizeFunctionsBaseUrl(functionsBaseUrlRaw);
  return {
    functionsBaseUrlRaw,
    functionsBaseUrl,
    queryApiUrl: snapshot.variables.VITE_QUERY_API_URL || (functionsBaseUrlRaw ? `${functionsBaseUrlRaw}/query` : ''),
    plansApiUrl: snapshot.variables.PLANS_API_URL || (functionsBaseUrlRaw ? `${functionsBaseUrlRaw}/application-plans` : ''),
    supabaseUrl: snapshot.variables.VITE_SUPABASE_URL,
    supabaseAnonKey: snapshot.variables.VITE_SUPABASE_ANON_KEY,
    apiKey: snapshot.variables.API_KEY,
    authApiKey: snapshot.variables.VITE_AUTH_API_KEY,
    authAppId: snapshot.variables.VITE_AUTH_APP_ID,
    authUrl: snapshot.variables.VITE_AUTH_URL,
    redirectUri: snapshot.variables.VITE_REDIRECT_URI,
    authValidaToken: snapshot.variables.AUTH_VALIDA_TOKEN,
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
