import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Extract user_id from the app's JWT (external auth system)
const getUserIdFromToken = (authHeader: string | null): string | null => {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7);
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Try common fields for user ID
    return payload.sub || payload.user?.id || payload.id || payload.user_id || null;
  } catch {
    return null;
  }
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const userId = getUserIdFromToken(req.headers.get("Authorization"));
    if (!userId) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const url = new URL(req.url);
    // path: /embed-credentials  or  /embed-credentials/:id
    const parts = url.pathname.replace(/^\/embed-credentials\/?/, "").split("/").filter(Boolean);
    const credId = parts[0] ?? null;

    // GET — list all credentials for this user
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("embed_credentials")
        .select("id, username, label, is_active, last_used_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    // POST — create new credential
    if (req.method === "POST") {
      const body = await req.json();
      const { username, password_hash, label } = body;
      if (!username || !password_hash) {
        return json({ error: "username and password_hash are required" }, 400);
      }
      const { data, error } = await supabase
        .from("embed_credentials")
        .insert({ user_id: userId, username: username.trim(), password_hash, label: label || username.trim() })
        .select("id, username, label, is_active, created_at")
        .single();
      if (error) {
        if (error.code === "23505") return json({ error: "username_taken" }, 409);
        throw error;
      }
      return json(data, 201);
    }

    // PATCH /:id — toggle active
    if (req.method === "PATCH" && credId) {
      const body = await req.json();
      const { data, error } = await supabase
        .from("embed_credentials")
        .update({ is_active: body.is_active })
        .eq("id", credId)
        .eq("user_id", userId)
        .select("id, is_active")
        .single();
      if (error) throw error;
      return json(data);
    }

    // DELETE /:id
    if (req.method === "DELETE" && credId) {
      const { error } = await supabase
        .from("embed_credentials")
        .delete()
        .eq("id", credId)
        .eq("user_id", userId);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
