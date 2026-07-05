
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, x-user-id, x-admin-token, Accept",
  "Access-Control-Max-Age": "86400",
};

function getAuthFunctionsBaseUrl(): string {
  return (
    Deno.env.get("AUTH_EDGE_FUNCTIONS_BASE_URL") ||    
    "https://sfqtmnncgiqkveaoqckt.supabase.co/functions/v1"
  )
    .trim()
    .replace(/\/+$/, "");
}

function buildUpstreamUrl(route: string, incomingUrl: URL): string {
  const baseUrl = getAuthFunctionsBaseUrl();
  const upstream = new URL(`${baseUrl}/${route.replace(/^\/+/, "")}`);
  upstream.search = incomingUrl.search;
  return upstream.toString();
}

function cloneRequestHeaders(req: Request): Headers {
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

export async function forwardAuthFunction(req: Request, route: string): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
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

  const upstreamUrl = buildUpstreamUrl(route, new URL(req.url));
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

