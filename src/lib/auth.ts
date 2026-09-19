import { buildFunctionsUrl, getRuntimeConfig } from './config';
import { fetchJsonWithTimeout } from './subscriptionCheckout';

const AUTH_REQUEST_TIMEOUT_MS = 5000;

// Lightweight client-side auth helper for cookie-based refresh flow.
// Stores short-lived access token in memory; uses server endpoints for cookie-set refresh token.

let _accessToken: string | null = null;

function resolveBaseUrl(baseUrl: string): string {
  const direct = (baseUrl || '').trim().replace(/\/+$/, '');
  if (direct) return direct;

  const runtimeBaseUrl = (
    getRuntimeConfig().authUrl ||
    getRuntimeConfig().publicFunctionsBaseUrlRaw ||
    ''
  ).trim().replace(/\/+$/, '');
  return runtimeBaseUrl;
}

function buildAuthEndpoint(baseUrl: string, endpoint: string): string {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  if (!resolvedBaseUrl) {
    throw new Error(`Missing base URL for ${endpoint}`);
  }

  return buildFunctionsUrl(endpoint, resolvedBaseUrl);
}

export const authClient = {
  setAccessToken: (token: string | null) => {
    _accessToken = token || null;
  },
  getAccessToken: () => _accessToken,

  // Call server endpoint to refresh access token using HttpOnly cookie.
  // Acotado con timeout: si el endpoint no responde (o no existe), no debe
  // dejar colgado a quien esta esperando este resultado.
  refreshAccessToken: async (baseUrl: string) => {
    try {
      const res = await fetchJsonWithTimeout(
        buildAuthEndpoint(baseUrl, 'auth-refresh'),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
        AUTH_REQUEST_TIMEOUT_MS,
      );
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      if (data.access_token) {
        _accessToken = data.access_token;
        return data.access_token;
      }
      return null;
    } catch (err) {
      return null;
    }
  },

  // Logout: clear cookie server-side (best-effort, acotado con timeout para
  // que nunca bloquee el cierre de sesion del lado del cliente).
  logout: async (baseUrl: string) => {
    try {
      await fetchJsonWithTimeout(
        buildAuthEndpoint(baseUrl, 'auth-logout'),
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        },
        AUTH_REQUEST_TIMEOUT_MS,
      );
    } catch {}
    _accessToken = null;
  },
};
