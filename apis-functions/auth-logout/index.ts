import { buildCorsHeaders } from "../_shared/auth-proxy.ts";

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

  const expiredCookie = "refresh_token=; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=0";

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Set-Cookie": expiredCookie,
    },
  });
});
