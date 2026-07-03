
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { getNextCronRunAt, isValidCronExpression } from "./_shared/cron-utils.ts";
import { buildAutomationNotifyPayload } from "./_shared/automation-notify-payload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-api-key, X-Api-Key, Accept",
};

const databaseUrl = Deno.env.get("DATABASE_URL") || "";
const pool = new Pool(databaseUrl, 3, true);

type ProgramKind = "scheduled" | "batch";
type ProgramStatus = "draft" | "scheduled" | "active" | "paused" | "done" | "failed" | "cancelled";
type Channel = "email" | "email_pdf" | "pdf";
type DeliveryMode = "static" | "queued";
type QueueStatus = "queued" | "processing" | "sent" | "failed" | "cancelled";

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
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  recipients_count?: number;
  is_due?: boolean;
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
  status: QueueStatus;
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

interface ProgramInput {
  name?: string;
  kind?: ProgramKind;
  status?: ProgramStatus;
  delivery_mode?: DeliveryMode;
  channel?: Channel;
  template_name?: string | null;
  pdf_template_name?: string | null;
  pdf_filename_pattern?: string | null;
  recipients?: Recipient[];
  shared_data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  schedule_at?: string | null;
  cron_expression?: string | null;
  timezone?: string | null;
  metadata?: Record<string, unknown>;
}

interface QueueItemInput {
  external_reference_id?: string | null;
  recipient_email?: string;
  recipient_data?: Record<string, unknown>;
  shared_data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  available_at?: string | null;
  metadata?: Record<string, unknown>;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalTextValue(value: unknown, existing: string | null): string | null {
  if (value === undefined) {
    return existing;
  }

  const text = trimText(value);
  return text || null;
}

function getEffectiveRunAt(program: { next_run_at: string | null; schedule_at: string | null }): string | null {
  return program.next_run_at || program.schedule_at || null;
}

function getNextRunAt(program: {
  cron_expression: string | null;
  timezone: string;
  next_run_at: string | null;
  schedule_at: string | null;
  last_run_at: string | null;
  updated_at: string;
  created_at: string;
}): string | null {
  if (!program.cron_expression) {
    return null;
  }

  const reference =
    getEffectiveRunAt(program) ||
    program.last_run_at ||
    program.updated_at ||
    program.created_at;

  return getNextCronRunAt(program.cron_expression, program.timezone, new Date(reference));
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeRecipients(value: unknown): Recipient[] | null {
  if (!Array.isArray(value)) return null;

  const recipients = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const email = trimText(record.email);

      if (!email) return null;

      const data = normalizeObject(record.data);

      return Object.keys(data).length > 0 ? { email, data } : { email };
    })
    .filter((item): item is Recipient => item !== null);

  return recipients.length > 0 ? recipients : [];
}

function safeDate(value: unknown): string | null {
  const text = trimText(value);
  if (!text) return null;

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

function getApiKey(req: Request, url: URL): string | null {
  return req.headers.get("x-api-key") ||
    req.headers.get("X-Api-Key") ||
    url.searchParams.get("api_key");
}

function buildProgramSummary(
  program: AutomationProgramRecord,
  nowIso: string,
): AutomationProgramRecord {
  const dueAt = getEffectiveRunAt(program);

  return {
    ...program,
    recipients_count: Array.isArray(program.recipients)
      ? program.recipients.length
      : 0,
    is_due: program.status === "scheduled" && !!dueAt && dueAt <= nowIso,
  };
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

function getRouteParts(pathname: string): string[] {
  const parts = pathname.split("/").filter(Boolean);
  const resourceIndex = parts.lastIndexOf("automation-programs");

  if (resourceIndex === -1) {
    return parts;
  }

  return parts.slice(resourceIndex + 1);
}

function normalizeProgramPayload(
  input: ProgramInput,
  existing?: AutomationProgramRecord | null,
) {
  const mergedRecipients = input.recipients ?? existing?.recipients ?? [];
  const recipients = normalizeRecipients(mergedRecipients);
  const delivery_mode = (input.delivery_mode ?? existing?.delivery_mode ?? "static") as DeliveryMode;

  if (recipients === null) {
    throw new Error("recipients debe ser un array valido");
  }

  if (delivery_mode === "static" && recipients.length === 0) {
    throw new Error("recipients debe contener al menos un destinatario");
  }

  const kind = (input.kind ?? existing?.kind ?? "scheduled") as ProgramKind;
  const channel = (input.channel ?? existing?.channel ?? "email") as Channel;
  const name = trimText(input.name ?? existing?.name);

  if (!name) throw new Error("name es requerido");

  const timezone = readOptionalTextValue(input.timezone, existing?.timezone) || "America/Montevideo";
  const cron_expression = readOptionalTextValue(input.cron_expression, existing?.cron_expression);

  if (!["scheduled", "batch"].includes(kind)) {
    throw new Error("kind debe ser scheduled o batch");
  }

  if (!["static", "queued"].includes(delivery_mode)) {
    throw new Error("delivery_mode debe ser static o queued");
  }

  if (!["email", "email_pdf", "pdf"].includes(channel)) {
    throw new Error("channel debe ser email, email_pdf o pdf");
  }

  if (cron_expression && kind !== "scheduled") {
    throw new Error("cron_expression solo se puede usar en programas scheduled");
  }

  if (cron_expression && !isValidCronExpression(cron_expression, timezone)) {
    throw new Error("cron_expression no es valido");
  }

  const template_name = readOptionalTextValue(input.template_name, existing?.template_name);

  const pdf_template_name = readOptionalTextValue(input.pdf_template_name, existing?.pdf_template_name);

  const pdf_filename_pattern = readOptionalTextValue(input.pdf_filename_pattern, existing?.pdf_filename_pattern);

  const schedule_at = safeDate(input.schedule_at ?? existing?.schedule_at ?? null);

  const status = (input.status ??
    existing?.status ??
    (kind === "scheduled" ? "scheduled" : "active")) as ProgramStatus;

  if ((channel === "email" || channel === "email_pdf") && !template_name) {
    throw new Error("template_name es requerido para este canal");
  }

  if ((channel === "email_pdf" || channel === "pdf") && !pdf_template_name) {
    throw new Error("pdf_template_name es requerido para este canal");
  }

  if (kind === "scheduled" && !schedule_at) {
    throw new Error("schedule_at es requerido para programas programados");
  }

  const shared_data = {
    ...(existing?.shared_data ?? {}),
    ...normalizeObject(input.shared_data),
  };

  const options = {
    ...(existing?.options ?? {}),
    ...normalizeObject(input.options),
  };

  const metadata = {
    ...(existing?.metadata ?? {}),
    ...normalizeObject(input.metadata),
  };

  const next_run_at = kind === "scheduled" ? schedule_at : null;

  return {
    name,
    kind,
    status,
    delivery_mode,
    channel,
    template_name,
    pdf_template_name,
    pdf_filename_pattern,
    recipients,
    shared_data,
    options,
    schedule_at,
    cron_expression,
    timezone,
    next_run_at,
    metadata,
  };
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

async function fetchProgramById(
  client: any,
  applicationId: string,
  programId: string,
): Promise<AutomationProgramRecord | null> {
  const result = await client.queryObject(
    `
    SELECT *
    FROM automation_programs
    WHERE application_id = $1
      AND id = $2
    LIMIT 1
    `,
    [applicationId, programId],
  );

  return result.rows[0] as AutomationProgramRecord ?? null;
}

async function listPrograms(
  client: any,
  applicationId: string,
  filters: { kind?: string | null; status?: string | null; due?: boolean; limit?: number },
) {
  const nowIso = new Date().toISOString();

  const params: unknown[] = [applicationId];
  let whereSql = "WHERE application_id = $1";

  if (filters.kind) {
    params.push(filters.kind);
    whereSql += ` AND kind = $${params.length}`;
  }

  if (filters.status) {
    params.push(filters.status);
    whereSql += ` AND status = $${params.length}`;
  }

  if (filters.due) {
    params.push(nowIso);
    whereSql += ` AND status = 'scheduled' AND (next_run_at <= $${params.length} OR (next_run_at IS NULL AND schedule_at <= $${params.length}))`;
  }

  let limitSql = "";

  if (filters.limit && filters.limit > 0) {
    params.push(filters.limit);
    limitSql = `LIMIT $${params.length}`;
  }

  const result = await client.queryObject(
    `
    SELECT *
    FROM automation_programs
    ${whereSql}
    ORDER BY created_at DESC
    ${limitSql}
    `,
    params,
  );

  const programs = (result.rows as AutomationProgramRecord[]).map((program) =>
    buildProgramSummary(program, nowIso)
  );

  return {
    programs,
    total: programs.length,
    now: nowIso,
  };
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

function normalizeQueueItemInput(input: QueueItemInput) {
  const recipient_email = trimText(input.recipient_email);
  if (!recipient_email) {
    throw new Error("recipient_email es requerido");
  }

  const external_reference_id = readOptionalTextValue(input.external_reference_id, null);
  const recipient_data = normalizeObject(input.recipient_data);
  const shared_data = normalizeObject(input.shared_data);
  const options = normalizeObject(input.options);
  const metadata = normalizeObject(input.metadata);

  let available_at = new Date().toISOString();
  if (input.available_at !== undefined) {
    const parsed = safeDate(input.available_at);
    if (!parsed) {
      throw new Error("available_at no es valido");
    }
    available_at = parsed;
  }

  return {
    external_reference_id,
    recipient_email,
    recipient_data,
    shared_data,
    options,
    available_at,
    metadata,
  };
}

function normalizeQueueItemsFromBody(body: Record<string, unknown>): QueueItemInput[] {
  if (Array.isArray(body.items)) {
    return body.items as QueueItemInput[];
  }

  return [body as QueueItemInput];
}

async function fetchProgramQueueItems(
  client: any,
  applicationId: string,
  programId: string,
  filters: { status?: string | null; limit?: number },
) {
  const params: unknown[] = [applicationId, programId];
  let whereSql = "WHERE application_id = $1 AND program_id = $2";

  if (filters.status) {
    params.push(filters.status);
    whereSql += ` AND status = $${params.length}`;
  }

  let limitSql = "";
  if (filters.limit && filters.limit > 0) {
    params.push(filters.limit);
    limitSql = `LIMIT $${params.length}`;
  }

  const result = await client.queryObject(
    `
    SELECT *
    FROM automation_program_queue_items
    ${whereSql}
    ORDER BY available_at ASC, created_at DESC
    ${limitSql}
    `,
    params,
  );

  return result.rows as AutomationProgramQueueItemRecord[];
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

async function upsertProgramQueueItems(
  client: any,
  applicationId: string,
  programId: string,
  items: QueueItemInput[],
) {
  const normalizedItems = items.map((item) => normalizeQueueItemInput(item));
  const results: AutomationProgramQueueItemRecord[] = [];

  for (const item of normalizedItems) {
    const result = await client.queryObject(
      `
      INSERT INTO automation_program_queue_items (
        application_id,
        program_id,
        external_reference_id,
        recipient_email,
        recipient_data,
        shared_data,
        options,
        available_at,
        metadata
      )
      VALUES (
        $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9::jsonb
      )
      ON CONFLICT (application_id, program_id, external_reference_id)
      DO UPDATE SET
        recipient_email = EXCLUDED.recipient_email,
        recipient_data = EXCLUDED.recipient_data,
        shared_data = EXCLUDED.shared_data,
        options = EXCLUDED.options,
        available_at = EXCLUDED.available_at,
        metadata = EXCLUDED.metadata,
        status = 'queued',
        last_error = NULL,
        last_attempt_at = NULL,
        sent_at = NULL,
        last_job_id = NULL,
        updated_at = NOW()
      RETURNING *
      `,
      [
        applicationId,
        programId,
        item.external_reference_id,
        item.recipient_email,
        JSON.stringify(item.recipient_data),
        JSON.stringify(item.shared_data),
        JSON.stringify(item.options),
        item.available_at,
        JSON.stringify(item.metadata),
      ],
    );

    results.push(result.rows[0] as AutomationProgramQueueItemRecord);
  }

  return results;
}

async function cancelProgramQueueItem(
  client: any,
  applicationId: string,
  programId: string,
  queueItemId: string,
): Promise<AutomationProgramQueueItemRecord | null> {
  const result = await client.queryObject(
    `
    UPDATE automation_program_queue_items
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE application_id = $1
      AND program_id = $2
      AND id = $3
    RETURNING *
    `,
    [applicationId, programId, queueItemId],
  );

  return (result.rows[0] as AutomationProgramQueueItemRecord | undefined) ?? null;
}

async function runStaticProgram(
  client: any,
  apiKey: string,
  applicationId: string,
  program: AutomationProgramRecord,
) {
  const notifyBaseUrl =
    Deno.env.get("NOTIFY_FUNCTION_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
    "";

  if (!notifyBaseUrl) {
    throw new Error("NOTIFY_FUNCTION_URL or FUNCTIONS_BASE_URL is required");
  }

  const notifyUrl = notifyBaseUrl.endsWith("/notify")
    ? notifyBaseUrl
    : `${notifyBaseUrl}/notify`;

  const payload = buildNotifyPayload(program);
  const nextRunAt = getNextRunAt(program);

  const response = await fetch(notifyUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok || body?.error || body?.success === false) {
    const message =
      body?.error?.message ||
      body?.error ||
      body?.message ||
      `notify failed (${response.status})`;
    const isRecurring = program.kind === "scheduled" && !!program.cron_expression;
    const failedStatus: ProgramStatus =
      program.status === "paused"
        ? "paused"
        : isRecurring
          ? "scheduled"
          : "failed";

    await client.queryObject(
      `
      UPDATE automation_programs
      SET last_error = $1,
          last_run_at = $2,
          run_count = COALESCE(run_count, 0) + 1,
          status = $3,
          next_run_at = $4,
          updated_at = $5
      WHERE id = $6
        AND application_id = $7
      `,
      [
        String(message),
        new Date().toISOString(),
        failedStatus,
        program.status === "paused" ? program.next_run_at : nextRunAt,
        new Date().toISOString(),
        program.id,
        applicationId,
      ],
    );

    throw new Error(String(message));
  }

  const nowIso = new Date().toISOString();
  const isRecurring = program.kind === "scheduled" && !!program.cron_expression;

  const nextStatus: ProgramStatus =
    program.status === "paused"
      ? "paused"
      : program.kind === "scheduled"
        ? isRecurring
          ? "scheduled"
          : "done"
        : "active";

  const updateResult = await client.queryObject(
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
    RETURNING *
    `,
    [
      nowIso,
      body.job_id ?? null,
      nextStatus,
      program.status === "paused"
        ? program.next_run_at
        : program.kind === "scheduled" && !isRecurring
          ? null
          : nextRunAt,
      nowIso,
      program.id,
      applicationId,
    ],
  );

  const updatedProgram = updateResult.rows[0] as AutomationProgramRecord;

  return {
    job_id: body.job_id ?? null,
    program: updatedProgram,
    notify: body,
  };
}

async function runQueuedProgram(
  client: any,
  apiKey: string,
  applicationId: string,
  program: AutomationProgramRecord,
) {
  const notifyBaseUrl =
    Deno.env.get("NOTIFY_FUNCTION_URL") ||
    Deno.env.get("FUNCTIONS_BASE_URL") ||
    Deno.env.get("PUBLIC_FUNCTIONS_URL") ||
    "";

  if (!notifyBaseUrl) {
    throw new Error("NOTIFY_FUNCTION_URL or FUNCTIONS_BASE_URL is required");
  }

  const notifyUrl = notifyBaseUrl.endsWith("/notify")
    ? notifyBaseUrl
    : `${notifyBaseUrl}/notify`;

  const queueLimit = parseQueueLimit(program.options);
  const queueItems = await claimDueQueueItems(client, applicationId, program.id, queueLimit);
  const nowIso = new Date().toISOString();
  const isRecurring = program.kind === "scheduled" && !!program.cron_expression;
  const nextRunAt = program.status === "paused"
    ? program.next_run_at
    : getNextRunAt(program);
  const nextStatus: ProgramStatus =
    program.status === "paused"
      ? "paused"
      : program.kind === "scheduled"
        ? isRecurring
          ? "scheduled"
          : "done"
        : "active";

  const items: Array<{
    queue_item_id: string;
    recipient_email: string;
    status: "sent" | "failed";
    job_id: string | null;
    message?: string;
  }> = [];

  let sent = 0;
  let failed = 0;
  let lastJobId: string | null = null;
  let firstError: string | null = null;

  for (const queueItem of queueItems) {
    try {
      const response = await fetch(notifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
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
      items.push({
        queue_item_id: queueItem.id,
        recipient_email: queueItem.recipient_email,
        status: "sent",
        job_id: lastJobId,
      });

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
        [nowIso, lastJobId, nowIso, queueItem.id, applicationId, program.id],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!firstError) {
        firstError = message;
      }
      failed += 1;
      items.push({
        queue_item_id: queueItem.id,
        recipient_email: queueItem.recipient_email,
        status: "failed",
        job_id: null,
        message,
      });

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
        [message, nowIso, queueItem.id, applicationId, program.id],
      );
    }
  }

  const queueMessage = failed > 0
    ? `Procesados ${sent} items y ${failed} fallaron`
    : null;

  const updateResult = await client.queryObject(
    `
    UPDATE automation_programs
    SET last_error = $1,
        last_run_at = $2,
        last_job_id = $3,
        run_count = COALESCE(run_count, 0) + 1,
        status = $4,
        next_run_at = $5,
        updated_at = $6
    WHERE id = $7
      AND application_id = $8
    RETURNING *
    `,
    [
      queueMessage || firstError || null,
      nowIso,
      lastJobId,
      nextStatus,
      nextRunAt,
      nowIso,
      program.id,
      applicationId,
    ],
  );

  return {
    job_id: lastJobId,
    program: updateResult.rows[0] as AutomationProgramRecord,
    queued_items: queueItems.length,
    sent,
    failed,
    items,
  };
}

async function runProgram(
  client: any,
  apiKey: string,
  applicationId: string,
  program: AutomationProgramRecord,
) {
  if (program.delivery_mode === "queued") {
    return runQueuedProgram(client, apiKey, applicationId, program);
  }

  return runStaticProgram(client, apiKey, applicationId, program);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let client: any = null;

  try {
    const databaseUrl = Deno.env.get("DATABASE_URL");

    if (!databaseUrl) {
      return json({
        success: false,
        error: {
          code: "MISSING_ENV",
          message: "DATABASE_URL environment not configured",
        },
      }, 500);
    }

    const url = new URL(req.url);
    const routeParts = getRouteParts(url.pathname);
    const maybeProgramId = routeParts[0];
    const isRunAction = routeParts[1] === "run";
    const isQueueRoute = routeParts[1] === "queue";
    const queueItemId = routeParts[2];
    const isQueueCollection = isQueueRoute && !queueItemId;
    const isQueueItemAction = isQueueRoute && !!queueItemId;
    const isRoot = routeParts.length === 0;

    const apiKey = getApiKey(req, url);

    if (!apiKey) {
      return json({
        success: false,
        error: {
          code: "MISSING_API_KEY",
          message: "Missing x-api-key header",
        },
      }, 401);
    }

    client = await pool.connect();

    const application = await getApplicationByKey(client, apiKey);

    if (!application) {
      return json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "API Key invalida",
        },
      }, 401);
    }

    const applicationIdFilter = url.searchParams.get("application_id");

    if (applicationIdFilter && applicationIdFilter !== application.id) {
      return json({
        success: false,
        error: {
          code: "APPLICATION_MISMATCH",
          message: "application_id no coincide con la API Key",
        },
      }, 403);
    }

    if (req.method === "GET" && isRoot) {
      const kind = url.searchParams.get("kind");
      const status = url.searchParams.get("status");
      const due = url.searchParams.get("due") === "true";
      const limit = Number(url.searchParams.get("limit") || "0") || undefined;

      const result = await listPrograms(client, application.id, {
        kind,
        status,
        due,
        limit,
      });

      return json({ success: true, data: result });
    }

    if (req.method === "POST" && isRoot) {
      const body = await req.json().catch(() => ({})) as ProgramInput;
      const normalized = normalizeProgramPayload(body);

      const result = await client.queryObject(
        `
        INSERT INTO automation_programs (
          application_id,
          name,
          kind,
          status,
          delivery_mode,
          channel,
          template_name,
          pdf_template_name,
          pdf_filename_pattern,
          recipients,
          shared_data,
          options,
          schedule_at,
          cron_expression,
          timezone,
          next_run_at,
          metadata
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,
          $12,$13,$14,$15,$16,$17::jsonb
        )
        RETURNING *
        `,
        [
          application.id,
          normalized.name,
          normalized.kind,
          normalized.status,
          normalized.delivery_mode,
          normalized.channel,
          normalized.template_name,
          normalized.pdf_template_name,
          normalized.pdf_filename_pattern,
          JSON.stringify(normalized.recipients),
          JSON.stringify(normalized.shared_data),
          JSON.stringify(normalized.options),
          normalized.schedule_at,
          normalized.cron_expression,
          normalized.timezone,
          normalized.next_run_at,
          JSON.stringify(normalized.metadata),
        ],
      );

      return json({
        success: true,
        data: { program: result.rows[0] as AutomationProgramRecord },
      }, 201);
    }

    if (isQueueRoute && req.method === "GET" && maybeProgramId && isQueueCollection) {
      const program = await fetchProgramById(client, application.id, maybeProgramId);
      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      const status = url.searchParams.get("status");
      const limit = Number(url.searchParams.get("limit") || "0") || undefined;
      const queueItems = await fetchProgramQueueItems(client, application.id, program.id, { status, limit });

      return json({
        success: true,
        data: {
          program: buildProgramSummary(program, new Date().toISOString()),
          queue_items: queueItems,
          total: queueItems.length,
        },
      });
    }

    if (isQueueRoute && req.method === "POST" && maybeProgramId && isQueueCollection) {
      const program = await fetchProgramById(client, application.id, maybeProgramId);
      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      if (program.delivery_mode !== "queued") {
        return json({
          success: false,
          error: {
            code: "QUEUE_NOT_ENABLED",
            message: "Program delivery_mode must be queued to accept pushed data",
          },
        }, 400);
      }

      const body = await req.json().catch(() => ({})) as Record<string, unknown>;
      const queueItemsInput = normalizeQueueItemsFromBody(body);

      if (queueItemsInput.length === 0) {
        return json({
          success: false,
          error: {
            code: "MISSING_ITEMS",
            message: "At least one queue item is required",
          },
        }, 400);
      }

      const queueItems = await upsertProgramQueueItems(client, application.id, program.id, queueItemsInput);

      return json({
        success: true,
        data: {
          program: buildProgramSummary(program, new Date().toISOString()),
          queue_items: queueItems,
          total: queueItems.length,
        },
      }, 201);
    }

    if (isQueueRoute && req.method === "DELETE" && maybeProgramId && isQueueItemAction) {
      const program = await fetchProgramById(client, application.id, maybeProgramId);
      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      const cancelled = await cancelProgramQueueItem(client, application.id, program.id, queueItemId);
      if (!cancelled) {
        return json({
          success: false,
          error: {
            code: "QUEUE_ITEM_NOT_FOUND",
            message: "Queue item not found",
          },
        }, 404);
      }

      return json({
        success: true,
        data: {
          queue_item: cancelled,
        },
      });
    }

    if (req.method === "GET" && !isRoot && !isRunAction) {
      const program = await fetchProgramById(
        client,
        application.id,
        maybeProgramId,
      );

      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      return json({
        success: true,
        data: {
          program: buildProgramSummary(program, new Date().toISOString()),
        },
      });
    }

    if ((req.method === "PUT" || req.method === "PATCH") && !isRoot && !isRunAction) {
      const existing = await fetchProgramById(
        client,
        application.id,
        maybeProgramId,
      );

      if (!existing) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      const body = await req.json().catch(() => ({})) as ProgramInput;
      const normalized = normalizeProgramPayload(body, existing);

      const result = await client.queryObject(
        `
        UPDATE automation_programs
        SET name = $1,
            kind = $2,
            status = $3,
            delivery_mode = $4,
            channel = $5,
            template_name = $6,
            pdf_template_name = $7,
            pdf_filename_pattern = $8,
            recipients = $9::jsonb,
            shared_data = $10::jsonb,
            options = $11::jsonb,
            schedule_at = $12,
            cron_expression = $13,
            timezone = $14,
            next_run_at = $15,
            metadata = $16::jsonb,
            updated_at = $17
        WHERE id = $18
          AND application_id = $19
        RETURNING *
        `,
        [
          normalized.name,
          normalized.kind,
          normalized.status,
          normalized.delivery_mode,
          normalized.channel,
          normalized.template_name,
          normalized.pdf_template_name,
          normalized.pdf_filename_pattern,
          JSON.stringify(normalized.recipients),
          JSON.stringify(normalized.shared_data),
          JSON.stringify(normalized.options),
          normalized.schedule_at,
          normalized.cron_expression,
          normalized.timezone,
          normalized.next_run_at,
          JSON.stringify(normalized.metadata),
          new Date().toISOString(),
          existing.id,
          application.id,
        ],
      );

      return json({
        success: true,
        data: { program: result.rows[0] as AutomationProgramRecord },
      });
    }

    if (req.method === "POST" && isRunAction) {
      const programId = routeParts[0];

      const program = await fetchProgramById(client, application.id, programId);

      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      const result = await runProgram(
        client,
        apiKey,
        application.id,
        program,
      );

      return json({ success: true, data: result });
    }

    if (req.method === "DELETE" && !isRoot && !isRunAction) {
      const program = await fetchProgramById(
        client,
        application.id,
        maybeProgramId,
      );

      if (!program) {
        return json({
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program not found",
          },
        }, 404);
      }

      const result = await client.queryObject(
        `
        UPDATE automation_programs
        SET status = 'cancelled',
            updated_at = $1
        WHERE id = $2
          AND application_id = $3
        RETURNING *
        `,
        [new Date().toISOString(), program.id, application.id],
      );

      return json({
        success: true,
        data: { program: result.rows[0] as AutomationProgramRecord },
      });
    }

    return json({
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed",
      },
    }, 405);
  } catch (err: any) {
    return json({
      success: false,
      error: {
        code: "UNEXPECTED_ERROR",
        message: err?.message || String(err),
      },
    }, 500);
  } finally {
    try {
      client?.release();
    } catch {
      // ignore
    }
  }
});

