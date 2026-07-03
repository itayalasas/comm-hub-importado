
type Channel = "email" | "email_pdf" | "pdf";

export interface AutomationNotifyRecipient {
  email: string;
  data?: Record<string, unknown>;
}

export interface AutomationNotifySource {
  channel: Channel;
  template_name: string | null;
  pdf_template_name: string | null;
  pdf_filename_pattern: string | null;
  recipients: AutomationNotifyRecipient[];
  shared_data: Record<string, unknown>;
  options: Record<string, unknown>;
}

export interface AutomationNotifyOverrides {
  recipients?: AutomationNotifyRecipient[];
  recipient_email?: string;
  recipient_data?: Record<string, unknown>;
  shared_data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  template_name?: string | null;
  pdf_template_name?: string | null;
  pdf_filename_pattern?: string | null;
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveRecipients(
  source: AutomationNotifySource,
  overrides: AutomationNotifyOverrides,
): AutomationNotifyRecipient[] {
  if (Array.isArray(overrides.recipients)) {
    return overrides.recipients;
  }

  if (overrides.recipient_email) {
    const data = normalizeObject(overrides.recipient_data);
    return Object.keys(data).length > 0
      ? [{ email: overrides.recipient_email, data }]
      : [{ email: overrides.recipient_email }];
  }

  return source.recipients;
}

export function buildAutomationNotifyPayload(
  source: AutomationNotifySource,
  overrides: AutomationNotifyOverrides = {},
): Record<string, unknown> {
  const recipients = resolveRecipients(source, overrides);

  const payload: Record<string, unknown> = {
    type: source.channel,
    recipients,
    shared_data: {
      ...(source.shared_data ?? {}),
      ...normalizeObject(overrides.shared_data),
    },
    options: {
      ...(source.options ?? {}),
      ...normalizeObject(overrides.options),
    },
  };

  const templateName = overrides.template_name ?? source.template_name;
  const pdfTemplateName = overrides.pdf_template_name ?? source.pdf_template_name;
  const pdfFilenamePattern = overrides.pdf_filename_pattern ?? source.pdf_filename_pattern;

  if (source.channel === "email" || source.channel === "email_pdf") {
    payload.template_name = templateName;
  }

  if (source.channel === "email_pdf" || source.channel === "pdf") {
    payload.attachment = {
      pdf_template_name: pdfTemplateName,
      filename: pdfFilenamePattern ?? undefined,
    };
  }

  return payload;
}

