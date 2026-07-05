import type { FC } from 'react';
import {
  Activity,
  Clock,
  Eye,
  FileText,
  Mail,
  Play,
  Send,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import { MARKETPLACE_SDK_GROUPS } from './sdkTemplates';

type PublicMarketplaceGroup = (typeof MARKETPLACE_SDK_GROUPS)[number];

export type MarketplaceCategory = PublicMarketplaceGroup['category'];
export type MarketplaceEmbedIcon = 'mail' | 'pdf' | 'automation';

export interface MarketplaceEmbedActionParam {
  key: string;
  required: boolean;
}

export interface MarketplaceEmbedAction {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  params: MarketplaceEmbedActionParam[];
}

export interface MarketplaceEmbedConnector {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  icon: MarketplaceEmbedIcon;
  iconBg: string;
  iconColor: string;
  badge?: string;
  auth: {
    header: string;
    label: string;
    placeholder: string;
    hint: string;
  };
  actions: MarketplaceEmbedAction[];
  features: string[];
}

export type ApiExplorerMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type ApiExplorerFieldLocation = 'body' | 'query' | 'path' | 'header';

export interface ApiExplorerField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: unknown;
  location?: ApiExplorerFieldLocation;
}

export interface ApiExplorerResponse {
  code: number;
  label: string;
  body: Record<string, unknown>;
}

export interface ApiExplorerEndpoint {
  id: string;
  groupId: string;
  groupLabel: string;
  title: string;
  method: ApiExplorerMethod;
  path: string;
  description: string;
  authType: 'api-key' | 'none';
  fields: ApiExplorerField[];
  responses: ApiExplorerResponse[];
  icon: FC<{ className?: string }>;
}

export interface ApiExplorerGroup {
  id: string;
  label: string;
  icon: FC<{ className?: string }>;
}

export interface ApiExplorerCatalog {
  groups: ApiExplorerGroup[];
  endpoints: ApiExplorerEndpoint[];
}

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  if (!normalizedBase) return `/${normalizedPath}`;
  return `${normalizedBase}/${normalizedPath}`;
}

function field(
  name: string,
  type: string,
  required: boolean,
  description: string,
  example?: unknown,
  location?: ApiExplorerFieldLocation,
): ApiExplorerField {
  const value: ApiExplorerField = { name, type, required, description };
  if (example !== undefined) value.example = example;
  if (location) value.location = location;
  return value;
}

function response(code: number, label: string, body: Record<string, unknown>): ApiExplorerResponse {
  return { code, label, body };
}

const GROUP_STYLE_BY_ID: Record<PublicMarketplaceGroup['id'], { icon: MarketplaceEmbedIcon; iconBg: string; iconColor: string; label: string; explorerIcon: FC<{ className?: string }> }> = {
  'sendcraft-email': {
    icon: 'mail',
    iconBg: 'bg-cyan-500',
    iconColor: 'text-white',
    label: 'Email',
    explorerIcon: Mail,
  },
  'sendcraft-email-pdf': {
    icon: 'pdf',
    iconBg: 'bg-blue-500',
    iconColor: 'text-white',
    label: 'Email + PDF',
    explorerIcon: FileText,
  },
  'sendcraft-pdf': {
    icon: 'pdf',
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    label: 'PDF',
    explorerIcon: FileText,
  },
  'sendcraft-notify': {
    icon: 'automation',
    iconBg: 'bg-rose-500',
    iconColor: 'text-white',
    label: 'Notify',
    explorerIcon: Zap,
  },
  'sendcraft-programs': {
    icon: 'automation',
    iconBg: 'bg-cyan-500',
    iconColor: 'text-white',
    label: 'Programs',
    explorerIcon: Play,
  },
  'sendcraft-monitoring': {
    icon: 'automation',
    iconBg: 'bg-emerald-500',
    iconColor: 'text-white',
    label: 'Monitoring',
    explorerIcon: Activity,
  },
  'sendcraft-webhook': {
    icon: 'automation',
    iconBg: 'bg-amber-500',
    iconColor: 'text-white',
    label: 'Webhooks',
    explorerIcon: Webhook,
  },
};

const ACTION_PARAMS_BY_ID: Record<string, MarketplaceEmbedActionParam[]> = {
  send_email: [
    { key: 'template_name', required: true },
    { key: 'recipient_email', required: true },
    { key: 'data', required: false },
    { key: 'subject', required: false },
    { key: 'order_id', required: false },
  ],
  send_email_with_pdf: [
    { key: 'recipient_email', required: true },
    { key: 'email.template_name', required: true },
    { key: 'email.data', required: false },
    { key: 'attachment.pdf_template_name', required: true },
    { key: 'attachment.filename', required: false },
    { key: 'attachment.data', required: false },
    { key: 'order_id', required: false },
  ],
  generate_pdf: [
    { key: 'template_id', required: false },
    { key: 'pdf_template_name', required: false },
    { key: 'data', required: true },
    { key: 'order_id', required: false },
    { key: 'pending_communication_id', required: false },
  ],
  create_campaign: [
    { key: 'type', required: true },
    { key: 'template_name', required: false },
    { key: 'recipients', required: true },
    { key: 'shared_data', required: false },
  ],
  get_campaign_status: [
    { key: 'job_id', required: true },
  ],
  list_programs: [
    { key: 'status', required: false },
    { key: 'channel', required: false },
    { key: 'limit', required: false },
    { key: 'offset', required: false },
  ],
  create_program: [
    { key: 'name', required: true },
    { key: 'delivery_mode', required: false },
    { key: 'channel', required: true },
    { key: 'template_name', required: false },
    { key: 'pdf_template_name', required: false },
    { key: 'schedule_at', required: true },
    { key: 'cron_expression', required: false },
    { key: 'recipients', required: false },
  ],
  update_program: [
    { key: 'programId', required: true },
    { key: 'name', required: false },
    { key: 'delivery_mode', required: false },
    { key: 'channel', required: false },
    { key: 'template_name', required: false },
    { key: 'pdf_template_name', required: false },
    { key: 'schedule_at', required: false },
    { key: 'cron_expression', required: false },
    { key: 'recipients', required: false },
  ],
  delete_program: [
    { key: 'programId', required: true },
  ],
  run_program: [
    { key: 'programId', required: true },
  ],
  list_program_queue: [
    { key: 'programId', required: true },
    { key: 'status', required: false },
    { key: 'limit', required: false },
  ],
  enqueue_program_items: [
    { key: 'programId', required: true },
    { key: 'recipient_email', required: true },
    { key: 'external_reference_id', required: false },
  ],
  cancel_program_queue_item: [
    { key: 'programId', required: true },
    { key: 'queueItemId', required: true },
  ],
  get_snapshot: [
    { key: 'limit', required: false },
  ],
  track_open: [
    { key: 'log_id', required: true },
  ],
  track_click: [
    { key: 'log_id', required: true },
    { key: 'url', required: true },
  ],
};

const EXPLORER_FIELDS_BY_ID: Record<string, ApiExplorerField[]> = {
  send_email: [
    field('recipient_email', 'string', true, 'Email del destinatario', 'cliente@empresa.com'),
    field('template_name', 'string', true, 'Nombre exacto del template', 'bienvenida'),
    field('data', 'object', true, 'Variables del template para reemplazar los placeholders', { nombre: 'Juan Perez', total: '1500.00' }),
    field('subject', 'string', false, 'Asunto personalizado', 'Tu pedido fue confirmado'),
    field('order_id', 'string', false, 'Referencia externa para deduplicar el envio', 'ORD-2024-001'),
  ],
  send_email_with_pdf: [
    field('recipient_email', 'string', true, 'Email del destinatario', 'cliente@empresa.com'),
    field('order_id', 'string', false, 'Referencia externa para auditoria', 'ORD-2024-001'),
    field('email', 'object', true, 'Bloque de configuracion del email con template_name, subject y data', { template_name: 'invoice_email', subject: 'Tu factura esta lista', data: { nombre: 'Juan Perez' } }),
    field('attachment', 'object', true, 'Bloque de configuracion del PDF adjunto', { pdf_template_name: 'invoice_pdf', filename: 'factura-ORD-2024-001.pdf', data: { total: '1500.00' } }),
  ],
  generate_pdf: [
    field('template_id', 'string (UUID)', false, 'UUID del template PDF', 'd4e5f6a7-b8c9-0123-defa-234567890123'),
    field('pdf_template_name', 'string', false, 'Nombre del template PDF', 'invoice_pdf'),
    field('data', 'object', true, 'Datos para renderizar el PDF', { cliente: 'Empresa XYZ', total: '1500.00' }),
    field('order_id', 'string', false, 'Referencia externa para deduplicacion', 'ORD-2024-001'),
    field('pending_communication_id', 'string', false, 'Comunicacion pendiente a vincular con el PDF', 'b2c3d4e5-f6a7-8901-bcde-f12345678901'),
  ],
  create_campaign: [
    field('type', 'string', true, 'Tipo de campana', 'email'),
    field('template_name', 'string', false, 'Template base para el envio', 'welcome'),
    field('recipients', 'array', true, 'Lista de destinatarios o reglas de audiencia', ['cliente@empresa.com']),
    field('shared_data', 'object', false, 'Datos compartidos para todos los destinatarios', { empresa: 'Acme SA' }),
  ],
  get_campaign_status: [
    field('job_id', 'string', true, 'Identificador de la campana asincrona', 'job_123', 'path'),
  ],
  list_programs: [
    field('status', 'string', false, 'Filtra por estado de la programacion', 'active', 'query'),
    field('channel', 'string', false, 'Filtra por canal', 'email', 'query'),
    field('limit', 'number', false, 'Limite de resultados', 20, 'query'),
    field('offset', 'number', false, 'Desplazamiento para paginacion', 0, 'query'),
  ],
  create_program: [
    field('name', 'string', true, 'Nombre de la programacion', 'Cobranza mensual'),
    field('delivery_mode', 'string', false, 'Modo de envio', 'manual'),
    field('channel', 'string', true, 'Canal de la programacion', 'email'),
    field('template_name', 'string', false, 'Template de email a usar', 'payment_reminder'),
    field('pdf_template_name', 'string', false, 'Template de PDF a usar', 'invoice_pdf'),
    field('schedule_at', 'string (ISO 8601)', true, 'Fecha y hora de ejecucion', '2026-07-05T12:00:00Z'),
    field('cron_expression', 'string', false, 'Expresion cron para repeticiones', '0 9 * * 1'),
    field('recipients', 'array', false, 'Lista de destinatarios o reglas', ['cliente@empresa.com']),
  ],
  update_program: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
    field('name', 'string', false, 'Nuevo nombre de la programacion', 'Cobranza mensual'),
    field('delivery_mode', 'string', false, 'Nuevo modo de envio', 'manual'),
    field('channel', 'string', false, 'Nuevo canal', 'email'),
    field('template_name', 'string', false, 'Nuevo template de email', 'payment_reminder'),
    field('pdf_template_name', 'string', false, 'Nuevo template de PDF', 'invoice_pdf'),
    field('schedule_at', 'string (ISO 8601)', false, 'Nueva fecha de ejecucion', '2026-07-05T12:00:00Z'),
    field('cron_expression', 'string', false, 'Nueva expresion cron', '0 9 * * 1'),
    field('recipients', 'array', false, 'Nueva lista de destinatarios', ['cliente@empresa.com']),
  ],
  delete_program: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
  ],
  run_program: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
  ],
  list_program_queue: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
    field('status', 'string', false, 'Filtra por estado de la cola', 'pending', 'query'),
    field('limit', 'number', false, 'Limite de resultados', 20, 'query'),
  ],
  enqueue_program_items: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
    field('recipient_email', 'string', true, 'Email del destinatario', 'cliente@empresa.com'),
    field('external_reference_id', 'string', false, 'Referencia externa para idempotencia', 'ORD-2024-001'),
  ],
  cancel_program_queue_item: [
    field('programId', 'string', true, 'Identificador de la programacion', 'program_123', 'path'),
    field('queueItemId', 'string', true, 'Identificador del item de cola', 'queue_123', 'path'),
  ],
  get_snapshot: [
    field('limit', 'number', false, 'Limite de registros operativos a devolver', 50, 'query'),
  ],
  track_open: [
    field('log_id', 'string', true, 'Identificador del email rastreado', 'log_123', 'query'),
  ],
  track_click: [
    field('log_id', 'string', true, 'Identificador del email rastreado', 'log_123', 'query'),
    field('url', 'string', true, 'URL destino del click', 'https://example.com', 'query'),
  ],
};

const EXPLORER_RESPONSES_BY_ID: Record<string, ApiExplorerResponse[]> = {
  send_email: [
    response(200, 'Exito', {
      success: true,
      message: 'Email enviado correctamente',
      log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      resend_email_id: 're_abc123',
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'Faltan campos requeridos',
    }),
    response(401, 'No autorizado', {
      success: false,
      error: 'Invalid or missing API key',
    }),
  ],
  send_email_with_pdf: [
    response(200, 'Email enviado con PDF', {
      success: true,
      message: 'Email with PDF attachment sent successfully',
      log_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      pdf_log_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      pdf_public_url: 'https://...',
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'attachment.pdf_template_name is required',
    }),
    response(401, 'No autorizado', {
      success: false,
      error: 'Invalid or missing API key',
    }),
  ],
  generate_pdf: [
    response(200, 'PDF generado', {
      success: true,
      message: 'PDF generado correctamente',
      data: {
        pdf_id: 'e5f6a7b8-c9d0-1234-efab-345678901234',
        filename: 'factura_F-001.pdf',
        public_url: 'https://api.tu-dominio.com/view-pdf?token=abc123xyz',
      },
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'pdf_template_name or template_id is required',
    }),
    response(409, 'Duplicado prevenido', {
      success: true,
      message: 'PDF ya generado previamente',
      duplicate_prevented: true,
    }),
  ],
  create_campaign: [
    response(200, 'Cola creada', {
      success: true,
      message: 'Campana encolada',
      job_id: 'job_123',
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'Missing required fields',
    }),
    response(401, 'No autorizado', {
      success: false,
      error: 'Invalid or missing API key',
    }),
  ],
  get_campaign_status: [
    response(200, 'Estado', {
      success: true,
      job_id: 'job_123',
      status: 'running',
      processed: 120,
      total: 500,
    }),
    response(404, 'No encontrado', {
      success: false,
      error: 'Job not found',
    }),
  ],
  list_programs: [
    response(200, 'Lista de programaciones', {
      success: true,
      data: [],
      count: 0,
    }),
    response(401, 'No autorizado', {
      success: false,
      error: 'Invalid or missing API key',
    }),
  ],
  create_program: [
    response(200, 'Programacion creada', {
      success: true,
      message: 'Programacion creada correctamente',
      program_id: 'program_123',
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'Missing required fields',
    }),
  ],
  update_program: [
    response(200, 'Programacion actualizada', {
      success: true,
      message: 'Programacion actualizada correctamente',
      program_id: 'program_123',
    }),
    response(404, 'No encontrada', {
      success: false,
      error: 'Program not found',
    }),
  ],
  delete_program: [
    response(200, 'Programacion eliminada', {
      success: true,
      message: 'Programacion eliminada correctamente',
    }),
    response(404, 'No encontrada', {
      success: false,
      error: 'Program not found',
    }),
  ],
  run_program: [
    response(200, 'Programacion ejecutada', {
      success: true,
      message: 'Programacion ejecutada correctamente',
      job_id: 'job_123',
    }),
    response(404, 'No encontrada', {
      success: false,
      error: 'Program not found',
    }),
  ],
  list_program_queue: [
    response(200, 'Cola', {
      success: true,
      data: [],
      count: 0,
    }),
    response(404, 'No encontrada', {
      success: false,
      error: 'Program not found',
    }),
  ],
  enqueue_program_items: [
    response(200, 'Item encolado', {
      success: true,
      message: 'Item encolado correctamente',
      queue_item_id: 'queue_123',
    }),
    response(400, 'Solicitud invalida', {
      success: false,
      error: 'Missing required fields',
    }),
  ],
  cancel_program_queue_item: [
    response(200, 'Item cancelado', {
      success: true,
      message: 'Item cancelado correctamente',
    }),
    response(404, 'No encontrado', {
      success: false,
      error: 'Queue item not found',
    }),
  ],
  get_snapshot: [
    response(200, 'Snapshot', {
      success: true,
      data: {
        programs: 3,
        jobs: 12,
        failures: 1,
      },
    }),
  ],
  track_open: [
    response(200, 'Marcado', {
      success: true,
      message: 'Open tracked',
    }),
  ],
  track_click: [
    response(200, 'Redirigido', {
      success: true,
      message: 'Click tracked',
    }),
  ],
};

export function buildMarketplaceEmbedConnectors(baseUrl: string): MarketplaceEmbedConnector[] {
  return MARKETPLACE_SDK_GROUPS.map((group) => {
    const style = GROUP_STYLE_BY_ID[group.id];

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      category: group.category,
      icon: style.icon,
      iconBg: style.iconBg,
      iconColor: style.iconColor,
      badge: 'Oficial',
      auth: {
        header: group.auth.header,
        label: group.auth.label,
        placeholder: group.auth.placeholder,
        hint: group.auth.hint,
      },
      actions: group.actions.map((action) => ({
        id: action.id,
        name: action.name,
        method: action.method,
        endpoint: joinUrl(baseUrl, action.path),
        params: ACTION_PARAMS_BY_ID[action.id] ?? [],
      })),
      features: [...group.features],
    };
  });
}

function buildApiExplorerGroups(): ApiExplorerGroup[] {
  return MARKETPLACE_SDK_GROUPS.map((group) => ({
    id: group.id,
    label: GROUP_STYLE_BY_ID[group.id].label,
    icon: GROUP_STYLE_BY_ID[group.id].explorerIcon,
  }));
}

function buildApiExplorerEndpoints(): ApiExplorerEndpoint[] {
  return MARKETPLACE_SDK_GROUPS.flatMap((group) => {
    const groupMeta = GROUP_STYLE_BY_ID[group.id];

    return group.actions.map((action) => ({
      id: action.id,
      groupId: group.id,
      groupLabel: groupMeta.label,
      title: action.name,
      method: action.method as ApiExplorerMethod,
      path: action.path,
      description: action.description,
      authType: group.id === 'sendcraft-webhook' ? 'none' : 'api-key',
      fields: EXPLORER_FIELDS_BY_ID[action.id] ?? [],
      responses: EXPLORER_RESPONSES_BY_ID[action.id] ?? [],
      icon: ACTION_ICON_BY_ID[action.id] ?? groupMeta.explorerIcon,
    }));
  });
}

const ACTION_ICON_BY_ID: Record<string, FC<{ className?: string }>> = {
  send_email: Mail,
  send_email_with_pdf: FileText,
  generate_pdf: FileText,
  create_campaign: Zap,
  get_campaign_status: Activity,
  list_programs: Clock,
  create_program: Send,
  update_program: Send,
  delete_program: Trash2,
  run_program: Play,
  list_program_queue: Clock,
  enqueue_program_items: Send,
  cancel_program_queue_item: Trash2,
  get_snapshot: Activity,
  track_open: Eye,
  track_click: Webhook,
};

export function buildApiExplorerCatalog(): ApiExplorerCatalog {
  return {
    groups: buildApiExplorerGroups(),
    endpoints: buildApiExplorerEndpoints(),
  };
}

