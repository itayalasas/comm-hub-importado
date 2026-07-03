import { configManager } from './config';

type FunctionsFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  includeApiKey?: boolean;
};

export function functionsFetch(path: string, options: FunctionsFetchOptions = {}): Promise<Response> {
  const base = configManager.functionsBaseUrl;
  const apiKey = configManager.apiKey;
  const { includeApiKey = true, headers, ...requestInit } = options;
  const resolvedHeaders = { ...(headers || {}) };

  if (!includeApiKey) {
    delete resolvedHeaders['x-api-key'];
    delete resolvedHeaders['X-API-KEY'];
  }

  return fetch(`${base}/${path}`, {
    ...requestInit,
    headers: {
      'Content-Type': 'application/json',
      ...(includeApiKey && apiKey ? { 'x-api-key': apiKey } : {}),
      ...resolvedHeaders,
    },
  });
}
