export function trimSlash(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function normalizeFunctionsBaseUrl(value = '') {
  return trimSlash(value)
    .replace(/\/functions\/v1$/i, '')
    .replace(/\/functions$/i, '')
    .replace(/\/v1$/i, '');
}

function resolveAuthBaseUrl() {
  return normalizeFunctionsBaseUrl(
    readEnv('AUTH_FUNCTIONS_BASE_URL', 'AUTH_EDGE_FUNCTIONS_BASE_URL', 'AUTH_URL', 'VITE_AUTH_URL'),
  );
}

function buildAuthEndpoint(path) {
  const base = resolveAuthBaseUrl();
  return base ? `${base}/${String(path || '').replace(/^\/+/, '')}` : '';
}

function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function getRequestOrigin(req) {
  const proto = readEnv('FORWARDED_PROTO') ||
    String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() ||
    (req.socket?.encrypted ? 'https' : 'http');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();

  if (!host) {
    return '';
  }

  return `${proto}://${host}`;
}

export function resolvePublicBaseUrl(req) {
  const configured = trimSlash(readEnv('FUNCTIONS_BASE_URL', 'VITE_FUNCTIONS_BASE_URL'));
  if (configured) return configured;

  return trimSlash(getRequestOrigin(req));
}

export function resolveConfigApiUrl(req) {
  const configured = trimSlash(readEnv('CONFIG_API_URL', 'VITE_CONFIG_API_URL'));
  if (configured) {
    return configured.endsWith('/get-env') ? configured : `${configured}/get-env`;
  }

  const base = resolvePublicBaseUrl(req);
  return base ? `${base}/get-env` : '';
}

export function getAllowedOrigins() {
  return new Set(
    readEnv('CORS_ALLOWED_ORIGINS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;

  const normalized = String(origin).trim();
  if (
    normalized.startsWith('http://localhost') ||
    normalized.startsWith('http://127.0.0.1') ||
    normalized.startsWith('http://[::1]') ||
    normalized.startsWith('https://localhost') ||
    normalized.startsWith('https://127.0.0.1') ||
    normalized.startsWith('https://[::1]')
  ) {
    return true;
  }

  const allowed = getAllowedOrigins();
  return allowed.size === 0 || allowed.has(normalized);
}

export const serverConfig = {
  port: Number(process.env.PORT || 3000),
  serviceName: readEnv('SERVICE_NAME') || 'SendCraft API',
  projectName: readEnv('PROJECT_NAME') || 'SendCraft',
  description: readEnv('PROJECT_DESCRIPTION') || 'SendCraft backend APIs sobre Neon',
  databaseUrl: readEnv('DATABASE_URL'),
  databaseSsl: process.env.DATABASE_SSL !== 'false',
  apiKey: readEnv('API_KEY'),
  apiKeyUserEmbed: readEnv('API_KEY_USER_EMBED'),
  adminApiKey: readEnv('ADMIN_API_KEY'),
  configAccessKey: readEnv('CONFIG_ACCESS_KEY', 'ACCESS_KEY'),
  authRefreshUrl: readEnv('AUTH_REFRESH_URL'),
  authExchangeUrl: readEnv('AUTH_EXCHANGE_URL'),
  cancelSubscriptionUrl: readEnv('CANCEL_SUBSCRIPTION_URL'),
  resendApiKey: readEnv('RESEND_API_KEY'),
  defaultFromEmail: readEnv('DEFAULT_FROM_EMAIL') || 'no-reply@sendcraft.net',
  defaultFromName: readEnv('DEFAULT_FROM_NAME') || 'SendCraft',
  systemAdminEmail: readEnv('SYSTEM_ADMIN_EMAIL') || 'administrador@sendcraft.net',
};

export function buildEnvPayload(req) {
  const publicBaseUrl = resolvePublicBaseUrl(req);
  const configApiUrl = resolveConfigApiUrl(req);
  const authBaseUrl = resolveAuthBaseUrl();
  const authExchangeUrl = readEnv('AUTH_VALIDA_TOKEN') || readEnv('AUTH_EXCHANGE_URL') || buildAuthEndpoint('auth-exchange-code');
  const authVerifyUrl = readEnv('AUTH_TOKEN_VALIDA') || readEnv('AUTH_VERIFY_URL') || buildAuthEndpoint('auth-verify-token');
  const authRefreshUrl = readEnv('AUTH_REFRESH_URL') || buildAuthEndpoint('auth-refresh');
  const authLogoutUrl = readEnv('AUTH_LOGOUT_URL') || buildAuthEndpoint('auth-logout');
  const plansApiUrl = readEnv('PLANS_API_URL') || readEnv('VITE_PLANS_API_URL') || (publicBaseUrl ? `${publicBaseUrl}/application-plans` : '');

  return {
    project_name: serverConfig.projectName,
    description: serverConfig.description,
    variables: {
      VITE_CONFIG_API_URL: configApiUrl,
      VITE_FUNCTIONS_BASE_URL: publicBaseUrl,
      FUNCTIONS_BASE_URL: publicBaseUrl,
      VITE_QUERY_API_URL: publicBaseUrl ? `${publicBaseUrl}/query` : '',
      QUERY_API_URL: publicBaseUrl ? `${publicBaseUrl}/query` : '',
      PLANS_API_URL: plansApiUrl,
      VITE_PLANS_API_URL: plansApiUrl,
      API_KEY: serverConfig.apiKey,
      VITE_API_KEY: serverConfig.apiKey,
      API_KEY_USER_EMBED: serverConfig.apiKeyUserEmbed,
      VITE_AUTH_API_KEY: readEnv('VITE_AUTH_API_KEY'),
      VITE_AUTH_APP_ID: readEnv('VITE_AUTH_APP_ID'),
      VITE_AUTH_URL: authBaseUrl,
      AUTH_URL: authBaseUrl,
      AUTH_FUNCTIONS_BASE_URL: authBaseUrl,
      VITE_REDIRECT_URI: readEnv('VITE_REDIRECT_URI'),
      AUTH_VALIDA_TOKEN: authExchangeUrl,
      AUTH_EXCHANGE_URL: authExchangeUrl,
      AUTH_TOKEN_VALIDA: authVerifyUrl,
      AUTH_VERIFY_URL: authVerifyUrl,
      AUTH_REFRESH_URL: authRefreshUrl,
      AUTH_LOGOUT_URL: authLogoutUrl,
      URL_HEALTH_CHECK_API: publicBaseUrl ? `${publicBaseUrl}/health-check-email` : '',
      VALIDATION_API_BASE_URL: readEnv('VALIDATION_API_BASE_URL'),
      CANCEL_SUBSCRIPTION_URL: serverConfig.cancelSubscriptionUrl,
    },
    updated_at: new Date().toISOString(),
  };
}
