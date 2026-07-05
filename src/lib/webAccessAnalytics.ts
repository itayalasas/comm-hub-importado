import { authClient } from './auth';
import { buildFunctionsUrl, configManager } from './config';
import { querySelect, type QueryFilter } from './queryApi';

export const WEB_ACCESS_ATTEMPT_STORAGE_KEY = 'web_access_attempt_id';
const WEB_ACCESS_ANALYTICS_TABLE = 'web_access_attempts';
const LEGACY_WEB_ACCESS_ANALYTICS_ENDPOINT = 'web-access-attempts';
const ANALYTICS_PAGE_SIZE = 250;
const ANALYTICS_MAX_ROWS = 10000;
const ANALYTICS_TIME_COLUMNS = ['created_at', 'timestamp', 'createdAt'] as const;

export type WebAccessEventType = 'login_started' | 'login_success' | 'login_failed';

export interface WebAccessAttemptEvent {
  event_type: WebAccessEventType;
  attempt_id?: string;
  email?: string | null;
  path?: string;
  referrer?: string;
  error_message?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

export interface AccessAnalyticsSummary {
  total_attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  unique_countries: number;
  unique_ips: number;
  last_24h_attempts: number;
  last_7d_attempts: number;
  generated_at: string;
}

export interface AccessAnalyticsCountryStat {
  country_code: string;
  country_name: string;
  attempts: number;
  successful_attempts: number;
  failed_attempts: number;
  share: number;
}

export interface AccessAnalyticsDailyStat {
  date: string;
  attempts: number;
  successful_attempts: number;
  failed_attempts: number;
}

export interface AccessAnalyticsAttempt {
  id: string;
  created_at: string;
  event_type: WebAccessEventType | string;
  email: string | null;
  status: string;
  country_code: string | null;
  country_name: string | null;
  ip: string | null;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface AccessAnalyticsDashboardPayload {
  summary: AccessAnalyticsSummary;
  countries: AccessAnalyticsCountryStat[];
  daily: AccessAnalyticsDailyStat[];
  recent_attempts: AccessAnalyticsAttempt[];
  generated_at: string;
}

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: unknown;
  message?: string;
};

const WINDOW_STORAGE = () => (typeof window !== 'undefined' ? window.sessionStorage : null);

const asRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
);

const asString = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const getAttemptTimestamp = (attempt: AccessAnalyticsAttempt): number => {
  const parsed = new Date(attempt.created_at);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const countUniqueStrings = (values: Array<string | null | undefined>): number => {
  return new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)).size;
};

const countAttemptsSince = (attempts: AccessAnalyticsAttempt[], cutoffTimestamp: number): number => {
  return attempts.reduce((count, attempt) => count + (getAttemptTimestamp(attempt) >= cutoffTimestamp ? 1 : 0), 0);
};

const getLatestAttemptIso = (attempts: AccessAnalyticsAttempt[]): string => {
  const latestTimestamp = attempts.reduce((latest, attempt) => Math.max(latest, getAttemptTimestamp(attempt)), 0);
  return latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : new Date().toISOString();
};

const resolveDerivedCount = (value: unknown, fallback: number): number => {
  const parsed = asNumber(value, fallback);
  return parsed > 0 ? parsed : fallback;
};

const createAttemptId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `attempt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

export const startWebAccessAttempt = (): string => {
  const attemptId = createAttemptId();
  const storage = WINDOW_STORAGE();
  storage?.setItem(WEB_ACCESS_ATTEMPT_STORAGE_KEY, attemptId);
  return attemptId;
};

export const getPendingWebAccessAttemptId = (): string | null => {
  const storage = WINDOW_STORAGE();
  return storage?.getItem(WEB_ACCESS_ATTEMPT_STORAGE_KEY) || null;
};

export const consumePendingWebAccessAttemptId = (): string | null => {
  const storage = WINDOW_STORAGE();
  if (!storage) return null;

  const attemptId = storage.getItem(WEB_ACCESS_ATTEMPT_STORAGE_KEY);
  storage.removeItem(WEB_ACCESS_ATTEMPT_STORAGE_KEY);
  return attemptId;
};

const buildAnalyticsHeaders = (): Record<string, string> => {
  const token = authClient.getAccessToken() || (typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : '');
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const buildQueryHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const apiKey = configManager.apiKey;
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const analyticsHeaders = buildAnalyticsHeaders();
  return {
    ...headers,
    ...analyticsHeaders,
  };
};

const buildAnalyticsAttemptRecord = (
  payload: WebAccessAttemptEvent,
  timestamp: string,
) => ({
  attempt_id: payload.attempt_id || createAttemptId(),
  event_type: payload.event_type,
  email: payload.email ?? null,
  path: payload.path ?? null,
  referrer: payload.referrer ?? null,
  error_message: payload.error_message ?? null,
  user_agent: payload.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
  metadata: payload.metadata ?? {},
  ...(payload.event_type === 'login_started' ? { created_at: timestamp } : { completed_at: timestamp }),
  updated_at: timestamp,
});

async function sendAnalyticsPayloadViaQuery(payload: WebAccessAttemptEvent): Promise<void> {
  const timestamp = new Date().toISOString();
  const apiUrl = configManager.apiUrl;

  if (!apiUrl) {
    throw new Error('Missing query API URL');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: buildQueryHeaders(),
    body: JSON.stringify({
      table: WEB_ACCESS_ANALYTICS_TABLE,
      operation: 'upsert',
      data: buildAnalyticsAttemptRecord(payload, timestamp),
      onConflict: 'attempt_id',
      returning: '*',
    }),
    keepalive: true,
  });

  const raw = await response.json().catch(() => ({}));
  if (!response.ok || asRecord(raw).error) {
    const errorMessage =
      asRecord(raw).error?.message ||
      asRecord(raw).message ||
      `No se pudo guardar el evento (${response.status})`;
    throw new Error(String(errorMessage));
  }
}

async function sendAnalyticsPayloadViaLegacyEndpoint(payload: WebAccessAttemptEvent): Promise<void> {
  const body = {
    ...payload,
    timestamp: new Date().toISOString(),
    user_agent: payload.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
  };

  const url = buildFunctionsUrl(LEGACY_WEB_ACCESS_ANALYTICS_ENDPOINT);
  const serialized = JSON.stringify(body);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const beaconOk = navigator.sendBeacon(url, new Blob([serialized], { type: 'application/json' }));
      if (beaconOk) {
        return;
      }
    } catch {
      // Fallback to fetch below.
    }
  }

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAnalyticsHeaders(),
    },
    body: serialized,
    keepalive: true,
  });
}

const sendAnalyticsPayload = async (payload: WebAccessAttemptEvent): Promise<void> => {
  await configManager.loadConfig();

  try {
    await sendAnalyticsPayloadViaQuery(payload);
  } catch {
    try {
      await sendAnalyticsPayloadViaLegacyEndpoint(payload);
    } catch {
      // Tracking should never block navigation or auth flow.
    }
  }
};

export const recordWebAccessAttempt = async (payload: Omit<WebAccessAttemptEvent, 'user_agent'> & { user_agent?: string }): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    await sendAnalyticsPayload({
      ...payload,
      user_agent: payload.user_agent || window.navigator.userAgent,
    });
  } catch {
    // Tracking should never block navigation or auth flow.
  }
};

const getValue = (source: Record<string, any>, keys: string[], fallback = ''): string => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const normalized = asString(value, '');
      if (normalized) return normalized;
    }
  }
  return fallback;
};

const getNullableString = (source: Record<string, any>, keys: string[]): string | null => {
  const value = getValue(source, keys, '');
  return value || null;
};

const normalizeCountry = (entry: unknown): AccessAnalyticsCountryStat => {
  const source = asRecord(entry);
  return {
    country_code: getValue(source, ['country_code', 'countryCode', 'code', 'iso_code', 'isoCode'], '??'),
    country_name: getValue(source, ['country_name', 'countryName', 'name', 'country', 'label'], 'Desconocido'),
    attempts: asNumber(source.attempts ?? source.total ?? source.count, 0),
    successful_attempts: asNumber(source.successful_attempts ?? source.success ?? source.successes, 0),
    failed_attempts: asNumber(source.failed_attempts ?? source.failed ?? source.failures, 0),
    share: asNumber(source.share ?? source.percentage ?? source.pct, 0),
  };
};

const normalizeDaily = (entry: unknown): AccessAnalyticsDailyStat => {
  const source = asRecord(entry);
  return {
    date: getValue(source, ['date', 'day', 'created_at', 'period'], ''),
    attempts: asNumber(source.attempts ?? source.total ?? source.count, 0),
    successful_attempts: asNumber(source.successful_attempts ?? source.success ?? source.successes, 0),
    failed_attempts: asNumber(source.failed_attempts ?? source.failed ?? source.failures, 0),
  };
};

const normalizeAttempt = (entry: unknown): AccessAnalyticsAttempt => {
  const source = asRecord(entry);
  return {
    id: getValue(source, ['id', 'attempt_id', 'event_id'], createAttemptId()),
    created_at: getValue(source, ['created_at', 'timestamp', 'createdAt'], new Date().toISOString()),
    event_type: getValue(source, ['event_type', 'type', 'status'], 'login_started'),
    email: getNullableString(source, ['email', 'user_email', 'account_email']),
    status: getValue(source, ['status', 'event_status'], getValue(source, ['event_type', 'type'], 'login_started')),
    country_code: getNullableString(source, ['country_code', 'countryCode', 'iso_code']),
    country_name: getNullableString(source, ['country_name', 'countryName', 'country']),
    ip: getNullableString(source, ['ip', 'ip_address', 'client_ip', 'remote_ip']),
    path: getNullableString(source, ['path', 'url', 'pathname', 'route']),
    referrer: getNullableString(source, ['referrer', 'referer']),
    user_agent: getNullableString(source, ['user_agent', 'userAgent', 'ua']),
    error_message: getNullableString(source, ['error_message', 'error', 'message']),
    metadata: asRecord(source.metadata ?? source.meta ?? source.context ?? {}),
  };
};

const normalizeSummary = (
  source: Record<string, any>,
  countries: AccessAnalyticsCountryStat[],
  daily: AccessAnalyticsDailyStat[],
  recentAttempts: AccessAnalyticsAttempt[],
): AccessAnalyticsSummary => {
  const totalAttemptsFallback = countries.reduce((sum, item) => sum + item.attempts, 0) || daily.reduce((sum, item) => sum + item.attempts, 0) || recentAttempts.length;
  const successfulAttemptsFallback = countries.reduce((sum, item) => sum + item.successful_attempts, 0) || daily.reduce((sum, item) => sum + item.successful_attempts, 0);
  const failedAttemptsFallback = countries.reduce((sum, item) => sum + item.failed_attempts, 0) || daily.reduce((sum, item) => sum + item.failed_attempts, 0);
  const uniqueIpsFallback = countUniqueStrings(recentAttempts.map((attempt) => attempt.ip));
  const last24hFallback = countAttemptsSince(recentAttempts, Date.now() - DAY_IN_MS);
  const last7dFallback = countAttemptsSince(recentAttempts, Date.now() - 7 * DAY_IN_MS);

  return {
    total_attempts: resolveDerivedCount(
      source.total_attempts ??
      source.attempts ??
      source.total ??
      source.count,
      totalAttemptsFallback,
    ),
    successful_attempts: resolveDerivedCount(
      source.successful_attempts ??
      source.success_attempts ??
      source.success ??
      source.sent,
      successfulAttemptsFallback,
    ),
    failed_attempts: resolveDerivedCount(
      source.failed_attempts ??
      source.fail_attempts ??
      source.failed ??
      source.errors,
      failedAttemptsFallback,
    ),
    unique_countries: resolveDerivedCount(source.unique_countries ?? source.countries_count, countries.length),
    unique_ips: resolveDerivedCount(source.unique_ips ?? source.ips_count, uniqueIpsFallback),
    last_24h_attempts: resolveDerivedCount(source.last_24h_attempts ?? source.attempts_24h ?? source.last_day_attempts, last24hFallback),
    last_7d_attempts: resolveDerivedCount(source.last_7d_attempts ?? source.attempts_7d ?? source.last_week_attempts, last7dFallback),
    generated_at: getValue(source, ['generated_at', 'updated_at', 'timestamp', 'generatedAt'], getLatestAttemptIso(recentAttempts)),
  };
};

const normalizeAnalyticsPayload = (raw: unknown): AccessAnalyticsDashboardPayload => {
  const envelope = asRecord(raw) as ApiEnvelope<Record<string, any>>;
  const root = asRecord(envelope.data ?? raw);

  const countriesSource = Array.isArray(root.countries)
    ? root.countries
    : Array.isArray(root.country_breakdown)
    ? root.country_breakdown
    : Array.isArray(root.country_stats)
    ? root.country_stats
    : [];

  const dailySource = Array.isArray(root.daily)
    ? root.daily
    : Array.isArray(root.daily_trend)
    ? root.daily_trend
    : Array.isArray(root.timeline)
    ? root.timeline
    : [];

  const recentAttemptsSource = Array.isArray(root.recent_attempts)
    ? root.recent_attempts
    : Array.isArray(root.attempts)
    ? root.attempts
    : Array.isArray(root.recent_logs)
    ? root.recent_logs
    : [];

  const countries = countriesSource.map(normalizeCountry);
  const daily = dailySource.map(normalizeDaily);
  const recentAttempts = recentAttemptsSource.map(normalizeAttempt);
  const summary = normalizeSummary(asRecord(root.summary ?? root.stats ?? root), countries, daily, recentAttempts);

  const totalAttempts = summary.total_attempts || 1;
  const normalizedCountries = countries.map((country) => ({
    ...country,
    share: country.share > 0 ? country.share : Number(((country.attempts / totalAttempts) * 100).toFixed(1)),
  }));

  return {
    summary,
    countries: normalizedCountries,
    daily,
    recent_attempts: recentAttempts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    generated_at: summary.generated_at,
  };
};

function toUtcDateKey(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 10) || 'unknown';
  }

  return parsed.toISOString().slice(0, 10);
}

function isSuccessfulAttempt(attempt: AccessAnalyticsAttempt): boolean {
  const marker = `${attempt.event_type} ${attempt.status}`.toLowerCase();
  return /(success|complete|completed|ok|done|accepted)/.test(marker);
}

function isFailedAttempt(attempt: AccessAnalyticsAttempt): boolean {
  const marker = `${attempt.event_type} ${attempt.status}`.toLowerCase();
  return /(fail|failed|error|reject|rejected|deny|denied)/.test(marker);
}

function buildCountryBreakdown(attempts: AccessAnalyticsAttempt[]): AccessAnalyticsCountryStat[] {
  const countries = new Map<string, AccessAnalyticsCountryStat>();

  for (const attempt of attempts) {
    const countryCode = (attempt.country_code || '??').trim().toUpperCase() || '??';
    const countryName = (attempt.country_name || 'Desconocido').trim() || 'Desconocido';
    const existing = countries.get(countryCode) || {
      country_code: countryCode,
      country_name: countryName,
      attempts: 0,
      successful_attempts: 0,
      failed_attempts: 0,
      share: 0,
    };

    existing.attempts += 1;
    if (isSuccessfulAttempt(attempt)) {
      existing.successful_attempts += 1;
    }
    if (isFailedAttempt(attempt)) {
      existing.failed_attempts += 1;
    }

    if (existing.country_name === 'Desconocido' && countryName !== 'Desconocido') {
      existing.country_name = countryName;
    }

    countries.set(countryCode, existing);
  }

  return [...countries.values()].sort((a, b) => b.attempts - a.attempts || a.country_name.localeCompare(b.country_name, 'es'));
}

function buildDailyBreakdown(attempts: AccessAnalyticsAttempt[]): AccessAnalyticsDailyStat[] {
  const days = new Map<string, AccessAnalyticsDailyStat>();

  for (const attempt of attempts) {
    const dateKey = toUtcDateKey(attempt.created_at);
    const existing = days.get(dateKey) || {
      date: dateKey,
      attempts: 0,
      successful_attempts: 0,
      failed_attempts: 0,
    };

    existing.attempts += 1;
    if (isSuccessfulAttempt(attempt)) {
      existing.successful_attempts += 1;
    }
    if (isFailedAttempt(attempt)) {
      existing.failed_attempts += 1;
    }

    days.set(dateKey, existing);
  }

  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildAnalyticsPayloadFromAttempts(attempts: AccessAnalyticsAttempt[]): AccessAnalyticsDashboardPayload {
  const countries = buildCountryBreakdown(attempts);
  const daily = buildDailyBreakdown(attempts);
  const summary = normalizeSummary({}, countries, daily, attempts);
  const totalAttempts = summary.total_attempts || 1;

  const normalizedCountries = countries.map((country) => ({
    ...country,
    share: country.share > 0 ? country.share : Number(((country.attempts / totalAttempts) * 100).toFixed(1)),
  }));

  return {
    summary,
    countries: normalizedCountries,
    daily,
    recent_attempts: [...attempts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    generated_at: summary.generated_at,
  };
}

function getAnalyticsRangeStart(range: string): Date | null {
  const now = new Date();
  const normalized = (range || '').trim().toLowerCase();

  switch (normalized) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

async function loadAnalyticsAttemptsFromQuery(range: string): Promise<AccessAnalyticsAttempt[]> {
  const rangeStart = getAnalyticsRangeStart(range);
  const attempts: AccessAnalyticsAttempt[] = [];

  for (const timeColumn of ANALYTICS_TIME_COLUMNS) {
    attempts.length = 0;
    let offset = 0;
    const filters: QueryFilter[] = [];

    if (rangeStart) {
      filters.push({
        column: timeColumn,
        op: 'gte',
        value: rangeStart.toISOString(),
      });
    }

    while (attempts.length < ANALYTICS_MAX_ROWS) {
      const result = await querySelect<Record<string, unknown>>({
        table: WEB_ACCESS_ANALYTICS_TABLE,
        operation: 'select',
        select: '*',
        filters,
        order: {
          column: timeColumn,
          ascending: false,
        },
        limit: ANALYTICS_PAGE_SIZE,
        offset,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const page = (result.data || []).map(normalizeAttempt);
      attempts.push(...page);

      if (page.length < ANALYTICS_PAGE_SIZE) {
        return attempts;
      }

      offset += page.length;
    }

    if (attempts.length > 0) {
      return attempts;
    }
  }

  return attempts;
}

async function loadLegacyAnalyticsPayload(range: string): Promise<AccessAnalyticsDashboardPayload> {
  const params = new URLSearchParams();
  if (range) {
    params.set('range', range);
  }

  const endpoint = params.toString()
    ? `${LEGACY_WEB_ACCESS_ANALYTICS_ENDPOINT}?${params.toString()}`
    : LEGACY_WEB_ACCESS_ANALYTICS_ENDPOINT;

  const response = await fetch(buildFunctionsUrl(endpoint), {
    method: 'GET',
    headers: {
      ...buildAnalyticsHeaders(),
    },
  });

  const raw = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      asRecord(raw).message ||
      asRecord(raw).error?.message ||
      `No se pudieron cargar las estadisticas (${response.status})`;
    throw new Error(String(errorMessage));
  }

  return normalizeAnalyticsPayload(raw);
}

export async function loadAdminAccessAnalytics(range = '30d'): Promise<AccessAnalyticsDashboardPayload> {
  await configManager.loadConfig();
  try {
    const attempts = await loadAnalyticsAttemptsFromQuery(range);
    return buildAnalyticsPayloadFromAttempts(attempts);
  } catch {
    return loadLegacyAnalyticsPayload(range);
  }
}
