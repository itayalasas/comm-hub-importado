type CorsOptions = {
  methods?: string;
  allowCredentials?: boolean;
};

const configuredOrigins = new Set(
  (Deno.env.get("CORS_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

const defaultAllowedOrigins = new Set([
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://sendcraft-test.jollypond-925d9aaa.northcentralus.azurecontainerapps.io",
  "https://auth.sendcraft.net",
  "https://sendcraft.com",
  "https://www.sendcraft.com",
]);

const defaultAllowedHeaders = [
  "Content-Type",
  "Authorization",
  "X-Client-Info",
  "Apikey",
  "x-api-key",
  "x-user-id",
  "x-admin-token",
  "Accept",
];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://[::1]")
  ) {
    return true;
  }

  return configuredOrigins.has(origin) || defaultAllowedOrigins.has(origin);
}

function trimBaseUrl(value: string): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function readEnvUrl(...keys: string[]): string {
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (typeof value === "string" && value.trim()) {
      return trimBaseUrl(value);
    }
  }

  return "";
}

export function buildCorsHeaders(
  origin: string | null,
  options: CorsOptions = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": options.methods || "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": defaultAllowedHeaders.join(", "),
    "Vary": "Origin",
  };

  if (options.allowCredentials !== false) {
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function cloneRequestHeaders(req: Request): Headers {
  const headers = new Headers();

  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "connection" ||
      lower === "transfer-encoding" ||
      lower === "keep-alive" ||
      lower === "upgrade"
    ) {
      return;
    }

    headers.set(key, value);
  });

  if (!headers.has("accept")) {
    headers.set("accept", "application/json, text/plain, */*");
  }

  return headers;
}

export function getAuthUpstreamBaseUrl(): string {
  return readEnvUrl(
    "AUTH_FUNCTIONS_BASE_URL",
    "AUTH_EDGE_FUNCTIONS_BASE_URL",
    "AUTH_URL",
    "VITE_AUTH_URL",
  );
}

export function resolveAuthUpstreamUrl(route: string): string {
  const cleanedRoute = route.replace(/^\/+/, "");
  const routeOverrides: Record<string, string[]> = {
    "auth-exchange-code": ["AUTH_UPSTREAM_EXCHANGE_URL"],
    "auth-verify-token": ["AUTH_UPSTREAM_VERIFY_URL"],
    "auth-refresh": ["AUTH_UPSTREAM_REFRESH_URL"],
    "auth-logout": ["AUTH_UPSTREAM_LOGOUT_URL"],
  };

  const explicitUrl = readEnvUrl(...(routeOverrides[cleanedRoute] || []));
  if (explicitUrl) {
    return explicitUrl;
  }

  const baseUrl = getAuthUpstreamBaseUrl();
  return baseUrl ? `${baseUrl}/${cleanedRoute}` : "";
}

export async function forwardJsonAuthRequest(
  req: Request,
  route: string,
  options: { allowGet?: boolean; allowCredentials?: boolean } = {},
): Promise<Response> {
  const origin = req.headers.get("Origin");
  const corsHeaders = buildCorsHeaders(origin, {
    methods: options.allowGet === false ? "POST, OPTIONS" : "GET, POST, OPTIONS",
    allowCredentials: options.allowCredentials !== false,
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (options.allowGet === false ? req.method !== "POST" : !["GET", "POST"].includes(req.method)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const upstreamUrl = resolveAuthUpstreamUrl(route);
  if (!upstreamUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: "CONFIG_ERROR", message: "Auth upstream URL not configured" },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const headers = cloneRequestHeaders(req);
  const body = req.method === "GET" ? undefined : await req.text();
  if (body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseHeaders = new Headers(upstream.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => responseHeaders.set(key, value));

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Upstream auth service unavailable",
        },
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
