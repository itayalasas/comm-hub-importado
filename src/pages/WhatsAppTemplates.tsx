import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { db } from '../lib/db';
import { functionsFetch } from '../lib/functions';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { usePermissions } from '../hooks/usePermissions';
import { PageLoader } from '../components/PageLoader';
import { loadOwnedApplicationsWithKeys } from '../lib/applicationQueries';
import {
  Plus, MessageSquare, CheckCircle, XCircle, Clock, Send,
  Trash2, RefreshCw, AlertCircle, Eye, X, FileText, Paperclip,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */

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

interface PdfTemplate {
  id: string;
  name: string;
  description: string | null;
  pdf_filename_pattern: string | null;
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
  pdf_template_id: string | null;
  pdf_filename_pattern: string | null;
}

/* ── Helpers ────────────────────────────────────────────────────── */

const STATUS_BADGE: Record<string, { label: string; cls: string; icon: any }> = {
  DRAFT:    { label: 'Borrador',  cls: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',   icon: Clock },
  PENDING:  { label: 'Pendiente', cls: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',   icon: Clock },
  APPROVED: { label: 'Aprobado',  cls: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', icon: CheckCircle },
  REJECTED: { label: 'Rechazado', cls: 'bg-red-500/20 text-red-400 border border-red-500/30',         icon: XCircle },
  PAUSED:   { label: 'Pausado',   cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', icon: Clock },
};

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const SAMPLE_BODY = 'Hola {{1}},\n\nTu reserva para {{2}} quedó confirmada.\n\nFecha: {{3}}\nHora: {{4}}\n\nGracias.';

/* ── Component ─────────────────────────────────────────────────── */

export const WhatsAppTemplates = () => {
  const { user, isSystemAdmin } = useAuth();
  const toast = useToast();
  const { canCreate, canUpdate, canDelete } = usePermissions('templates.whatsapp');

  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Template modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    meta_template_name: '',
    language_code: 'es',
    category: 'UTILITY',
    body_text: SAMPLE_BODY,
    header_text: '',
    footer_text: '',
    pdf_template_id: null as string | null,
    pdf_filename_pattern: '',
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  // Submit to Meta
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Preview
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  /* ── Load ── */
  useEffect(() => {
    if (user) loadApplications();
  }, [user, isSystemAdmin]);

  useEffect(() => {
    if (selectedApp) {
      loadConfig();
      loadTemplates();
      loadPdfTemplates();
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

      const rows = await loadOwnedApplicationsWithKeys(user.sub, user.tenant_id, isSystemAdmin);
      setApplications(rows);
      const defaultId = (prefs as any)?.default_application_id;
      if (defaultId) setSelectedApp(defaultId);
      else if (rows.length > 0) setSelectedApp(rows[0].id);
    } catch {
      // ignore
    } finally {
      setLoading(false);
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
    if (!selectedApp) return;
    const { data } = await db
      .from('whatsapp_templates')
      .select('*')
      .eq('application_id', selectedApp)
      .order('created_at', { ascending: false });
    setTemplates((data as WhatsAppTemplate[]) || []);
  };

  const loadPdfTemplates = async () => {
    if (!selectedApp) return;
    const { data } = await db
      .from('communication_templates')
      .select('id, name, description, pdf_filename_pattern')
      .eq('application_id', selectedApp)
      .eq('template_type', 'pdf')
      .order('name', { ascending: true });
    setPdfTemplates((data as PdfTemplate[]) || []);
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

  const openModal = (tpl?: WhatsAppTemplate) => {
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
        pdf_template_id: tpl.pdf_template_id || null,
        pdf_filename_pattern: tpl.pdf_filename_pattern || '',
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
        pdf_template_id: null,
        pdf_filename_pattern: '',
      });
    }
    setShowModal(true);
  };

  const saveTemplate = async () => {
    if (!selectedApp || !templateForm.meta_template_name || !templateForm.body_text) {
      toast.error('Nombre y cuerpo del mensaje son requeridos.');
      return;
    }
    setTemplateSaving(true);
    try {
      const payload = {
        application_id: selectedApp,
        meta_template_name: templateForm.meta_template_name,
        language_code: templateForm.language_code,
        category: templateForm.category,
        components: buildComponents(),
        pdf_template_id: templateForm.pdf_template_id || null,
        pdf_filename_pattern: templateForm.pdf_template_id ? (templateForm.pdf_filename_pattern || null) : null,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        await db.from('whatsapp_templates').update(payload).eq('id', editingTemplate.id);
        toast.success('Template actualizado');
      } else {
        await db.from('whatsapp_templates').insert({ ...payload, status: 'DRAFT' });
        toast.success('Template creado');
      }
      setShowModal(false);
      loadTemplates();
    } catch {
      toast.error('Error al guardar el template.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const submitToMeta = async (tpl: WhatsAppTemplate) => {
    if (!selectedApp) return;
    setSubmitting(tpl.id);
    try {
      const app = applications.find(a => a.id === selectedApp);
      if (!app) throw new Error('Aplicación no encontrada');

      const res = await functionsFetch('whatsapp-template-submit', {
        method: 'POST',
        headers: { 'x-api-key': app.api_key },
        body: JSON.stringify({ application_id: selectedApp, template_id: tpl.id }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || 'Error al enviar a Meta');
      }

      toast.success('Template enviado a Meta para revisión');
      loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al enviar a Meta');
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

  const countVars = (text: string) => {
    const matches = text.match(/\{\{\d+\}\}/g);
    return matches ? new Set(matches).size : 0;
  };

  const selectedPdfTemplate = pdfTemplates.find(p => p.id === templateForm.pdf_template_id) || null;

  /* ── Render ── */
  if (loading) {
    return (
      <Layout currentPage="templates-whatsapp">
        <PageLoader />
      </Layout>
    );
  }

  return (
    <Layout currentPage="templates-whatsapp">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Templates — WhatsApp</h1>
          <p className="text-sm text-slate-400 mt-1">Gestiona tus templates de WhatsApp Business aprobados por Meta</p>
        </div>

        {applications.length === 0 ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 text-center">
            <p className="text-slate-400 mb-4">Primero debes crear una aplicación</p>
            <a href="/dashboard" className="inline-block px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors">
              Ir al Dashboard
            </a>
          </div>
        ) : (
          <>
            {/* App selector */}
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {applications.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelectedApp(app.id)}
                  className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                    selectedApp === app.id ? 'bg-emerald-500 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {app.name}
                </button>
              ))}
            </div>

            {/* Config warning */}
            {!config && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-amber-300 font-medium text-sm">Credenciales de Meta no configuradas</p>
                  <p className="text-amber-400/70 text-sm mt-0.5">
                    Configura las credenciales en{' '}
                    <a href="/settings" className="underline hover:text-amber-300 transition-colors">
                      Configuración → Aplicaciones
                    </a>{' '}
                    para poder enviar templates a Meta.
                  </p>
                </div>
              </div>
            )}

            {/* Templates list */}
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white">Templates de WhatsApp</h2>
                {canCreate && (
                  <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Nuevo Template
                  </button>
                )}
              </div>

              {templates.length === 0 ? (
                <div className="py-16 text-center">
                  <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400 mb-2">No hay templates de WhatsApp</p>
                  <p className="text-slate-500 text-sm mb-6">Crea un Utility Template y envialo a Meta para aprobación</p>
                  {canCreate && (
                    <button
                      onClick={() => openModal()}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
                    >
                      Crear Template
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {templates.map(tpl => {
                    const st = STATUS_BADGE[tpl.status] || STATUS_BADGE['DRAFT'];
                    const StatusIcon = st.icon;
                    const body = tpl.components.find(c => c.type === 'BODY');
                    const varCount = body ? countVars(body.text || '') : 0;
                    const linkedPdf = pdfTemplates.find(p => p.id === tpl.pdf_template_id);

                    return (
                      <div key={tpl.id} className="p-4 sm:p-5 hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-white font-semibold font-mono text-sm">{tpl.meta_template_name}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                                <StatusIcon className="w-3 h-3" />
                                {st.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/50 text-slate-400">
                                {tpl.category}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700/50 text-slate-400">
                                {tpl.language_code}
                              </span>
                              {varCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                                  {varCount} var{varCount !== 1 ? 's' : ''}
                                </span>
                              )}
                              {linkedPdf && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  <Paperclip className="w-3 h-3" />
                                  {linkedPdf.name}
                                </span>
                              )}
                            </div>
                            {body?.text && (
                              <p className="text-sm text-slate-400 line-clamp-2">{body.text}</p>
                            )}
                            {tpl.rejection_reason && (
                              <p className="text-xs text-red-400 mt-1">Rechazado: {tpl.rejection_reason}</p>
                            )}
                            <p className="text-xs text-slate-600 mt-1">{fmtDate(tpl.created_at)}</p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => setPreviewTemplate(tpl)}
                              className="p-1.5 text-slate-500 hover:text-white transition-colors rounded"
                              title="Vista previa"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canUpdate && tpl.status === 'DRAFT' && (
                              <button
                                onClick={() => openModal(tpl)}
                                className="p-1.5 text-slate-500 hover:text-cyan-400 transition-colors rounded"
                                title="Editar"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                            {config && tpl.status === 'DRAFT' && (
                              <button
                                onClick={() => submitToMeta(tpl)}
                                disabled={submitting === tpl.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                <Send className="w-3.5 h-3.5" />
                                {submitting === tpl.id ? 'Enviando…' : 'Enviar a Meta'}
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => setDeleteConfirm(tpl.id)}
                                className="p-1.5 text-slate-500 hover:text-red-400 transition-colors rounded"
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
          </>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900 z-10">
              <h2 className="text-xl font-bold text-white">
                {editingTemplate ? 'Editar Template' : 'Nuevo Template WhatsApp'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm text-blue-300">
                <strong>Utility Template:</strong> Solo mensajes informativos relacionados con una acción del usuario (confirmaciones, recordatorios, facturas). Los templates deben ser aprobados por Meta antes de usarse.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm text-slate-400 mb-1.5">
                    Nombre del template <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={templateForm.meta_template_name}
                    onChange={e => setTemplateForm(f => ({ ...f, meta_template_name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                    placeholder="confirmacion_reserva"
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">Solo minúsculas, números y guiones bajos.</p>
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
                  <span className="ml-2 text-slate-500 font-normal text-xs">Usa {'{{1}}'}, {'{{2}}'}, etc. para variables posicionales</span>
                </label>
                <textarea
                  value={templateForm.body_text}
                  onChange={e => setTemplateForm(f => ({ ...f, body_text: e.target.value }))}
                  rows={8}
                  className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm resize-none"
                />
                {countVars(templateForm.body_text) > 0 && (
                  <p className="text-xs text-emerald-400 mt-1">
                    {countVars(templateForm.body_text)} variable{countVars(templateForm.body_text) !== 1 ? 's' : ''} detectada{countVars(templateForm.body_text) !== 1 ? 's' : ''}
                  </p>
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

              {/* PDF Attachment */}
              <div className="border border-slate-700 rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/60">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-slate-300">PDF adjunto (opcional)</span>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-500">
                    Selecciona un template PDF para generarlo y enviarlo como documento adjunto en el mensaje de WhatsApp.
                  </p>
                  {pdfTemplates.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 rounded-lg px-3 py-2.5">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      No hay templates PDF en esta aplicación. Crea uno en Templates → Correo para poder adjuntarlo.
                    </div>
                  ) : (
                    <>
                      <select
                        value={templateForm.pdf_template_id || ''}
                        onChange={e => {
                          const id = e.target.value || null;
                          const found = pdfTemplates.find(p => p.id === id);
                          setTemplateForm(f => ({
                            ...f,
                            pdf_template_id: id,
                            pdf_filename_pattern: found?.pdf_filename_pattern || f.pdf_filename_pattern,
                          }));
                        }}
                        className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 text-sm"
                      >
                        <option value="">— Sin adjunto PDF —</option>
                        {pdfTemplates.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>

                      {selectedPdfTemplate && (
                        <>
                          {selectedPdfTemplate.description && (
                            <p className="text-xs text-slate-500">{selectedPdfTemplate.description}</p>
                          )}
                          <div>
                            <label className="block text-xs text-slate-400 mb-1.5">
                              Nombre del archivo PDF
                              <span className="ml-1 text-slate-600">Usa {'{{variable}}'} para valores dinámicos</span>
                            </label>
                            <input
                              type="text"
                              value={templateForm.pdf_filename_pattern}
                              onChange={e => setTemplateForm(f => ({ ...f, pdf_filename_pattern: e.target.value }))}
                              placeholder="documento_{{numero}}.pdf"
                              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono text-sm"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 pt-0 sticky bottom-0 bg-slate-900">
              <button
                onClick={() => setShowModal(false)}
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

      {/* ── Preview Modal ── */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-base font-bold text-white">Vista previa — {previewTemplate.meta_template_name}</h2>
              <button onClick={() => setPreviewTemplate(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              {/* WhatsApp bubble */}
              <div className="bg-[#1a2630] rounded-2xl rounded-bl-sm p-4 max-w-[280px] space-y-2">
                {previewTemplate.components.map((c, i) => {
                  if (c.type === 'HEADER') {
                    return <p key={i} className="text-white font-semibold text-sm">{c.text}</p>;
                  }
                  if (c.type === 'BODY') {
                    return (
                      <p key={i} className="text-slate-200 text-sm whitespace-pre-line leading-relaxed">
                        {c.text}
                      </p>
                    );
                  }
                  if (c.type === 'FOOTER') {
                    return <p key={i} className="text-slate-500 text-xs">{c.text}</p>;
                  }
                  return null;
                })}
                {previewTemplate.pdf_template_id && (
                  <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 mt-1">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-slate-300 truncate">
                      {pdfTemplates.find(p => p.id === previewTemplate.pdf_template_id)?.name || 'PDF adjunto'}
                    </span>
                  </div>
                )}
                <p className="text-slate-500 text-[10px] text-right">{fmtDate(previewTemplate.created_at)}</p>
              </div>
              {previewTemplate.rejection_reason && (
                <div className="mt-4 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs text-red-400"><strong>Razón de rechazo:</strong> {previewTemplate.rejection_reason}</p>
                </div>
              )}
            </div>
            <div className="p-4 pt-0">
              <button
                onClick={() => setPreviewTemplate(null)}
                className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm transition-colors"
              >
                Cerrar
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
