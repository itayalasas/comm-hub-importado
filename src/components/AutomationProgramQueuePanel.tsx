import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Trash2, Send } from 'lucide-react';
import { useToast } from './Toast';
import { buildFunctionsUrl } from '../lib/config';
import { translateStatus } from '../lib/statusLabels';
import {
  AutomationProgramQueueBulkInput,
  AutomationProgramRecord,
  AutomationProgramQueueItemRecord,
  cancelAutomationProgramQueueItem,
  enqueueAutomationProgramQueue,
  loadAutomationProgramQueue,
} from '../lib/automationApi';

type QueueStatusFilter = 'all' | 'queued' | 'processing' | 'sent' | 'failed' | 'cancelled';

const defaultPayloadExample = (programId: string) =>
  JSON.stringify(
    {
      items: [
        {
          external_reference_id: 'order-123',
          recipient_email: 'cliente@ejemplo.com',
          recipient_data: {
            nombre: 'Juan',
          },
          shared_data: {
            empresa: 'Acme SA',
          },
        },
      ],
    },
    null,
    2,
  ) + `\n\n// program_id: ${programId}`;

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

const statusStyles: Record<string, string> = {
  queued: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  processing: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
  sent: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  failed: 'border-red-500/25 bg-red-500/10 text-red-200',
  cancelled: 'border-slate-700/50 bg-slate-800/50 text-slate-400',
};

export const AutomationProgramQueuePanel = ({
  apiKey,
  program,
}: {
  apiKey: string;
  program: AutomationProgramRecord;
}) => {
  const toast = useToast();
  const [items, setItems] = useState<AutomationProgramQueueItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('all');
  const [payload, setPayload] = useState(() =>
    JSON.stringify(
      {
        items: [
          {
            external_reference_id: 'order-123',
            recipient_email: 'cliente@ejemplo.com',
            recipient_data: { nombre: 'Juan' },
            shared_data: { empresa: 'Acme SA' },
          },
        ],
      },
      null,
      2,
    ),
  );
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const queueUrl = buildFunctionsUrl(`automation-programs/${program.id}/queue`);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await loadAutomationProgramQueue(
        apiKey,
        program.id,
        statusFilter === 'all' ? undefined : { status: statusFilter },
      );
      setItems(result.queue_items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la cola');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, program.id, statusFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000);
  };

  const handleAddItems = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      toast.error('El payload no es un JSON valido');
      return;
    }

    try {
      setSubmitting(true);
      const input: AutomationProgramQueueBulkInput = Array.isArray((parsed as { items?: unknown })?.items)
        ? (parsed as AutomationProgramQueueBulkInput)
        : { items: [parsed as AutomationProgramQueueBulkInput['items'][number]] };
      const result = await enqueueAutomationProgramQueue(apiKey, program.id, input);
      toast.success(`${result.queue_items.length} item(s) cargados en la cola`);
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el payload');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (item: AutomationProgramQueueItemRecord) => {
    try {
      setCancellingId(item.id);
      await cancelAutomationProgramQueueItem(apiKey, program.id, item.id);
      toast.success('Item cancelado');
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar el item');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-cyan-500/20 bg-slate-950/40 p-4">
      <div>
        <h4 className="text-sm font-semibold text-white">Integracion externa</h4>
        <p className="mt-1 text-xs text-slate-400">
          Este programa espera que otro sistema empuje destinatarios via API. Usa esta URL y este payload de ejemplo.
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2">
          <code className="flex-1 truncate text-xs text-cyan-200">POST {queueUrl}</code>
          <button
            onClick={() => copyToClipboard(queueUrl, 'queue-url')}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {copied === 'queue-url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="relative mt-2">
          <pre className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
            {defaultPayloadExample(program.id)}
          </pre>
          <button
            onClick={() => copyToClipboard(defaultPayloadExample(program.id), 'queue-payload')}
            className="absolute right-2 top-2 rounded-lg bg-slate-800 p-1.5 text-slate-400 transition-colors hover:text-white"
          >
            {copied === 'queue-payload' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Header requerido: <code className="rounded bg-slate-900/70 px-1.5 py-0.5">x-api-key</code>
        </p>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-white">Cargar items manualmente</h4>
        <textarea
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={7}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 outline-none transition-colors focus:border-cyan-500/60"
        />
        <button
          onClick={() => void handleAddItems()}
          disabled={submitting}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Cargar en cola
        </button>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-white">Items en cola</h4>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as QueueStatusFilter)}
              className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-xs text-white outline-none"
            >
              <option value="all">Todos</option>
              <option value="queued">En espera</option>
              <option value="processing">En proceso</option>
              <option value="sent">Enviados</option>
              <option value="failed">Fallidos</option>
              <option value="cancelled">Cancelados</option>
            </select>
            <button
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/40 py-6 text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando cola...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700/70 bg-slate-900/40 p-4 text-xs text-slate-500">
              No hay items en la cola para este filtro.
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700/70 bg-slate-900/40 p-3 text-xs"
              >
                <div>
                  <div className="font-medium text-white">
                    {item.external_reference_id || item.recipient_email}
                  </div>
                  <div className="mt-0.5 text-slate-500">
                    {item.recipient_email} · {formatDate(item.created_at)}
                  </div>
                  {item.last_error && (
                    <div className="mt-1 text-red-300">{item.last_error}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${statusStyles[item.status] || statusStyles.queued}`}>
                    {translateStatus(item.status)}
                  </span>
                  {(item.status === 'queued' || item.status === 'failed') && (
                    <button
                      onClick={() => void handleCancel(item)}
                      disabled={cancellingId === item.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AutomationProgramQueuePanel;
