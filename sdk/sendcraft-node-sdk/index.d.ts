export type QueryValue = string | number | boolean | null | undefined;
export type QueryMap = Record<string, QueryValue>;
export type RecordMap = Record<string, unknown>;

export interface SendCraftClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface SendEmailPayload {
  recipient_email: string;
  template_name: string;
  data?: RecordMap;
  subject?: string;
  order_id?: string;
  [key: string]: unknown;
}

export interface SendEmailWithPdfPayload {
  recipient_email: string;
  email: {
    template_name: string;
    subject?: string;
    data?: RecordMap;
    [key: string]: unknown;
  };
  attachment: {
    pdf_template_name: string;
    filename?: string;
    data?: RecordMap;
    [key: string]: unknown;
  };
  order_id?: string;
  [key: string]: unknown;
}

export interface GeneratePdfPayload {
  template_id?: string;
  pdf_template_name?: string;
  data: RecordMap;
  order_id?: string;
  pending_communication_id?: string;
  [key: string]: unknown;
}

export interface AutomationBatchPayload {
  type: "email" | "email_pdf" | "pdf";
  template_name?: string;
  attachment?: {
    pdf_template_name: string;
    filename?: string;
    data?: RecordMap;
    [key: string]: unknown;
  };
  recipients: Array<{ email: string; data?: RecordMap }>;
  shared_data?: RecordMap;
  options?: RecordMap;
  [key: string]: unknown;
}

export interface AutomationProgramInput {
  id?: string;
  name: string;
  kind: "scheduled" | "batch";
  status?: "draft" | "scheduled" | "active" | "paused" | "done" | "failed" | "cancelled";
  delivery_mode?: "static" | "queued";
  channel: "email" | "email_pdf" | "pdf";
  template_name?: string | null;
  pdf_template_name?: string | null;
  pdf_filename_pattern?: string | null;
  recipients?: Array<{ email: string; data?: RecordMap }>;
  shared_data?: RecordMap;
  options?: RecordMap;
  schedule_at?: string | null;
  cron_expression?: string | null;
  timezone?: string | null;
  metadata?: RecordMap;
  [key: string]: unknown;
}

export interface AutomationProgramQueueInput {
  external_reference_id?: string | null;
  recipient_email?: string;
  recipient_data?: RecordMap;
  shared_data?: RecordMap;
  options?: RecordMap;
  available_at?: string | null;
  metadata?: RecordMap;
  [key: string]: unknown;
}

export interface ProgramQuery {
  kind?: string;
  status?: string;
  due?: boolean;
  limit?: number;
}

export interface QueueQuery {
  status?: string;
  limit?: number;
}

export interface MonitoringQuery {
  limit?: number;
}

export declare class SendCraftError extends Error {
  status: number;
  details: unknown;
  constructor(message: string, status: number, details?: unknown);
}

export declare class SendCraftClient {
  constructor(options?: SendCraftClientOptions);
  request(path: string, options?: { method?: string; headers?: Record<string, string>; body?: unknown; query?: QueryMap }): Promise<unknown>;
  sendEmail(payload: SendEmailPayload): Promise<unknown>;
  sendEmailWithPdf(payload: SendEmailWithPdfPayload): Promise<unknown>;
  generatePdf(payload: GeneratePdfPayload): Promise<unknown>;
  notify(payload: AutomationBatchPayload): Promise<unknown>;
  notifyStatus(jobId: string): Promise<unknown>;
  listPrograms(query?: ProgramQuery): Promise<unknown>;
  createProgram(payload: AutomationProgramInput): Promise<unknown>;
  updateProgram(programId: string, payload: AutomationProgramInput): Promise<unknown>;
  deleteProgram(programId: string): Promise<unknown>;
  runProgram(programId: string): Promise<unknown>;
  loadProgramQueue(programId: string, query?: QueueQuery): Promise<unknown>;
  enqueueProgramQueue(programId: string, payload: AutomationProgramQueueInput | Array<AutomationProgramQueueInput>): Promise<unknown>;
  cancelProgramQueueItem(programId: string, queueItemId: string): Promise<unknown>;
  loadMonitoring(query?: MonitoringQuery): Promise<unknown>;
}

export default SendCraftClient;