
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, svix-id, svix-timestamp, svix-signature",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

interface ResendWebhookEvent {
  type:
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.bounced"
  | "email.complained";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounced_at?: string;
    bounce?: {
      bounce_type: "hard" | "soft" | "spam";
      diagnostic_code?: string;
    };
  };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function verifyWebhookSignature(
  payload: string,
  headers: Headers,
): Promise<boolean> {
  const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");

  if (!webhookSecret) {
    return true;
  }

  const svixId = headers.get("svix-id");
  const svixTimestamp = headers.get("svix-timestamp");
  const svixSignature = headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return false;
  }

  try {
    const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

    const secret = webhookSecret.startsWith("whsec_")
      ? webhookSecret.slice(6)
      : webhookSecret;

    const encoder = new TextEncoder();

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      encoder.encode(signedContent),
    );

    const base64Signature = btoa(
      String.fromCharCode(...new Uint8Array(signature)),
    );

    const signatures = svixSignature.split(" ");

    for (const versionedSignature of signatures) {
      const [version, signatureToCompare] = versionedSignature.split(",");

      if (version === "v1" && signatureToCompare === base64Signature) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let client;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({ error: "Missing DATABASE_URL" }, 500);
    }

    const payload = await req.text();

    const isValid = await verifyWebhookSignature(payload, req.headers);

    if (!isValid) {
      return json({ error: "Invalid signature" }, 401);
    }

    const event: ResendWebhookEvent = JSON.parse(payload);

    const recipientEmail = event.data.to?.[0] || null;

    client = await pool.connect();

    const emailLogResult = await client.queryObject<{
      id: string;
      status: string | null;
      application_id: string;
    }>(
      `
      SELECT
        id,
        status,
        application_id
      FROM email_logs
      WHERE resend_email_id = $1
      LIMIT 1
      `,
      [event.data.email_id],
    );

    const emailLog = emailLogResult.rows[0];

    if (!emailLog) {
      return json({
        message: "Email log not found, possibly not tracked",
      });
    }

    const deliveryStatus = event.type.replace("email.", "");

    const updateData: Record<string, unknown> = {
      delivery_status: deliveryStatus,
    };

    switch (event.type) {
      case "email.sent":
        updateData.status = "sent";
        break;

      case "email.delivered":
        updateData.status = "sent";
        updateData.delivered_at = event.created_at;
        break;

      case "email.delivery_delayed":
        break;

      case "email.bounced": {
        updateData.status = "failed";
        updateData.bounced_at = event.data.bounced_at || event.created_at;
        updateData.bounce_type = event.data.bounce?.bounce_type || "hard";
        updateData.bounce_reason =
          event.data.bounce?.diagnostic_code || "Email bounced";
        updateData.error_message =
          `Bounced (${updateData.bounce_type}): ${updateData.bounce_reason}`;

        if (recipientEmail) {
          const pendingResult = await client.queryObject<{
            id: string;
            bounce_count: number | null;
            status: string;
          }>(
            `
            SELECT
              id,
              bounce_count,
              status
            FROM pending_communications
            WHERE recipient_email = $1
              AND application_id = $2
            ORDER BY created_at DESC
            LIMIT 1
            `,
            [recipientEmail, emailLog.application_id],
          );

          const pendingComm = pendingResult.rows[0];

          if (pendingComm && pendingComm.status !== "cancelled") {
            const newBounceCount = (pendingComm.bounce_count || 0) + 1;
            const shouldCancel =
              newBounceCount >= 3 || updateData.bounce_type === "hard";

            await client.queryObject(
              `
              UPDATE pending_communications
              SET
                bounce_count = $1,
                last_bounce_reason = $2,
                status = $3,
                error_message = $4,
                updated_at = NOW()
              WHERE id = $5
              `,
              [
                newBounceCount,
                updateData.bounce_reason,
                shouldCancel ? "failed" : pendingComm.status,
                shouldCancel
                  ? `Email permanently failed after ${newBounceCount} bounces: ${updateData.bounce_reason}`
                  : `Email bounced (attempt ${newBounceCount}): ${updateData.bounce_reason}`,
                pendingComm.id,
              ],
            );
          }
        }

        break;
      }

      case "email.complained":
        updateData.status = "failed";
        updateData.complained_at = event.created_at;
        updateData.error_message = "Email marked as spam by recipient";
        break;
    }

    await client.queryObject(
      `
      UPDATE email_logs
      SET
        delivery_status = $1,
        status = COALESCE($2, status),
        delivered_at = COALESCE($3, delivered_at),
        bounced_at = COALESCE($4, bounced_at),
        bounce_type = COALESCE($5, bounce_type),
        bounce_reason = COALESCE($6, bounce_reason),
        complained_at = COALESCE($7, complained_at),
        error_message = COALESCE($8, error_message)
      WHERE id = $9
      `,
      [
        updateData.delivery_status ?? null,
        updateData.status ?? null,
        updateData.delivered_at ?? null,
        updateData.bounced_at ?? null,
        updateData.bounce_type ?? null,
        updateData.bounce_reason ?? null,
        updateData.complained_at ?? null,
        updateData.error_message ?? null,
        emailLog.id,
      ],
    );

    return json({
      success: true,
      message: `Webhook processed: ${event.type}`,
      email_log_id: emailLog.id,
    });
  } catch (error) {
    return json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  } finally {
    if (client) {
      client.release();
    }
  }
});

