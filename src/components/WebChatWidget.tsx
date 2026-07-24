import { createPortal } from 'react-dom';
import { AlertCircle, Bot, Check, Code2, Copy, FileText, Headset, Image as ImageIcon, Loader2, MessageSquare, Paperclip, Send, Sparkles, Trash2, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { getRuntimeConfig } from '../lib/config';

type WebChatConfig = {
  endpoint: string;
  getEndpoint: string;
  domain: string;
  title: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  agentColor: string;
  backgroundColor: string;
  statusText: string;
  welcomeMessage: string;
  quickReplies: string[];
  integrationHeader: string;
  integrationKey: string;
  getIntegrationHeader: string;
  getIntegrationKey: string;
  apiKey: string;
  botProxyUrl: string;
  crmUrl: string;
  aiEnabled: boolean;
  handoffEnabled: boolean;
  VITE_WIDGET_URL: string;
  VITE_WIDGET_APIKEY: string;
  variables: {
    botProxyUrl: string;
    VITE_WIDGET_URL: string;
    VITE_WIDGET_APIKEY: string;
    platform: string;
    assistantName: string;
    supportEmail: string;
    crmUrl: string;
  };
};

declare global {
  interface Window {
    CRM_WEBCHAT_CONFIG?: WebChatConfig;
  }
}

const WEBCHAT_WIDGET_SCRIPT_SRC = 'https://crmpro-38w1.bolt.host/webchat-widget.js';
const WEBCHAT_WIDGET_CONTAINER_ID = 'crm-webchat';
const WEBCHAT_WIDGET_CONFIG_API_URL = (
  import.meta.env.VITE_WEBCHAT_WIDGET_CONFIG_URL ||
  'https://api.sendcraft.net/webchat-widget-config'
).trim().replace(/\/+$/, '');
const DEFAULT_WIDGET_CRM_URL = 'https://api.sendcraft.net/webchat-widget';
const LEGACY_WIDGET_CRM_URL = 'https://satzkpynnuloncwgxeev.supabase.co/functions/v1/webchat-widget';
const HANDOFF_PENDING_NOTICE: WidgetNotice = {
  kind: 'info',
  title: 'Solicitud enviada',
  message: 'Estamos conectando tu historial con un agente. No hace falta repetir todo.',
};
function resolveWidgetConfigApiKey(): string {
  return String(
    getRuntimeConfig().apiKey ||
      import.meta.env.VITE_WEBCHAT_WIDGET_CONFIG_API_KEY ||
      '',
  ).trim();
}

function previewText(value: string, maxLength = 120): string {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function redactUrlForLog(value: string): string {
  try {
    const url = new URL(value);
    if (url.searchParams.has('api_key')) {
      url.searchParams.set('api_key', '[redacted]');
    }
    return url.toString();
  } catch {
    return value;
  }
}

function normalizeWidgetCrmUrl(value: string): string {
  const normalized = normalizeUrl(String(value || ''));
  if (!normalized) return DEFAULT_WIDGET_CRM_URL;
  if (normalized === LEGACY_WIDGET_CRM_URL) return DEFAULT_WIDGET_CRM_URL;
  return normalized;
}

function logWebchatDebug(event: string, details?: Record<string, unknown>): void {
  if (details) {
    console.info(`[WebChatWidget] ${event}`, details);
    return;
  }

  console.info(`[WebChatWidget] ${event}`);
}

function logWebchatError(event: string, error: unknown, details?: Record<string, unknown>): void {
  console.error(`[WebChatWidget] ${event}`, {
    ...(details || {}),
    error: error instanceof Error ? error.message : String(error),
  });
}

export const WEBCHAT_WIDGET_CONFIG: WebChatConfig = {
  endpoint: normalizeWidgetCrmUrl(import.meta.env.VITE_WIDGET_URL || DEFAULT_WIDGET_CRM_URL),
  getEndpoint: normalizeWidgetCrmUrl(import.meta.env.VITE_WIDGET_URL || DEFAULT_WIDGET_CRM_URL),
  domain: 'sendcraft.net',
  title: 'Asistente SendCraft',
  logoUrl: '/logo.svg',
  primaryColor: '#0D9488',
  secondaryColor: '#14B8A6',
  agentColor: '#2563EB',
  backgroundColor: '#F3F4F6',
  statusText: 'En línea',
  welcomeMessage:
    '¡Hola! Soy el asistente virtual de SendCraft. ¿Cómo puedo ayudarte con tus comunicaciones, correos o documentos PDF?',
  quickReplies: [
    '¿Qué es SendCraft?',
    '¿Cómo envío un correo?',
    '¿Cómo genero un PDF?',
    '¿Qué planes ofrecen?',
  ],
  integrationHeader: 'X-Integration-Key',
  integrationKey: 'wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b',
  getIntegrationHeader: 'X-Integration-Key',
  getIntegrationKey: 'wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b',
  apiKey: 'wc_7e4ac6fb-9202-4fdf-86bb-a3ec8c4c270b',
  botProxyUrl: 'https://api.sendcraft.net/webchat-bot-proxy',
  crmUrl: normalizeWidgetCrmUrl(import.meta.env.VITE_CRM_URL || DEFAULT_WIDGET_CRM_URL),
  aiEnabled: true,
  handoffEnabled: true,
  VITE_WIDGET_URL: 'https://api.flowbridge.site/functions/v1/api-gateway/84509071-8288-4698-b0dd-37bb6a5627a8',
  VITE_WIDGET_APIKEY: 'pub_c37d9f0c0b339da3ff57445f0a6bae41d63236e3aecb771bc0ecf0a9aeacfda2',
  variables: {
    botProxyUrl: 'https://api.sendcraft.net/webchat-bot-proxy',
    VITE_WIDGET_URL: normalizeWidgetCrmUrl(import.meta.env.VITE_WIDGET_URL || DEFAULT_WIDGET_CRM_URL),
    VITE_WIDGET_APIKEY: 'pub_c37d9f0c0b339da3ff57445f0a6bae41d63236e3aecb771bc0ecf0a9aeacfda2',
    platform: 'SendCraft',
    assistantName: 'Crafty',
    supportEmail: 'soporte@sendcraft.net',
    crmUrl: normalizeWidgetCrmUrl(import.meta.env.VITE_CRM_URL || DEFAULT_WIDGET_CRM_URL),
  },
};

function cloneWidgetConfig(config: WebChatConfig = WEBCHAT_WIDGET_CONFIG): WebChatConfig {
  return {
    ...config,
    quickReplies: [...config.quickReplies],
    variables: { ...config.variables },
  };
}

function buildWidgetSnippet(config: WebChatConfig): string {
  return [
    '<!-- Contenedor del chat -->',
    `<div id="${WEBCHAT_WIDGET_CONTAINER_ID}"></div>`,
    '',
    '<script>',
    `  window.CRM_WEBCHAT_CONFIG = ${JSON.stringify(config, null, 2)};`,
    '</script>',
    '',
    `<script src="${WEBCHAT_WIDGET_SCRIPT_SRC}" defer></script>`,
  ].join('\n');
}

function firstString(...values: Array<string | number | boolean | null | undefined>): string {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return '';
}

function firstBoolean(...values: Array<unknown>): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value;

    if (typeof value === 'number') {
      if (Number.isFinite(value)) return value !== 0;
      continue;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) continue;
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
  }

  return null;
}

function firstObject(...values: Array<unknown>): Record<string, unknown> | null {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

function repairMojibakeText(value: string): string {
  const text = String(value || '');
  if (!text) return '';
  if (!/[ÃÂâ]/.test(text)) return text;

  try {
    const bytes = Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
    const repaired = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!repaired || repaired === text) return text;

    const score = (input: string) =>
      (input.match(/[ÃÂâ]/g)?.length ?? 0) + (input.match(/�/g)?.length ?? 0);

    return score(repaired) < score(text) ? repaired : text;
  } catch {
    return text;
  }
}

function roleToSenderType(role: ChatRole): ChatSenderType {
  return role === 'user' ? 'visitor' : role;
}

function senderTypeToRole(senderType: ChatSenderType): ChatRole {
  return senderType === 'visitor' ? 'user' : senderType;
}

function resolveMessageSenderType(record: Record<string, unknown>, fallback: ChatSenderType = 'visitor'): ChatSenderType {
  const candidates = [
    record.sender_type,
    record.senderType,
    record.role,
    record.sender_id,
    record.senderId,
    record.author_type,
    record.authorType,
  ];

  for (const candidate of candidates) {
    const normalized = firstString(candidate as string | number | boolean | null | undefined).trim().toLowerCase();
    if (!normalized) continue;
    if (
      normalized === 'assistant' ||
      normalized === 'agent' ||
      normalized === 'support' ||
      normalized === 'staff' ||
      normalized === 'human'
    ) {
      return 'assistant';
    }
    if (normalized === 'system') return 'system';
    if (normalized === 'user' || normalized === 'visitor' || normalized === 'customer' || normalized === 'client') {
      return 'visitor';
    }
  }

  return fallback;
}

function normalizeUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseQuickReplies(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => repairMojibakeText(firstString(item as string | number | null | undefined)))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const parsed = value
      .split('\n')
      .map((item) => repairMojibakeText(item.trim()))
      .filter(Boolean);

    if (parsed.length > 0) return parsed;
  }

  return fallback.map((item) => repairMojibakeText(item)).filter(Boolean);
}

function normalizeSearchText(value: string): string {
  return String(repairMojibakeText(value) || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isInternalHandoffNoticeText(value: string): boolean {
  const normalizedText = normalizeSearchText(value);
  if (!normalizedText) return false;

  return [
    'solicitud manual de agente',
    'solicitud de agente pendiente',
    'el usuario solicito contacto con un agente',
    'el usuario pidio contacto con un agente',
    'el usuario pidio hablar con un agente desde el widget',
    'el usuario pidio hablar con un agente',
  ].some((phrase) => normalizedText.includes(normalizeSearchText(phrase)));
}

function senderPriority(senderType: ChatSenderType): number {
  if (senderType === 'system') return 3;
  if (senderType === 'assistant') return 2;
  return 1;
}

function getAttachmentSignature(attachments: ChatAttachment[]): string {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return '';
  }

  return attachments
    .map((attachment) => `${normalizeSearchText(attachment.name)}:${attachment.mimeType}:${attachment.size}`)
    .join('|');
}

function dedupeConversationMessages(messages: ChatMessage[]): ChatMessage[] {
  const byText = new Map<string, ChatMessage>();

  for (const message of messages) {
    const text = normalizeSearchText(message.text);
    if (!text) continue;

    const senderType = message.senderType || roleToSenderType(message.role);
    const attachmentSignature = getAttachmentSignature(message.attachments);
    const key = `${senderType}:${text}:${attachmentSignature}`;
    const current = byText.get(key);
    if (!current) {
      byText.set(key, message);
      continue;
    }

    const currentSenderType = current.senderType || roleToSenderType(current.role);
    const currentPriority = senderPriority(currentSenderType);
    const nextPriority = senderPriority(senderType);
    const currentTime = new Date(current.createdAt).getTime();
    const nextTime = new Date(message.createdAt).getTime();
    const closeEnough =
      Number.isNaN(currentTime) ||
      Number.isNaN(nextTime) ||
      Math.abs(nextTime - currentTime) <= 3 * 60 * 1000;
    const likelyDuplicate = closeEnough && text.length >= 24 && currentPriority !== nextPriority;

    if (likelyDuplicate) {
      if (nextPriority >= currentPriority) {
        byText.set(key, message);
      }
      continue;
    }

    if (nextPriority > currentPriority) {
      byText.set(key, message);
      continue;
    }

    if (nextPriority === currentPriority && (!Number.isNaN(nextTime) && (Number.isNaN(currentTime) || nextTime >= currentTime))) {
      byText.set(key, message);
    }
  }

  return Array.from(byText.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return leftTime - rightTime;
  });
}

const WEBCHAT_FAQ_ENTRIES: FaqEntry[] = [
  {
    terms: ['que es sendcraft', 'que hace sendcraft', 'sendcraft'],
    answer:
      'SendCraft es una plataforma para enviar correos, generar PDFs y automatizar comunicaciones desde una sola API, con soporte para CRM y widgets de chat.',
  },
  {
    terms: ['como envio un correo', 'enviar un correo', 'correo'],
    answer:
      'Para enviar un correo podes usar la API de emails o configurar SMTP desde tu cuenta. Si queres, te guio con el flujo de tu plan actual.',
  },
  {
    terms: ['como genero un pdf', 'generar pdf', 'pdf'],
    answer:
      'Podés generar PDFs usando plantillas HTML y la API de PDF. El flujo toma tu template, renderiza el documento y lo deja listo para enviar o descargar.',
  },
  {
    terms: ['que planes ofrecen', 'planes', 'pricing', 'precios'],
    answer:
      'Tenemos distintos planes según el volumen y las funciones activadas. Si querés, te muestro el plan más adecuado para tu caso.',
  },
  {
    terms: ['como integrar el widget', 'widget', 'chat', 'integrar'],
    answer:
      'El widget se integra con un snippet corto. Desde ahí podés personalizar colores, saludo, respuestas rápidas y la conexión con el CRM.',
  },
];

function resolveFaqAnswer(message: string): string | null {
  const normalizedMessage = normalizeSearchText(message);
  if (!normalizedMessage) return null;

  const handoffKeywords = [
    'agente',
    'humano',
    'asesor',
    'soporte',
    'persona',
    'contacto',
    'llamar',
    'conectar',
    'hablar',
  ];

  if (handoffKeywords.some((keyword) => normalizedMessage.includes(keyword))) {
    return null;
  }

  for (const entry of WEBCHAT_FAQ_ENTRIES) {
    if (entry.terms.some((term) => normalizedMessage.includes(normalizeSearchText(term)))) {
      return entry.answer;
    }
  }

  return null;
}

function extractConversationSnapshot(payload: unknown): ConversationSnapshot {
  if (!payload || typeof payload !== 'object') {
    return {
      assignedAgentName: '',
      assignedAt: '',
      status: '',
      isTaken: false,
      isClosed: false,
    };
  }

  const record = payload as Record<string, unknown>;
  const conversation = record.conversation && typeof record.conversation === 'object'
    ? record.conversation as Record<string, unknown>
    : undefined;
  const status = normalizeSearchText(
    firstString(
      conversation?.status as string | number | null | undefined,
      record.status as string | number | null | undefined,
    ),
  );
  const assignedAgentName = firstString(
    conversation?.assigned_user_name as string | number | null | undefined,
    conversation?.assignedUserName as string | number | null | undefined,
    record.assigned_user_name as string | number | null | undefined,
    record.assignedUserName as string | number | null | undefined,
  );
  const assignedAt = firstString(
    conversation?.assigned_at as string | number | null | undefined,
    conversation?.assignedAt as string | number | null | undefined,
    record.assigned_at as string | number | null | undefined,
    record.assignedAt as string | number | null | undefined,
  );

  return {
    assignedAgentName: repairMojibakeText(assignedAgentName),
    assignedAt,
    status,
    isTaken: status === 'taken' || status === 'assigned' || Boolean(firstString(conversation?.assigned_user_id as string | number | null | undefined)),
    isClosed: status === 'closed' || status === 'resolved' || Boolean(firstString(conversation?.closed_at as string | number | null | undefined)),
  };
}

function isWaitingForAgentSnapshot(snapshot: ConversationSnapshot): boolean {
  if (!snapshot) return false;

  const status = normalizeSearchText(snapshot.status);
  if (!status) return false;

  return (
    (status.includes('waiting') && status.includes('agent')) ||
    status.includes('pending agent') ||
    status.includes('awaiting agent')
  );
}

function isConversationAssignedToHuman(snapshot: ConversationSnapshot): boolean {
  if (!snapshot || snapshot.isClosed) return false;

  return Boolean(
    snapshot.assignedAgentName ||
      snapshot.isTaken ||
      snapshot.assignedAt,
  );
}

function isTimestampAtOrAfter(value: string, reference: string): boolean {
  const valueTime = new Date(value).getTime();
  const referenceTime = new Date(reference).getTime();
  if (Number.isNaN(valueTime) || Number.isNaN(referenceTime)) return false;
  return valueTime >= referenceTime;
}

function isInternalHandoffMessage(message: ChatMessage): boolean {
  const normalizedText = normalizeSearchText(message.text);
  if (!normalizedText) return false;

  const senderType = message.senderType || roleToSenderType(message.role);

  if (isInternalHandoffNoticeText(message.text)) {
    return true;
  }

  if (senderType === 'system') {
    return [
      'te estamos conectando con un agente',
      'solicitud manual de agente',
      'solicitud de agente pendiente',
      'ya recibimos tu solicitud',
      'ya te estamos conectando con un agente',
    ].some((phrase) => normalizedText.includes(normalizeSearchText(phrase)));
  }

  if (senderType === 'assistant') {
    return [
      'no tengo una respuesta precisa en este momento',
      'no quiero dejarte colgado',
      'te estamos conectando con un agente',
      'ya recibimos tu solicitud',
      'ya te estoy conectando',
    ].some((phrase) => normalizedText.includes(normalizeSearchText(phrase)));
  }

  return false;
}

function extractHandoffReply(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '';
  }

  const record = payload as Record<string, unknown>;
  return repairMojibakeText(firstString(
    record.reply as string | number | boolean | null | undefined,
    record.message as string | number | boolean | null | undefined,
    record.detail as string | number | boolean | null | undefined,
  ));
}

function extractHandoffMessage(conversationHistory: Array<Record<string, unknown>>): string {
  let fallbackText = '';

  for (let index = conversationHistory.length - 1; index >= 0; index -= 1) {
    const item = conversationHistory[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const record = item as Record<string, unknown>;
    const text = firstString(
      record.text as string | number | boolean | null | undefined,
      record.message as string | number | boolean | null | undefined,
      record.content as string | number | boolean | null | undefined,
    );
    if (!text) continue;

    const role = firstString(record.role as string | number | boolean | null | undefined).toLowerCase();
    if (role === 'user' || role === 'visitor') {
      return text;
    }

    if (!fallbackText) {
      fallbackText = text;
    }
  }

  return fallbackText;
}

function buildHandoffPayload(params: {
  reason: 'auto_fallback' | 'manual_contact';
  sessionId: string;
  conversationId: string | null;
  pageUrl: string;
  sourceDomain: string;
  identity: WidgetLookupIdentity;
  visitor: { name: string; email: string; phone?: string };
  message: string;
  assistantReply?: string;
  quickReplies: string[];
  conversationHistory: Array<Record<string, unknown>>;
  attachments: ChatAttachment[];
}): Record<string, unknown> {
  const isManualContact = params.reason === 'manual_contact';
  const handoffReason = isManualContact ? 'manual_contact' : 'auto_fallback';
  const sourceDetail = isManualContact ? 'user_clicked_contact_agent' : 'ai_no_answer';
  const resultNotes = isManualContact
    ? 'El usuario pidió hablar con un agente desde el widget.'
    : 'La IA no encontró una respuesta segura y derivó la conversación.';
  const handoffMessage = firstString(
    params.message,
    extractHandoffMessage(params.conversationHistory),
    resultNotes,
  );

  return {
    action: 'request_agent_handoff',
    reason: handoffReason,
    handoff_reason: handoffReason,
    source_channel: 'webchat',
    source_detail: sourceDetail,
    cause: isManualContact ? 'user_requested_agent' : 'ai_no_answer',
    result: 'handoff_requested',
    result_notes: resultNotes,
    status: 'waiting_agent',
    session_id: params.sessionId,
    conversation_id: params.conversationId,
    page_url: params.pageUrl,
    source_domain: params.sourceDomain,
    tenant_key: params.identity.tenantKey,
    tenant_id: params.identity.tenantId,
    subscription_id: params.identity.subscriptionId,
    scope_key: params.identity.scopeKey,
    tenant_name: params.identity.tenantName,
    subdomain: params.identity.subdomain,
    visitor: {
      name: params.visitor.name || 'Visitante',
      email: params.visitor.email || '',
      ...(params.visitor.phone ? { phone: params.visitor.phone } : {}),
    },
    message: handoffMessage,
    messages: params.conversationHistory,
    attachments: params.attachments.map(serializeChatAttachment),
    metadata: {
      trigger: handoffReason,
      source: 'widget',
      requestedAt: new Date().toISOString(),
    },
  };
}

function isManualContactRequest(text: string): boolean {
  const normalized = normalizeSearchText(text);
  if (!normalized) return false;

  return (
    normalized.includes('agente') ||
    normalized.includes('contact') ||
    normalized.includes('transfer') ||
    normalized.includes('deriv') ||
    normalized.includes('escal') ||
    normalized.includes('humano') ||
    normalized.includes('asesor') ||
    normalized.includes('representante') ||
    normalized.includes('hablar con alguien') ||
    normalized.includes('persona')
  );
}

function hasMeaningfulAssistantReply(
  messages: ChatMessage[],
  welcomeMessage: string,
  since?: string,
): boolean {
  const welcomeText = normalizeSearchText(welcomeMessage);
  const sinceTime = since ? new Date(since).getTime() : NaN;

  return messages.some((message) => {
    const senderType = message.senderType || roleToSenderType(message.role);
    if (senderType !== 'assistant') return false;
    if (!Number.isNaN(sinceTime)) {
      const messageTime = new Date(message.createdAt).getTime();
      if (Number.isNaN(messageTime) || messageTime < sinceTime) {
        return false;
      }
    }
    const normalizedText = normalizeSearchText(message.text);
    if (!normalizedText) return false;
    return normalizedText !== welcomeText;
  });
}

export const WEBCHAT_WIDGET_SNIPPET = buildWidgetSnippet(WEBCHAT_WIDGET_CONFIG);

const WEBCHAT_WIDGET_SNIPPET_PREVIEW = WEBCHAT_WIDGET_SNIPPET
  .replace(/https?:\/\/[^\s"']+/g, 'https://…')
  .replace(/pub_[A-Za-z0-9]+/g, 'pub_••••')
  .replace(/wc_[A-Za-z0-9-]+/g, 'wc_••••')
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, 'correo@…')
  .replace(/sendcraft\.net/gi, 'sendcraft.…');

const WEBCHAT_SESSION_STORAGE_KEY = 'sendcraft:webchat:session_id';

type ChatRole = 'assistant' | 'user' | 'system';

type ChatSenderType = 'assistant' | 'visitor' | 'system';

type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  base64: string;
  kind: 'image' | 'file';
};

type ChatMessage = {
  id: string;
  role: ChatRole;
  senderType: ChatSenderType;
  text: string;
  createdAt: string;
  attachments: ChatAttachment[];
};

type ConversationSnapshot = {
  assignedAgentName: string;
  assignedAt: string;
  status: string;
  isTaken: boolean;
  isClosed: boolean;
};

type WidgetNotice = {
  kind: 'info' | 'warning' | 'error';
  title: string;
  message: string;
};

type FaqEntry = {
  terms: string[];
  answer: string;
};

type WidgetLookupIdentity = {
  tenantKey: string;
  tenantId: string;
  subscriptionId: string;
  scopeKey: string;
  tenantName: string;
  subdomain: string;
};

function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readSessionId(): string {
  if (typeof window === 'undefined') return '';

  try {
    return window.localStorage.getItem(WEBCHAT_SESSION_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(WEBCHAT_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Ignore storage failures.
  }
}

function clearSessionId(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(WEBCHAT_SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

function readStoredRecord(key: string): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readNestedRecord(
  source: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null {
  if (!source) return null;

  const value = source[key];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  return value as Record<string, unknown>;
}

function readStoredVisitorProfile(): { name: string; email: string; phone: string } {
  const user = readStoredRecord('user');
  const subscription = readStoredRecord('subscription');
  const userMetadata = readNestedRecord(user, 'metadata');
  const subscriptionMetadata = readNestedRecord(subscription, 'metadata');

  return {
    name: firstString(
      user?.name as string | number | null | undefined,
      user?.full_name as string | number | null | undefined,
      user?.display_name as string | number | null | undefined,
      user?.tenant_name as string | number | null | undefined,
      userMetadata?.name as string | number | null | undefined,
      userMetadata?.full_name as string | number | null | undefined,
      userMetadata?.display_name as string | number | null | undefined,
      subscriptionMetadata?.name as string | number | null | undefined,
    ),
    email: firstString(
      user?.email as string | number | null | undefined,
      user?.mail as string | number | null | undefined,
      userMetadata?.email as string | number | null | undefined,
      subscriptionMetadata?.email as string | number | null | undefined,
    ),
    phone: firstString(
      user?.phone as string | number | null | undefined,
      user?.phone_number as string | number | null | undefined,
      userMetadata?.phone as string | number | null | undefined,
      userMetadata?.phone_number as string | number | null | undefined,
      subscriptionMetadata?.phone as string | number | null | undefined,
      subscriptionMetadata?.phone_number as string | number | null | undefined,
    ),
  };
}

function buildWidgetRequestHeaders(kind: 'get' | 'post', config: WebChatConfig = WEBCHAT_WIDGET_CONFIG): HeadersInit {
  const integrationHeader = firstString(config.integrationHeader, 'X-Integration-Key');
  const integrationKey = firstString(config.integrationKey, config.getIntegrationKey);

  return {
    Accept: 'application/json',
    ...(kind === 'post' ? { 'Content-Type': 'application/json' } : {}),
    ...(integrationHeader && integrationKey ? { [integrationHeader]: integrationKey } : {}),
  };
}

function resolveAgentActionEndpoint(config: WebChatConfig): string {
  const crmUrl = firstString(config.crmUrl, config.variables.crmUrl);
  return normalizeWidgetCrmUrl(crmUrl);
}

function resolveAssistantEndpoint(config: WebChatConfig): string {
  const botProxyUrl = firstString(config.botProxyUrl, config.variables.botProxyUrl);
  if (botProxyUrl && /^https?:\/\//i.test(botProxyUrl)) {
    return normalizeUrl(botProxyUrl);
  }

  return '';
}

function slugifySubdomain(value: string): string {
  const normalized = String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return normalized.slice(0, 63) || 'tenant';
}

function resolveWidgetLookupIdentity(): WidgetLookupIdentity {
  const user = readStoredRecord('user');
  const subscription = readStoredRecord('subscription');
  const userMetadata = readNestedRecord(user, 'metadata');
  const subscriptionMetadata = readNestedRecord(subscription, 'metadata');

  const tenantId = firstString(
    user?.tenant_id as string | number | null | undefined,
    user?.tenantId as string | number | null | undefined,
    user?.id as string | number | null | undefined,
    userMetadata?.tenant_id as string | number | null | undefined,
    userMetadata?.tenantId as string | number | null | undefined,
    subscriptionMetadata?.tenant_id as string | number | null | undefined,
    subscriptionMetadata?.tenantId as string | number | null | undefined,
  );
  const subscriptionId = firstString(
    subscription?.id as string | number | null | undefined,
    user?.subscription_id as string | number | null | undefined,
    user?.subscriptionId as string | number | null | undefined,
    subscriptionMetadata?.subscription_id as string | number | null | undefined,
    subscriptionMetadata?.subscriptionId as string | number | null | undefined,
  );
  const tenantName = firstString(
    user?.tenant_name as string | number | null | undefined,
    user?.tenantName as string | number | null | undefined,
    user?.full_name as string | number | null | undefined,
    user?.display_name as string | number | null | undefined,
    user?.name as string | number | null | undefined,
    userMetadata?.tenant_name as string | number | null | undefined,
    userMetadata?.tenantName as string | number | null | undefined,
    userMetadata?.name as string | number | null | undefined,
    subscriptionMetadata?.tenant_name as string | number | null | undefined,
    subscriptionMetadata?.tenantName as string | number | null | undefined,
    subscriptionMetadata?.name as string | number | null | undefined,
    tenantId,
    subscriptionId,
    'Widget CRM',
  );
  const subdomain = slugifySubdomain(firstString(
    user?.subdomain as string | number | null | undefined,
    user?.tenant_subdomain as string | number | null | undefined,
    userMetadata?.subdomain as string | number | null | undefined,
    subscriptionMetadata?.subdomain as string | number | null | undefined,
    tenantName,
  ));
  const tenantKey = firstString(
    user?.tenant_key as string | number | null | undefined,
    user?.tenantKey as string | number | null | undefined,
    user?.scope_key as string | number | null | undefined,
    user?.scopeKey as string | number | null | undefined,
    subscription?.tenant_key as string | number | null | undefined,
    subscription?.tenantKey as string | number | null | undefined,
    subscription?.scope_key as string | number | null | undefined,
    subscription?.scopeKey as string | number | null | undefined,
    tenantId ? `tenant:${tenantId.toLowerCase()}` : '',
    subscriptionId ? `subscription:${subscriptionId.toLowerCase()}` : '',
    tenantName ? `tenant:${slugifySubdomain(tenantName)}` : '',
    `tenant:${subdomain}`,
  );
  const scopeKey = firstString(
    user?.scope_key as string | number | null | undefined,
    user?.scopeKey as string | number | null | undefined,
    subscription?.scope_key as string | number | null | undefined,
    subscription?.scopeKey as string | number | null | undefined,
    tenantKey,
  );

  return {
    tenantKey,
    tenantId,
    subscriptionId,
    scopeKey,
    tenantName,
    subdomain,
  };
}

function appendWidgetIdentityParams(url: URL, identity: WidgetLookupIdentity): URL {
  if (identity.tenantKey) url.searchParams.set('tenant_key', identity.tenantKey);
  if (identity.scopeKey) url.searchParams.set('scope_key', identity.scopeKey);
  if (identity.tenantId) url.searchParams.set('tenant_id', identity.tenantId);
  if (identity.subscriptionId) url.searchParams.set('subscription_id', identity.subscriptionId);
  if (identity.tenantName) url.searchParams.set('tenant_name', identity.tenantName);
  if (identity.subdomain) url.searchParams.set('subdomain', identity.subdomain);
  return url;
}

function normalizeWidgetConfigRecord(
  record: Record<string, unknown>,
  fallback: WebChatConfig,
): WebChatConfig {
  const variables = firstObject(record.variables) ?? {};
  const endpoint = normalizeUrl(firstString(
    record.endpoint as string | number | null | undefined,
    record.VITE_WIDGET_URL as string | number | null | undefined,
    variables.VITE_WIDGET_URL as string | number | null | undefined,
    fallback.endpoint,
  ));
  const getEndpoint = normalizeUrl(firstString(
    record.getEndpoint as string | number | null | undefined,
    record.get_endpoint as string | number | null | undefined,
    variables.getEndpoint as string | number | null | undefined,
    variables.get_endpoint as string | number | null | undefined,
    fallback.getEndpoint,
    endpoint,
  ));
  const title = repairMojibakeText(firstString(record.title as string | number | null | undefined, fallback.title));
  const logoUrl = firstString(
    record.logoUrl as string | number | null | undefined,
    record.logo_url as string | number | null | undefined,
    fallback.logoUrl,
  );
  const primaryColor = firstString(
    record.primaryColor as string | number | null | undefined,
    record.primary_color as string | number | null | undefined,
    fallback.primaryColor,
  );
  const secondaryColor = firstString(
    record.secondaryColor as string | number | null | undefined,
    record.secondary_color as string | number | null | undefined,
    fallback.secondaryColor,
  );
  const agentColor = firstString(
    record.agentColor as string | number | null | undefined,
    record.agent_color as string | number | null | undefined,
    fallback.agentColor,
  );
  const backgroundColor = firstString(
    record.backgroundColor as string | number | null | undefined,
    record.background_color as string | number | null | undefined,
    fallback.backgroundColor,
  );
  const statusText = repairMojibakeText(firstString(
    record.statusText as string | number | null | undefined,
    record.status_text as string | number | null | undefined,
    fallback.statusText,
  ));
  const welcomeMessage = repairMojibakeText(firstString(
    record.welcomeMessage as string | number | null | undefined,
    record.welcome_message as string | number | null | undefined,
    fallback.welcomeMessage,
  ));
  const quickReplies = parseQuickReplies(
    record.quickReplies ?? record.quick_replies ?? variables.quickReplies ?? variables.quick_replies,
    fallback.quickReplies,
  );
  const integrationHeader = firstString(
    record.integrationHeader as string | number | null | undefined,
    record.integration_header as string | number | null | undefined,
    fallback.integrationHeader,
  );
  const integrationKey = firstString(
    record.integrationKey as string | number | null | undefined,
    record.integration_key as string | number | null | undefined,
    fallback.integrationKey,
  );
  const getIntegrationHeader = firstString(
    record.getIntegrationHeader as string | number | null | undefined,
    record.get_integration_header as string | number | null | undefined,
    fallback.getIntegrationHeader,
  );
  const getIntegrationKey = firstString(
    record.getIntegrationKey as string | number | null | undefined,
    record.get_integration_key as string | number | null | undefined,
    record.integrationKey as string | number | null | undefined,
    record.integration_key as string | number | null | undefined,
    fallback.getIntegrationKey,
  );
  const apiKey = firstString(
    record.apiKey as string | number | null | undefined,
    record.api_key as string | number | null | undefined,
    fallback.apiKey,
  );
  const botProxyUrl = normalizeUrl(firstString(
    record.botProxyUrl as string | number | null | undefined,
    record.bot_proxy_url as string | number | null | undefined,
    variables.botProxyUrl as string | number | null | undefined,
    fallback.botProxyUrl,
  ));
  const crmUrl = normalizeUrl(firstString(
    record.crmUrl as string | number | null | undefined,
    record.crm_url as string | number | null | undefined,
    variables.crmUrl as string | number | null | undefined,
    fallback.crmUrl,
  ));
  const normalizedCrmUrl = normalizeWidgetCrmUrl(crmUrl);
  const supportEmail = firstString(
    record.supportEmail as string | number | null | undefined,
    record.support_email as string | number | null | undefined,
    variables.supportEmail as string | number | null | undefined,
    fallback.variables.supportEmail as string | number | null | undefined,
  );
  const aiEnabled = firstBoolean(
    record.aiEnabled as boolean | string | number | null | undefined,
    record.ai_enabled as boolean | string | number | null | undefined,
    fallback.aiEnabled,
  ) ?? fallback.aiEnabled;
  const handoffEnabled = firstBoolean(
    record.handoffEnabled as boolean | string | number | null | undefined,
    record.handoff_enabled as boolean | string | number | null | undefined,
    fallback.handoffEnabled,
  ) ?? fallback.handoffEnabled;

  return {
    ...fallback,
    endpoint,
    getEndpoint,
    domain: firstString(record.domain as string | number | null | undefined, fallback.domain),
    title,
    logoUrl,
    primaryColor,
    secondaryColor,
    agentColor,
    backgroundColor,
    statusText,
    welcomeMessage,
    quickReplies,
    integrationHeader,
    integrationKey,
    getIntegrationHeader,
    getIntegrationKey,
    apiKey,
    botProxyUrl,
    crmUrl: normalizedCrmUrl,
    aiEnabled,
    handoffEnabled,
    VITE_WIDGET_URL: endpoint,
    VITE_WIDGET_APIKEY: firstString(
      record.VITE_WIDGET_APIKEY as string | number | null | undefined,
      variables.VITE_WIDGET_APIKEY as string | number | null | undefined,
      apiKey,
    ),
    variables: {
      ...fallback.variables,
      ...variables,
      botProxyUrl,
      VITE_WIDGET_URL: endpoint,
      VITE_WIDGET_APIKEY: firstString(
        record.VITE_WIDGET_APIKEY as string | number | null | undefined,
        variables.VITE_WIDGET_APIKEY as string | number | null | undefined,
        apiKey,
      ),
      platform: firstString(
        variables.platform as string | number | null | undefined,
        fallback.variables.platform as string | number | null | undefined,
      ) || fallback.variables.platform,
      assistantName: firstString(
        variables.assistantName as string | number | null | undefined,
        fallback.variables.assistantName as string | number | null | undefined,
      ) || fallback.variables.assistantName,
      supportEmail,
      crmUrl: normalizedCrmUrl,
    },
  };
}

async function loadWidgetRuntimeConfig(): Promise<WebChatConfig> {
  const fallback = cloneWidgetConfig();
  const apiKey = resolveWidgetConfigApiKey();
  if (!WEBCHAT_WIDGET_CONFIG_API_URL || !apiKey) {
    logWebchatDebug('config GET skipped', {
      endpoint: WEBCHAT_WIDGET_CONFIG_API_URL || '(missing)',
      hasApiKey: Boolean(apiKey),
    });
    return fallback;
  }

  const identity = resolveWidgetLookupIdentity();
  const url = new URL(WEBCHAT_WIDGET_CONFIG_API_URL);

  if (identity.tenantKey) url.searchParams.set('tenant_key', identity.tenantKey);
  if (identity.scopeKey) url.searchParams.set('scope_key', identity.scopeKey);
  if (identity.tenantId) url.searchParams.set('tenant_id', identity.tenantId);
  if (identity.subscriptionId) url.searchParams.set('subscription_id', identity.subscriptionId);
  if (identity.tenantName) url.searchParams.set('tenant_name', identity.tenantName);
  if (identity.subdomain) url.searchParams.set('subdomain', identity.subdomain);

  logWebchatDebug('config GET start', {
    endpoint: url.toString(),
    tenantKey: identity.tenantKey,
    scopeKey: identity.scopeKey,
    tenantId: identity.tenantId,
    subscriptionId: identity.subscriptionId,
    apiKeyLoaded: Boolean(apiKey),
  });

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
  });

  if (!response.ok) {
    logWebchatError('config GET failed', new Error(`GET ${response.status}`), {
      endpoint: url.toString(),
      status: response.status,
    });
    throw new Error(`GET ${response.status}`);
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') {
    logWebchatDebug('config GET empty payload', {
      endpoint: url.toString(),
      status: response.status,
    });
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const configRecord = firstObject(record.config, record.widget_config, record.widgetConfig) || record;
  logWebchatDebug('config GET success', {
    endpoint: url.toString(),
    status: response.status,
    hasWidgetConfig: Boolean(configRecord),
  });
  return normalizeWidgetConfigRecord(configRecord, fallback);
}

function mergeChatMessages(existing: ChatMessage[], fetched: ChatMessage[]): ChatMessage[] {
  const byKey = new Map<string, ChatMessage>();

  for (const message of [...existing, ...fetched]) {
    const text = normalizeSearchText(message.text);
    if (!text) continue;

    const senderType = message.senderType || roleToSenderType(message.role);
    const key = `${senderType}:${text}`;
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, message);
      continue;
    }

    const currentTime = new Date(current.createdAt).getTime();
    const nextTime = new Date(message.createdAt).getTime();
    if (Number.isNaN(currentTime) || Number.isNaN(nextTime) || nextTime >= currentTime) {
      byKey.set(key, message);
    }
  }

  return dedupeConversationMessages(Array.from(byKey.values()).sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
    if (Number.isNaN(leftTime)) return 1;
    if (Number.isNaN(rightTime)) return -1;
    return leftTime - rightTime;
  }));
}

async function requestAgentHandoff(
  config: WebChatConfig,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const endpoint = resolveAgentActionEndpoint(config);
  if (!endpoint) {
    logWebchatDebug('handoff POST skipped', {
      reason: 'missing_endpoint',
    });
    return null;
  }

  logWebchatDebug('handoff POST start', {
    endpoint,
    action: firstString(body.action as string | number | boolean | null | undefined),
    sessionId: firstString(body.session_id as string | number | boolean | null | undefined),
    conversationId: firstString(body.conversation_id as string | number | boolean | null | undefined),
    messagePreview: previewText(firstString(body.message as string | number | boolean | null | undefined)),
  });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(config.integrationHeader && config.integrationKey ? { [config.integrationHeader]: config.integrationKey } : {}),
      },
      body: JSON.stringify(body),
    });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    logWebchatError('handoff POST failed', new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`)), {
      endpoint,
      status: response.status,
      responsePreview: previewText(JSON.stringify(payload || {}), 180),
    });
    throw new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`));
  }

  logWebchatDebug('handoff POST success', {
    endpoint,
    status: response.status,
    conversationId: extractConversationId(payload),
    snapshotStatus: extractConversationSnapshot(payload).status,
    assignedAgentName: extractConversationSnapshot(payload).assignedAgentName,
    handoffReply: previewText(extractHandoffReply(payload)),
  });
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
}

async function requestAssistantReply(
  config: WebChatConfig,
  body: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const endpoint = resolveAssistantEndpoint(config);
  if (!endpoint) {
    logWebchatDebug('assistant POST skipped', {
      reason: 'missing_endpoint',
    });
    return null;
  }

  logWebchatDebug('assistant POST start', {
    endpoint,
    messagePreview: previewText(firstString(body.message as string | number | boolean | null | undefined)),
    sessionId: firstString(body.session_id as string | number | boolean | null | undefined),
    conversationId: firstString(body.conversation_id as string | number | boolean | null | undefined),
  });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      'x-api-key': resolveWidgetConfigApiKey(),
      ...(config.integrationHeader && config.integrationKey ? { [config.integrationHeader]: config.integrationKey } : {}),
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    logWebchatError('assistant POST failed', new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`)), {
      endpoint,
      status: response.status,
      responsePreview: previewText(JSON.stringify(payload || {}), 180),
    });
    throw new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`));
  }

  logWebchatDebug('assistant POST success', {
    endpoint,
    status: response.status,
    replyPreview: previewText(firstString(payload?.reply as string | number | boolean | null | undefined)),
    handoff: firstBoolean(payload?.handoff) ?? false,
  });
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
}

function serializeConversationHistory(messages: ChatMessage[], startIndex = 0): Array<Record<string, unknown>> {
  return messages
    .slice(Math.max(0, startIndex))
    .filter((message) => !isInternalHandoffMessage(message))
    .map((message) => ({
      role: message.role,
      sender_type: message.senderType || roleToSenderType(message.role),
      text: repairMojibakeText(message.text),
      created_at: message.createdAt,
      attachments: message.attachments.map(serializeChatAttachment),
    }));
}

function createMessage(role: ChatRole, text: string, attachments: ChatAttachment[] = []): ChatMessage {
  const senderType = roleToSenderType(role);
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    senderType,
    text: repairMojibakeText(text),
    createdAt: new Date().toISOString(),
    attachments: [...attachments],
  };
}

function extractMimeTypeFromDataUrl(value: string): string {
  const match = /^data:([^;,]+)[;,]/i.exec(String(value || '').trim());
  return match?.[1] || '';
}

function extractAttachmentBase64(value: string): string {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';

  const commaIndex = normalizedValue.indexOf(',');
  if (commaIndex >= 0) {
    return normalizedValue.slice(commaIndex + 1).trim();
  }

  return normalizedValue;
}

function buildAttachmentDataUrl(mimeType: string, base64: string): string {
  const normalizedBase64 = String(base64 || '').trim();
  if (!normalizedBase64) return '';
  if (/^data:/i.test(normalizedBase64) || /^https?:\/\//i.test(normalizedBase64)) {
    return normalizedBase64;
  }

  const normalizedMimeType = String(mimeType || '').trim() || 'application/octet-stream';
  return `data:${normalizedMimeType};base64,${normalizedBase64}`;
}

function normalizeChatAttachment(value: unknown): ChatAttachment | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const mimeType = extractMimeTypeFromDataUrl(trimmed) || 'application/octet-stream';
    const dataUrl = buildAttachmentDataUrl(mimeType, trimmed);

    return {
      id: crypto.randomUUID(),
      name: 'archivo',
      mimeType,
      size: 0,
      dataUrl,
      base64: extractAttachmentBase64(dataUrl),
      kind: mimeType.startsWith('image/') ? 'image' : 'file',
    };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const rawDataUrl = firstString(
    record.dataUrl as string | number | boolean | null | undefined,
    record.data_url as string | number | boolean | null | undefined,
    record.url as string | number | boolean | null | undefined,
    record.href as string | number | boolean | null | undefined,
  );
  const rawBase64 = firstString(
    record.base64 as string | number | boolean | null | undefined,
    record.content as string | number | boolean | null | undefined,
    record.data as string | number | boolean | null | undefined,
    record.payload as string | number | boolean | null | undefined,
  );
  const inferredMimeType = rawDataUrl.startsWith('data:')
    ? extractMimeTypeFromDataUrl(rawDataUrl)
    : '';
  const mimeType = firstString(
    record.mimeType as string | number | boolean | null | undefined,
    record.mime_type as string | number | boolean | null | undefined,
    record.contentType as string | number | boolean | null | undefined,
    record.content_type as string | number | boolean | null | undefined,
    inferredMimeType,
    'application/octet-stream',
  );
  const dataUrl = rawDataUrl
    ? rawDataUrl.startsWith('data:') || /^https?:\/\//i.test(rawDataUrl)
      ? rawDataUrl
      : buildAttachmentDataUrl(mimeType, rawDataUrl || rawBase64)
    : buildAttachmentDataUrl(mimeType, rawBase64);
  const base64 = firstString(
    rawBase64,
    extractAttachmentBase64(dataUrl),
  );
  const size = Number(firstString(
    record.size as string | number | boolean | null | undefined,
    record.bytes as string | number | boolean | null | undefined,
    record.fileSize as string | number | boolean | null | undefined,
  ));
  const name = firstString(
    record.name as string | number | boolean | null | undefined,
    record.fileName as string | number | boolean | null | undefined,
    record.filename as string | number | boolean | null | undefined,
    record.file_name as string | number | boolean | null | undefined,
    'archivo',
  );

  if (!dataUrl && !base64) {
    return null;
  }

  return {
    id: firstString(
      record.id as string | number | boolean | null | undefined,
      crypto.randomUUID(),
    ),
    name,
    mimeType,
    size: Number.isFinite(size) && size > 0 ? size : 0,
    dataUrl: dataUrl || buildAttachmentDataUrl(mimeType, base64),
    base64,
    kind: mimeType.startsWith('image/') ? 'image' : 'file',
  };
}

function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!value) return [];

  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((item) => {
    const attachment = normalizeChatAttachment(item);
    return attachment ? [attachment] : [];
  });
}

function serializeChatAttachment(attachment: ChatAttachment): Record<string, unknown> {
  return {
    id: attachment.id,
    name: attachment.name,
    fileName: attachment.name,
    mimeType: attachment.mimeType,
    mime_type: attachment.mimeType,
    size: attachment.size,
    dataUrl: attachment.dataUrl,
    data_url: attachment.dataUrl,
    base64: attachment.base64 || extractAttachmentBase64(attachment.dataUrl),
    kind: attachment.kind,
  };
}

async function readFileAsChatAttachment(file: File): Promise<ChatAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.onerror = () => {
      reject(reader.error || new Error('Failed to read attachment'));
    };
    reader.readAsDataURL(file);
  });

  const mimeType = file.type || extractMimeTypeFromDataUrl(dataUrl) || 'application/octet-stream';

  return {
    id: crypto.randomUUID(),
    name: file.name || 'archivo',
    mimeType,
    size: file.size || 0,
    dataUrl,
    base64: extractAttachmentBase64(dataUrl),
    kind: mimeType.startsWith('image/') ? 'image' : 'file',
  };
}

function isDefaultWelcomeMessage(messages: ChatMessage[], welcomeMessage: string): boolean {
  return (
    messages.length === 1 &&
    messages[0]?.senderType === 'assistant' &&
    normalizeSearchText(messages[0]?.text || '') === normalizeSearchText(welcomeMessage)
  );
}

function formatMessageTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function extractConversationId(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';

  const record = payload as Record<string, unknown>;
  const conversation = record.conversation && typeof record.conversation === 'object'
    ? record.conversation as Record<string, unknown>
    : undefined;

  return firstString(
    record.conversation_id as string | number | null | undefined,
    record.conversationId as string | number | null | undefined,
    conversation?.id as string | number | null | undefined,
    record.id as string | number | null | undefined,
  );
}

function mapConversationMessages(payload: unknown, assignedAgentName = ''): ChatMessage[] {
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  const rawMessages = Array.isArray(record.messages) ? record.messages : [];
  const normalizedAssignedAgentName = normalizeSearchText(assignedAgentName);

  return dedupeConversationMessages(rawMessages.flatMap((rawMessage, index) => {
    if (!rawMessage || typeof rawMessage !== 'object') return [];

    const message = rawMessage as Record<string, unknown>;
    const text = firstString(
      message.message as string | number | null | undefined,
      message.content as string | number | null | undefined,
      message.text as string | number | null | undefined,
    );

    if (!text) return [];

    const senderName = repairMojibakeText(firstString(
      message.sender_name as string | number | null | undefined,
      message.senderName as string | number | null | undefined,
      message.display_name as string | number | null | undefined,
      message.displayName as string | number | null | undefined,
      message.author_name as string | number | null | undefined,
      message.authorName as string | number | null | undefined,
    ));

    let senderType = isInternalHandoffNoticeText(text)
      ? 'system'
      : resolveMessageSenderType(message, 'visitor');

    if (
      senderType === 'visitor' &&
      normalizedAssignedAgentName &&
      normalizeSearchText(senderName) === normalizedAssignedAgentName
    ) {
      senderType = 'assistant';
    }

    const role: ChatRole = senderTypeToRole(senderType);
    const attachments = normalizeChatAttachments(
      message.attachments ??
        message.attachments_data ??
        message.files ??
        message.files_data,
    );

    return [
      {
        id: firstString(
          message.id as string | number | null | undefined,
          `${role}-${index}`,
        ),
        role,
        senderType,
        text: repairMojibakeText(text),
        createdAt: firstString(
          message.created_at as string | number | null | undefined,
          message.createdAt as string | number | null | undefined,
          new Date().toISOString(),
        ),
        attachments,
      },
    ];
  }));
}

function WidgetHeaderStatusEnhanced({
  config,
  loading,
  error,
  agentName,
  waitingForAgent,
  isClosed,
}: {
  config: WebChatConfig;
  loading: boolean;
  error: boolean;
  agentName: string;
  waitingForAgent: boolean;
  isClosed: boolean;
}) {
  const dotClass = error
    ? 'bg-amber-200'
    : isClosed
      ? 'bg-slate-300'
      : waitingForAgent
        ? 'bg-amber-200'
        : 'bg-emerald-300';
  const label = error
    ? 'Sin conexion'
    : isClosed
      ? 'Conversacion cerrada'
      : waitingForAgent
        ? 'Esperando agente'
        : loading
          ? 'Sincronizando'
          : agentName || config.statusText;
  const badge = error
    ? 'Error'
    : isClosed
      ? 'Cerrado'
      : waitingForAgent
        ? 'En cola'
        : agentName
          ? 'En linea'
          : '';

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="truncate">{label}</span>
      {badge ? (
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-white/80">
          {badge}
        </span>
      ) : null}
    </span>
  );
}

function WidgetNoticeBanner({
  notice,
  onDismiss,
}: {
  notice: WidgetNotice | null;
  onDismiss: () => void;
}) {
  if (!notice) {
    return null;
  }

  const palette = notice.kind === 'error'
    ? {
        container: 'border-rose-200 bg-rose-50/95 text-rose-900',
        icon: 'bg-rose-100 text-rose-700 ring-rose-200',
        button: 'text-rose-500 hover:text-rose-700 hover:bg-rose-100',
      }
    : notice.kind === 'warning'
      ? {
          container: 'border-amber-200 bg-amber-50/95 text-amber-900',
          icon: 'bg-amber-100 text-amber-700 ring-amber-200',
          button: 'text-amber-500 hover:text-amber-700 hover:bg-amber-100',
        }
      : {
          container: 'border-sky-200 bg-sky-50/95 text-sky-900',
          icon: 'bg-sky-100 text-sky-700 ring-sky-200',
          button: 'text-sky-500 hover:text-sky-700 hover:bg-sky-100',
        };

  return (
    <div className="mx-4 mt-4 overflow-hidden rounded-[22px] border shadow-sm backdrop-blur-sm">
      <div className={`flex items-start gap-3 px-4 py-3 ${palette.container}`}>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${palette.icon}`}>
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{notice.title}</p>
          <p className="mt-0.5 text-xs leading-relaxed opacity-80">{notice.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${palette.button}`}
          aria-label="Cerrar aviso"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function MessageBubbleEnhanced({
  message,
  hasHumanAgent,
  assignedAt,
}: {
  message: ChatMessage;
  hasHumanAgent: boolean;
  assignedAt: string;
}) {
  const senderType = message.senderType || roleToSenderType(message.role);
  const isUser = senderType === 'visitor';
  const isSystem = senderType === 'system';
  const isHumanAssistant = senderType === 'assistant' && (
    !assignedAt
      ? hasHumanAgent
      : isTimestampAtOrAfter(message.createdAt, assignedAt)
  );

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs text-slate-500">
          {repairMojibakeText(message.text)}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${
            isHumanAssistant
              ? 'bg-[#14b8a6]/10 text-[#0f9a98] ring-[#14b8a6]/20'
              : 'bg-slate-100 text-slate-500 ring-slate-200'
          }`}
        >
          {isHumanAssistant ? <Headset className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
      )}

      <div
        className={`max-w-[80%] rounded-3xl px-4 py-3 shadow-sm ${
          isUser
            ? 'rounded-br-md bg-[#14b8a6] text-white'
            : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{repairMojibakeText(message.text)}</p>
        <p className={`mt-1 text-[11px] ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
          {formatMessageTime(message.createdAt)}
        </p>
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
function WidgetPreviewCard() {
  const replies = WEBCHAT_WIDGET_CONFIG.quickReplies.slice(0, 4);

  return (
    <div className="rounded-[28px] border border-slate-200 bg-[#f8fafc] shadow-[0_20px_60px_rgba(15,23,42,0.12)]">
      <div className="rounded-t-[28px] bg-gradient-to-r from-[#0f9a98] to-[#18b8ad] px-4 py-3">
        <div className="flex items-center gap-3 text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">{WEBCHAT_WIDGET_CONFIG.title}</p>
            <p className="text-[11px] text-white/80">{WEBCHAT_WIDGET_CONFIG.statusText}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="max-w-[85%] rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed text-slate-700">
            {WEBCHAT_WIDGET_CONFIG.welcomeMessage}
          </p>
          <p className="mt-2 text-[11px] text-slate-400">22:01</p>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">Respuestas rápidas:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {replies.map((reply) => (
              <span
                key={reply}
                className="rounded-full border border-[#14b8a6]/25 bg-[#14b8a6]/8 px-3 py-2 text-xs text-[#0f9a98]"
              >
                {reply}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400">
            Escribe tu mensaje...
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#14b8a6] text-white">
            <Send className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function WebChatFloatingButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group fixed bottom-5 right-5 z-[125] flex h-16 w-16 items-center justify-center rounded-full bg-[#14b8a6] text-white shadow-2xl shadow-cyan-500/30 ring-1 ring-white/15 transition-all hover:-translate-y-1 hover:bg-[#0ea5a8]"
      aria-label="Abrir widget de chat"
    >
      <span className="absolute inset-0 rounded-full bg-white/10 opacity-0 blur-md transition-opacity group-hover:opacity-100" />
      <MessageSquare className="relative z-10 h-6 w-6" />
    </button>
  );
}

export function WebChatSnippetCard({ onOpenWidget }: { onOpenWidget?: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(WEBCHAT_WIDGET_SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#071428] shadow-2xl shadow-cyan-500/10">
      <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
            <Code2 className="h-3.5 w-3.5" />
            Snippet del widget
          </div>

          <h3 className="text-2xl font-bold text-white sm:text-3xl">
            Widget compacto, limpio y listo para integrar.
          </h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
            La vista previa imita la experiencia real del chat y el snippet se copia completo, pero la interfaz no muestra URLs sensibles por defecto.
          </p>

          <div className="mt-6">
            <WidgetPreviewCard />
          </div>
        </div>

        <div className="bg-white/[0.02] p-5 sm:p-6 lg:p-8">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Codigo del snippet
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Copia el snippet completo cuando lo necesites. La vista previa muestra una version redactada.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <pre className="mt-4 max-h-[26rem] overflow-auto rounded-2xl border border-white/10 bg-[#04101d] p-4 text-[11px] leading-relaxed text-slate-200">
              <code className="whitespace-pre-wrap break-words">{WEBCHAT_WIDGET_SNIPPET_PREVIEW}</code>
            </pre>

            {onOpenWidget && (
              <button
                type="button"
                onClick={onOpenWidget}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#14b8a6] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#0ea5a8] hover:shadow-lg hover:shadow-cyan-500/25"
              >
                <Sparkles className="h-4 w-4" />
                Probar widget
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WebChatWidgetPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => []);
  const [widgetConfig, setWidgetConfig] = useState<WebChatConfig>(() => cloneWidgetConfig());
  const [runtimeQuickReplies, setRuntimeQuickReplies] = useState<string[]>(() => [...WEBCHAT_WIDGET_CONFIG.quickReplies]);
  const [draft, setDraft] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [conversationSnapshot, setConversationSnapshot] = useState<ConversationSnapshot>(() => ({
    assignedAgentName: '',
    assignedAt: '',
    status: '',
    isTaken: false,
    isClosed: false,
  }));
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isSending, setIsSending] = useState(false);
  const [handoffPending, setHandoffPending] = useState(false);
  const [widgetNotice, setWidgetNotice] = useState<WidgetNotice | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef(messages);
  const historyStartIndexRef = useRef(0);
  const waitingForAgent = handoffPending || isWaitingForAgentSnapshot(conversationSnapshot);
  const hasHumanAgent = isConversationAssignedToHuman(conversationSnapshot);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!open) {
      setWidgetNotice(null);
    }
  }, [open]);

  useEffect(() => {
    if (!widgetNotice) return;

    const timeout = window.setTimeout(() => {
      setWidgetNotice(null);
    }, widgetNotice.kind === 'error' ? 5500 : 4500);

    return () => window.clearTimeout(timeout);
  }, [widgetNotice]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      try {
        const loadedConfig = await loadWidgetRuntimeConfig();
        if (cancelled) return;

        setWidgetConfig(loadedConfig);
        setRuntimeQuickReplies([...loadedConfig.quickReplies]);
        window.CRM_WEBCHAT_CONFIG = cloneWidgetConfig(loadedConfig);

        const nextSessionId = readSessionId() || createSessionId();
        setSessionId(nextSessionId);
        saveSessionId(nextSessionId);
        setStatus('loading');

        const identity = resolveWidgetLookupIdentity();
        const bootstrapUrl = appendWidgetIdentityParams(
          new URL(loadedConfig.getEndpoint),
          identity,
        );
        bootstrapUrl.searchParams.set('session_id', nextSessionId);

        const response = await fetch(bootstrapUrl.toString(), {
          headers: buildWidgetRequestHeaders('get', loadedConfig),
        });

        if (!response.ok) {
          throw new Error(`GET ${response.status}`);
        }

        const payload = await response.json().catch(() => null);
        if (cancelled || !payload) return;

        const snapshot = extractConversationSnapshot(payload);
        const fetchedMessages = mapConversationMessages(payload, snapshot.assignedAgentName);
        const nextConversationId = extractConversationId(payload);
        const nextMessages = fetchedMessages.length > 0 ? mergeChatMessages(messagesRef.current, fetchedMessages) : messagesRef.current;

        setConversationSnapshot(snapshot);
        setHandoffPending(isWaitingForAgentSnapshot(snapshot));

        if (snapshot.isClosed) {
          historyStartIndexRef.current = nextMessages.length;
          setConversationId('');
          setSessionId('');
          clearSessionId();
        } else if (nextConversationId) {
          setConversationId(nextConversationId);
        }

        const isDefaultWelcome =
          messagesRef.current.length === 1 &&
          messagesRef.current[0]?.senderType === 'assistant' &&
          normalizeSearchText(messagesRef.current[0]?.text || '') ===
            normalizeSearchText(WEBCHAT_WIDGET_CONFIG.welcomeMessage);

        if (fetchedMessages.length > 0) {
          setMessages(nextMessages);
        } else if (messagesRef.current.length === 0 || isDefaultWelcome) {
          setMessages([createMessage('assistant', loadedConfig.welcomeMessage)]);
        }

        setStatus('ready');
      } catch {
        if (cancelled) return;

        const fallbackConfig = cloneWidgetConfig();
        setWidgetConfig(fallbackConfig);
        setRuntimeQuickReplies([...fallbackConfig.quickReplies]);
        window.CRM_WEBCHAT_CONFIG = cloneWidgetConfig(fallbackConfig);
        setStatus('error');

        const isDefaultWelcome =
          messagesRef.current.length === 1 &&
          messagesRef.current[0]?.senderType === 'assistant' &&
          normalizeSearchText(messagesRef.current[0]?.text || '') ===
            normalizeSearchText(WEBCHAT_WIDGET_CONFIG.welcomeMessage);

        if (messagesRef.current.length === 0 || isDefaultWelcome) {
          setMessages([createMessage('assistant', fallbackConfig.welcomeMessage)]);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !sessionId) {
      return;
    }

    if (conversationSnapshot.isClosed) {
      return;
    }

    const shouldPoll =
      Boolean(conversationId) ||
      waitingForAgent ||
      hasHumanAgent ||
      messages.length > 1;

    if (!shouldPoll) {
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const getDelay = (): number => {
      if (waitingForAgent || hasHumanAgent) return 4000;
      if (conversationId) return 12000;
      if (messages.length > 1) return 15000;
      return 0;
    };

    const pollConversation = async () => {
      if (cancelled) return;

      try {
        await refreshConversation(sessionId, widgetConfig);
      } catch {
        // Retry on the next tick.
      }

      if (cancelled) return;

      const delay = getDelay();
      if (delay > 0) {
        timeoutId = window.setTimeout(() => {
          void pollConversation();
        }, delay);
      }
    };

    timeoutId = window.setTimeout(() => {
      void pollConversation();
    }, 1200);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    open,
    sessionId,
    conversationId,
    waitingForAgent,
    hasHumanAgent,
    messages.length,
    conversationSnapshot.isClosed,
    widgetConfig.getEndpoint,
  ]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages, open, isSending]);

  const refreshConversation = async (nextSessionId: string, activeConfig: WebChatConfig = widgetConfig) => {
    const identity = resolveWidgetLookupIdentity();
    const refreshUrl = appendWidgetIdentityParams(
      new URL(activeConfig.getEndpoint),
      identity,
    );
    refreshUrl.searchParams.set('session_id', nextSessionId);

    logWebchatDebug('conversation GET start', {
      endpoint: redactUrlForLog(refreshUrl.toString()),
      sessionId: nextSessionId,
      conversationId,
    });

    const response = await fetch(refreshUrl.toString(), {
      headers: buildWidgetRequestHeaders('get', activeConfig),
    });

    if (!response.ok) {
      logWebchatError('conversation GET failed', new Error(`GET ${response.status}`), {
        endpoint: redactUrlForLog(refreshUrl.toString()),
        status: response.status,
        sessionId: nextSessionId,
      });
      throw new Error(`GET ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    if (!payload) {
      logWebchatDebug('conversation GET empty payload', {
        endpoint: redactUrlForLog(refreshUrl.toString()),
        sessionId: nextSessionId,
      });
      return {
        fetchedMessages: [] as ChatMessage[],
        snapshot: conversationSnapshot,
        payload: null,
      };
    }

    const snapshot = extractConversationSnapshot(payload);
    const fetchedMessages = mapConversationMessages(payload, snapshot.assignedAgentName);
    const nextConversationId = extractConversationId(payload);
    const nextMessages = fetchedMessages.length > 0 ? mergeChatMessages(messagesRef.current, fetchedMessages) : messagesRef.current;

    logWebchatDebug('conversation GET success', {
      endpoint: redactUrlForLog(refreshUrl.toString()),
      sessionId: nextSessionId,
      conversationId: nextConversationId,
      status: snapshot.status,
      assignedAgentName: snapshot.assignedAgentName,
      isTaken: snapshot.isTaken,
      isClosed: snapshot.isClosed,
      fetchedMessages: fetchedMessages.length,
    });

    setConversationSnapshot(snapshot);
    setHandoffPending(isWaitingForAgentSnapshot(snapshot));

    if (snapshot.isClosed) {
      historyStartIndexRef.current = nextMessages.length;
      setConversationId('');
      setSessionId('');
      clearSessionId();
    } else if (nextConversationId) {
      setConversationId(nextConversationId);
    }

    if (fetchedMessages.length > 0) {
      setMessages(nextMessages);
    }

    return { fetchedMessages, snapshot, payload };
  };

  const sendMessage = async (rawText?: string) => {
    const text = String(rawText ?? draft).trim();
    if (!text || isSending || status === 'loading') return;

    const currentConfig = widgetConfig;
    const isClosedConversation = conversationSnapshot.isClosed;
    const nextSessionId = isClosedConversation ? createSessionId() : (sessionId || readSessionId() || createSessionId());
    if (isClosedConversation || !sessionId) {
      setSessionId(nextSessionId);
      saveSessionId(nextSessionId);
    }
    if (isClosedConversation) {
      historyStartIndexRef.current = messagesRef.current.length;
      setConversationId('');
    }

    const visitorProfile = readStoredVisitorProfile();
    const identity = resolveWidgetLookupIdentity();
    const widgetRequestUrl = appendWidgetIdentityParams(
      new URL(currentConfig.endpoint),
      identity,
    );
    const manualContactRequest = isManualContactRequest(text);
    const userMessage = createMessage('user', text);
    const conversationHistory = serializeConversationHistory([...messagesRef.current, userMessage], historyStartIndexRef.current);
    const conversationReferenceId = isClosedConversation ? null : conversationId || null;

    setMessages((prev) => [...prev, userMessage]);
    setDraft('');
    setIsSending(true);
    setStatus('loading');

    try {
      logWebchatDebug('message POST start', {
        endpoint: redactUrlForLog(widgetRequestUrl.toString()),
        sessionId: nextSessionId,
        conversationId: conversationReferenceId,
        messagePreview: previewText(text),
        tenantKey: identity.tenantKey,
        scopeKey: identity.scopeKey,
      });

      const response = await fetch(widgetRequestUrl.toString(), {
        method: 'POST',
        headers: buildWidgetRequestHeaders('post', currentConfig),
        body: JSON.stringify({
          session_id: nextSessionId,
          conversation_id: conversationReferenceId,
          message: text,
          sender_type: 'visitor',
          visitor: {
            name: visitorProfile.name || 'Visitante',
            email: visitorProfile.email || '',
            ...(visitorProfile.phone ? { phone: visitorProfile.phone } : {}),
          },
          page_url: window.location.href,
          source_domain: window.location.hostname,
          tenant_key: identity.tenantKey,
          tenant_id: identity.tenantId,
          subscription_id: identity.subscriptionId,
          scope_key: identity.scopeKey,
          tenant_name: identity.tenantName,
          subdomain: identity.subdomain,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        logWebchatError('message POST failed', new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`)), {
          endpoint: redactUrlForLog(widgetRequestUrl.toString()),
          status: response.status,
          sessionId: nextSessionId,
          conversationId: conversationReferenceId,
          responsePreview: previewText(JSON.stringify(payload || {}), 180),
        });
        throw new Error(firstString(payload?.error?.message, payload?.message, `POST ${response.status}`));
      }

      const nextConversationId = firstString(
        payload?.conversation_id,
        payload?.conversationId,
        payload?.id,
        extractConversationId(payload),
      );

      if (nextConversationId) {
        setConversationId(nextConversationId);
      }

      logWebchatDebug('message POST success', {
        endpoint: currentConfig.endpoint,
        sessionId: nextSessionId,
        conversationId: nextConversationId || conversationReferenceId,
      });

      const refreshResult = await refreshConversation(nextSessionId, currentConfig);
      if (isConversationAssignedToHuman(refreshResult.snapshot) || isWaitingForAgentSnapshot(refreshResult.snapshot)) {
        setStatus('ready');
        return;
      }

      const hasAssistantReply = hasMeaningfulAssistantReply(
        refreshResult.fetchedMessages,
        currentConfig.welcomeMessage,
        userMessage.createdAt,
      );

      if (hasAssistantReply) {
        setStatus('ready');
        return;
      }

      let assistantResponse: Record<string, unknown> | null = null;
      if (!manualContactRequest && currentConfig.aiEnabled !== false && resolveAssistantEndpoint(currentConfig)) {
        try {
          assistantResponse = await requestAssistantReply(currentConfig, {
            message: text,
            conversationHistory,
            locale: 'es-UY',
            session_id: nextSessionId,
            conversation_id: nextConversationId || conversationReferenceId,
            page_url: window.location.href,
            source_domain: window.location.hostname,
            tenant_key: identity.tenantKey,
            tenant_id: identity.tenantId,
            subscription_id: identity.subscriptionId,
            scope_key: identity.scopeKey,
            tenant_name: identity.tenantName,
            subdomain: identity.subdomain,
            visitor: {
              name: visitorProfile.name || 'Visitante',
              email: visitorProfile.email || '',
              ...(visitorProfile.phone ? { phone: visitorProfile.phone } : {}),
            },
          });
        } catch {
          assistantResponse = null;
        }
      }

      const assistantReply = firstString(
        assistantResponse?.reply as string | number | null | undefined,
      );
      const assistantHandoff = firstBoolean(
        assistantResponse?.handoff,
      ) ?? manualContactRequest;
      const assistantQuickReplies = parseQuickReplies(
        assistantResponse?.quickReplies ?? assistantResponse?.quick_replies,
        currentConfig.quickReplies,
      );
      if (assistantResponse) {
        setRuntimeQuickReplies(assistantQuickReplies);
      }
      logWebchatDebug('assistant decision', {
        sessionId: nextSessionId,
        conversationId: nextConversationId || conversationReferenceId,
        handoff: assistantHandoff,
        replyPreview: previewText(assistantReply),
      });
      const assistantMessageRecord = assistantReply
        ? {
            role: 'assistant' as const,
            text: assistantReply,
            created_at: new Date().toISOString(),
          }
        : null;
      const handoffConversationHistory = assistantMessageRecord
        ? [...conversationHistory, assistantMessageRecord]
        : conversationHistory;
      const assistantHandoffReason = manualContactRequest ? 'manual_contact' : 'auto_fallback';

      if (assistantReply && !assistantHandoff) {
        setMessages((prev) => mergeChatMessages(prev, [createMessage('assistant', assistantReply)]));
        setRuntimeQuickReplies(assistantQuickReplies);

        try {
        await fetch(widgetRequestUrl.toString(), {
          method: 'POST',
          headers: buildWidgetRequestHeaders('post', currentConfig),
          body: JSON.stringify({
            session_id: nextSessionId,
            conversation_id: nextConversationId || conversationReferenceId,
              message: assistantReply,
              sender_type: 'assistant',
              visitor: {
                name: visitorProfile.name || 'Visitante',
                email: visitorProfile.email || '',
                ...(visitorProfile.phone ? { phone: visitorProfile.phone } : {}),
              },
              page_url: window.location.href,
              source_domain: window.location.hostname,
              tenant_key: identity.tenantKey,
              tenant_id: identity.tenantId,
              subscription_id: identity.subscriptionId,
              scope_key: identity.scopeKey,
              tenant_name: identity.tenantName,
              subdomain: identity.subdomain,
              messages: conversationHistory,
            }),
          });
        } catch {
          // Ignore storage errors for assistant replies.
        }
      }

      if (assistantHandoff) {
        if (!currentConfig.handoffEnabled) {
          setWidgetNotice({
            kind: 'warning',
            title: 'Derivacion no disponible',
            message: 'La derivacion a agente no esta habilitada para este plan.',
          });
          await refreshConversation(nextSessionId, currentConfig);
          setStatus('ready');
          return;
        }

        const handoffTarget = resolveAgentActionEndpoint(currentConfig);
        if (!handoffTarget) {
          setWidgetNotice({
            kind: 'warning',
            title: 'CRM no configurado',
            message: 'Todavia no hay un CRM configurado para derivar al agente.',
          });
          setStatus('ready');
          return;
        }

        setHandoffPending(true);
        setWidgetNotice(HANDOFF_PENDING_NOTICE);
        logWebchatDebug('handoff UI state', {
          reason: assistantHandoffReason,
          sessionId: nextSessionId,
          conversationId: nextConversationId || conversationReferenceId,
          target: handoffTarget,
        });

        const handoffPayload = buildHandoffPayload({
          reason: assistantHandoffReason,
          sessionId: nextSessionId,
          conversationId: nextConversationId || conversationReferenceId || null,
          pageUrl: window.location.href,
          sourceDomain: window.location.hostname,
          identity,
          visitor: visitorProfile,
          message: extractHandoffMessage(handoffConversationHistory),
          assistantReply,
          quickReplies: assistantQuickReplies,
          conversationHistory: handoffConversationHistory,
        });

        try {
          const handoffResponse = await requestAgentHandoff(currentConfig, handoffPayload);
          const handoffConversationId = extractConversationId(handoffResponse);
          const handoffSnapshot = extractConversationSnapshot(handoffResponse);
          const handoffReply = extractHandoffReply(handoffResponse);

          if (handoffConversationId) {
            setConversationId(handoffConversationId);
          }

          setConversationSnapshot(handoffSnapshot);
          setHandoffPending(isWaitingForAgentSnapshot(handoffSnapshot));
          logWebchatDebug('handoff response applied', {
            sessionId: nextSessionId,
            conversationId: handoffConversationId || nextConversationId || conversationReferenceId,
            status: handoffSnapshot.status,
            assignedAgentName: handoffSnapshot.assignedAgentName,
            isTaken: handoffSnapshot.isTaken,
            isClosed: handoffSnapshot.isClosed,
            handoffReply: previewText(handoffReply),
          });
        } catch (error) {
          logWebchatError('handoff flow failed', error, {
            sessionId: nextSessionId,
            conversationId: nextConversationId || conversationReferenceId,
          });
          setHandoffPending(false);
          setWidgetNotice({
            kind: 'error',
            title: 'No pudimos conectar',
            message: 'No pudimos conectar con un agente en este momento. Intentalo de nuevo en unos segundos.',
          });
        }

        await refreshConversation(nextSessionId, currentConfig);
        setStatus('ready');
        return;
      }

      if (assistantReply) {
        await refreshConversation(nextSessionId, currentConfig);
        setStatus('ready');
        return;
      }

      const faqAnswer = resolveFaqAnswer(text);
      if (faqAnswer) {
        setMessages((prev) => mergeChatMessages(prev, [createMessage('assistant', faqAnswer)]));
        setRuntimeQuickReplies([...currentConfig.quickReplies]);
        await fetch(widgetRequestUrl.toString(), {
          method: 'POST',
          headers: buildWidgetRequestHeaders('post', currentConfig),
          body: JSON.stringify({
            session_id: nextSessionId,
            conversation_id: nextConversationId || conversationReferenceId,
            message: faqAnswer,
            sender_type: 'assistant',
            visitor: {
              name: visitorProfile.name || 'Visitante',
              email: visitorProfile.email || '',
              ...(visitorProfile.phone ? { phone: visitorProfile.phone } : {}),
            },
            page_url: window.location.href,
            source_domain: window.location.hostname,
            tenant_key: identity.tenantKey,
            tenant_id: identity.tenantId,
            subscription_id: identity.subscriptionId,
            scope_key: identity.scopeKey,
            tenant_name: identity.tenantName,
            subdomain: identity.subdomain,
            messages: conversationHistory,
          }),
        }).catch(() => undefined);
        setStatus('ready');
        return;
      }

      const handoffTarget = resolveAgentActionEndpoint(currentConfig);
      if (!handoffTarget) {
        setWidgetNotice({
          kind: 'warning',
          title: 'CRM no configurado',
          message: 'Todavia no hay un CRM configurado para derivar al agente.',
        });
        setStatus('ready');
        return;
      }

      if (!currentConfig.handoffEnabled) {
        setWidgetNotice({
          kind: 'warning',
          title: 'Derivacion no disponible',
          message: 'La derivacion a agente no esta habilitada para este plan.',
        });
        await refreshConversation(nextSessionId, currentConfig);
        setStatus('ready');
        return;
      }

      setHandoffPending(true);
      setWidgetNotice(HANDOFF_PENDING_NOTICE);

      const fallbackHandoffReason = isManualContactRequest(text) ? 'manual_contact' : 'auto_fallback';
      const handoffPayload = {
        action: 'request_agent_handoff',
        reason: fallbackHandoffReason,
        session_id: nextSessionId,
        conversation_id: nextConversationId || conversationReferenceId || null,
        page_url: window.location.href,
        source_domain: window.location.hostname,
        tenant_key: identity.tenantKey,
        tenant_id: identity.tenantId,
        subscription_id: identity.subscriptionId,
        scope_key: identity.scopeKey,
        tenant_name: identity.tenantName,
        subdomain: identity.subdomain,
        visitor: {
          name: visitorProfile.name || 'Visitante',
          email: visitorProfile.email || '',
          ...(visitorProfile.phone ? { phone: visitorProfile.phone } : {}),
        },
        message: text,
        assistant_reply: assistantReply || null,
        quickReplies: assistantQuickReplies,
        messages: handoffConversationHistory,
      };

      try {
        const handoffResponse = await requestAgentHandoff(currentConfig, handoffPayload);
        const handoffConversationId = extractConversationId(handoffResponse);
        const handoffSnapshot = extractConversationSnapshot(handoffResponse);

        if (handoffConversationId) {
          setConversationId(handoffConversationId);
        }

        setConversationSnapshot(handoffSnapshot);
        setHandoffPending(isWaitingForAgentSnapshot(handoffSnapshot));
      } catch {
        setHandoffPending(false);
        setWidgetNotice({
          kind: 'error',
          title: 'No pudimos conectar',
          message: 'No pudimos conectar con un agente en este momento. Intentalo de nuevo en unos segundos.',
        });
      }

      await refreshConversation(nextSessionId, currentConfig);
      setStatus('ready');
    } catch {
      setStatus('error');
      setHandoffPending(false);
      setWidgetNotice({
        kind: 'error',
        title: 'No pudimos enviar',
        message: 'No pudimos enviar tu mensaje. Intentalo de nuevo en unos segundos.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleConnectAgent = async () => {
    const currentConfig = widgetConfig;
    const identity = resolveWidgetLookupIdentity();

    if (!currentConfig.handoffEnabled) {
      setWidgetNotice({
        kind: 'warning',
        title: 'Derivacion no disponible',
        message: 'La derivacion a agente no esta habilitada para este plan.',
      });
      return;
    }

    const target = resolveAgentActionEndpoint(currentConfig);
    if (!target) {
      setWidgetNotice({
        kind: 'warning',
        title: 'CRM no configurado',
        message: 'Todavia no hay un CRM configurado para derivar al agente.',
      });
      return;
    }

    const isClosedConversation = conversationSnapshot.isClosed;
    if (!isClosedConversation && (conversationSnapshot.assignedAgentName || conversationSnapshot.isTaken)) {
      setHandoffPending(false);
      return;
    }

    const nextSessionId = isClosedConversation ? createSessionId() : (sessionId || readSessionId() || createSessionId());
    if (isClosedConversation || !sessionId) {
      setSessionId(nextSessionId);
      saveSessionId(nextSessionId);
    }
    if (isClosedConversation) {
      historyStartIndexRef.current = messagesRef.current.length;
      setConversationId('');
    }

    const visitorProfile = readStoredVisitorProfile();
    setHandoffPending(true);
    setWidgetNotice(HANDOFF_PENDING_NOTICE);
    logWebchatDebug('manual handoff UI state', {
      sessionId: nextSessionId,
      conversationId,
      target,
    });

    try {
      const handoffResponse = await requestAgentHandoff(
        currentConfig,
        buildHandoffPayload({
          reason: 'manual_contact',
          sessionId: nextSessionId,
          conversationId: conversationId || null,
          pageUrl: window.location.href,
          sourceDomain: window.location.hostname,
          identity,
          visitor: visitorProfile,
          message: extractHandoffMessage(
            serializeConversationHistory(messagesRef.current, historyStartIndexRef.current),
          ),
          quickReplies: runtimeQuickReplies.length > 0 ? runtimeQuickReplies : currentConfig.quickReplies,
          conversationHistory: serializeConversationHistory(messagesRef.current, historyStartIndexRef.current),
        }),
      );

      const handoffConversationId = extractConversationId(handoffResponse);
      const handoffSnapshot = extractConversationSnapshot(handoffResponse);
      if (handoffConversationId) {
        setConversationId(handoffConversationId);
      }

      setConversationSnapshot(handoffSnapshot);
      setHandoffPending(isWaitingForAgentSnapshot(handoffSnapshot));
      logWebchatDebug('manual handoff response applied', {
        sessionId: nextSessionId,
        conversationId: handoffConversationId || conversationId,
        status: handoffSnapshot.status,
        assignedAgentName: handoffSnapshot.assignedAgentName,
        isTaken: handoffSnapshot.isTaken,
        isClosed: handoffSnapshot.isClosed,
      });

      await refreshConversation(nextSessionId, currentConfig);
      setStatus('ready');
    } catch (error) {
      logWebchatError('manual handoff failed', error, {
        sessionId: nextSessionId,
        conversationId,
      });
      setHandoffPending(false);
      setWidgetNotice({
        kind: 'error',
        title: 'No pudimos conectar',
        message: 'No pudimos conectar con un agente en este momento. Intentalo de nuevo en unos segundos.',
      });
      setStatus('ready');
    }
  };

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const activeHumanAgent = hasHumanAgent && !conversationSnapshot.isClosed;
  const agentLabel = conversationSnapshot.isClosed ? '' : conversationSnapshot.assignedAgentName || (hasHumanAgent ? 'un agente' : '');
  const visibleMessages = messages.filter((message) => !isInternalHandoffMessage(message));

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-end p-3 pointer-events-none sm:p-6">
      <div className="pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-[30px] border border-slate-200 bg-[#f8fafc] shadow-[0_30px_100px_rgba(15,23,42,0.32)]">
        <div className="flex items-start justify-between bg-gradient-to-r from-[#0f9a98] to-[#18b8ad] px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/15">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{widgetConfig.title}</p>
              <div className="mt-1">
                <WidgetHeaderStatusEnhanced
                  config={widgetConfig}
                  loading={status === 'loading'}
                  error={status === 'error'}
                  agentName={agentLabel}
                  waitingForAgent={waitingForAgent}
                  isClosed={conversationSnapshot.isClosed}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 text-white/90 transition-colors hover:bg-white/25 hover:text-white"
            aria-label="Cerrar widget"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <WidgetNoticeBanner
          notice={widgetNotice}
          onDismiss={() => setWidgetNotice(null)}
        />

        <div ref={scrollRef} className="max-h-[420px] space-y-4 overflow-y-auto px-4 py-4">
          {visibleMessages.map((message) => (
            <MessageBubbleEnhanced
              key={message.id}
              message={message}
              hasHumanAgent={hasHumanAgent}
              assignedAt={conversationSnapshot.assignedAt}
            />
          ))}

          {isSending && (
            <div className="flex items-end gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ring-1 ${
                  waitingForAgent || activeHumanAgent
                    ? 'bg-[#14b8a6]/10 text-[#0f9a98] ring-[#14b8a6]/20'
                    : 'bg-slate-100 text-slate-500 ring-slate-200'
                }`}
              >
                {waitingForAgent || activeHumanAgent ? <Headset className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className="rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.2s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.1s]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <div className="mb-3">
            <p className="text-xs font-medium text-slate-500">Respuestas rápidas:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {runtimeQuickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => void sendMessage(reply)}
                  disabled={status === 'loading' || isSending}
                  className="rounded-full border border-[#14b8a6]/25 bg-[#14b8a6]/8 px-3 py-2 text-xs text-[#0f9a98] transition-colors hover:bg-[#14b8a6]/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <button
              type="button"
              onClick={() => void handleConnectAgent()}
              disabled={!widgetConfig.handoffEnabled || isSending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-[#14b8a6]/30 hover:text-[#0f9a98] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Conectar con un agente"
              title="Conectar con un agente"
            >
              <Headset className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Escribe tu mensaje..."
              disabled={status === 'loading'}
              className="h-11 flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 disabled:cursor-not-allowed disabled:bg-slate-50"
            />

            <button
              type="submit"
              disabled={isSending || status === 'loading' || !draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#14b8a6] text-white shadow-lg shadow-cyan-500/25 transition-colors hover:bg-[#0ea5a8] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Enviar mensaje"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}



