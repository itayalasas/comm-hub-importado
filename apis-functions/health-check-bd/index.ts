
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool(
  Deno.env.get("DATABASE_URL") || "",
  3,
  true,
);

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "GET") {
    return json({
      status: "error",
      error: "Method not allowed",
      timestamp: new Date().toISOString(),
    }, 405);
  }

  const start = Date.now();
  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        status: "down",
        error: "Missing DATABASE_URL",
        timestamp: new Date().toISOString(),
      }, 500);
    }

    client = await pool.connect();

    const result = await client.queryObject<{ health: number }>(
      "SELECT 1 as health",
    );

    const responseTime = Date.now() - start;

    const isHealthy =
      result.rows.length > 0 &&
      result.rows[0].health === 1;

    return json({
      status: isHealthy ? "operational" : "degraded",
      responseTime,
      database: "postgres",
      provider: "neon",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return json({
      status: "down",
      responseTime: Date.now() - start,
      error: error instanceof Error
        ? error.message
        : "Unknown database error",
      database: "postgres",
      provider: "neon",
      timestamp: new Date().toISOString(),
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}
