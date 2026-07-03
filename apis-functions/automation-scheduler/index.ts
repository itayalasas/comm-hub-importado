
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { getNextCronRunAt } from "./_shared/cron-utils.ts";
import { buildAutomationNotifyPayload } from "./_shared/automation-notify-payload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, X-Api-Key, x-scheduler-token, Accept",
};

const databaseUrl = Deno.env.get("DATABASE_URL") || "";
const pool = new Pool(databaseUrl, 3, true);

type ProgramKind = "scheduled" | "batch";
type ProgramStatus = "draft" | "scheduled" | "active" | "paused" | "done" | "failed" | "cancelled";
type Channel = "email" | "email_pdf" | "pdf";
type DeliveryMode = "static" | "queued";

interface Recipient {
  email: string;
  data?: Record<string, unknown>;
}

interface AutomationProgramRecord {
  id: string;
  application_id: string;
  name: string;
  kind: ProgramKind;
  status: ProgramStatus;
  delivery_mode: DeliveryMode;
  channel: Channel;
  template_name: string | null;
  pdf_template_name: string | null;
  pdf_filename_pattern: string | null;
  recipients: Recipient[];
  shared_data: Record<string, unknown>;
  options: Record<string, unknown>;
  schedule_at: string | null;
  cron_expression: string | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  last_job_id: string | null;
  run_count: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface AutomationProgramQueueItemRecord {
  id: string;
  application_id: string;
  program_id: string;
  external_reference_id: string | null;
  recipient_email: string;
  recipient_data: Record<string, unknown>;
  shared_data: Record<string, unknown>;
  options: Record<string, unknown>;
  status: "queued" | "processing" | "sent" | "failed" | "cancelled";
  available_at: string;
  last_attempt_at: string | null;
  sent_at: string | null;
  last_job_id: string | null;
  attempt_count: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface ApplicationRecord {
  id: string;
  name: string;
  api_key: string;
}

interface SchedulerResultItem {
  program_id: string;
  application_id: string;
  application_name: string;
  status: "sent" | "failed";
  job_id: string | null;
  queue_items?: number;
  queue_sent?: number;
  queue_failed?: number;
  message?: string;
}

interface SchedulerRequestBody {
  limit?: number;
  application_id?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getEffectiveRunAt(program: AutomationProgramRecord): string | null {
  return program.next_run_at || program.schedule_at || null;
}

function getNextRunAt(program: AutomationProgramRecord): string | null {
  if (!program.cron_expression) {
    return null;
  }

  const reference = getEffectiveRunAt(program) || program.last_run_at || program.updated_at || program.created_at;
  return getNextCronRunAt(program.cron_expression, program.timezone, new Date(reference));
}

function parseLimit(value: string | null): number {
  const parsed = Number(value || "0");
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(Math.floor(parsed), 100);
}

function getSchedulerToken(req: Request): string {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.get("x-scheduler-token") || req.headers.get("X-Scheduler-Token") || "";
}

function requireSchedulerToken(req: Request): Response | null {
  const configuredToken = trimText(
    Deno.env.get("AUTOMATION_SCHEDULER_TOKEN") ||
    Deno.env.get("SCHEDULER_TOKEN"),
  );

  if (!configuredToken) {
    return json(
      {
        success: false,
        error: {
          code: "MISSING_ENV",
          message: "AUTOMATION_SCHEDULER_TOKEN is not configured",
        },
      },
      500,
    );
  }

  const incomingToken = trimText(getSchedulerToken(req));
  if (!incomingToken || incomingToken !== configuredToken) {
    return json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid scheduler token",
        },
      },
      401,
    );
  }

  return null;
}

function buildNotifyBaseUrl(): string {
  const raw = (
    Deno.env.get("NOTIFY_FUNCTION_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
    ""
  ).trim().replace(/\/+$/, "");

  if (!raw) {
    throw new Error("NOTIFY_FUNCTION_URL or FUNCTIONS_BASE_URL is required");
  }

  return raw.endsWith("/notify") ? raw : `${raw}/notify`;
}

function buildNotifyPayload(program: AutomationProgramRecord) {
  return buildAutomationNotifyPayload(program);
}

function buildQueuedNotifyPayload(
  program: AutomationProgramRecord,
  queueItem: AutomationProgramQueueItemRecord,
) {
  return buildAutomationNotifyPayload(program, {
    recipient_email: queueItem.recipient_email,
    recipient_data: queueItem.recipient_data,
    shared_data: queueItem.shared_data,
    options: queueItem.options,
  });
}

function parseQueueLimit(options: Record<string, unknown>): number {
  const rawValue =
    options.queue_limit ??
    options.batch_size ??
    options.limit ??
    25;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25;
  }
  return Math.min(Math.floor(parsed), 100);
}

async function claimDueQueueItems(
  client: any,
  applicationId: string,
  programId: string,
  limit: number,
): Promise<AutomationProgramQueueItemRecord[]> {
  const result = await client.queryObject(
    `
    WITH due AS (
      SELECT id
      FROM automation_program_queue_items
      WHERE application_id = $1
        AND program_id = $2
        AND status = 'queued'
        AND available_at <= NOW()
      ORDER BY available_at ASC, created_at ASC
      LIMIT $3
      FOR UPDATE SKIP LOCKED
    )
    UPDATE automation_program_queue_items q
    SET status = 'processing',
        last_attempt_at = NOW(),
        attempt_count = COALESCE(attempt_count, 0) + 1,
        updated_at = NOW()
    FROM due
    WHERE q.id = due.id
    RETURNING
      q.id,
      q.application_id,
      q.program_id,
      q.external_reference_id,
      q.recipient_email,
      q.recipient_data,
      q.shared_data,
      q.options,
      q.status,
      q.available_at,
      q.last_attempt_at,
      q.sent_at,
      q.last_job_id,
      q.attempt_count,
      q.last_error,
      q.metadata,
      q.created_at,
      q.updated_at
    `,
    [applicationId, programId, limit],
  );

  return (result.rows as AutomationProgramQueueItemRecord[]) || [];
}

async function updateQueueItemStatus(
  client: any,
  applicationId: string,
  programId: string,
  queueItemId: string,
  status: "sent" | "failed",
  values: { jobId?: string | null; message?: string | null; timestamp: string },
) {
  if (status === "sent") {
    await client.queryObject(
      `
      UPDATE automation_program_queue_items
      SET status = 'sent',
          sent_at = $1,
          last_job_id = $2,
          last_error = NULL,
          updated_at = $3
      WHERE id = $4
        AND application_id = $5
        AND program_id = $6
      `,
      [values.timestamp, values.jobId ?? null, values.timestamp, queueItemId, applicationId, programId],
    );
    return;
  }

  await client.queryObject(
    `
    UPDATE automation_program_queue_items
    SET status = 'failed',
        last_error = $1,
        updated_at = $2
    WHERE id = $3
      AND application_id = $4
      AND program_id = $5
    `,
    [values.message ?? null, values.timestamp, queueItemId, applicationId, programId],
  );
}

async function fetchDuePrograms(
  client: any,
  limit: number,
  applicationId?: string | null,
): Promise<AutomationProgramRecord[]> {
  const conditions = [
    "status = 'scheduled'",
    "COALESCE(next_run_at, schedule_at) IS NOT NULL",
    "COALESCE(next_run_at, schedule_at) <= NOW()",
  ];
  const params: unknown[] = [];

  if (applicationId) {
    params.push(applicationId);
    conditions.push(`application_id = $${params.length}`);
  }

  params.push(limit);
  const limitIndex = params.length;

  const result = await client.queryObject<AutomationProgramRecord>(
    `
    WITH due AS (
      SELECT id
      FROM automation_programs
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(next_run_at, schedule_at) ASC, created_at ASC
      LIMIT $${limitIndex}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE automation_programs p
    SET status = 'active',
        updated_at = NOW()
    FROM due
    WHERE p.id = due.id
    RETURNING
      p.id,
      p.application_id,
      p.name,
      p.kind,
      p.status,
      p.delivery_mode,
      p.channel,
      p.template_name,
      p.pdf_template_name,
      p.pdf_filename_pattern,
      p.recipients,
      p.shared_data,
      p.options,
      p.schedule_at,
      p.cron_expression,
      p.timezone,
      p.next_run_at,
      p.last_run_at,
      p.last_job_id,
      p.run_count,
      p.last_error,
      p.metadata,
      p.created_at,
      p.updated_at
    `,
    params,
  );

  return (result.rows as AutomationProgramRecord[]) || [];
}

async function fetchApplicationsByIds(client: any, ids: string[]): Promise<Map<string, ApplicationRecord>> {
  if (ids.length === 0) {
    return new Map();
  }

  const result = await client.queryObject<ApplicationRecord>(
    `
    SELECT id, name, api_key
    FROM applications
    WHERE id = ANY($1::uuid[])
    `,
    [ids],
  );

  return new Map((result.rows as ApplicationRecord[]).map((item) => [item.id, item]));
}

async function dispatchProgram(
  client: any,
  program: AutomationProgramRecord,
  application: ApplicationRecord,
): Promise<{ job_id: string | null; queue_items?: number; queue_sent?: number; queue_failed?: number }> {
  const notifyUrl = buildNotifyBaseUrl();

  if (program.delivery_mode === "queued") {
    const queueLimit = parseQueueLimit(program.options);
    const queueItems = await claimDueQueueItems(client, program.application_id, program.id, queueLimit);
    const nowIso = new Date().toISOString();
    let lastJobId: string | null = null;
    let sent = 0;
    let failed = 0;
    let firstError: string | null = null;

    for (const queueItem of queueItems) {
      try {
        const response = await fetch(notifyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": application.api_key,
          },
          body: JSON.stringify(buildQueuedNotifyPayload(program, queueItem)),
        });

        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        if (!response.ok || body?.error || body?.success === false) {
          const message = String(
            (body?.error && typeof body.error === "object" && (body.error as { message?: string }).message) ||
            body?.message ||
            body?.error ||
            `notify failed (${response.status})`,
          );
          throw new Error(message);
        }

        lastJobId = typeof body.job_id === "string" ? body.job_id : null;
        sent += 1;
        await updateQueueItemStatus(client, program.application_id, program.id, queueItem.id, "sent", {
          jobId: lastJobId,
          timestamp: nowIso,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!firstError) {
          firstError = message;
        }
        failed += 1;
        await updateQueueItemStatus(client, program.application_id, program.id, queueItem.id, "failed", {
          message,
          timestamp: nowIso,
        });
      }
    }

    return {
      job_id: lastJobId,
      queue_items: queueItems.length,
      queue_sent: sent,
      queue_failed: failed,
      message: failed > 0
        ? (firstError || `Queue dispatch failed (${failed}/${queueItems.length})`)
        : undefined,
    };
  }

  const response = await fetch(notifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": application.api_key,
    },
    body: JSON.stringify(buildNotifyPayload(program)),
  });

  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || body?.error) {
    const message = String(
      (body?.error && typeof body.error === "object" && (body.error as { message?: string }).message) ||
      body?.message ||
      body?.error ||
      `notify failed (${response.status})`,
    );
    throw new Error(message);
  }

  return { job_id: typeof body.job_id === "string" ? body.job_id : null };
}

async function markProgramAsDone(
  client: any,
  program: AutomationProgramRecord,
  jobId: string | null,
) {
  const nowIso = new Date().toISOString();
  const nextRunAt = getNextRunAt(program);
  const nextStatus: ProgramStatus = program.cron_expression && nextRunAt ? "scheduled" : "done";

  await client.queryObject(
    `
    UPDATE automation_programs
    SET last_error = NULL,
        last_run_at = $1,
        last_job_id = $2,
        run_count = COALESCE(run_count, 0) + 1,
        status = $3,
        next_run_at = $4,
        updated_at = $5
    WHERE id = $6
      AND application_id = $7
    `,
    [nowIso, jobId, nextStatus, nextRunAt, nowIso, program.id, program.application_id],
  );
}

async function markProgramAsFailed(
  client: any,
  program: AutomationProgramRecord,
  message: string,
  jobId: string | null = null,
) {
  const nowIso = new Date().toISOString();
  const nextRunAt = getNextRunAt(program);
  const nextStatus: ProgramStatus = program.cron_expression && nextRunAt ? "scheduled" : "failed";

  await client.queryObject(
    `
    UPDATE automation_programs
    SET status = $1,
        last_error = $2,
        last_run_at = $3,
        last_job_id = $4,
        run_count = COALESCE(run_count, 0) + 1,
        next_run_at = $5,
        updated_at = $6
    WHERE id = $7
      AND application_id = $8
    `,
    [nextStatus, message, nowIso, jobId, nextRunAt, nowIso, program.id, program.application_id],
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(
      {
        success: false,
        error: {
          code: "METHOD_NOT_ALLOWED",
          message: "Method not allowed",
        },
      },
      405,
    );
  }

  const authError = requireSchedulerToken(req);
  if (authError) {
    return authError;
  }

  let client: any = null;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");
    if (!databaseUrl) {
      return json(
        {
          success: false,
          error: {
            code: "MISSING_ENV",
            message: "DATABASE_URL environment not configured",
          },
        },
        500,
      );
    }

    client = await pool.connect();

    const url = new URL(req.url);
    const body = (await req.json().catch(() => ({}))) as SchedulerRequestBody;
    const limit = parseLimit(url.searchParams.get("limit") || (typeof body.limit === "number" ? String(body.limit) : null));
    const applicationId = trimText(url.searchParams.get("application_id") || body.application_id || null) || null;

    const duePrograms = await fetchDuePrograms(client, limit, applicationId);
    if (duePrograms.length === 0) {
      return json({
        success: true,
        data: {
          claimed: 0,
          dispatched: 0,
          failed: 0,
          items: [],
        },
      });
    }

    const applicationMap = await fetchApplicationsByIds(
      client,
      [...new Set(duePrograms.map((program) => program.application_id))],
    );

    const items: SchedulerResultItem[] = [];
    let dispatched = 0;
    let failed = 0;

    for (const program of duePrograms) {
      const application = applicationMap.get(program.application_id);
      if (!application?.api_key) {
        const message = "Application API key not found";
        await markProgramAsFailed(client, program, message);
        items.push({
          program_id: program.id,
          application_id: program.application_id,
          application_name: application?.name || "unknown",
          status: "failed",
          job_id: null,
          message,
        });
        failed += 1;
        continue;
      }

      try {
        const result = await dispatchProgram(client, program, application);
        if (result.queue_failed && result.queue_failed > 0) {
          const message = result.message || `Queue dispatch failed (${result.queue_failed}/${result.queue_items || 0})`;
          await markProgramAsFailed(client, program, message, result.job_id);
          items.push({
            program_id: program.id,
            application_id: program.application_id,
            application_name: application.name,
            status: "failed",
            job_id: result.job_id,
            queue_items: result.queue_items,
            queue_sent: result.queue_sent,
            queue_failed: result.queue_failed,
            message,
          });
          failed += 1;
          continue;
        }

        await markProgramAsDone(client, program, result.job_id);
        items.push({
          program_id: program.id,
          application_id: program.application_id,
          application_name: application.name,
          status: "sent",
          job_id: result.job_id,
          queue_items: result.queue_items,
          queue_sent: result.queue_sent,
          queue_failed: result.queue_failed,
        });
        dispatched += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markProgramAsFailed(client, program, message);
        items.push({
          program_id: program.id,
          application_id: program.application_id,
          application_name: application.name,
          status: "failed",
          job_id: null,
          queue_items: program.delivery_mode === "queued" ? 0 : undefined,
          message,
        });
        failed += 1;
      }
    }

    return json({
      success: true,
      data: {
        claimed: duePrograms.length,
        dispatched,
        failed,
        items,
      },
    });
  } catch (err) {
    return json(
      {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  } finally {
    try {
      client?.release();
    } catch {
      // noop
    }
  }
});

