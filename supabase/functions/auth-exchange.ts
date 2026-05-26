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

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin');
  const cors = buildCors(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: cors });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const accessToken = body.access_token || null;
    const refreshToken = body.refresh_token || null;
    const refreshExpires = body.refresh_expires_in || 30 * 24 * 60 * 60; // default 30 days

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'refresh_token is required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const encoded = encodeURIComponent(refreshToken);
    const cookie = `refresh_token=${encoded}; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=${Math.floor(refreshExpires)}`;

    return new Response(JSON.stringify({ ok: true, access_token: accessToken }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json', 'Set-Cookie': cookie },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
