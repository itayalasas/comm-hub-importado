import { buildCorsHeaders, resolveAuthUpstreamUrl } from "../_shared/auth-proxy.ts";

function parseCookies(cookieHeader = ""): Record<string, string> {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [rawKey, ...rawValue] = pair.split("=");
    const key = rawKey?.trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {} as Record<string, string>);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const cors = buildCorsHeaders(origin, {
    methods: "POST, OPTIONS",
    allowCredentials: true,
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
      }),
      {
        status: 405,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const cookieHeader = req.headers.get("cookie");
    const cookies = parseCookies(cookieHeader || "");
    const refreshToken = cookies["refresh_token"];

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: "No refresh token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const refreshUrl = resolveAuthUpstreamUrl("auth-refresh");
    if (!refreshUrl) {
      return new Response(JSON.stringify({ error: "AUTH_REFRESH_URL not configured on server" }), {
        status: 501,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Failed to refresh token", detail }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await upstream.json().catch(() => ({}));
    const newAccessToken = data.access_token || null;
    const newRefreshToken = data.refresh_token || null;
    const refreshExpires = data.refresh_expires_in || 30 * 24 * 60 * 60;

    const headers: Record<string, string> = {
      ...cors,
      "Content-Type": "application/json",
    };

    if (newRefreshToken) {
      const encoded = encodeURIComponent(newRefreshToken);
      headers["Set-Cookie"] = `refresh_token=${encoded}; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=${Math.floor(refreshExpires)}`;
    }

    return new Response(JSON.stringify({ ok: true, access_token: newAccessToken }), {
      status: 200,
      headers,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
