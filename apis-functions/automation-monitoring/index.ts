
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, X-Api-Key, Accept",
};

const databaseUrl = Deno.env.get("DATABASE_URL") || "";
const pool = new Pool(databaseUrl, 3, true);

type ProgramKind = "scheduled" | "batch";
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
  status: string;
  delivery_mode: DeliveryMode;
  channel: string;
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
  created_at: string;
  updated_at: string;
}

interface AutomationProgramQueueItemRecord {
  id: string;
  application_id: string;
  program_id: string;
  external_reference_id: string | null;
  recipient_email: string;
  status: "queued" | "processing" | "sent" | "failed" | "cancelled";
  available_at: string;
  last_attempt_at: string | null;
  sent_at: string | null;
  last_job_id: string | null;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface CampaignJobRecord {
  id: string;
  type: string;
  status: string;
  template_name: string | null;
  total: number;
  processed: number;
  sent: number;
  failed: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface EmailLogRecord {
  id: string;
  status: string;
  delivery_status: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  communication_type: string;
  error_message: string | null;
  recipient_email: string;
  subject: string | null;
  created_at: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getApiKey(req: Request, url: URL): string | null {
  return req.headers.get("x-api-key") ||
    req.headers.get("X-Api-Key") ||
    url.searchParams.get("api_key");
}

function getEffectiveRunAt(program: AutomationProgramRecord): string | null {
  return program.next_run_at || program.schedule_at || null;
}

async function getApplicationByKey(client: any, apiKey: string) {
  const result = await client.queryObject(
    `
    SELECT id, name, api_key
    FROM applications
    WHERE api_key = $1
    LIMIT 1
    `,
    [apiKey],
  );

  return result.rows[0] ?? null;
}

function toProgramSummary(program: AutomationProgramRecord, nowIso: string) {
  const dueAt = getEffectiveRunAt(program);

  return {
    ...program,
    recipients_count: Array.isArray(program.recipients)
      ? program.recipients.length
      : 0,
    is_due:
      program.kind === "scheduled" &&
      program.status === "scheduled" &&
      !!dueAt &&
      dueAt <= nowIso,
  };
}

function toJobSummary(job: CampaignJobRecord) {
  return {
    ...job,
    trace_level: job.status === "failed"
      ? "error"
      : job.status === "done"
        ? "success"
        : job.status === "processing"
          ? "info"
          : "warning",
  };
}

function buildTraceEntries(
  programs: AutomationProgramRecord[],
  jobs: CampaignJobRecord[],
  logs: EmailLogRecord[],
  queueItems: AutomationProgramQueueItemRecord[],
) {
  const traces = [
    ...programs.slice(0, 12).map((program) => ({
      id: `program-${program.id}`,
      kind: "program",
      level: program.last_error
        ? "error"
        : program.status === "paused"
          ? "warning"
          : program.status === "done"
            ? "success"
            : "info",
      title: program.name,
      message: program.last_error
        ? program.last_error
        : program.last_run_at
          ? `Ultima ejecucion ${program.last_run_at}`
          : program.schedule_at
            ? `Programado para ${program.schedule_at}`
            : `Estado ${program.status}`,
      created_at: program.updated_at,
      program_id: program.id,
      job_id: program.last_job_id,
    })),
    ...queueItems.slice(0, 12).map((item) => ({
      id: `queue-${item.id}`,
      kind: "program" as const,
      level: item.last_error
        ? "error"
        : item.status === "sent"
          ? "success"
          : item.status === "processing"
            ? "info"
            : item.status === "cancelled"
              ? "warning"
              : "warning",
      title: item.external_reference_id || item.recipient_email,
      message: item.last_error
        ? item.last_error
        : item.status === "sent"
          ? `Enviado ${item.sent_at || item.updated_at}`
          : item.status === "processing"
            ? "En proceso"
            : `Estado ${item.status}`,
      created_at: item.updated_at,
      program_id: item.program_id,
      job_id: item.last_job_id,
      recipient_email: item.recipient_email,
    })),
    ...jobs.slice(0, 12).map((job) => ({
      id: `job-${job.id}`,
      kind: "job",
      level: job.status === "failed"
        ? "error"
        : job.status === "done"
          ? "success"
          : job.status === "processing"
            ? "info"
            : "warning",
      title: `Job ${job.type}`,
      message: job.error_message
        ? job.error_message
        : `${job.sent} enviados, ${job.failed} fallidos sobre ${job.total}`,
      created_at: job.updated_at,
      job_id: job.id,
    })),
    ...logs.slice(0, 10).map((log) => ({
      id: `log-${log.id}`,
      kind: "log",
      level:
        log.status === "failed" || log.delivery_status === "bounced"
          ? "error"
          : log.clicked_at
            ? "success"
            : log.opened_at
              ? "info"
              : "warning",
      title: log.subject || log.recipient_email,
      message: log.error_message || `${log.communication_type} Â· ${log.status}`,
      created_at: log.created_at,
      recipient_email: log.recipient_email,
      log_id: log.id,
    })),
  ];

  return traces
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .slice(0, 30);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let client: any = null;

  try {
    if (req.method !== "GET") {
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

    const url = new URL(req.url);
    const apiKey = getApiKey(req, url);

    if (!apiKey) {
      return json(
        {
          success: false,
          error: {
            code: "MISSING_API_KEY",
            message: "Missing x-api-key header",
          },
        },
        401,
      );
    }

    client = await pool.connect();

    const applicationResult = await client.queryObject(
      `
      SELECT id, name, api_key
      FROM applications
      WHERE api_key = $1
      LIMIT 1
      `,
      [apiKey],
    );

    const application: any = applicationResult.rows[0] ?? null;

    if (!application) {
      return json(
        {
          success: false,
          error: {
            code: "INVALID_API_KEY",
            message: "API Key invalida",
          },
        },
        401,
      );
    }

    const applicationIdFilter = url.searchParams.get("application_id");

    if (applicationIdFilter && applicationIdFilter !== application.id) {
      return json(
        {
          success: false,
          error: {
            code: "APPLICATION_MISMATCH",
            message: "application_id no coincide con la API Key",
          },
        },
        403,
      );
    }

    const limit = Math.max(1, Number(url.searchParams.get("limit") || "10") || 10);
    const nowIso = new Date().toISOString();

    const programsResult = await client.queryObject(
      `
      SELECT *
      FROM automation_programs
      WHERE application_id = $1
      ORDER BY updated_at DESC
      `,
      [application.id],
    );

    const queueItemsResult = await client.queryObject(
      `
      SELECT
        id,
        application_id,
        program_id,
        external_reference_id,
        recipient_email,
        status,
        available_at,
        last_attempt_at,
        sent_at,
        last_job_id,
        attempt_count,
        last_error,
        created_at,
        updated_at
      FROM automation_program_queue_items
      WHERE application_id = $1
      ORDER BY updated_at DESC
      `,
      [application.id],
    );

    const jobsResult = await client.queryObject(
      `
      SELECT
        id,
        type,
        status,
        template_name,
        total,
        processed,
        sent,
        failed,
        error_message,
        created_at,
        updated_at
      FROM campaign_jobs
      WHERE application_id = $1
      ORDER BY created_at DESC
      `,
      [application.id],
    );

    const logsResult = await client.queryObject(
      `
      SELECT
        id,
        status,
        delivery_status,
        opened_at,
        clicked_at,
        communication_type,
        error_message,
        recipient_email,
        subject,
        created_at
      FROM email_logs
      WHERE application_id = $1
      ORDER BY created_at DESC
      `,
      [application.id],
    );

    const allPrograms = (programsResult.rows as AutomationProgramRecord[]).map(
      (program) => toProgramSummary(program, nowIso),
    );

    const allJobs = (jobsResult.rows as CampaignJobRecord[]).map((job) =>
      toJobSummary(job)
    );

    const allLogs = logsResult.rows as EmailLogRecord[];
    const allQueueItems = queueItemsResult.rows as AutomationProgramQueueItemRecord[];

    const programs = allPrograms.slice(0, limit);
    const jobs = allJobs.slice(0, limit);
    const logs = allLogs.slice(0, limit);
    const queueItems = allQueueItems.slice(0, limit);

    const summary = {
      programs_total: allPrograms.length,
      scheduled_programs: allPrograms.filter((program) =>
        program.kind === "scheduled"
      ).length,
      batch_programs: allPrograms.filter((program) =>
        program.kind === "batch"
      ).length,
      due_programs: allPrograms.filter((program) => program.is_due).length,
      queue_total: allQueueItems.length,
      queue_queued: allQueueItems.filter((item) => item.status === "queued").length,
      queue_processing: allQueueItems.filter((item) => item.status === "processing").length,
      queue_sent: allQueueItems.filter((item) => item.status === "sent").length,
      queue_failed: allQueueItems.filter((item) => item.status === "failed").length,
      jobs_total: allJobs.length,
      jobs_pending: allJobs.filter((job) => job.status === "pending").length,
      jobs_processing: allJobs.filter((job) => job.status === "processing")
        .length,
      jobs_done: allJobs.filter((job) => job.status === "done").length,
      jobs_failed: allJobs.filter((job) => job.status === "failed").length,
      jobs_sent: allJobs.reduce(
        (acc, job) => acc + Number(job.sent || 0),
        0,
      ),
      jobs_failed_count: allJobs.reduce(
        (acc, job) => acc + Number(job.failed || 0),
        0,
      ),
      emails_opened: allLogs.filter((log) => !!log.opened_at).length,
      emails_clicked: allLogs.filter((log) => !!log.clicked_at).length,
      bounce_count: allLogs.filter((log) =>
        log.delivery_status === "bounced" || log.status === "failed"
      ).length,
      generated_at: nowIso,
    };

    const traces = buildTraceEntries(
      programs as AutomationProgramRecord[],
      jobs as CampaignJobRecord[],
      logs,
      queueItems as AutomationProgramQueueItemRecord[],
    );

    return json({
      success: true,
      data: {
        application: {
          id: application.id,
          name: application.name,
        },
        summary,
        recent_programs: programs,
        recent_jobs: jobs,
        recent_queue_items: queueItems,
        traces,
      },
    });
  } catch (err: any) {
    return json(
      {
        success: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: err?.message || String(err),
        },
      },
      500,
    );
  } finally {
    try {
      client?.release();
    } catch {
      // ignore
    }
  }
});

