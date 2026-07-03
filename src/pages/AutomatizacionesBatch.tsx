import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../components/Layout';
import { PageLoader } from '../components/PageLoader';
import { AutomationPageHeader } from '../components/AutomationPageHeader';
import { useApplicationPicker } from '../hooks/useApplicationPicker';
import { useToast } from '../components/Toast';
import {
  AutomationProgramRecord,
  deleteAutomationProgram,
  loadAutomationPrograms,
  saveAutomationProgram,
  sendAutomationBatch,
} from '../lib/automationApi';
import { CheckCircle2, Loader2, Play, Plus, RefreshCw, Trash2, PencilLine, SquarePen, Send, Clock } from 'lucide-react';

type BatchFormState = {
  name: string;
  channel: 'email' | 'email_pdf' | 'pdf';
  template_name: string;
  pdf_template_name: string;
  pdf_filename_pattern: string;
  recipients: string;
  shared_data: string;
  options: string;
};

const emptyForm = (): BatchFormState => ({
  name: '',
  channel: 'email_pdf',
  template_name: 'welcome',
  pdf_template_name: 'factura_pdf',
  pdf_filename_pattern: 'documento-{{order_id}}.pdf',
  recipients: '[\n  {\n    "email": "cliente@ejemplo.com",\n    "data": {\n      "nombre": "Juan"\n    }\n  }\n]',
  shared_data: '{\n  "empresa": "Acme SA"\n}',
  options: '{\n  "concurrency": 5,\n  "stop_on_error": false,\n  "batch_delay_ms": 5000,\n  "max_retries": 5,\n  "retry_delay_ms": 5000\n}',
});

function parseJson<T>(value: string, fallback: T): T {
  if (!value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-UY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const BatchCard = ({
  program,
  onUse,
  onEdit,
  onDelete,
  running,
}: {
  program: AutomationProgramRecord;
  onUse: (program: AutomationProgramRecord) => void;
  onEdit: (program: AutomationProgramRecord) => void;
  onDelete: (program: AutomationProgramRecord) => void;
  running: boolean;
}) => (
  <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-white">{program.name}</h3>
          <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {program.channel}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {program.recipients_count ?? program.recipients.length} destinatarios · {formatDate(program.updated_at)}
        </p>
      </div>
      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
        {program.status}
      </span>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <button
        onClick={() => onUse(program)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-400"
      >
        <Play className="h-3.5 w-3.5" />
        Enviar ahora
      </button>
      <button
        onClick={() => onEdit(program)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
      >
        <PencilLine className="h-3.5 w-3.5" />
        Editar
      </button>
      <button
        onClick={() => onDelete(program)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/20"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Cancelar
      </button>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Ejecuciones</p>
        <p className="mt-1 font-semibold text-white">{program.run_count ?? 0}</p>
      </div>
      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Ultimo job</p>
        <p className="mt-1 truncate font-semibold text-white">{program.last_job_id || 'Sin job'}</p>
      </div>
      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Ultima ejecucion</p>
        <p className="mt-1 font-semibold text-white">{formatDate(program.last_run_at)}</p>
      </div>
      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Error</p>
        <p className="mt-1 truncate font-semibold text-white">{program.last_error || 'Ninguno'}</p>
      </div>
    </div>

    {running && (
      <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
        Procesando...
      </div>
    )}
  </div>
);

export const AutomatizacionesBatch = () => {
  const toast = useToast();
  const { applications, selectedApp, setSelectedApp, selectedApplication, loading } = useApplicationPicker();
  const [programs, setPrograms] = useState<AutomationProgramRecord[]>([]);
  const [form, setForm] = useState<BatchFormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [sending, setSending] = useState(false);
  const [deletingProgramId, setDeletingProgramId] = useState<string | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);

  const selectedApplicationLabel = useMemo(() => selectedApplication?.name || 'Selecciona una aplicacion', [selectedApplication]);
  const selectedApplicationApiKey = selectedApplication?.api_key?.trim() || '';

  const requireApplicationApiKey = () => {
    if (!selectedApplication) {
      throw new Error('Selecciona una aplicacion primero');
    }

    if (!selectedApplicationApiKey) {
      throw new Error('La aplicacion seleccionada no tiene api_key');
    }

    return selectedApplicationApiKey;
  };

  const refreshPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const apiKey = requireApplicationApiKey();
      const data = await loadAutomationPrograms(apiKey, { kind: 'batch' });
      setPrograms(data.filter((program) => program.status !== 'cancelled'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el listado');
    } finally {
      setLoadingPrograms(false);
    }
  };

  useEffect(() => {
    if (selectedApplicationApiKey) {
      void refreshPrograms();
    } else {
      setPrograms([]);
    }
    setEditingId(null);
    setForm(emptyForm());
    setLastJobId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApp, selectedApplicationApiKey]);

  const populateForm = (program: AutomationProgramRecord) => {
    setEditingId(program.id);
    setForm({
      name: program.name || '',
      channel: program.channel as BatchFormState['channel'],
      template_name: program.template_name || '',
      pdf_template_name: program.pdf_template_name || '',
      pdf_filename_pattern: program.pdf_filename_pattern || '',
      recipients: JSON.stringify(program.recipients || [], null, 2),
      shared_data: JSON.stringify(program.shared_data || {}, null, 2),
      options: JSON.stringify(program.options || {}, null, 2),
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const persistProgram = async () => {
    if (!selectedApplication) {
      toast.error('Selecciona una aplicacion primero');
      return;
    }

    try {
      setSaving(true);
      const apiKey = requireApplicationApiKey();
      const recipients = parseJson<AutomationProgramRecord['recipients']>(form.recipients, []);
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('La lista de destinatarios no puede estar vacia');
      }

      const shared_data = parseJson<Record<string, unknown>>(form.shared_data, {});
      const options = parseJson<Record<string, unknown>>(form.options, {});
      const currentProgram = editingId ? programs.find((item) => item.id === editingId) || null : null;

      const program = await saveAutomationProgram(apiKey, {
        id: editingId || undefined,
        application_id: selectedApplication.id,
        name: form.name.trim(),
        kind: 'batch',
        status: (currentProgram?.status ?? 'active') as AutomationProgramRecord['status'],
        channel: form.channel,
        template_name: form.channel === 'email' || form.channel === 'email_pdf' ? form.template_name.trim() : null,
        pdf_template_name: form.channel === 'email_pdf' || form.channel === 'pdf' ? form.pdf_template_name.trim() : null,
        pdf_filename_pattern: form.pdf_filename_pattern.trim() || null,
        recipients,
        shared_data,
        options,
      });

      toast.success(editingId ? 'Lote actualizado' : 'Lote guardado');
      setPrograms((current) => {
        const exists = current.some((item) => item.id === program.id);
        if (exists) {
          return current.map((item) => (item.id === program.id ? program : item));
        }
        return [program, ...current];
      });
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el lote');
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    if (!selectedApplication) {
      toast.error('Selecciona una aplicacion primero');
      return;
    }

    try {
      setSending(true);
      const apiKey = requireApplicationApiKey();
      const recipients = parseJson<AutomationProgramRecord['recipients']>(form.recipients, []);
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('La lista de destinatarios no puede estar vacia');
      }

      const shared_data = parseJson<Record<string, unknown>>(form.shared_data, {});
      const options = parseJson<Record<string, unknown>>(form.options, {});

      const result = await sendAutomationBatch(apiKey, {
        type: form.channel,
        template_name: form.channel === 'email' || form.channel === 'email_pdf' ? form.template_name.trim() : undefined,
        attachment:
          form.channel === 'email_pdf' || form.channel === 'pdf'
            ? {
                pdf_template_name: form.pdf_template_name.trim(),
                filename: form.pdf_filename_pattern.trim() || undefined,
              }
            : undefined,
        recipients,
        shared_data,
        options,
      });

      setLastJobId(result.job_id);
      toast.success(`Job creado: ${result.job_id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo enviar el lote');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (program: AutomationProgramRecord) => {
    try {
      setDeletingProgramId(program.id);
      const apiKey = requireApplicationApiKey();
      await deleteAutomationProgram(apiKey, program.id);
      setPrograms((current) => current.filter((item) => item.id !== program.id));
      if (editingId === program.id) {
        resetForm();
      }
      toast.success('Lote cancelado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar el lote');
    } finally {
      setDeletingProgramId(null);
    }
  };

  if (loading) {
    return <Layout currentPage="automatizaciones-en-lote"><PageLoader /></Layout>;
  }

  return (
    <Layout currentPage="automatizaciones-en-lote">
      <div className="space-y-6">
        <AutomationPageHeader
          title="En lote"
          description="Envios masivos listos para dispararse ahora o para guardarse como recetas reutilizables, todo sobre las APIs publicas existentes."
        />

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar lote' : 'Nuevo lote'}</h2>
                <p className="text-sm text-slate-400">Usando: {selectedApplicationLabel}</p>
                {selectedApplication && !selectedApplicationApiKey && (
                  <p className="mt-1 text-xs text-amber-300">La aplicacion seleccionada no tiene api_key configurada.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {applications.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => setSelectedApp(app.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      selectedApp === app.id ? 'bg-cyan-500 text-white' : 'bg-slate-800/70 text-slate-400 hover:text-white'
                    }`}
                  >
                    {app.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  placeholder="Lote de facturas"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Canal</span>
                <select
                  value={form.channel}
                  onChange={(e) => setForm((current) => ({ ...current, channel: e.target.value as BatchFormState['channel'] }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                >
                  <option value="email">Email</option>
                  <option value="email_pdf">Email + PDF</option>
                  <option value="pdf">PDF</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Template email</span>
                <input
                  value={form.template_name}
                  onChange={(e) => setForm((current) => ({ ...current, template_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  placeholder="welcome"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Template PDF</span>
                <input
                  value={form.pdf_template_name}
                  onChange={(e) => setForm((current) => ({ ...current, pdf_template_name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  placeholder="factura_pdf"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-300">Nombre de archivo PDF</span>
                <input
                  value={form.pdf_filename_pattern}
                  onChange={(e) => setForm((current) => ({ ...current, pdf_filename_pattern: e.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-cyan-500/60"
                  placeholder="factura-{{order_id}}.pdf"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-300">Recipients JSON</span>
                <textarea
                  value={form.recipients}
                  onChange={(e) => setForm((current) => ({ ...current, recipients: e.target.value }))}
                  rows={7}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 font-mono text-xs text-slate-100 outline-none transition-colors focus:border-cyan-500/60"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-300">Shared data JSON</span>
                <textarea
                  value={form.shared_data}
                  onChange={(e) => setForm((current) => ({ ...current, shared_data: e.target.value }))}
                  rows={5}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 font-mono text-xs text-slate-100 outline-none transition-colors focus:border-cyan-500/60"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-medium text-slate-300">Options JSON</span>
                <textarea
                  value={form.options}
                  onChange={(e) => setForm((current) => ({ ...current, options: e.target.value }))}
                  rows={6}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-950/60 px-4 py-3 font-mono text-xs text-slate-100 outline-none transition-colors focus:border-cyan-500/60"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => void sendNow()}
                disabled={sending || !selectedApplicationApiKey}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar ahora
              </button>
              <button
                onClick={() => void persistProgram()}
                disabled={saving || !selectedApplicationApiKey}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {editingId ? 'Actualizar lote' : 'Guardar lote'}
              </button>
              <button
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
              >
                <SquarePen className="h-4 w-4" />
                Limpiar
              </button>
              <button
                onClick={() => void refreshPrograms()}
                disabled={loadingPrograms || !selectedApplicationApiKey}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loadingPrograms ? 'animate-spin' : ''}`} />
                Actualizar lista
              </button>
            </div>

            {lastJobId && (
              <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                Ultimo job: <span className="font-mono">{lastJobId}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-slate-700 bg-slate-900/60 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Lotes guardados</h2>
                  <p className="text-sm text-slate-400">Plantillas listas para volver a enviar.</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-3 py-1 text-xs text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  {programs.length} items
                </div>
              </div>

              <div className="mt-4 space-y-4">
                {loadingPrograms ? (
                  <div className="flex items-center justify-center rounded-2xl border border-slate-700/70 bg-slate-950/40 py-10 text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Cargando lotes...
                  </div>
                ) : programs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/40 p-6 text-sm text-slate-500">
                    No hay lotes guardados para esta aplicacion.
                  </div>
                ) : (
                  programs.map((program) => (
                    <BatchCard
                      key={program.id}
                      program={program}
                      onUse={() => {
                        setEditingId(program.id);
                        setForm((current) => ({
                          ...current,
                          name: program.name,
                          channel: program.channel as BatchFormState['channel'],
                          template_name: program.template_name || '',
                          pdf_template_name: program.pdf_template_name || '',
                          pdf_filename_pattern: program.pdf_filename_pattern || '',
                          recipients: JSON.stringify(program.recipients || [], null, 2),
                          shared_data: JSON.stringify(program.shared_data || {}, null, 2),
                          options: JSON.stringify(program.options || {}, null, 2),
                        }));
                      }}
                      onEdit={populateForm}
                      onDelete={(item) => void handleDelete(item)}
                      running={deletingProgramId === program.id}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-semibold text-emerald-100">Reutilizacion</h3>
                  <p className="mt-1 text-sm text-emerald-50/80">
                    El envio inmediato usa <code className="rounded bg-slate-950/40 px-1.5 py-0.5">notify</code> y las plantillas guardadas quedan persistidas en <code className="rounded bg-slate-950/40 px-1.5 py-0.5">automation_programs</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AutomatizacionesBatch;
