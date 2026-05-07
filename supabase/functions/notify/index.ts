import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Recipient {
  email: string;
  data?: Record<string, unknown>;
}

interface NotifyRequest {
  type: "email" | "email_pdf" | "pdf";
  template_name?: string;
  attachment?: {
    pdf_template_name: string;
    filename?: string;
    data?: Record<string, unknown>;
  };
  recipients: Recipient[];
  shared_data?: Record<string, unknown>;
  options?: {
    concurrency?: number;
    stop_on_error?: boolean;
  };
}

interface RecipientResult {
  email: string;
  status: "sent" | "failed";
  log_id?: string;
  pdf_log_id?: string;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mergeData(
  shared: Record<string, unknown>,
  recipient: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...shared, ...(recipient ?? {}) };
}

async function processBatch(
  items: Recipient[],
  handler: (r: Recipient) => Promise<RecipientResult>,
  concurrency: number,
): Promise<RecipientResult[]> {
  const results: RecipientResult[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(handler));
    results.push(...batchResults);
  }
  return results;
}

// ─── Dispatcher — calls existing edge functions via internal fetch ─────────────

async function dispatchEmail(
  supabaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  templateName: string,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const data = mergeData(sharedData, recipient.data);
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        recipient_email: recipient.email,
        template_name: templateName,
        data,
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { email: recipient.email, status: "failed", error: body.error ?? body.message ?? "Unknown error" };
    }
    return { email: recipient.email, status: "sent", log_id: body.log_id };
  } catch (err) {
    return { email: recipient.email, status: "failed", error: String(err) };
  }
}

async function dispatchEmailWithPdf(
  supabaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  templateName: string,
  pdfTemplateName: string,
  pdfFilename: string | undefined,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const mergedData = mergeData(sharedData, recipient.data);
    const res = await fetch(`${supabaseUrl}/functions/v1/send-email-with-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        recipient_email: recipient.email,
        email: { template_name: templateName, data: mergedData },
        attachment: {
          pdf_template_name: pdfTemplateName,
          filename: pdfFilename,
          data: mergedData,
        },
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { email: recipient.email, status: "failed", error: body.error ?? body.message ?? "Unknown error" };
    }
    return {
      email: recipient.email,
      status: "sent",
      log_id: body.log_id,
      pdf_log_id: body.pdf_log_id,
    };
  } catch (err) {
    return { email: recipient.email, status: "failed", error: String(err) };
  }
}

async function dispatchPdf(
  supabaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  pdfTemplateName: string,
  pdfFilename: string | undefined,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const data = mergeData(sharedData, recipient.data);
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        pdf_template_name: pdfTemplateName,
        filename: pdfFilename,
        data,
        recipient_email: recipient.email,
      }),
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      return { email: recipient.email, status: "failed", error: body.error ?? body.message ?? "Unknown error" };
    }
    return { email: recipient.email, status: "sent", log_id: body.log_id ?? body.pdf_log_id };
  } catch (err) {
    return { email: recipient.email, status: "failed", error: String(err) };
  }
}

// ─── Background processor ─────────────────────────────────────────────────────

async function processJob(
  jobId: string,
  payload: NotifyRequest,
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
) {
  const sharedData = payload.shared_data ?? {};
  const concurrency = Math.min(payload.options?.concurrency ?? 5, 20);
  const stopOnError = payload.options?.stop_on_error ?? false;

  await supabase
    .from("campaign_jobs")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", jobId);

  const allResults: RecipientResult[] = [];
  let sent = 0;
  let failed = 0;
  let earlyStop = false;

  for (let i = 0; i < payload.recipients.length && !earlyStop; i += concurrency) {
    const batch = payload.recipients.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((recipient) => {
        if (payload.type === "email") {
          return dispatchEmail(supabaseUrl, apiKey, recipient, payload.template_name!, sharedData);
        } else if (payload.type === "email_pdf") {
          return dispatchEmailWithPdf(
            supabaseUrl,
            apiKey,
            recipient,
            payload.template_name!,
            payload.attachment!.pdf_template_name,
            payload.attachment?.filename,
            sharedData,
          );
        } else {
          return dispatchPdf(
            supabaseUrl,
            apiKey,
            recipient,
            payload.attachment!.pdf_template_name,
            payload.attachment?.filename,
            sharedData,
          );
        }
      }),
    );

    for (const r of batchResults) {
      allResults.push(r);
      if (r.status === "sent") sent++;
      else failed++;
    }

    if (stopOnError && failed > 0) {
      earlyStop = true;
    }

    // Persist incremental progress
    await supabase
      .from("campaign_jobs")
      .update({
        processed: allResults.length,
        sent,
        failed,
        results: allResults,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }

  await supabase
    .from("campaign_jobs")
    .update({
      status: "done",
      processed: allResults.length,
      sent,
      failed,
      results: allResults,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── GET /notify/:jobId — status check ──────────────────────────────────
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const maybeJobId = pathParts[pathParts.length - 1];
    const isStatusCheck = req.method === "GET" && maybeJobId && maybeJobId !== "notify";

    if (isStatusCheck) {
      const apiKey = req.headers.get("x-api-key");
      if (!apiKey) return json({ error: "Missing x-api-key header" }, 401);

      const { data: application } = await supabase
        .from("applications")
        .select("id")
        .eq("api_key", apiKey)
        .maybeSingle();

      if (!application) return json({ error: "Invalid API key" }, 401);

      const { data: job, error: jobErr } = await supabase
        .from("campaign_jobs")
        .select("id, type, status, total, processed, sent, failed, results, created_at, updated_at")
        .eq("id", maybeJobId)
        .eq("application_id", application.id)
        .maybeSingle();

      if (jobErr || !job) return json({ error: "Job not found" }, 404);
      return json(job);
    }

    // ── POST /notify — create campaign job ─────────────────────────────────
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) return json({ error: "Missing x-api-key header" }, 401);

    const { data: application } = await supabase
      .from("applications")
      .select("id, name")
      .eq("api_key", apiKey)
      .maybeSingle();

    if (!application) return json({ error: "Invalid API key" }, 401);

    const payload: NotifyRequest = await req.json();

    // ── Validate ────────────────────────────────────────────────────────────
    if (!payload.type || !["email", "email_pdf", "pdf"].includes(payload.type)) {
      return json({ error: "type must be 'email', 'email_pdf', or 'pdf'" }, 400);
    }
    if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
      return json({ error: "recipients must be a non-empty array" }, 400);
    }
    if ((payload.type === "email" || payload.type === "email_pdf") && !payload.template_name) {
      return json({ error: "template_name is required for type 'email' and 'email_pdf'" }, 400);
    }
    if ((payload.type === "email_pdf" || payload.type === "pdf") && !payload.attachment?.pdf_template_name) {
      return json({ error: "attachment.pdf_template_name is required for type 'email_pdf' and 'pdf'" }, 400);
    }
    const invalidRecipient = payload.recipients.find((r) => !r.email || typeof r.email !== "string");
    if (invalidRecipient) {
      return json({ error: "Every recipient must have a valid email field" }, 400);
    }

    // ── Create job record ───────────────────────────────────────────────────
    const { data: job, error: insertErr } = await supabase
      .from("campaign_jobs")
      .insert({
        application_id: application.id,
        type: payload.type,
        template_name: payload.template_name ?? null,
        pdf_template_name: payload.attachment?.pdf_template_name ?? null,
        pdf_filename_pattern: payload.attachment?.filename ?? null,
        shared_data: payload.shared_data ?? {},
        recipients: payload.recipients,
        total: payload.recipients.length,
        options: payload.options ?? {},
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !job) {
      return json({ error: "Failed to create job", detail: insertErr?.message }, 500);
    }

    // ── Fire-and-forget background processing ───────────────────────────────
    EdgeRuntime.waitUntil(
      processJob(job.id, payload, apiKey, supabase, supabaseUrl),
    );

    return json({
      job_id: job.id,
      status: "pending",
      total: payload.recipients.length,
      message: `Campaign job created. Use GET /notify/${job.id} to check progress.`,
    }, 202);
  } catch (err) {
    return json({ error: "Internal server error", detail: String(err) }, 500);
  }
});
