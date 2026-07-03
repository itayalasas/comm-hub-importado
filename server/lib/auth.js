import geoip from 'geoip-lite';
import { serverConfig } from './config.js';

const COUNTRY_DISPLAY_NAMES = (() => {
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' });
  } catch {
    return null;
  }
})();

export function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, pair) => {
    const [rawKey, ...rawValue] = pair.split('=');
    const key = rawKey?.trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rawValue.join('=').trim());
    return acc;
  }, {});
}

export function buildCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure !== false) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  } else {
    parts.push('SameSite=None');
  }

  if (typeof options.maxAge === 'number') {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  return parts.join('; ');
}

export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function getBearerToken(req) {
  const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
  if (!authHeader.startsWith('Bearer ')) return '';
  return authHeader.slice(7).trim();
}

export function getRequestIdentity(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const userId = String(
    payload.sub ||
    payload.user_id ||
    payload.id ||
    payload.user?.id ||
    payload.user?.sub ||
    '',
  ).trim();

  if (!userId) return null;

  const tenantId = String(
    payload.tenant_id ||
    payload.user?.tenant_id ||
    payload.tenant?.id ||
    '',
  ).trim() || null;

  const email = String(
    payload.email ||
    payload.user?.email ||
    payload.claims?.email ||
    '',
  ).trim() || null;

  return { userId, tenantId, email, payload };
}

export function getClientIp(req) {
  const headerNames = [
    'cf-connecting-ip',
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'true-client-ip',
  ];

  for (const headerName of headerNames) {
    const raw = req.headers[headerName];
    if (typeof raw === 'string' && raw.trim()) {
      return raw.split(',')[0].trim();
    }
  }

  const remote = req.socket?.remoteAddress || req.ip || '';
  return String(remote).replace(/^::ffff:/, '');
}

export function lookupCountry(ip) {
  const cleanedIp = String(ip || '').trim();
  if (!cleanedIp || cleanedIp === '127.0.0.1' || cleanedIp === '::1') {
    return {
      country_code: 'LO',
      country_name: 'Local',
    };
  }

  const geo = geoip.lookup(cleanedIp);
  if (!geo?.country) {
    return {
      country_code: '??',
      country_name: 'Desconocido',
    };
  }

  const countryName = COUNTRY_DISPLAY_NAMES?.of(geo.country) || geo.country;

  return {
    country_code: geo.country,
    country_name: countryName || geo.country,
  };
}

export function getAllowedApiKeys() {
  const values = [
    serverConfig.apiKey,
    serverConfig.apiKeyUserEmbed,
    serverConfig.adminApiKey,
    process.env.API_KEY,
    process.env.VITE_API_KEY,
    process.env.API_KEY_USER_EMBED,
    process.env.FPM_API_KEY,
    process.env.FPM_AUTH_TOKENS,
  ];

  return new Set(values.map((value) => String(value || '').trim()).filter(Boolean));
}

export function isApiKeyAllowed(value) {
  const key = String(value || '').trim();
  if (!key) return false;

  const allowed = getAllowedApiKeys();
  if (allowed.size === 0) return true;
  return allowed.has(key);
}
