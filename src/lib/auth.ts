import { buildFunctionsUrl, getRuntimeConfig } from './config';

// Lightweight client-side auth helper for cookie-based refresh flow.
// Stores short-lived access token in memory; uses server endpoints for cookie-set refresh token.

let _accessToken: string | null = null;

function shouldLogAuth(): boolean {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function resolveBaseUrl(baseUrl: string): string {
  const direct = (baseUrl || '').trim().replace(/\/+$/, '');
  if (direct) return direct;

  const runtimeBaseUrl = (getRuntimeConfig().functionsBaseUrlRaw || getRuntimeConfig().supabaseUrl || '').trim().replace(/\/+$/, '');
  return runtimeBaseUrl;
}

function buildAuthEndpoint(baseUrl: string, endpoint: string): string {
  const resolvedBaseUrl = resolveBaseUrl(baseUrl);
  if (!resolvedBaseUrl) {
    if (shouldLogAuth()) {
      console.error(`[auth] Missing base URL for ${endpoint}`, {
        baseUrl,
        runtimeBaseUrl: getRuntimeConfig().functionsBaseUrl || getRuntimeConfig().supabaseUrl,
      });
    }
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
  refreshAccessToken: async (baseUrl: string) => {
    try {
      const res = await fetch(buildAuthEndpoint(baseUrl, 'auth-refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
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

  // Logout: clear cookie server-side
  logout: async (baseUrl: string) => {
    try {
      await fetch(buildAuthEndpoint(baseUrl, 'auth-logout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {}
    _accessToken = null;
  },
};
