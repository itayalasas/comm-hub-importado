import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const configuredOrigins = new Set(
  (Deno.env.get('CORS_ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const defaultAllowedOrigins = new Set([
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
  'https://sendcraft-test.jollypond-925d9aaa.northcentralus.azurecontainerapps.io',
  'https://auth.sendcraft.net',
  'https://sendcraft.com',
  'https://www.sendcraft.com',
]);

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('http://[::1]')) {
    return true;
  }
  return configuredOrigins.has(origin) || defaultAllowedOrigins.has(origin);
}

const buildCors = (origin: string | null) => {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

function parseCookies(cookieHeader: string | null) {
  const res: Record<string, string> = {};
  if (!cookieHeader) return res;
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.split('=');
    if (!k) return;
    res[k.trim()] = decodeURIComponent((v || []).join('=').trim());
  });
  return res;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = buildCors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const cookieHeader = req.headers.get('cookie');
    const cookies = parseCookies(cookieHeader);
    const refreshToken = cookies['refresh_token'];

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'No refresh token' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const refreshUrl = Deno.env.get('AUTH_REFRESH_URL');
    if (!refreshUrl) {
      return new Response(JSON.stringify({ error: 'AUTH_REFRESH_URL not configured on server' }), {
        status: 501,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const resp = await fetch(refreshUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return new Response(JSON.stringify({ error: 'Failed to refresh token', detail: txt }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json().catch(() => ({}));
    const newAccessToken = data.access_token || null;
    const newRefreshToken = data.refresh_token || null;
    const refreshExpires = data.refresh_expires_in || 30 * 24 * 60 * 60;

    const headers: Record<string, string> = { ...cors, 'Content-Type': 'application/json' };
    if (newRefreshToken) {
      const encoded = encodeURIComponent(newRefreshToken);
      headers['Set-Cookie'] = `refresh_token=${encoded}; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=${Math.floor(refreshExpires)}`;
    }

    return new Response(JSON.stringify({ ok: true, access_token: newAccessToken }), {
      status: 200,
      headers,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
