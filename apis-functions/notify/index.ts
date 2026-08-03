
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key",
};

// Subido de 3 a 6: cada job en curso abre varias conexiones cortas
// (createCampaignJob + updateCampaignJob por lote + update final), y con
// varios jobs en simultaneo (una corrida de N items) el pool chico se
// agotaba - eso quedaba como jobs trabados en "processing" sin ningun error
// visible porque la escritura final del status nunca alcanzaba a correr.
const pool = new Pool({ connectionString: Deno.env.get("DATABASE_URL") || "", connectionTimeoutMillis: 5000 }, 6, true);

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
  program_id?: string;
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
  programId: string | undefined,
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
        program_id: programId,
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
  programId: string | undefined,
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
        program_id: programId,
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
  programId: string | undefined,
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
        program_id: programId,
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

async function getFullJobById(jobId: string, applicationId: string) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject(
      `
      SELECT
        id,
        type,
        program_id,
        template_name,
        pdf_template_name,
        pdf_filename_pattern,
        shared_data,
        recipients,
        options,
        results,
        status
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

async function getJobById(jobId: string, applicationId: string) {
  const client = await pool.connect();

  try {
    const result = await client.queryObject(
      `
      SELECT
        id,
        type,
        program_id,
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
        program_id,
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
        $6,
        $7::jsonb,
        $8::jsonb,
        $9,
        $10::jsonb,
        'pending'
      )
      RETURNING id
      `,
      [
        applicationId,
        payload.type,
        payload.program_id ?? null,
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
  attempt = 1,
): Promise<void> {
  const maxAttempts = 3;

  try {
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
  } catch (err) {
    if (attempt >= maxAttempts) {
      console.error(
        `updateCampaignJob failed after ${maxAttempts} attempts for job ${jobId} (status=${data.status ?? "unchanged"}):`,
        err,
      );
      throw err;
    }

    console.error(
      `updateCampaignJob attempt ${attempt} failed for job ${jobId}, retrying:`,
      err,
    );
    await sleep(300 * attempt);
    return updateCampaignJob(jobId, data, attempt + 1);
  }
}

function dispatchRecipientWithRetry(
  payload: NotifyRequest,
  recipient: Recipient,
  sharedData: Record<string, unknown>,
  apiKey: string,
  functionsBaseUrl: string,
  maxRetries: number,
  retryDelayMs: number,
): Promise<RecipientResult> {
  if (payload.type === "email") {
    return dispatchWithRetry(
      () =>
        dispatchEmail(
          functionsBaseUrl,
          apiKey,
          recipient,
          payload.template_name!,
          sharedData,
          payload.program_id,
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
          payload.program_id,
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
        payload.program_id,
      ),
    maxRetries,
    retryDelayMs,
  );
}

// Reemplaza en baseResults la entrada de cada email reintentado por su nuevo
// resultado (conserva el resto tal cual), en vez de pisar todo el array -
// asi el job original acumula el conteo real de ok/fail en vez de perder
// los resultados de los destinatarios que no se reintentaron.
function mergeRetryResults(
  baseResults: RecipientResult[],
  retryResults: RecipientResult[],
): RecipientResult[] {
  const retryByEmail = new Map(
    retryResults.map((r) => [r.email.toLowerCase(), r]),
  );
  const knownEmails = new Set(baseResults.map((r) => r.email.toLowerCase()));

  const merged = baseResults.map((r) => {
    const updated = retryByEmail.get(r.email.toLowerCase());
    return updated ?? r;
  });

  for (const r of retryResults) {
    if (!knownEmails.has(r.email.toLowerCase())) {
      merged.push(r);
    }
  }

  return merged;
}

async function processRetryJob(
  jobId: string,
  baseResults: RecipientResult[],
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

  let mergedResults = baseResults;
  let earlyStop = false;

  for (
    let i = 0;
    i < payload.recipients.length && !earlyStop;
    i += concurrency
  ) {
    const batch = payload.recipients.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map((recipient) =>
        dispatchRecipientWithRetry(
          payload,
          recipient,
          sharedData,
          apiKey,
          functionsBaseUrl,
          maxRetries,
          retryDelayMs,
        )
      ),
    );

    mergedResults = mergeRetryResults(mergedResults, batchResults);

    if (stopOnError && batchResults.some((r) => r.status === "failed")) {
      earlyStop = true;
    }

    await updateCampaignJob(jobId, {
      processed: mergedResults.length,
      sent: mergedResults.filter((r) => r.status === "sent").length,
      failed: mergedResults.filter((r) => r.status === "failed").length,
      results: mergedResults,
    });

    if (i + concurrency < payload.recipients.length) {
      await sleep(batchDelayMs);
    }
  }

  const finalSent = mergedResults.filter((r) => r.status === "sent").length;
  const finalFailed = mergedResults.filter((r) => r.status === "failed").length;

  await updateCampaignJob(jobId, {
    status: finalSent === 0 && finalFailed > 0 ? "failed" : "done",
    processed: mergedResults.length,
    sent: finalSent,
    failed: finalFailed,
    results: mergedResults,
  });
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
      batch.map((recipient) =>
        dispatchRecipientWithRetry(
          payload,
          recipient,
          sharedData,
          apiKey,
          functionsBaseUrl,
          maxRetries,
          retryDelayMs,
        )
      ),
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
    status: sent === 0 && failed > 0 ? "failed" : "done",
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

    const rawBody = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (rawBody?.retry_job_id) {
      const originalJobId = String(rawBody.retry_job_id);
      const originalJob = await getFullJobById(originalJobId, application.id);

      if (!originalJob) {
        return json({ error: "Job not found" }, 404);
      }

      const originalResults = Array.isArray(originalJob.results)
        ? originalJob.results as RecipientResult[]
        : [];
      const failedEmails = new Set(
        originalResults
          .filter((r) => r.status === "failed")
          .map((r) => r.email.toLowerCase()),
      );
      const originalRecipients = Array.isArray(originalJob.recipients)
        ? originalJob.recipients as Recipient[]
        : [];
      // Solo se reintentan los destinatarios que fallaron (si hay results
      // guardados para distinguirlos); si el job es viejo y no tiene results,
      // se reintenta la lista completa como fallback.
      const recipientsToRetry = failedEmails.size > 0
        ? originalRecipients.filter((r) => failedEmails.has(r.email.toLowerCase()))
        : originalRecipients;

      if (recipientsToRetry.length === 0) {
        return json({ error: "No hay destinatarios fallidos para reintentar en este job" }, 400);
      }

      const retryPayload: NotifyRequest = {
        type: originalJob.type,
        program_id: originalJob.program_id ?? undefined,
        template_name: originalJob.template_name ?? undefined,
        attachment: originalJob.pdf_template_name
          ? {
            pdf_template_name: originalJob.pdf_template_name,
            filename: originalJob.pdf_filename_pattern ?? undefined,
          }
          : undefined,
        recipients: recipientsToRetry,
        shared_data: (originalJob.shared_data as Record<string, unknown>) ?? {},
        options: (originalJob.options as NotifyRequest["options"]) ?? {},
      };

      // El reintento actualiza el MISMO job (no crea uno nuevo): se re-envia
      // solo a los destinatarios fallidos y sus resultados se mezclan con los
      // del job original, acumulando el conteo real de ok/fail en ese registro.
      if (retryPayload.recipients.length <= 1) {
        await processRetryJob(originalJobId, originalResults, retryPayload, apiKey, functionsBaseUrl).catch((err) => {
          console.error(`processRetryJob failed for job ${originalJobId}:`, err);
        });

        const finishedJob = await getJobById(originalJobId, application.id);

        return json({
          job_id: originalJobId,
          status: finishedJob?.status ?? "done",
          total: finishedJob?.total ?? recipientsToRetry.length,
          sent: finishedJob?.sent ?? 0,
          failed: finishedJob?.failed ?? 0,
        });
      }

      const retryBackgroundProcessing = processRetryJob(originalJobId, originalResults, retryPayload, apiKey, functionsBaseUrl).catch((err) => {
        console.error(`processRetryJob failed for job ${originalJobId}:`, err);
      });

      const maybeEdgeRuntimeForRetry = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
      if (maybeEdgeRuntimeForRetry?.waitUntil) {
        maybeEdgeRuntimeForRetry.waitUntil(retryBackgroundProcessing);
      }

      return json({
        job_id: originalJobId,
        status: "processing",
        total: recipientsToRetry.length,
        message: `Retry started. Use GET /notify/${originalJobId} to check progress.`,
      }, 202);
    }

    const payload = rawBody as unknown as NotifyRequest;

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

    // Los llamados de a un destinatario (el drenado de cola de programas
    // manda uno por vez, ya esperando cada respuesta en su propio loop) se
    // procesan sincronicamente: no hay ninguna ganancia en mandarlos a
    // segundo plano, y el waitUntil quedaba expuesto a que el runtime corte
    // la tarea antes de terminar, dejando el job trabado en "processing"
    // para siempre aunque el envio ya haya salido.
    if (payload.recipients.length <= 1) {
      await processJob(job.id, payload, apiKey, functionsBaseUrl).catch((err) => {
        console.error(`processJob failed for job ${job.id}:`, err);
      });

      const finishedJob = await getJobById(job.id, application.id);

      return json({
        job_id: job.id,
        status: finishedJob?.status ?? "done",
        total: payload.recipients.length,
        sent: finishedJob?.sent ?? 0,
        failed: finishedJob?.failed ?? 0,
      });
    }

    const backgroundProcessing = processJob(job.id, payload, apiKey, functionsBaseUrl).catch((err) => {
      console.error(`processJob failed for job ${job.id}:`, err);
    });

    const maybeEdgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (maybeEdgeRuntime?.waitUntil) {
      maybeEdgeRuntime.waitUntil(backgroundProcessing);
    }

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

