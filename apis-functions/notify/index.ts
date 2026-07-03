
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 3, true);

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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
    batch_delay_ms?: number;
    max_retries?: number;
    retry_delay_ms?: number;
  };
}

interface RecipientResult {
  email: string;
  status: "sent" | "failed";
  log_id?: string;
  pdf_log_id?: string;
  error?: string;
}

const DEFAULT_NOTIFY_OPTIONS = {
  concurrency: 1,
  stop_on_error: false,
  batch_delay_ms: 5000,
  max_retries: 5,
  retry_delay_ms: 5000,
};

function mergeData(
  shared: Record<string, unknown>,
  recipient: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...shared, ...(recipient ?? {}) };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error?: string) {
  return !!error && /rate limit|429/i.test(error);
}

async function dispatchWithRetry(
  dispatchFn: () => Promise<RecipientResult>,
  maxRetries: number,
  retryDelayMs: number,
): Promise<RecipientResult> {
  let attempt = 0;
  let result = await dispatchFn();

  while (
    attempt < maxRetries &&
    result.status === "failed" &&
    isRateLimitError(result.error)
  ) {
    attempt += 1;
    const backoffMs = retryDelayMs * Math.pow(2, attempt - 1);
    await sleep(backoffMs + Math.floor(Math.random() * 500));
    result = await dispatchFn();
  }

  return result;
}

async function dispatchEmail(
  functionsBaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  templateName: string,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const data = mergeData(sharedData, recipient.data);

    const res = await fetch(`${functionsBaseUrl}/send-email`, {
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
      return {
        email: recipient.email,
        status: "failed",
        error: body.error ?? body.message ?? "Unknown error",
      };
    }

    return { email: recipient.email, status: "sent", log_id: body.log_id };
  } catch (err) {
    return { email: recipient.email, status: "failed", error: String(err) };
  }
}

async function dispatchEmailWithPdf(
  functionsBaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  templateName: string,
  pdfTemplateName: string,
  pdfFilename: string | undefined,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const mergedData = mergeData(sharedData, recipient.data);

    const res = await fetch(`${functionsBaseUrl}/send-email-with-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        recipient_email: recipient.email,
        email: {
          template_name: templateName,
          data: mergedData,
        },
        attachment: {
          pdf_template_name: pdfTemplateName,
          filename: pdfFilename,
          data: mergedData,
        },
      }),
    });

    const body = await res.json();

    if (!res.ok || !body.success) {
      return {
        email: recipient.email,
        status: "failed",
        error: body.error ?? body.message ?? "Unknown error",
      };
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
  functionsBaseUrl: string,
  apiKey: string,
  recipient: Recipient,
  pdfTemplateName: string,
  pdfFilename: string | undefined,
  sharedData: Record<string, unknown>,
): Promise<RecipientResult> {
  try {
    const data = mergeData(sharedData, recipient.data);

    const res = await fetch(`${functionsBaseUrl}/generate-pdf`, {
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
      return {
        email: recipient.email,
        status: "failed",
        error: body.error ?? body.message ?? "Unknown error",
      };
    }

    return {
      email: recipient.email,
      status: "sent",
      log_id: body.log_id ?? body.pdf_log_id,
    };
  } catch (err) {
    return { email: recipient.email, status: "failed", error: String(err) };
  }
}

async function getApplicationByApiKey(apiKey: string) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject<{ id: string; name: string }>(
      `
      SELECT id, name
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function getJobById(jobId: string, applicationId: string) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject(
      `
      SELECT
        id,
        type,
        status,
        total,
        processed,
        sent,
        failed,
        results,
        created_at,
        updated_at
      FROM campaign_jobs
      WHERE id = $1
        AND application_id = $2
      LIMIT 1
      `,
      [jobId, applicationId],
    );

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function createCampaignJob(
  applicationId: string,
  payload: NotifyRequest,
  options: typeof DEFAULT_NOTIFY_OPTIONS,
) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject<{ id: string }>(
      `
      INSERT INTO campaign_jobs (
        application_id,
        type,
        template_name,
        pdf_template_name,
        pdf_filename_pattern,
        shared_data,
        recipients,
        total,
        options,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8,
        $9::jsonb,
        'pending'
      )
      RETURNING id
      `,
      [
        applicationId,
        payload.type,
        payload.template_name ?? null,
        payload.attachment?.pdf_template_name ?? null,
        payload.attachment?.filename ?? null,
        JSON.stringify(payload.shared_data ?? {}),
        JSON.stringify(payload.recipients),
        payload.recipients.length,
        JSON.stringify(options),
      ],
    );

    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

async function updateCampaignJob(
  jobId: string,
  data: {
    status?: string;
    processed?: number;
    sent?: number;
    failed?: number;
    results?: RecipientResult[];
  },
) {
  const client = await pool.connect();

  try {
    await client.queryObject(
      `
      UPDATE campaign_jobs
      SET
        status = COALESCE($2, status),
        processed = COALESCE($3, processed),
        sent = COALESCE($4, sent),
        failed = COALESCE($5, failed),
        results = COALESCE($6::jsonb, results),
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        jobId,
        data.status ?? null,
        data.processed ?? null,
        data.sent ?? null,
        data.failed ?? null,
        data.results ? JSON.stringify(data.results) : null,
      ],
    );
  } finally {
    client.release();
  }
}

async function processJob(
  jobId: string,
  payload: NotifyRequest,
  apiKey: string,
  functionsBaseUrl: string,
) {
  const sharedData = payload.shared_data ?? {};
  const options = { ...DEFAULT_NOTIFY_OPTIONS, ...(payload.options ?? {}) };
  const concurrency = Math.min(options.concurrency, 20);
  const stopOnError = options.stop_on_error;
  const batchDelayMs = options.batch_delay_ms;
  const maxRetries = options.max_retries;
  const retryDelayMs = options.retry_delay_ms;

  await updateCampaignJob(jobId, { status: "processing" });

  const allResults: RecipientResult[] = [];
  let sent = 0;
  let failed = 0;
  let earlyStop = false;

  for (
    let i = 0;
    i < payload.recipients.length && !earlyStop;
    i += concurrency
  ) {
    const batch = payload.recipients.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((recipient) => {
        if (payload.type === "email") {
          return dispatchWithRetry(
            () =>
              dispatchEmail(
                functionsBaseUrl,
                apiKey,
                recipient,
                payload.template_name!,
                sharedData,
              ),
            maxRetries,
            retryDelayMs,
          );
        }

        if (payload.type === "email_pdf") {
          return dispatchWithRetry(
            () =>
              dispatchEmailWithPdf(
                functionsBaseUrl,
                apiKey,
                recipient,
                payload.template_name!,
                payload.attachment!.pdf_template_name,
                payload.attachment?.filename,
                sharedData,
              ),
            maxRetries,
            retryDelayMs,
          );
        }

        return dispatchWithRetry(
          () =>
            dispatchPdf(
              functionsBaseUrl,
              apiKey,
              recipient,
              payload.attachment!.pdf_template_name,
              payload.attachment?.filename,
              sharedData,
            ),
          maxRetries,
          retryDelayMs,
        );
      }),
    );

    for (const r of batchResults) {
      allResults.push(r);

      if (r.status === "sent") {
        sent++;
      } else {
        failed++;
      }
    }

    if (stopOnError && failed > 0) {
      earlyStop = true;
    }

    await updateCampaignJob(jobId, {
      processed: allResults.length,
      sent,
      failed,
      results: allResults,
    });

    if (i + concurrency < payload.recipients.length) {
      await sleep(batchDelayMs);
    }
  }

  await updateCampaignJob(jobId, {
    status: "done",
    processed: allResults.length,
    sent,
    failed,
    results: allResults,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL");

    if (!databaseUrl) {
      return json({ error: "Missing DATABASE_URL" }, 500);
    }

    if (!functionsBaseUrl) {
      return json({ error: "Missing FUNCTIONS_BASE_URL" }, 500);
    }

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const maybeJobId = pathParts[pathParts.length - 1];
    const isStatusCheck =
      req.method === "GET" && maybeJobId && maybeJobId !== "notify";

    const apiKey = req.headers.get("x-api-key");

    if (!apiKey) {
      return json({ error: "Missing x-api-key header" }, 401);
    }

    const application = await getApplicationByApiKey(apiKey);

    if (!application) {
      return json({ error: "Invalid API key" }, 401);
    }

    if (isStatusCheck) {
      const job = await getJobById(maybeJobId, application.id);

      if (!job) {
        return json({ error: "Job not found" }, 404);
      }

      return json(job);
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const payload: NotifyRequest = await req.json();

    if (!payload.type || !["email", "email_pdf", "pdf"].includes(payload.type)) {
      return json({ error: "type must be 'email', 'email_pdf', or 'pdf'" }, 400);
    }

    if (!Array.isArray(payload.recipients) || payload.recipients.length === 0) {
      return json({ error: "recipients must be a non-empty array" }, 400);
    }

    if (
      (payload.type === "email" || payload.type === "email_pdf") &&
      !payload.template_name
    ) {
      return json({
        error: "template_name is required for type 'email' and 'email_pdf'",
      }, 400);
    }

    if (
      (payload.type === "email_pdf" || payload.type === "pdf") &&
      !payload.attachment?.pdf_template_name
    ) {
      return json({
        error:
          "attachment.pdf_template_name is required for type 'email_pdf' and 'pdf'",
      }, 400);
    }

    const invalidRecipient = payload.recipients.find(
      (r) => !r.email || typeof r.email !== "string",
    );

    if (invalidRecipient) {
      return json({ error: "Every recipient must have a valid email field" }, 400);
    }

    const options = { ...DEFAULT_NOTIFY_OPTIONS, ...(payload.options ?? {}) };
    const job = await createCampaignJob(application.id, payload, options);

    if (!job) {
      return json({ error: "Failed to create job" }, 500);
    }

    EdgeRuntime.waitUntil(
      processJob(job.id, payload, apiKey, functionsBaseUrl),
    );

    return json({
      job_id: job.id,
      status: "pending",
      total: payload.recipients.length,
      message: `Campaign job created. Use GET /notify/${job.id} to check progress.`,
    }, 202);
  } catch (err) {
    return json({
      error: "Internal server error",
      detail: String(err),
    }, 500);
  }
});

