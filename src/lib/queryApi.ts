import { authClient } from './auth';
import { buildFunctionsUrl, configManager, getRuntimeConfig } from './config';

export type QueryOperation = 'select' | 'insert' | 'update' | 'delete' | 'upsert';

export type QueryFilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is';

export type QueryFilterValue = string | number | boolean | null | Array<string | number | boolean>;

export interface QueryFilter {
  column: string;
  op: QueryFilterOperator | string;
  value: QueryFilterValue;
}

export interface QueryOrder {
  column: string;
  ascending?: boolean;
}

export interface QueryRequest {
  table: string;
  operation: QueryOperation;
  baseUrl?: string;
  select?: string;
  filters?: QueryFilter[];
  order?: QueryOrder;
  limit?: number;
  offset?: number;
  data?: Record<string, unknown> | Record<string, unknown>[] | null;
  update?: Record<string, unknown> | null;
  returning?: string;
  onConflict?: string;
}

export interface QueryError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  raw?: unknown;
}

export interface QueryResponse<T> {
  data: T[] | null;
  error: QueryError | null;
  count: number | null;
}

export interface QuerySingleResponse<T> {
  data: T | null;
  error: QueryError | null;
  count: number | null;
}

function getAccessToken(): string {
  if (typeof window === 'undefined') return authClient.getAccessToken() || '';
  return authClient.getAccessToken() || localStorage.getItem('access_token') || '';
}

function buildHeaders(): HeadersInit {
  const { apiKey } = getRuntimeConfig();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function normalizeQueryError(raw: unknown, status?: number): QueryError {
  if (!raw) {
    return {
      message: status ? `HTTP ${status}` : 'Unknown query error',
      raw,
    };
  }

  if (typeof raw === 'string') {
    return {
      message: raw,
      raw,
    };
  }

  if (typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    const message = String(record.message || record.error || record.detail || record.details || `HTTP ${status ?? 'error'}`);
    return {
      message,
      code: record.code ? String(record.code) : undefined,
      details: record.details ? String(record.details) : undefined,
      hint: record.hint ? String(record.hint) : undefined,
      raw,
    };
  }

  return {
    message: String(raw),
    raw,
  };
}

function normalizeQueryData<T>(json: any): T[] | null {
  if (Array.isArray(json?.data)) return json.data as T[];
  if (Array.isArray(json?.data?.data)) return json.data.data as T[];
  if (Array.isArray(json)) return json as T[];
  if (Array.isArray(json?.result)) return json.result as T[];
  if (Array.isArray(json?.rows)) return json.rows as T[];
  return null;
}

function buildAlternateQueryUrl(queryApiUrl: string): string | null {
  try {
    const url = new URL(queryApiUrl);
    if (url.pathname.endsWith('/v1/query')) {
      url.pathname = url.pathname.replace(/\/v1\/query$/, '/query');
      return url.toString();
    }
    if (url.pathname.endsWith('/query')) {
      url.pathname = url.pathname.replace(/\/query$/, '/v1/query');
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function shouldLogQueryRequests(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function logQueryRequest(url: string, request: QueryRequest): void {
  if (!shouldLogQueryRequests()) return;

  console.groupCollapsed('[query] request');
  console.log('url:', url);
  console.log('request:', request);
  console.groupEnd();
}

async function queryRequest<T>(request: QueryRequest): Promise<QueryResponse<T>> {
  await configManager.loadConfig();
  const { baseUrl: baseUrlOverride, ...requestBody } = request;
  const runtime = getRuntimeConfig();
  const queryApiUrl = baseUrlOverride
    ? buildFunctionsUrl('query', baseUrlOverride)
    : runtime.queryApiUrl;

  if (!queryApiUrl) {
    return {
      data: null,
      error: { message: 'Missing query API URL' },
      count: null,
    };
  }

  try {
    const execute = async (url: string) => {
      logQueryRequest(url, requestBody);
      const response = await fetch(url, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({
          ...requestBody,
        }),
      });

      const json = await response.json().catch(() => ({}));
      const data = normalizeQueryData<T>(json);
      const count = typeof json?.count === 'number'
        ? json.count
        : typeof json?.data?.count === 'number'
          ? json.data.count
          : typeof json?.data?.data?.count === 'number'
            ? json.data.data.count
            : null;
      const rawError = json?.error ?? json?.data?.error ?? null;

      return {
        response,
        json,
        data,
        count,
        rawError,
      };
    };

    let result = await execute(queryApiUrl);
    if (result.response.status === 404) {
      const alternateUrl = buildAlternateQueryUrl(queryApiUrl);
      if (alternateUrl && alternateUrl !== queryApiUrl) {
        if (shouldLogQueryRequests()) {
          console.warn('[query] primary endpoint returned 404, retrying alternate url:', alternateUrl);
        }
        result = await execute(alternateUrl);
      }
    }

    if (!result.response.ok || result.rawError) {
      return {
        data: null,
        error: normalizeQueryError(result.rawError || result.json, result.response.status),
        count: result.count,
      };
    }

    return {
      data: result.data,
      error: null,
      count: result.count,
    };
  } catch (error) {
    return {
      data: null,
      error: normalizeQueryError(error),
      count: null,
    };
  }
}

export async function querySelect<T>(request: QueryRequest): Promise<QueryResponse<T>> {
  return queryRequest<T>({
    ...request,
    operation: 'select',
  });
}

export async function queryMutate<T>(request: QueryRequest): Promise<QueryResponse<T>> {
  if (!['insert', 'update', 'delete', 'upsert'].includes(request.operation)) {
    return {
      data: null,
      error: { message: `Invalid mutate operation: ${request.operation}` },
      count: null,
    };
  }

  return queryRequest<T>(request);
}

export async function querySingle<T>(request: QueryRequest): Promise<QuerySingleResponse<T>> {
  const result = await querySelect<T>({
    ...request,
    limit: request.limit ?? 1,
  });

  return {
    ...result,
    data: result.data?.[0] ?? null,
  };
}

export async function queryCount(request: QueryRequest): Promise<{ count: number; error: QueryError | null }> {
  const result = await querySelect<unknown>(request);
  return {
    count: result.count ?? (result.data?.length ?? 0),
    error: result.error,
  };
}
