import { configManager } from './config';
import { authClient } from './auth';

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

function getAccessToken(): string {
  if (typeof window === 'undefined') return authClient.getAccessToken() || '';
  return authClient.getAccessToken() || window.localStorage.getItem('access_token') || '';
}

// Cabeceras para que el panel llame a las funciones de envío en nombre de una
// aplicación con la sesión del usuario, sin usar la API key de la aplicación.
export function buildAppSessionHeaders(applicationId: string): Record<string, string> {
  const id = (applicationId || '').trim();
  if (!id) {
    throw new Error('Selecciona una aplicación');
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'x-application-id': id,
  };
}
