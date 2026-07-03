import { buildFunctionsUrl, configManager } from './config';

export type AutomationChannel = 'email' | 'email_pdf' | 'pdf';
export type AutomationKind = 'scheduled' | 'batch';
export type AutomationProgramStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'done' | 'failed' | 'cancelled';
export type AutomationDeliveryMode = 'static' | 'queued';

export interface AutomationRecipient {
  email: string;
  data?: Record<string, unknown>;
}

export interface AutomationOptions {
  concurrency?: number;
  stop_on_error?: boolean;
  batch_delay_ms?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  [key: string]: unknown;
}

export interface AutomationProgramRecord {
  id: string;
  application_id: string;
  name: string;
  kind: AutomationKind;
  status: AutomationProgramStatus;
  delivery_mode: AutomationDeliveryMode;
  channel: AutomationChannel;
  template_name: string | null;
  pdf_template_name: string | null;
  pdf_filename_pattern: string | null;
  recipients: AutomationRecipient[];
  shared_data: Record<string, unknown>;
  options: AutomationOptions;
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
  recipients_count?: number;
  is_due?: boolean;
}

export interface AutomationProgramInput {
  id?: string;
  application_id?: string;
  name: string;
  kind: AutomationKind;
  status?: AutomationProgramStatus;
  delivery_mode?: AutomationDeliveryMode;
  channel: AutomationChannel;
  template_name?: string | null;
  pdf_template_name?: string | null;
  pdf_filename_pattern?: string | null;
  recipients?: AutomationRecipient[];
  shared_data?: Record<string, unknown>;
  options?: AutomationOptions;
  schedule_at?: string | null;
  cron_expression?: string | null;
  timezone?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AutomationProgramQueueItemRecord {
  id: string;
  application_id: string;
  program_id: string;
  external_reference_id: string | null;
  recipient_email: string;
  recipient_data: Record<string, unknown>;
  shared_data: Record<string, unknown>;
  options: AutomationOptions;
  status: 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';
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

export interface AutomationProgramQueueInput {
  external_reference_id?: string | null;
  recipient_email?: string;
  recipient_data?: Record<string, unknown>;
  shared_data?: Record<string, unknown>;
  options?: AutomationOptions;
  available_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AutomationProgramQueueBulkInput {
  items: AutomationProgramQueueInput[];
}

export interface NotifyBatchInput {
  type: AutomationChannel;
  template_name?: string;
  attachment?: {
    pdf_template_name: string;
    filename?: string;
    data?: Record<string, unknown>;
  };
  recipients: AutomationRecipient[];
  shared_data?: Record<string, unknown>;
  options?: AutomationOptions;
}

export interface AutomationMonitoringSummary {
  programs_total: number;
  scheduled_programs: number;
  batch_programs: number;
  due_programs: number;
  queue_total: number;
  queue_queued: number;
  queue_processing: number;
  queue_sent: number;
  queue_failed: number;
  jobs_total: number;
  jobs_pending: number;
  jobs_processing: number;
  jobs_done: number;
  jobs_failed: number;
  jobs_sent: number;
  jobs_failed_count: number;
  emails_opened: number;
  emails_clicked: number;
  bounce_count: number;
  generated_at: string;
}

export interface AutomationMonitoringPayload {
  application: {
    id: string;
    name: string;
  };
  summary: AutomationMonitoringSummary;
  recent_programs: AutomationProgramRecord[];
  recent_jobs: Array<{
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
    trace_level?: 'info' | 'success' | 'warning' | 'error';
  }>;
  recent_queue_items?: AutomationProgramQueueItemRecord[];
  traces: Array<{
    id: string;
    kind: 'program' | 'job' | 'log';
    level: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    created_at: string;
    program_id?: string;
    job_id?: string;
    log_id?: string;
    recipient_email?: string;
  }>;
}

type ApiResult<T> = {
  success?: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  } | string;
  message?: string;
};

async function ensureConfigLoaded() {
  await configManager.loadConfig();
}

async function buildHeaders(apiKey: string, hasBody = false): Promise<HeadersInit> {
  await ensureConfigLoaded();
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error('La aplicacion seleccionada no tiene api_key');
  }

  const headers: Record<string, string> = {};

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  headers['x-api-key'] = trimmedApiKey;

  return headers;
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as ApiResult<T> & Record<string, unknown>;

  if (!response.ok || json?.success === false || json?.error) {
    const error = json?.error;
    const message =
      typeof error === 'string'
        ? error
        : error && typeof error === 'object'
          ? String((error as { message?: string }).message || (error as { code?: string }).code || 'Request failed')
          : json?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return (json.data ?? (json as T)) as T;
}

export async function loadAutomationPrograms(apiKey: string, filters?: { kind?: string; status?: string; due?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (filters?.kind) params.set('kind', filters.kind);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.due) params.set('due', 'true');
  if (filters?.limit) params.set('limit', String(filters.limit));

  const endpoint = params.toString()
    ? `automation-programs?${params.toString()}`
    : 'automation-programs';

  const response = await fetch(buildFunctionsUrl(endpoint), {
    method: 'GET',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<{ programs: AutomationProgramRecord[]; total: number; now: string }>(response);
  return data.programs || [];
}

export async function saveAutomationProgram(apiKey: string, input: AutomationProgramInput) {
  const isUpdate = !!input.id;
  const endpoint = isUpdate ? `automation-programs/${input.id}` : 'automation-programs';
  const response = await fetch(buildFunctionsUrl(endpoint), {
    method: isUpdate ? 'PUT' : 'POST',
    headers: await buildHeaders(apiKey, true),
    body: JSON.stringify({
      application_id: input.application_id,
      name: input.name,
      kind: input.kind,
      status: input.status,
      delivery_mode: input.delivery_mode,
      channel: input.channel,
      template_name: input.template_name,
      pdf_template_name: input.pdf_template_name,
      pdf_filename_pattern: input.pdf_filename_pattern,
      recipients: input.recipients,
      shared_data: input.shared_data ?? {},
      options: input.options ?? {},
      schedule_at: input.schedule_at ?? null,
      cron_expression: input.cron_expression ?? null,
      timezone: input.timezone ?? 'America/Montevideo',
      metadata: input.metadata ?? {},
    }),
  });

  const data = await parseJson<{ program: AutomationProgramRecord }>(response);
  return data.program;
}

export async function runAutomationProgram(apiKey: string, programId: string) {
  const response = await fetch(buildFunctionsUrl(`automation-programs/${programId}/run`), {
    method: 'POST',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<{ job_id: string | null; program: AutomationProgramRecord; notify: Record<string, unknown> }>(response);
  return data;
}

export async function loadAutomationProgramQueue(
  apiKey: string,
  programId: string,
  filters?: { status?: string; limit?: number },
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));

  const endpoint = params.toString()
    ? `automation-programs/${programId}/queue?${params.toString()}`
    : `automation-programs/${programId}/queue`;

  const response = await fetch(buildFunctionsUrl(endpoint), {
    method: 'GET',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<{ program: AutomationProgramRecord; queue_items: AutomationProgramQueueItemRecord[]; total: number }>(response);
  return data;
}

export async function enqueueAutomationProgramQueue(
  apiKey: string,
  programId: string,
  input: AutomationProgramQueueInput | AutomationProgramQueueBulkInput,
) {
  const response = await fetch(buildFunctionsUrl(`automation-programs/${programId}/queue`), {
    method: 'POST',
    headers: await buildHeaders(apiKey, true),
    body: JSON.stringify(input),
  });

  const data = await parseJson<{ program: AutomationProgramRecord; queue_items: AutomationProgramQueueItemRecord[]; total: number }>(response);
  return data;
}

export async function cancelAutomationProgramQueueItem(
  apiKey: string,
  programId: string,
  queueItemId: string,
) {
  const response = await fetch(buildFunctionsUrl(`automation-programs/${programId}/queue/${queueItemId}`), {
    method: 'DELETE',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<{ queue_item: AutomationProgramQueueItemRecord }>(response);
  return data.queue_item;
}

export async function deleteAutomationProgram(apiKey: string, programId: string) {
  const response = await fetch(buildFunctionsUrl(`automation-programs/${programId}`), {
    method: 'DELETE',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<{ program: AutomationProgramRecord }>(response);
  return data.program;
}

export async function loadAutomationMonitoring(apiKey: string, limit = 20) {
  const response = await fetch(buildFunctionsUrl(`automation-monitoring?limit=${encodeURIComponent(String(limit))}`), {
    method: 'GET',
    headers: await buildHeaders(apiKey),
  });

  const data = await parseJson<AutomationMonitoringPayload>(response);
  return data;
}

export async function sendAutomationBatch(apiKey: string, input: NotifyBatchInput) {
  const response = await fetch(buildFunctionsUrl('notify'), {
    method: 'POST',
    headers: await buildHeaders(apiKey, true),
    body: JSON.stringify({
      type: input.type,
      template_name: input.template_name,
      attachment: input.attachment,
      recipients: input.recipients,
      shared_data: input.shared_data ?? {},
      options: input.options ?? {},
    }),
  });

  const data = await parseJson<{ job_id: string; status: string; total: number; message: string }>(response);
  return data;
}
