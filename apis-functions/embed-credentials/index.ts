
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-user-id",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const serializeError = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
};

function parseTokens(raw: string | undefined): string[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
  }

  return raw.split(",").map((item) => item.trim()).filter(Boolean);
}

function validateApiKey(req: Request): Response | null {
  const headerName = "x-api-key";
  const apiKey = req.headers.get(headerName);

  const allowed = [
    Deno.env.get("FPM_API_KEY"),
    Deno.env.get("API_KEY"),
    ...parseTokens(Deno.env.get("FPM_AUTH_TOKENS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS")),
    ...parseTokens(Deno.env.get("FPM_API_KEYS_CSV")),
  ].filter((value): value is string => !!value);

  if (apiKey && allowed.includes(apiKey)) {
    return null;
  }

  return json({ error: "Unauthorized" }, 401);
}

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const authError = validateApiKey(req);

  if (authError) {
    return authError;
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({ error: "Missing DATABASE_URL" }, 500);
    }

    const userId = req.headers.get("x-user-id");

    if (!userId) {
      return json({ error: "Missing x-user-id header" }, 400);
    }

    client = await pool.connect();

    const url = new URL(req.url);

    const pathSegments = url.pathname
      .split("/")
      .filter(Boolean);

    const credId =
      pathSegments.length > 0 &&
        pathSegments[0] !== "embed-credentials"
        ? pathSegments[0]
        : pathSegments[1] ?? null;

    if (req.method === "GET") {
      const result = await client.queryObject(
        `
        SELECT
          id,
          username,
          label,
          is_active,
          last_used_at,
          created_at
        FROM embed_credentials
        WHERE user_id = $1
        ORDER BY created_at DESC
        `,
        [userId],
      );

      return json(result.rows ?? []);
    }

    if (req.method === "POST") {
      const body = await req.json();

      const { username, password_hash, label } = body;

      if (!username || !password_hash) {
        return json({
          error: "username and password_hash are required",
        }, 400);
      }

      try {
        const result = await client.queryObject(
          `
          INSERT INTO embed_credentials (
            user_id,
            username,
            password_hash,
            label
          )
          VALUES ($1, $2, $3, $4)
          RETURNING
            id,
            username,
            label,
            is_active,
            created_at
          `,
          [
            userId,
            username.trim(),
            password_hash,
            (label || username).trim(),
          ],
        );

        return json(result.rows[0], 201);
      } catch (err: any) {
        if (err.code === "23505") {
          return json({ error: "username_taken" }, 409);
        }

        throw err;
      }
    }

    if (req.method === "PATCH" && credId) {
      const body = await req.json();

      const result = await client.queryObject(
        `
        UPDATE embed_credentials
        SET is_active = $1
        WHERE id = $2
          AND user_id = $3
        RETURNING
          id,
          is_active
        `,
        [
          body.is_active,
          credId,
          userId,
        ],
      );

      if (!result.rows.length) {
        return json({ error: "Credential not found" }, 404);
      }

      return json(result.rows[0]);
    }

    if (req.method === "DELETE" && credId) {
      const result = await client.queryObject(
        `
        DELETE FROM embed_credentials
        WHERE id = $1
          AND user_id = $2
        RETURNING id
        `,
        [
          credId,
          userId,
        ],
      );

      if (!result.rows.length) {
        return json({ error: "Credential not found" }, 404);
      }

      return json({ deleted: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({
      error: "Internal server error",
      detail: serializeError(err),
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}

