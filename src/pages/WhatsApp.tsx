import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { db } from '../lib/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { usePermissions } from '../hooks/usePermissions';
import { verifyApplicationOwnership } from '../lib/security';
import { Plus, MessageSquare, CheckCircle, XCircle, Clock, Send, Trash2, RefreshCw, AlertCircle, CreditCard as Edit, Eye, X, Loader, Smartphone } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface Application {
  id: string;
  name: string;
  api_key: string;
}

interface WhatsAppConfig {
  id: string;
  application_id: string;
  phone_number_id: string;
  waba_id: string;
  access_token: string;
  display_name: string;
  is_active: boolean;
}

interface WhatsAppTemplate {
  id: string;
  application_id: string;
  template_id: string | null;
  meta_template_name: string;
  meta_template_id: string | null;
  language_code: string;
  category: string;
  status: string;
  components: MetaComponent[];
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface MetaComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  buttons?: MetaButton[];
}

interface MetaButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

interface WhatsAppLog {
  id: string;
  wamid: string | null;
  recipient_phone: string;
  status: string;
  error_message: string | null;
  template_variables: Record<string, string>;
  external_reference_id: string | null;
  created_at: string;
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  DRAFT:    { label: 'Borrador',  cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
  PENDING:  { label: 'Pendiente', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30' },
  APPROVED: { label: 'Aprobado',  cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  PAUSED:   { label: 'Pausado',   cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
};

const LOG_STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  queued:    { label: 'En cola',    cls: 'bg-slate-500/20 text-slate-400',   icon: Clock },
  sent:      { label: 'Enviado',    cls: 'bg-blue-500/20 text-blue-400',     icon: Send },
  delivered: { label: 'Entregado',  cls: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
  read:      { label: 'Leído',      cls: 'bg-cyan-500/20 text-cyan-400',     icon: Eye },
  failed:    { label: 'Fallido',    cls: 'bg-red-500/20 text-red-400',       icon: XCircle },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const SAMPLE_BODY = 'Hola {{1}},\n\nTu reserva para {{2}} quedó confirmada.\n\nFecha: {{3}}\nHora: {{4}}\n\nGracias.';

/* ── Component ──────────────────────────────────────────────────────────── */

export const WhatsApp = () => {
  const { user } = useAuth();
  const toast = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions('statistics.jobs_whatsapp');

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [activeTab, setActiveTab] = useState<'templates' | 'logs'>('templates');

  // Template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    meta_template_name: '',
    language_code: 'es',
    category: 'UTILITY',
    body_text: SAMPLE_BODY,
    header_text: '',
    footer_text: '',
  });
  const [templateSaving, setTemplateSaving] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── Load ── */
  useEffect(() => {
    if (user) loadApplications();
  }, [user]);

  useEffect(() => {
    if (selectedApp) {
      loadConfig();
      loadTemplates();
      loadLogs();
    }
  }, [selectedApp]);

  const loadApplications = async () => {
    try {
      if (!user?.sub) return;
      const { data: prefs } = await db
        .from('user_preferences')
        .select('default_application_id')
        .eq('user_id', user.sub)
        .maybeSingle();

      const q = db.from('applications').select('id, name, api_key').order('created_at', { ascending: false });
      const { data } = await (user.tenant_id ? q.eq('tenant_id', user.tenant_id) : q.eq('user_id', user.sub));

      setApplications((data as Application[]) || []);
      const defaultId = (prefs as any)?.default_application_id;
      if (defaultId) setSelectedApp(defaultId);
      else if (data && (data as any[]).length > 0) setSelectedApp((data as any[])[0].id);
    } catch {
      // ignore
    }
  };

  const loadConfig = async () => {
    if (!selectedApp) return;
    const { data } = await db
      .from('whatsapp_configs')
      .select('*')
      .eq('application_id', selectedApp)
      .maybeSingle();
    setConfig((data as WhatsAppConfig) || null);
  };

  const loadTemplates = async () => {
    if (!selectedApp || !user?.sub) return;
    const isOwner = await verifyApplicationOwnership(selectedApp, user.sub, user.tenant_id);
    if (!isOwner) return;
    const { data } = await db
      .from('whatsapp_templates')
      .select('*')
      .eq('application_id', selectedApp)
      .order('created_at', { ascending: false });
    setTemplates((data as WhatsAppTemplate[]) || []);
  };

  const loadLogs = async () => {
    if (!selectedApp) return;
    const { data } = await db
      .from('whatsapp_logs')
      .select('*')
      .eq('application_id', selectedApp)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs((data as WhatsAppLog[]) || []);
  };

  /* ── Template helpers ── */
  const buildComponents = (): MetaComponent[] => {
    const comps: MetaComponent[] = [];
    if (templateForm.header_text.trim()) {
      comps.push({ type: 'HEADER', format: 'TEXT', text: templateForm.header_text.trim() });
    }
    comps.push({ type: 'BODY', text: templateForm.body_text.trim() });
    if (templateForm.footer_text.trim()) {
      comps.push({ type: 'FOOTER', text: templateForm.footer_text.trim() });
    }
    return comps;
  };

  const openTemplateModal = (tpl?: WhatsAppTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      const header = tpl.components.find(c => c.type === 'HEADER');
      const body = tpl.components.find(c => c.type === 'BODY');
      const footer = tpl.components.find(c => c.type === 'FOOTER');
      setTemplateForm({
        meta_template_name: tpl.meta_template_name,
        language_code: tpl.language_code,
        category: tpl.category,
        body_text: body?.text || '',
        header_text: header?.text || '',
        footer_text: footer?.text || '',
      });
    } else {
      setEditingTemplate(null);
      setTemplateForm({
        meta_template_name: '',
        language_code: 'es',
        category: 'UTILITY',
        body_text: SAMPLE_BODY,
        header_text: '',
        footer_text: '',
      });
    }
    setShowTemplateModal(true);
  };

  const saveTemplate = async () => {
    if (!selectedApp) return;
    const name = templateForm.meta_template_name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name || !templateForm.body_text.trim()) {
      toast.error('Nombre y cuerpo del template son requeridos.');
      return;
    }
    setTemplateSaving(true);
    try {
      const payload = {
        application_id: selectedApp,
        meta_template_name: name,
        language_code: templateForm.language_code,
        category: templateForm.category,
        components: buildComponents(),
        status: 'DRAFT',
        updated_at: new Date().toISOString(),
      };
      if (editingTemplate) {
        await db.from('whatsapp_templates').update(payload).eq('id', editingTemplate.id);
        toast.success('Template actualizado');
      } else {
        await db.from('whatsapp_templates').insert(payload);
        toast.success('Template creado');
      }
      setShowTemplateModal(false);
      loadTemplates();
    } catch {
      toast.error('Error al guardar el template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const submitToMeta = async (tpl: WhatsAppTemplate) => {
    if (!config) {
      toast.error('Primero configura las credenciales de WhatsApp.');
      return;
    }
    setSubmitting(tpl.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-template-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ application_id: selectedApp, template_id: tpl.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || data.detail || 'Error al enviar a Meta');
      } else {
        toast.success('Template enviado a Meta para aprobación');
        loadTemplates();
      }
    } catch {
      toast.error('Error de conexión al enviar a Meta.');
    } finally {
      setSubmitting(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    await db.from('whatsapp_templates').delete().eq('id', id);
    toast.success('Template eliminado');
    setDeleteConfirm(null);
    loadTemplates();
  };

  /* ── Extract variable count from body ── */
  const countVars = (text: string) => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  };

  /* ── Render ── */
  return (
    <Layout currentPage="whatsapp">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">WhatsApp</h1>
              <p className="text-sm text-slate-400">Templates aprobados por Meta · Cloud API</p>
            </div>
          </div>
        </div>

        {/* Config status banner */}
        {!config ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-amber-300 font-medium">Credenciales de Meta no configuradas</p>
              <p className="text-amber-400/70 text-sm mt-0.5">
                Configura las credenciales en <a href="/settings/whatsapp" className="underline">Configuración → WhatsApp Business</a>.
              </p>
            </div>
          </div>
        ) : (
          <div className={`rounded-xl p-4 flex items-center justify-between border ${config.is_active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <div>
                <p className={`text-sm font-medium ${config.is_active ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {config.is_active ? 'WhatsApp Cloud API activo' : 'WhatsApp Cloud API desactivado'}
                </p>
                {config.display_name && <p className="text-xs text-slate-500 mt-0.5">{config.display_name}</p>}
              </div>
            </div>
            <a href="/settings/whatsapp" className="text-xs text-slate-400 hover:text-white transition-colors">
              Editar configuración
            </a>
          </div>
        )}

        {/* App selector */}
        {applications.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {applications.map(app => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app.id)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${selectedApp === app.id ? 'bg-emerald-500 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
              >
                {app.name}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800/50 rounded-xl p-1 w-fit">
          {(['templates', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {tab === 'templates' ? 'Templates' : 'Logs de envío'}
            </button>
          ))}
        </div>

        {/* ── Templates tab ── */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Templates de WhatsApp</h2>
              {canCreate && (
                <button
                  onClick={() => openTemplateModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Template
                </button>
              )}
            </div>

            {templates.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center">
                <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">No hay templates de WhatsApp</p>
                <p className="text-slate-500 text-sm mb-4">Crea un Utility Template y envialo a Meta para aprobación</p>
                {canCreate && (
                  <button
                    onClick={() => openTemplateModal()}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Crear Template
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {templates.map(tpl => {
                  const badge = STATUS_BADGE[tpl.status] || STATUS_BADGE.DRAFT;
                  const body = tpl.components.find(c => c.type === 'BODY');
                  const vars = countVars(body?.text || '');
                  const canSubmit = ['DRAFT', 'REJECTED'].includes(tpl.status);
                  return (
                    <div key={tpl.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="text-white font-semibold font-mono text-sm">{tpl.meta_template_name}</h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{tpl.category}</span>
                            <span className="text-xs text-slate-500">{tpl.language_code}</span>
                          </div>
                          {body?.text && (
                            <p className="text-slate-400 text-sm whitespace-pre-line line-clamp-3 font-mono bg-slate-900/50 rounded-lg p-3 mt-2">
                              {body.text}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                            {vars > 0 && <span>{vars} variable{vars !== 1 ? 's' : ''}</span>}
                            {tpl.submitted_at && <span>Enviado: {fmtDate(tpl.submitted_at)}</span>}
                            {tpl.approved_at && <span>Aprobado: {fmtDate(tpl.approved_at)}</span>}
                            {tpl.rejection_reason && (
                              <span className="text-red-400">Motivo rechazo: {tpl.rejection_reason}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {canSubmit && config && (
                            <button
                              onClick={() => submitToMeta(tpl)}
                              disabled={submitting === tpl.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs border border-emerald-500/20 transition-colors disabled:opacity-50"
                            >
                              {submitting === tpl.id ? <Loader className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Enviar a Meta
                            </button>
                          )}
                          {canUpdate && ['DRAFT', 'REJECTED'].includes(tpl.status) && (
                            <button
                              onClick={() => openTemplateModal(tpl)}
                              className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteConfirm(tpl.id)}
                              className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Logs tab ── */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Logs de envío</h2>
              <button onClick={loadLogs} className="p-2 text-slate-400 hover:text-white transition-colors" title="Refrescar">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {logs.length === 0 ? (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-10 text-center">
                <Send className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No hay mensajes enviados todavía</p>
              </div>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Destinatario</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium">Estado</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium hidden md:table-cell">WAMID</th>
                      <th className="text-left px-4 py-3 text-slate-400 font-medium hidden lg:table-cell">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, i) => {
                      const s = LOG_STATUS_BADGE[log.status] || LOG_STATUS_BADGE.queued;
                      const Icon = s.icon;
                      return (
                        <tr key={log.id} className={`border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                          <td className="px-4 py-3 text-white font-mono">{log.recipient_phone}</td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1.5 w-fit px-2 py-0.5 rounded-full text-xs ${s.cls}`}>
                              <Icon className="w-3 h-3" />
                              {s.label}
                            </span>
                            {log.error_message && (
                              <p className="text-xs text-red-400 mt-1">{log.error_message}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-xs hidden md:table-cell">
                            {log.wamid ? log.wamid.slice(0, 20) + '…' : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{fmtDate(log.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── Template Modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">
                {editingTemplate ? 'Editar Template' : 'Nuevo Template WhatsApp'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-2 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Info banner */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
                <strong>Utility Template:</strong> Solo mensajes informativos relacionados con una acción del usuario (confirmaciones, recordatorios, facturas). Los templates deben ser aprobados por Meta antes de usarse.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1.5">Nombre del template <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={templateForm.meta_template_name}
                    onChange={e => setTemplateForm(f => ({ ...f, meta_template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                    placeholder="confirmacion_reserva"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Solo minúsculas, números y guiones bajos. Tal como aparece en Meta Business Manager.</p>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Idioma</label>
                  <select
                    value={templateForm.language_code}
                    onChange={e => setTemplateForm(f => ({ ...f, language_code: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="es">es — Español</option>
                    <option value="es_AR">es_AR — Español (Argentina)</option>
                    <option value="es_MX">es_MX — Español (México)</option>
                    <option value="en_US">en_US — English (US)</option>
                    <option value="pt_BR">pt_BR — Português (Brasil)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">Categoría</label>
                  <select
                    value={templateForm.category}
                    onChange={e => setTemplateForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UTILITY">UTILITY — Transaccional</option>
                    <option value="MARKETING">MARKETING — Promocional</option>
                    <option value="AUTHENTICATION">AUTHENTICATION — OTP / Código</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Header (opcional)</label>
                <input
                  type="text"
                  value={templateForm.header_text}
                  onChange={e => setTemplateForm(f => ({ ...f, header_text: e.target.value }))}
                  placeholder="Ej: Confirmación de reserva"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">
                  Cuerpo del mensaje <span className="text-red-400">*</span>
                  <span className="ml-2 text-slate-500 font-normal">Usa {'{{1}}'}, {'{{2}}'}, etc. para variables posicionales</span>
                </label>
                <textarea
                  value={templateForm.body_text}
                  onChange={e => setTemplateForm(f => ({ ...f, body_text: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm resize-none"
                />
                {countVars(templateForm.body_text) > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">{countVars(templateForm.body_text)} variable{countVars(templateForm.body_text) !== 1 ? 's' : ''} detectada{countVars(templateForm.body_text) !== 1 ? 's' : ''}</p>
                )}
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Footer (opcional)</label>
                <input
                  type="text"
                  value={templateForm.footer_text}
                  onChange={e => setTemplateForm(f => ({ ...f, footer_text: e.target.value }))}
                  placeholder="Ej: Gracias por confiar en nosotros"
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveTemplate}
                disabled={templateSaving}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {templateSaving ? 'Guardando…' : editingTemplate ? 'Guardar cambios' : 'Crear template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2">Eliminar template</h3>
            <p className="text-slate-400 text-sm mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors">Cancelar</button>
              <button onClick={() => deleteTemplate(deleteConfirm)} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};
