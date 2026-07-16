import {
  buildFunctionsUrl,
  getDedicatedFunctionsBaseUrlState,
  getRuntimeConfig,
  normalizeFunctionsBaseUrl,
  setDedicatedFunctionsBaseUrlState,
  type DedicatedFunctionsBaseUrlState,
} from './config';
import { queryMutate, querySelect, type QueryFilter } from './queryApi';
import { findPlanFeatureByCode } from './planFeatures';

export const DEDICATED_API_FEATURE_CODE = 'acceso_api_dedicado';
const DEFAULT_DEDICATED_DOMAIN = 'sendcraft.net';
const DEDICATED_API_REQUEST_TIMEOUT_MS = 60000;
const DEDICATED_API_RESULT_CACHE_TTL_MS = 8000;
const DEDICATED_API_STORE_TABLE = 'tenant_dedicated_api_servers';

const inFlightDedicatedApiResolutions = new Map<string, Promise<DedicatedApiResolutionResult | null>>();
const recentDedicatedApiResolutions = new Map<
  string,
  { result: DedicatedApiResolutionResult | null; completedAt: number }
>();

type FeatureLike = {
  code: string;
};

type FeatureValueLike = FeatureLike & {
  value?: unknown;
  value_type?: string | null;
};

type SubscriptionLike = {
  id?: string | number | null;
  status?: string | null;
  plan_name?: string | null;
  plan_id?: string | null;
  metadata?: Record<string, unknown> | null;
  entitlements?: {
    features?: FeatureLike[] | null;
  } | null;
  features?: FeatureLike[] | null;
};

type ScopeCandidate = {
  sub?: string | number | null;
  id?: string | number | null;
  user_id?: string | number | null;
  email?: string | null;
  name?: string | null;
  tenant_id?: string | number | null;
  tenantId?: string | number | null;
  tenant_name?: string | null;
  tenantName?: string | null;
  tenant?: {
    id?: string | number | null;
    name?: string | null;
  } | null;
  metadata?: Record<string, unknown> | null;
};

type DedicatedApiStoreRow = {
  id?: string | null;
  tenant_key?: string | null;
  tenant_id?: string | null;
  subscription_id?: string | null;
  scope_key?: string | null;
  tenant_name?: string | null;
  subdomain?: string | null;
  base_url?: string | null;
  public_hostname?: string | null;
  status?: string | null;
  project?: Record<string, unknown> | null;
  deployment?: Record<string, unknown> | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DedicatedApiPersistenceIdentity = {
  tenantKey: string;
  tenantId: string;
  subscriptionId: string;
  scopeKey: string;
};

export interface DedicatedApiResolutionResult extends DedicatedFunctionsBaseUrlState {
  status: 'provisioned' | 'reused' | 'fallback';
  project?: Record<string, unknown>;
  deployment?: Record<string, unknown>;
  error?: string;
}

export interface ResolveDedicatedApiBaseUrlArgs {
  subscription?: SubscriptionLike | null;
  user?: ScopeCandidate | null;
  forceProvision?: boolean;
}

export function clearDedicatedApiResolutionCache(): void {
  inFlightDedicatedApiResolutions.clear();
  recentDedicatedApiResolutions.clear();
}

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

function collectStringCandidates(
  payload: unknown,
  targetKeys: string[],
  nestedKeys: string[],
  depth = 0,
  visited = new Set<object>(),
): string[] {
  if (!payload || typeof payload !== 'object' || depth > 5) return [];

  const record = payload as Record<string, unknown>;
  if (visited.has(record)) return [];
  visited.add(record);

  const candidates: string[] = [];

  for (const key of targetKeys) {
    const candidate = firstString(record[key] as string | number | null | undefined);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  for (const key of nestedKeys) {
    const nestedValue = record[key];
    if (Array.isArray(nestedValue)) {
      for (const item of nestedValue) {
        candidates.push(...collectStringCandidates(item, targetKeys, nestedKeys, depth + 1, visited));
      }
      continue;
    }

    candidates.push(...collectStringCandidates(nestedValue, targetKeys, nestedKeys, depth + 1, visited));
  }

  return candidates;
}

function cloneResolutionResult(result: DedicatedApiResolutionResult | null): DedicatedApiResolutionResult | null {
  if (!result) return null;

  return {
    ...result,
    project: result.project ? { ...result.project } : result.project,
    deployment: result.deployment ? { ...result.deployment } : result.deployment,
  };
}

function rememberResolutionResult(key: string, result: DedicatedApiResolutionResult | null): void {
  recentDedicatedApiResolutions.set(key, {
    result: cloneResolutionResult(result),
    completedAt: Date.now(),
  });
}

function getRecentResolutionResult(key: string): DedicatedApiResolutionResult | null {
  const entry = recentDedicatedApiResolutions.get(key);
  if (!entry) return null;

  if (Date.now() - entry.completedAt > DEDICATED_API_RESULT_CACHE_TTL_MS) {
    recentDedicatedApiResolutions.delete(key);
    return null;
  }

  return cloneResolutionResult(entry.result);
}

function getDedicatedDomain(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return String(
    env.VITE_DEDICATED_API_DOMAIN ||
    env.DEDICATED_API_DOMAIN ||
    DEFAULT_DEDICATED_DOMAIN,
  ).trim().replace(/\/+$/, '') || DEFAULT_DEDICATED_DOMAIN;
}

function getPublicDedicatedQueryBaseUrl(): string {
  return normalizeFunctionsBaseUrl(getRuntimeConfig().publicFunctionsBaseUrlRaw || '');
}

function normalizeHostnameToBaseUrl(hostname: string): string {
  const trimmed = String(hostname || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return normalizeFunctionsBaseUrl(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
}

function resolveHostnameFromBaseUrl(baseUrl: string): string {
  const normalizedBaseUrl = normalizeFunctionsBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return '';

  try {
    return new URL(normalizedBaseUrl).hostname;
  } catch {
    return '';
  }
}

function isPlausibleHostnameCandidate(value: string): boolean {
  const candidate = String(value || '').trim().replace(/\/+$/, '');
  if (!candidate) return false;

  if (/[\s"'`<>]/.test(candidate)) {
    return false;
  }

  const urlValue = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const hostname = new URL(urlValue).hostname.trim().toLowerCase();
    if (!hostname) return false;

    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }

    if (!hostname.includes('.') || hostname.length > 253) {
      return false;
    }

    return hostname.split('.').every((label) => (
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9-]+$/i.test(label) &&
      !label.startsWith('-') &&
      !label.endsWith('-')
    ));
  } catch {
    return false;
  }
}

function isValidHttpUrl(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;

  try {
    const url = new URL(trimmed);
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function getDedicatedTenantId(
  candidate: ScopeCandidate | null | undefined,
): string {
  const metadata = candidate?.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};

  return firstString(
    candidate?.tenant_id,
    candidate?.tenantId,
    candidate?.tenant?.id,
    metadata.tenant_id as string | number | null | undefined,
    metadata.tenantId as string | number | null | undefined,
  );
}

function getDedicatedSubscriptionId(subscription: SubscriptionLike | null | undefined): string {
  return firstString(subscription?.id);
}

function getDedicatedTenantKey(
  tenantId: string,
  subscriptionId: string,
  scopeKey: string,
  subdomain: string,
): string {
  if (tenantId) {
    return `tenant:${tenantId.toLowerCase()}`;
  }

  if (subscriptionId) {
    return `subscription:${subscriptionId.toLowerCase()}`;
  }

  if (scopeKey) {
    return scopeKey;
  }

  return `tenant:${subdomain || 'tenant'}`;
}

function getDedicatedPersistenceIdentity(
  candidate: ScopeCandidate | null | undefined,
  subscription: SubscriptionLike | null | undefined,
  scopeKey: string,
  subdomain: string,
): DedicatedApiPersistenceIdentity {
  const tenantId = getDedicatedTenantId(candidate);
  const subscriptionId = getDedicatedSubscriptionId(subscription);

  return {
    tenantKey: getDedicatedTenantKey(tenantId, subscriptionId, scopeKey, subdomain),
    tenantId,
    subscriptionId,
    scopeKey,
  };
}

function normalizeDedicatedApiStoreRow(payload: unknown): DedicatedApiStoreRow | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const project = record.project && typeof record.project === 'object' && !Array.isArray(record.project)
    ? record.project as Record<string, unknown>
    : undefined;
  const deployment = record.deployment && typeof record.deployment === 'object' && !Array.isArray(record.deployment)
    ? record.deployment as Record<string, unknown>
    : undefined;

  return {
    id: firstString(record.id as string | number | null | undefined),
    tenant_key: firstString(record.tenant_key as string | number | null | undefined, record.tenantKey as string | number | null | undefined),
    tenant_id: firstString(record.tenant_id as string | number | null | undefined, record.tenantId as string | number | null | undefined),
    subscription_id: firstString(record.subscription_id as string | number | null | undefined, record.subscriptionId as string | number | null | undefined),
    scope_key: firstString(record.scope_key as string | number | null | undefined, record.scopeKey as string | number | null | undefined),
    tenant_name: firstString(record.tenant_name as string | number | null | undefined, record.tenantName as string | number | null | undefined),
    subdomain: firstString(record.subdomain as string | number | null | undefined),
    base_url: firstString(record.base_url as string | number | null | undefined, record.baseUrl as string | number | null | undefined),
    public_hostname: firstString(record.public_hostname as string | number | null | undefined, record.publicHostname as string | number | null | undefined),
    status: firstString(record.status as string | number | null | undefined),
    project,
    deployment,
    last_error: firstString(record.last_error as string | number | null | undefined, record.lastError as string | number | null | undefined),
    created_at: firstString(record.created_at as string | number | null | undefined, record.createdAt as string | number | null | undefined),
    updated_at: firstString(record.updated_at as string | number | null | undefined, record.updatedAt as string | number | null | undefined),
  };
}

function rowToDedicatedApiState(
  row: DedicatedApiStoreRow,
  scopeKey: string,
  tenantName: string,
  subdomain: string,
): DedicatedFunctionsBaseUrlState | null {
  const baseUrl = normalizeFunctionsBaseUrl(row.base_url || '');
  if (!baseUrl || !isValidHttpUrl(baseUrl)) return null;

  const publicHostname = String(
    row.public_hostname ||
      resolveHostnameFromBaseUrl(baseUrl),
  ).trim();
  if (!isPlausibleHostnameCandidate(publicHostname)) {
    return null;
  }

  return {
    scope: scopeKey,
    baseUrl,
    publicHostname,
    tenantName: String(row.tenant_name || tenantName || '').trim(),
    subdomain: String(row.subdomain || subdomain || '').trim(),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()).trim() || new Date().toISOString(),
  };
}

function buildDedicatedApiStorePayload(
  identity: DedicatedApiPersistenceIdentity,
  state: DedicatedFunctionsBaseUrlState,
  resolution: DedicatedApiResolutionResult,
): Record<string, unknown> {
  return {
    tenant_key: identity.tenantKey,
    tenant_id: identity.tenantId || null,
    subscription_id: identity.subscriptionId || null,
    scope_key: identity.scopeKey,
    tenant_name: state.tenantName || resolution.tenantName || '',
    subdomain: state.subdomain || resolution.subdomain || '',
    base_url: normalizeFunctionsBaseUrl(state.baseUrl || resolution.baseUrl || ''),
    public_hostname: String(state.publicHostname || resolution.publicHostname || '').trim(),
    status: resolution.status || 'provisioned',
    project: resolution.project || {},
    deployment: resolution.deployment || {},
    last_error: resolution.error || null,
  };
}

async function selectDedicatedApiStoreRow(filters: QueryFilter[]): Promise<DedicatedApiStoreRow | null> {
  const publicQueryBaseUrl = getPublicDedicatedQueryBaseUrl();
  if (!publicQueryBaseUrl) return null;

  const result = await querySelect<DedicatedApiStoreRow>({
    baseUrl: publicQueryBaseUrl,
    table: DEDICATED_API_STORE_TABLE,
    operation: 'select',
    select: '*',
    filters,
    order: { column: 'updated_at', ascending: false },
    limit: 1,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }

  return normalizeDedicatedApiStoreRow(result.data?.[0] || null);
}

async function updateDedicatedApiStoreRow(
  matchField: 'tenant_key' | 'scope_key',
  matchValue: string,
  updates: Record<string, unknown>,
): Promise<void> {
  const publicQueryBaseUrl = getPublicDedicatedQueryBaseUrl();
  if (!publicQueryBaseUrl) return;

  const result = await queryMutate({
    baseUrl: publicQueryBaseUrl,
    table: DEDICATED_API_STORE_TABLE,
    operation: 'update',
    update: {
      ...updates,
      updated_at: new Date().toISOString(),
    },
    filters: [{ column: matchField, op: 'eq', value: matchValue }],
    returning: '*',
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

async function loadDedicatedApiStoreResolution(
  identity: DedicatedApiPersistenceIdentity,
  scopeKey: string,
  tenantName: string,
  subdomain: string,
): Promise<DedicatedApiResolutionResult | null> {
  try {
    let row = await selectDedicatedApiStoreRow([
      { column: 'tenant_key', op: 'eq', value: identity.tenantKey },
    ]);

    let matchedField: 'tenant_key' | 'scope_key' | null = row ? 'tenant_key' : null;

    if (!row && identity.scopeKey && identity.scopeKey !== identity.tenantKey) {
      row = await selectDedicatedApiStoreRow([
        { column: 'scope_key', op: 'eq', value: identity.scopeKey },
      ]);
      if (row) {
        matchedField = 'scope_key';
      }
    }

    if (!row) {
      return null;
    }

    const state = rowToDedicatedApiState(row, scopeKey, tenantName, subdomain);
    if (!state) {
      return null;
    }

    if (matchedField && (
      row.tenant_key !== identity.tenantKey ||
      row.scope_key !== scopeKey ||
      row.tenant_id !== identity.tenantId ||
      row.subscription_id !== identity.subscriptionId ||
      row.tenant_name !== state.tenantName ||
      row.subdomain !== state.subdomain
    )) {
      const matchValue = matchedField === 'tenant_key' ? identity.tenantKey : identity.scopeKey;
      const updates: Record<string, unknown> = {
        tenant_key: identity.tenantKey,
        tenant_id: identity.tenantId || null,
        subscription_id: identity.subscriptionId || null,
        scope_key: scopeKey,
        tenant_name: state.tenantName,
        subdomain: state.subdomain,
      };

      void updateDedicatedApiStoreRow(matchedField, matchValue, updates).catch(() => null);
    }

    setDedicatedFunctionsBaseUrlState(state);

    return {
      ...state,
      status: 'reused',
      project: row.project || undefined,
      deployment: row.deployment || undefined,
      error: row.last_error || undefined,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[dedicatedApi] Failed to load persisted dedicated API server:', error);
    }
    return null;
  }
}

async function persistDedicatedApiStoreResolution(
  identity: DedicatedApiPersistenceIdentity,
  resolution: DedicatedApiResolutionResult,
): Promise<void> {
  const publicQueryBaseUrl = getPublicDedicatedQueryBaseUrl();
  if (!publicQueryBaseUrl || !resolution.baseUrl) return;

  const state: DedicatedFunctionsBaseUrlState = {
    scope: identity.scopeKey,
    baseUrl: normalizeFunctionsBaseUrl(resolution.baseUrl),
    publicHostname: String(resolution.publicHostname || '').trim(),
    tenantName: String(resolution.tenantName || '').trim(),
    subdomain: String(resolution.subdomain || '').trim(),
    updatedAt: String(resolution.updatedAt || new Date().toISOString()).trim() || new Date().toISOString(),
  };

  const payload = buildDedicatedApiStorePayload(identity, state, resolution);

  const result = await queryMutate({
    baseUrl: publicQueryBaseUrl,
    table: DEDICATED_API_STORE_TABLE,
    operation: 'upsert',
    data: payload,
    onConflict: 'tenant_key',
    returning: '*',
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

function slugifySubdomain(value: string): string {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return normalized.slice(0, 63) || 'tenant';
}

function extractProvisionErrorText(payload: unknown, rawText = ''): string {
  const candidates = collectStringCandidates(
    payload,
    ['error', 'message', 'details', 'reason', 'description'],
    ['data', 'result', 'deployment', 'project', 'response', 'payload', 'body', 'details', 'error'],
  );

  return [rawText, ...candidates].filter((part) => typeof part === 'string' && part.trim()).join(' ');
}

function extractHostnameFromError(payload: unknown, rawText = ''): string {
  const text = extractProvisionErrorText(payload, rawText);
  if (!text) return '';

  const quotedHostname = text.match(/(?:hostname|public[_ ]?url|fqdn)\s+"([^"]+)"/i)?.[1];
  if (quotedHostname && isPlausibleHostnameCandidate(quotedHostname)) {
    return quotedHostname.trim();
  }

  const directHostname = text.match(/(?:hostname|public[_ ]?url|fqdn)\s*[:=]\s*([A-Za-z0-9.-]+(?:\.[A-Za-z0-9.-]+)+)/i)?.[1];
  if (directHostname && isPlausibleHostnameCandidate(directHostname)) {
    return directHostname.trim();
  }

  const genericHost = text.match(/([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/)?.[1];
  return genericHost && isPlausibleHostnameCandidate(genericHost) ? genericHost.trim() : '';
}

function getProvisioningPayload(
  tenantName: string,
  subdomain: string,
  upstreamUrl: string,
  apiKey: string,
): Record<string, unknown> {
  return {
    name: tenantName,
    cpu: 1,
    memory: '2Gi',
    minReplicas: 1,
    maxReplicas: 3,
    storageMountPath: '/data',
    domain: getDedicatedDomain(),
    subdomain,
    upstreamUrl,
    ...(apiKey ? { api_key: apiKey } : {}),
  };
}

function getDedicatedProvisioningProxyUrl(): string {
  const runtime = getRuntimeConfig();
  const publicBaseUrl = normalizeFunctionsBaseUrl(runtime.publicFunctionsBaseUrlRaw || '');

  if (!publicBaseUrl) {
    return '';
  }

  return buildFunctionsUrl('provision-dedicated-api', publicBaseUrl);
}

function getScopeKey(candidate: ScopeCandidate | null | undefined, subscription: SubscriptionLike | null | undefined): string {
  const metadata = candidate?.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};
  const subdomainSource = firstString(
    candidate?.tenant_id,
    candidate?.tenantId,
    candidate?.tenant?.id,
    metadata.tenant_id as string | number | null | undefined,
    metadata.tenantId as string | number | null | undefined,
    candidate?.tenant_name,
    candidate?.tenantName,
    candidate?.tenant?.name,
    metadata.tenant_name as string | number | null | undefined,
    metadata.tenantName as string | number | null | undefined,
    subscription?.metadata?.tenant_id as string | number | null | undefined,
    subscription?.metadata?.tenantId as string | number | null | undefined,
    subscription?.metadata?.tenantName as string | number | null | undefined,
    subscription?.metadata?.tenant_name as string | number | null | undefined,
    subscription?.id as string | number | null | undefined,
  );

  return subdomainSource ? `tenant:${subdomainSource.toLowerCase()}` : '';
}

function getTenantDisplayName(
  candidate: ScopeCandidate | null | undefined,
  subscription: SubscriptionLike | null | undefined,
): string {
  const metadata = candidate?.metadata && typeof candidate.metadata === 'object' ? candidate.metadata : {};

  return firstString(
    candidate?.tenant_name,
    candidate?.tenantName,
    candidate?.tenant?.name,
    metadata.tenant_name as string | number | null | undefined,
    metadata.tenantName as string | number | null | undefined,
    candidate?.tenant?.id,
    metadata.tenant_id as string | number | null | undefined,
    metadata.tenantId as string | number | null | undefined,
    subscription?.metadata?.tenant_name as string | number | null | undefined,
    subscription?.metadata?.tenantName as string | number | null | undefined,
    subscription?.id as string | number | null | undefined,
    'API premium',
  );
}

function getExistingHostnameCandidate(payload: unknown): string {
  const candidates = collectStringCandidates(
    payload,
    [
      'publicHostname',
      'public_hostname',
      'publicUrl',
      'public_url',
      'hostname',
      'fqdn',
      'ingressFqdn',
      'ingress_fqdn',
      'defaultFqdn',
      'default_fqdn',
      'defaultHostname',
      'default_hostname',
    ],
    ['data', 'result', 'deployment', 'project', 'response', 'payload', 'body', 'details', 'customDomains', 'custom_domains', 'ingress'],
  );

  return firstString(...candidates.filter((candidate) => isPlausibleHostnameCandidate(candidate)));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEDICATED_API_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function parseResponseBody(response: Response): Promise<{ payload: unknown; rawText: string }> {
  const rawText = await response.text().catch(() => '');
  if (!rawText) {
    return { payload: {}, rawText: '' };
  }

  try {
    return { payload: JSON.parse(rawText), rawText };
  } catch {
    return { payload: rawText, rawText };
  }
}

function isDuplicateCloneError(payload: unknown, rawText: string, status: number): boolean {
  if (status !== 500) return false;

  const haystack = `${extractProvisionErrorText(payload, rawText)} ${rawText}`.toLowerCase();
  return haystack.includes('clone failed') ||
    haystack.includes('already exists') ||
    haystack.includes('ya existe') ||
    haystack.includes('ya existe un clon') ||
    haystack.includes('hostname');
}

export function isDedicatedApiEnabled(subscription: SubscriptionLike | null | undefined): boolean {
  if (!subscription) return false;

  const features = subscription.entitlements?.features ?? subscription.features ?? [];
  const feature = findPlanFeatureByCode(features as FeatureValueLike[], DEDICATED_API_FEATURE_CODE) as FeatureValueLike | undefined;
  if (!feature) return false;

  if (typeof feature.value === 'boolean') {
    return feature.value;
  }

  if (typeof feature.value === 'number') {
    return Number.isFinite(feature.value) && feature.value > 0;
  }

  const normalizedValue = String(feature.value ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalizedValue);
}

export async function resolveDedicatedApiBaseUrl(
  args: ResolveDedicatedApiBaseUrlArgs,
): Promise<DedicatedApiResolutionResult | null> {
  const { subscription, user, forceProvision = false } = args;
  if (!isDedicatedApiEnabled(subscription)) {
    clearDedicatedApiResolutionCache();
    return null;
  }

  const scope = getScopeKey(user ?? null, subscription ?? null);
  const tenantName = getTenantDisplayName(user ?? null, subscription ?? null);
  const subdomain = slugifySubdomain(tenantName);
  const domain = getDedicatedDomain();
  const cached = getDedicatedFunctionsBaseUrlState();
  const requestKey = scope || `tenant:${subdomain}`;
  const identity = getDedicatedPersistenceIdentity(user ?? null, subscription ?? null, scope, subdomain);

  if (!forceProvision && cached && cached.scope === scope && cached.baseUrl) {
    const reusedResolution: DedicatedApiResolutionResult = {
      ...cached,
      status: 'reused',
      project: undefined,
      deployment: undefined,
    };

    try {
      await persistDedicatedApiStoreResolution(identity, reusedResolution);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', error);
      }
    }

    return reusedResolution;
  }

  if (!forceProvision) {
    const recentResolution = getRecentResolutionResult(requestKey);
    if (recentResolution) {
      return recentResolution;
    }

    const inFlightResolution = inFlightDedicatedApiResolutions.get(requestKey);
    if (inFlightResolution) {
      return inFlightResolution;
    }
  }

  const runtime = getRuntimeConfig();
  const provisioningUrl = getDedicatedProvisioningProxyUrl() ||
    normalizeFunctionsBaseUrl(runtime.dedicatedApiProvisionUrl || '');
  if (!provisioningUrl) {
    if (cached && cached.scope === scope && cached.baseUrl) {
      const reusedResolution: DedicatedApiResolutionResult = {
        ...cached,
        status: 'reused',
        project: undefined,
        deployment: undefined,
      };

      try {
        await persistDedicatedApiStoreResolution(identity, reusedResolution);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', error);
        }
      }

      return reusedResolution;
    }
    return {
      scope,
      baseUrl: runtime.publicFunctionsBaseUrlRaw || runtime.functionsBaseUrlRaw || '',
      publicHostname: `${subdomain}.${domain}`,
      tenantName,
      subdomain,
      updatedAt: new Date().toISOString(),
      status: 'fallback',
      error: 'Missing URL_SERVER_DEDICADO configuration',
    };
  }

  const requestPromise = (async (): Promise<DedicatedApiResolutionResult | null> => {
    try {
      if (!forceProvision) {
        const persistedResolution = await loadDedicatedApiStoreResolution(identity, scope, tenantName, subdomain);
        if (persistedResolution) {
          return persistedResolution;
        }

        if (cached && cached.scope === scope && cached.baseUrl) {
          const reusedResolution: DedicatedApiResolutionResult = {
            ...cached,
            status: 'reused',
            project: undefined,
            deployment: undefined,
          };

          try {
            await persistDedicatedApiStoreResolution(identity, reusedResolution);
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', error);
            }
          }

          return reusedResolution;
        }
      }

      const apiKey = runtime.apiKey || '';
      const payload = getProvisioningPayload(
        tenantName,
        subdomain,
        runtime.dedicatedApiProvisionUrl || '',
        apiKey,
      );
      const response = await fetchWithTimeout(provisioningUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify(payload),
      });

      const { payload: body, rawText } = await parseResponseBody(response);
      const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      const deployment = record.deployment && typeof record.deployment === 'object'
        ? record.deployment as Record<string, unknown>
        : undefined;
      const project = record.project && typeof record.project === 'object'
        ? record.project as Record<string, unknown>
        : undefined;

      const extractedHostname = getExistingHostnameCandidate(record) ||
        extractHostnameFromError(body, rawText);
      const hostnameCandidate = extractedHostname || `${subdomain}.${domain}`;
      const normalizedBaseUrl = normalizeHostnameToBaseUrl(hostnameCandidate);
      const errorText = extractProvisionErrorText(body, rawText);
      const duplicateCloneError = isDuplicateCloneError(body, rawText, response.status);
      const hasHostnameEvidence = Boolean(extractedHostname);

      if (!response.ok && !duplicateCloneError && !hasHostnameEvidence) {
        if (cached && cached.scope === scope && cached.baseUrl) {
          const reusedResolution: DedicatedApiResolutionResult = {
            ...cached,
            status: 'reused',
            project,
            deployment,
            error: errorText || `HTTP ${response.status}`,
          };

          try {
            await persistDedicatedApiStoreResolution(identity, {
              ...reusedResolution,
              error: undefined,
            });
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', error);
            }
          }

          return reusedResolution;
        }

        return {
          scope,
          baseUrl: runtime.publicFunctionsBaseUrlRaw || runtime.functionsBaseUrlRaw || '',
          publicHostname: hostnameCandidate,
          tenantName,
          subdomain,
          updatedAt: new Date().toISOString(),
          status: 'fallback',
          project,
          deployment,
          error: errorText || `HTTP ${response.status}`,
        };
      }

      if (!normalizedBaseUrl) {
        if (cached && cached.scope === scope && cached.baseUrl) {
          const reusedResolution: DedicatedApiResolutionResult = {
            ...cached,
            status: 'reused',
            project,
            deployment,
          };

          try {
            await persistDedicatedApiStoreResolution(identity, reusedResolution);
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', error);
            }
          }

          return reusedResolution;
        }

        return {
          scope,
          baseUrl: runtime.publicFunctionsBaseUrlRaw || runtime.functionsBaseUrlRaw || '',
          publicHostname: hostnameCandidate,
          tenantName,
          subdomain,
          updatedAt: new Date().toISOString(),
          status: 'fallback',
          project,
          deployment,
          error: 'No se pudo resolver el hostname del servidor dedicado.',
        };
      }

      const nextState: DedicatedFunctionsBaseUrlState = {
        scope,
        baseUrl: normalizedBaseUrl,
        publicHostname: hostnameCandidate,
        tenantName,
        subdomain,
        updatedAt: new Date().toISOString(),
      };

      setDedicatedFunctionsBaseUrlState(nextState);

      const nextStatus: DedicatedApiResolutionResult['status'] = !response.ok
        ? (duplicateCloneError || (cached && cached.scope === scope && cached.baseUrl) ? 'reused' : 'provisioned')
        : (duplicateCloneError ? 'reused' : 'provisioned');

      const nextResolution: DedicatedApiResolutionResult = {
        ...nextState,
        status: nextStatus,
        project,
        deployment,
        error: response.ok ? undefined : errorText || `HTTP ${response.status}`,
      };

      try {
        await persistDedicatedApiStoreResolution(identity, nextResolution);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[dedicatedApi] Failed to persist dedicated API server:', error);
        }
      }

      return nextResolution;
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);

      if (cached && cached.scope === scope && cached.baseUrl) {
        const reusedResolution: DedicatedApiResolutionResult = {
          ...cached,
          status: 'reused',
          project: undefined,
          deployment: undefined,
          error: errorText,
        };

        try {
          await persistDedicatedApiStoreResolution(identity, {
            ...reusedResolution,
            error: undefined,
          });
        } catch (persistError) {
          if (import.meta.env.DEV) {
            console.warn('[dedicatedApi] Failed to backfill persisted dedicated API server:', persistError);
          }
        }

        return reusedResolution;
      }

      return {
        scope,
        baseUrl: runtime.publicFunctionsBaseUrlRaw || runtime.functionsBaseUrlRaw || '',
        publicHostname: `${subdomain}.${domain}`,
        tenantName,
        subdomain,
        updatedAt: new Date().toISOString(),
        status: 'fallback',
        error: errorText || 'No se pudo aprovisionar el servidor dedicado.',
      };
    }
  })();

  const trackedPromise = requestPromise
    .then((result) => {
      rememberResolutionResult(requestKey, result);
      return result;
    })
    .catch((error) => {
      rememberResolutionResult(requestKey, null);
      throw error;
    })
    .finally(() => {
      inFlightDedicatedApiResolutions.delete(requestKey);
    });

  inFlightDedicatedApiResolutions.set(requestKey, trackedPromise);
  return trackedPromise;
}
