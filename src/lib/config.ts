const CONFIG_API_URL = (() => {
  const raw = (import.meta.env.VITE_CONFIG_API_URL || 'https://proj-apis-pet-2r9a-7efeae.wittybeach-c1a761c9.northcentralus.azurecontainerapps.io/get-env')
    .trim()
    .replace(/\/+$/, '');

  return raw.endsWith('/get-env') ? raw : `${raw}/get-env`;
})();
const CONFIG_ACCESS_KEY = 'cc3cdc09379e1dc8f8482007290a5d9e2d2755c5613f5a3fd81fb02c81040b37';

interface EnvConfig {
  project_name: string;
  description: string;
  variables: Record<string, string>;
  updated_at: string;
}

export interface DedicatedFunctionsBaseUrlState {
  scope: string;
  baseUrl: string;
  publicHostname: string;
  tenantName: string;
  subdomain: string;
  updatedAt: string;
}

const DEDICATED_FUNCTIONS_BASE_URL_STORAGE_KEY = 'dedicated_functions_base_url_state';

function firstString(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function readStoredRecord(key: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readNestedRecord(source: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  if (!source) return null;

  const value = source[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function readCurrentTenantScopeKey(): string {
  const user = readStoredRecord('user');
  const subscription = readStoredRecord('subscription');
  const userTenant = readNestedRecord(user, 'tenant');
  const userMetadata = readNestedRecord(user, 'metadata');
  const subscriptionMetadata = readNestedRecord(subscription, 'metadata');

  const scopeSource = firstString(
    user?.tenant_id as string | number | null | undefined,
    user?.tenantId as string | number | null | undefined,
    userTenant?.id as string | number | null | undefined,
    userMetadata?.tenant_id as string | number | null | undefined,
    userMetadata?.tenantId as string | number | null | undefined,
    user?.tenant_name as string | number | null | undefined,
    user?.tenantName as string | number | null | undefined,
    userTenant?.name as string | number | null | undefined,
    userMetadata?.tenant_name as string | number | null | undefined,
    userMetadata?.tenantName as string | number | null | undefined,
    subscriptionMetadata?.tenant_id as string | number | null | undefined,
    subscriptionMetadata?.tenantId as string | number | null | undefined,
    subscriptionMetadata?.tenant_name as string | number | null | undefined,
    subscriptionMetadata?.tenantName as string | number | null | undefined,
    subscription?.id as string | number | null | undefined,
  );

  return scopeSource ? `tenant:${scopeSource.toLowerCase()}` : '';
}

function hasDedicatedApiAccessFromSubscription(subscription: Record<string, unknown> | null): boolean {
  if (!subscription) return false;

  const entitlements = readNestedRecord(subscription, 'entitlements');
  const rawFeatures = entitlements?.features ?? subscription.features;
  const features = Array.isArray(rawFeatures) ? rawFeatures : [];

  for (const feature of features) {
    if (!feature || typeof feature !== 'object' || Array.isArray(feature)) {
      continue;
    }

    const record = feature as Record<string, unknown>;
    const code = String(record.code || '').trim().toLowerCase();
    if (!['acceso_api_dedicado', 'api_dedicada', 'dedicated_api_access'].includes(code)) {
      continue;
    }

    if (typeof record.value === 'boolean') {
      return record.value;
    }

    if (typeof record.value === 'number') {
      return Number.isFinite(record.value) && record.value > 0;
    }

    const valueType = String(record.value_type || '').trim().toLowerCase();
    const normalizedValue = String(record.value ?? '').trim().toLowerCase();

    if (valueType === 'boolean') {
      return ['true', '1', 'yes', 'on'].includes(normalizedValue);
    }

    if (valueType === 'number') {
      const numericValue = Number(record.value);
      return Number.isFinite(numericValue) && numericValue > 0;
    }

    return ['true', '1', 'yes', 'on'].includes(normalizedValue);
  }

  return false;
}

function readDedicatedFunctionsBaseUrlState(): DedicatedFunctionsBaseUrlState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(DEDICATED_FUNCTIONS_BASE_URL_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const scope = String((parsed as Record<string, unknown>).scope || '').trim();
    const baseUrl = normalizeFunctionsBaseUrl(
      String((parsed as Record<string, unknown>).baseUrl || (parsed as Record<string, unknown>).base_url || ''),
    );
    const publicHostname = String((parsed as Record<string, unknown>).publicHostname || (parsed as Record<string, unknown>).public_hostname || '').trim();
    const tenantName = String((parsed as Record<string, unknown>).tenantName || (parsed as Record<string, unknown>).tenant_name || '').trim();
    const subdomain = String((parsed as Record<string, unknown>).subdomain || '').trim();
    const updatedAt = String((parsed as Record<string, unknown>).updatedAt || (parsed as Record<string, unknown>).updated_at || new Date().toISOString()).trim();

    if (!scope || !baseUrl) return null;

    return {
      scope,
      baseUrl,
      publicHostname,
      tenantName,
      subdomain,
      updatedAt,
    };
  } catch {
    return null;
  }
}

function readActiveDedicatedFunctionsBaseUrlState(): DedicatedFunctionsBaseUrlState | null {
  const dedicatedState = readDedicatedFunctionsBaseUrlState();
  if (!dedicatedState) return null;

  const subscription = readStoredRecord('subscription');
  if (!hasDedicatedApiAccessFromSubscription(subscription)) {
    return null;
  }

  const currentScope = readCurrentTenantScopeKey();
  if (!currentScope || dedicatedState.scope !== currentScope) {
    return null;
  }

  return dedicatedState;
}

export function getDedicatedFunctionsBaseUrlState(): DedicatedFunctionsBaseUrlState | null {
  return readActiveDedicatedFunctionsBaseUrlState();
}

export function setDedicatedFunctionsBaseUrlState(state: DedicatedFunctionsBaseUrlState): void {
  if (typeof window === 'undefined') return;

  const normalizedBaseUrl = normalizeFunctionsBaseUrl(state.baseUrl);
  const normalizedScope = String(state.scope || '').trim();

  if (!normalizedBaseUrl || !normalizedScope) return;

  const nextState: DedicatedFunctionsBaseUrlState = {
    scope: normalizedScope,
    baseUrl: normalizedBaseUrl,
    publicHostname: String(state.publicHostname || '').trim(),
    tenantName: String(state.tenantName || '').trim(),
    subdomain: String(state.subdomain || '').trim(),
    updatedAt: String(state.updatedAt || new Date().toISOString()).trim() || new Date().toISOString(),
  };

  localStorage.setItem(DEDICATED_FUNCTIONS_BASE_URL_STORAGE_KEY, JSON.stringify(nextState));
}

export function clearDedicatedFunctionsBaseUrlState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEDICATED_FUNCTIONS_BASE_URL_STORAGE_KEY);
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

export interface AuthLaunchConfig {
  authUrl: string;
  authAppId: string;
  authApiKey: string;
  redirectUri: string;
}

export function getLocalAuthLaunchConfig(): AuthLaunchConfig | null {
  const env = import.meta.env as Record<string, string | undefined>;
  const authUrl = normalizeFunctionsBaseUrl(
    env.VITE_AUTH_URL ||
    env.AUTH_URL ||
    env.AUTH_FUNCTIONS_BASE_URL ||
    env.AUTH_EDGE_FUNCTIONS_BASE_URL ||
    '',
  );

  const config: AuthLaunchConfig = {
    authUrl,
    authAppId: env.VITE_AUTH_APP_ID || '',
    authApiKey: env.VITE_AUTH_API_KEY || '',
    redirectUri: env.VITE_REDIRECT_URI || '',
  };

  return config.authUrl && config.authAppId && config.authApiKey && config.redirectUri
    ? config
    : null;
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
    case 'URL_SERVER_DEDICADO':
      return env.URL_SERVER_DEDICADO || env.VITE_URL_SERVER_DEDICADO || '';
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
  const publicFunctionsBaseUrl = normalizeFunctionsBaseUrl(
    readFallbackEnv('VITE_FUNCTIONS_BASE_URL') || readFallbackEnv('FUNCTIONS_BASE_URL'),
  );
  const dedicatedFunctionsBaseUrl = readActiveDedicatedFunctionsBaseUrlState()?.baseUrl || '';
  const effectiveFunctionsBaseUrl = normalizeFunctionsBaseUrl(dedicatedFunctionsBaseUrl || publicFunctionsBaseUrl);
  const authBaseUrl = resolveAuthBaseUrlFromEnv(env);
  const queryApiUrl = effectiveFunctionsBaseUrl
    ? `${effectiveFunctionsBaseUrl}/query`
    : readFallbackEnv('VITE_QUERY_API_URL') || readFallbackEnv('QUERY_API_URL') || '';
  const plansApiUrl = readFallbackEnv('PLANS_API_URL') || (publicFunctionsBaseUrl ? `${publicFunctionsBaseUrl}/application-plans` : '');
  const plansApiUrlVite = readFallbackEnv('VITE_PLANS_API_URL') || plansApiUrl;
  const authExchangeUrl = readFallbackEnv('AUTH_VALIDA_TOKEN') || readFallbackEnv('AUTH_EXCHANGE_URL');
  const authVerifyUrl = readFallbackEnv('AUTH_TOKEN_VALIDA') || readFallbackEnv('AUTH_VERIFY_URL');
  const authRefreshUrl = readFallbackEnv('AUTH_REFRESH_URL');
  const authLogoutUrl = readFallbackEnv('AUTH_LOGOUT_URL');

  return {
    project_name: '',
    description: '',
    variables: {
      VITE_FUNCTIONS_BASE_URL: publicFunctionsBaseUrl,
      VITE_CONFIG_API_URL: readFallbackEnv('VITE_CONFIG_API_URL'),
      FUNCTIONS_BASE_URL: publicFunctionsBaseUrl,
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
      URL_SERVER_DEDICADO: readFallbackEnv('URL_SERVER_DEDICADO'),
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
        const publicFunctionsBaseUrl = normalizeFunctionsBaseUrl(
          mergedVariables.VITE_FUNCTIONS_BASE_URL ||
          mergedVariables.FUNCTIONS_BASE_URL ||
          '',
        );
        const dedicatedFunctionsBaseUrl = readActiveDedicatedFunctionsBaseUrlState()?.baseUrl || '';
        const effectiveFunctionsBaseUrl = normalizeFunctionsBaseUrl(dedicatedFunctionsBaseUrl || publicFunctionsBaseUrl);
        const authBaseUrl = resolveAuthBaseUrlFromEnv(mergedVariables);
        const queryApiUrl = effectiveFunctionsBaseUrl
          ? `${effectiveFunctionsBaseUrl}/query`
          : remoteVariables.VITE_QUERY_API_URL ||
            remoteVariables.QUERY_API_URL ||
            fallbackConfig.variables.VITE_QUERY_API_URL;
        const plansApiUrl = publicFunctionsBaseUrl
          ? remoteVariables.PLANS_API_URL ||
            remoteVariables.VITE_PLANS_API_URL ||
            fallbackConfig.variables.PLANS_API_URL ||
            `${publicFunctionsBaseUrl}/application-plans`
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
            VITE_FUNCTIONS_BASE_URL: publicFunctionsBaseUrl,
            VITE_CONFIG_API_URL: remoteVariables.VITE_CONFIG_API_URL || fallbackConfig.variables.VITE_CONFIG_API_URL,
            FUNCTIONS_BASE_URL: publicFunctionsBaseUrl,
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
            URL_SERVER_DEDICADO: remoteVariables.URL_SERVER_DEDICADO || fallbackConfig.variables.URL_SERVER_DEDICADO,
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
    const dedicatedState = readActiveDedicatedFunctionsBaseUrlState();
    return normalizeFunctionsBaseUrl(
      dedicatedState?.baseUrl ||
      this.getVariable('VITE_FUNCTIONS_BASE_URL') ||
      this.getVariable('FUNCTIONS_BASE_URL'),
    );
  }

  get publicFunctionsBaseUrl(): string {
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
    if (this.functionsBaseUrl) {
      return `${this.functionsBaseUrl}/query`;
    }

    return this.getVariable('VITE_QUERY_API_URL') ||
      this.getVariable('QUERY_API_URL') ||
      '';
  }

  get urlHealthCheckEmail(): string {
    if (this.functionsBaseUrl) {
      return `${this.functionsBaseUrl}/health-check-email`;
    }

    return this.getVariable('URL_HEALTH_CHECK_API') || '';
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
      (this.publicFunctionsBaseUrl ? `${this.publicFunctionsBaseUrl}/application-plans` : '');
  }

  get dedicatedApiProvisionUrl(): string {
    return this.getVariable('URL_SERVER_DEDICADO');
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
  const publicFunctionsBaseUrlRaw = normalizeFunctionsBaseUrl(
    snapshot.variables.VITE_FUNCTIONS_BASE_URL ||
    snapshot.variables.FUNCTIONS_BASE_URL ||
    '',
  );
  const dedicatedFunctionsBaseUrlState = readActiveDedicatedFunctionsBaseUrlState();
  const functionsBaseUrlRaw = normalizeFunctionsBaseUrl(
    dedicatedFunctionsBaseUrlState?.baseUrl ||
    publicFunctionsBaseUrlRaw ||
    '',
  );
  const functionsBaseUrl = functionsBaseUrlRaw;
  const queryApiUrl = functionsBaseUrlRaw
    ? `${functionsBaseUrlRaw}/query`
    : snapshot.variables.VITE_QUERY_API_URL ||
      snapshot.variables.QUERY_API_URL ||
      '';

  return {
    functionsBaseUrlRaw,
    functionsBaseUrl,
    publicFunctionsBaseUrlRaw,
    publicFunctionsBaseUrl: publicFunctionsBaseUrlRaw,
    dedicatedApiProvisionUrl: snapshot.variables.URL_SERVER_DEDICADO || '',
    queryApiUrl,
    plansApiUrl: snapshot.variables.PLANS_API_URL || snapshot.variables.VITE_PLANS_API_URL || (publicFunctionsBaseUrlRaw ? `${publicFunctionsBaseUrlRaw}/application-plans` : ''),
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
