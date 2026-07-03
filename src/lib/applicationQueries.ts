import { queryMutate, querySelect } from './queryApi';

export interface ApplicationSummary {
  id: string;
  name: string;
  api_key: string;
  application_id?: string;
  domain?: string;
  created_at?: string;
}

export type ApplicationEnvironment = 'development' | 'testing' | 'production';

export interface CreateApplicationInput {
  ownerId: string;
  tenantId?: string | null;
  name: string;
  domain?: string;
  environment?: ApplicationEnvironment;
  environmentUrls?: Record<string, unknown> | null;
  corsOrigins?: string | null;
  webhookUrl?: string | null;
  enableEmailVerification?: boolean;
  allowPublicRegistration?: boolean;
}

interface OwnedApplicationRow {
  id: string;
  name: string;
  app_id: string;
  domain: string | null;
  api_key: string | null;
  created_at: string;
}

function normalizeDomain(value: string | undefined | null): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return `${url.hostname}${url.port ? `:${url.port}` : ''}`.trim();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }
}

function normalizeApplicationName(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getFallbackDomain(): string {
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
}

const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);
const TESTING_HOSTNAME = 'test.sendcraft.net';

function resolveApplicationEnvironment(environment?: ApplicationEnvironment): ApplicationEnvironment {
  if (environment) return environment;

  if (typeof window === 'undefined') {
    return 'development';
  }

  const hostname = window.location.hostname.toLowerCase();

  if (LOCALHOST_HOSTNAMES.has(hostname)) {
    return 'development';
  }

  if (hostname === TESTING_HOSTNAME) {
    return 'testing';
  }

  return 'production';
}

function generateApiKey(environment: ApplicationEnvironment): string {
  const chars = 'abcdef0123456789';
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  const prefix = environment === 'production' ? 'sk_' : `ak_${environment}_`;
  let result = prefix;
  for (let i = 0; i < randomBytes.length; i += 1) {
    result += chars.charAt(randomBytes[i] % chars.length);
  }

  return result;
}

function buildApiKeyPreview(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 18) return apiKey;
  return `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function loadOwnedApplicationRows(
  ownerId: string,
  tenantId?: string | null,
  includeAll = false,
): Promise<OwnedApplicationRow[]> {
  const filters = includeAll
    ? []
    : tenantId
    ? [{ column: 'tenant_id', op: 'eq', value: tenantId }]
    : [{ column: 'user_id', op: 'eq', value: ownerId }];

  const appsResult = await querySelect<OwnedApplicationRow>({
    table: 'applications',
    operation: 'select',
    select: 'id, name, app_id, domain, api_key, created_at',
    ...(filters.length > 0 ? { filters } : {}),
    order: { column: 'created_at', ascending: false },
  });

  if (appsResult.error) {
    throw new Error(appsResult.error.message);
  }

  return appsResult.data || [];
}

export async function loadOwnedApplicationsWithKeys(
  ownerId: string,
  tenantId?: string | null,
  includeAll = false,
): Promise<ApplicationSummary[]> {
  const apps = await loadOwnedApplicationRows(ownerId, tenantId, includeAll);

  return apps.map((app) => ({
    id: app.id,
    name: app.name,
    api_key: app.api_key || '',
    application_id: app.app_id,
    domain: app.domain || undefined,
    created_at: app.created_at,
  }));
}

async function assertApplicationNameAvailable(ownerId: string, tenantId: string | null, appName: string): Promise<void> {
  const apps = await loadOwnedApplicationRows(ownerId, tenantId);
  const normalizedName = normalizeApplicationName(appName);
  const duplicate = apps.find((app) => normalizeApplicationName(app.name) === normalizedName);

  if (duplicate) {
    throw new Error('Ya existe una aplicacion con ese nombre');
  }
}

async function bestEffortInsert(table: string, data: Record<string, unknown>): Promise<void> {
  const result = await queryMutate({
    table,
    operation: 'insert',
    data,
    returning: '*',
  });

  if (result.error) {
    console.warn(`[applicationQueries] Optional insert skipped for ${table}:`, result.error.message);
  }
}

export async function createOwnedApplication(input: CreateApplicationInput): Promise<ApplicationSummary> {
  const ownerId = input.ownerId.trim();
  const tenantId = input.tenantId?.trim() || null;
  const appName = input.name.trim();
  const domain = normalizeDomain(input.domain) || getFallbackDomain();
  const environment = resolveApplicationEnvironment(input.environment);
  const appId = `app_${crypto.randomUUID().slice(0, 12)}`;
  const apiKey = generateApiKey(environment);
  const keyPreview = buildApiKeyPreview(apiKey);

  if (!ownerId) {
    throw new Error('Missing owner ID');
  }

  if (!appName) {
    throw new Error('Missing application name');
  }

  await assertApplicationNameAvailable(ownerId, tenantId, appName);

  const appResult = await queryMutate<{
    id: string;
    name: string;
    app_id: string;
    domain: string | null;
    api_key: string | null;
    created_at: string;
  }>({
    table: 'applications',
    operation: 'insert',
    data: {
      name: appName,
      user_id: ownerId,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      app_id: appId,
      api_key: apiKey,
      domain,
    },
    returning: '*',
  });

  if (appResult.error) {
    throw new Error(appResult.error.message);
  }

  const app = appResult.data?.[0];
  if (!app) {
    throw new Error('No se pudo crear la aplicacion');
  }

  await bestEffortInsert('environments', {
    application_id: app.id,
    name: environment,
    domain: `auth-${environment}.${domain}`,
    auth_url: `https://auth-${environment}.${domain}`,
    callback_url: `https://${domain}/callback`,
  });

  await bestEffortInsert('branding_configs', {
    application_id: app.id,
  });

  await bestEffortInsert('api_keys', {
    application_id: app.id,
    name: `${capitalize(environment)} Environment Key`,
    key: apiKey,
    key_hash: apiKey,
    key_preview: keyPreview,
    permissions: ['read', 'write'],
    environment,
    is_active: true,
  });

  return {
    id: app.id,
    name: app.name,
    api_key: apiKey,
    application_id: app.app_id,
    domain: app.domain || undefined,
    created_at: app.created_at,
  };
}
