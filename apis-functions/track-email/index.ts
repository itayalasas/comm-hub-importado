import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const transparentPixel = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const databaseUrl = Deno.env.get("DATABASE_URL");

  if (!databaseUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Missing DATABASE_URL environment variable",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const pool = new Pool(databaseUrl, 3, true);

  try {
    const url = new URL(req.url);
    const logId = url.searchParams.get("log_id");
    const path = url.pathname;

    if (!logId) {
      return new Response("Missing log_id parameter", {
        status: 400,
        headers: corsHeaders,
      });
    }

    const client = await pool.connect();

    try {
      if (path.includes("/open")) {
        await client.queryObject(
          `
          UPDATE email_logs
          SET opened_at = NOW()
          WHERE id = $1
            AND opened_at IS NULL
          `,
          [logId],
        );

        return new Response(transparentPixel, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "image/gif",
            "Cache-Control": "no-cache, no-store, must-revalidate",
          },
        });
      }

      if (path.includes("/click")) {
        const targetUrl = url.searchParams.get("url");

        await client.queryObject(
          `
          UPDATE email_logs
          SET clicked_at = NOW()
          WHERE id = $1
            AND clicked_at IS NULL
          `,
          [logId],
        );

        if (!targetUrl) {
          return new Response("Missing url parameter", {
            status: 400,
            headers: corsHeaders,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: decodeURIComponent(targetUrl),
          },
        });
      }

      return new Response("Invalid endpoint", {
        status: 404,
        headers: corsHeaders,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    await pool.end();
  }
});
