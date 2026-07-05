import { useState, useCallback } from 'react';
import {
  Zap,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Play,
  AlertCircle,
  CheckCircle,
  Code2,
  Lock,
  BookOpen,
  Terminal,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { buildFunctionsUrl, getRuntimeConfig } from '../lib/config';
import { useAuth } from '../contexts/AuthContext';
import {
  buildApiExplorerCatalog,
  type ApiExplorerEndpoint,
  type ApiExplorerField,
  type ApiExplorerMethod,
} from '../lib/publicMarketplaceCatalog';

type HttpMethod = ApiExplorerMethod;

const getFunctionsBaseUrl = () => {
  const { functionsBaseUrlRaw, functionsBaseUrl } = getRuntimeConfig();
  return functionsBaseUrlRaw || functionsBaseUrl || 'https://api.tu-dominio.com';
};

const cleanFunctionPath = (path: string) => path.replace(/^\/functions\/v1/i, '') || path;

const isPathField = (field: ApiExplorerField) => field.location === 'path';
const isQueryField = (endpoint: ApiExplorerEndpoint, field: ApiExplorerField) =>
  field.location === 'query' || (!field.location && endpoint.method === 'GET');
const isBodyField = (endpoint: ApiExplorerEndpoint, field: ApiExplorerField) =>
  field.location === 'body' || (!field.location && endpoint.method !== 'GET' && field.location !== 'path' && field.location !== 'query' && field.location !== 'header');

const getPathFields = (endpoint: ApiExplorerEndpoint) => endpoint.fields.filter(isPathField);
const getQueryFields = (endpoint: ApiExplorerEndpoint) => endpoint.fields.filter((field) => isQueryField(endpoint, field));
const getBodyFields = (endpoint: ApiExplorerEndpoint) => endpoint.fields.filter((field) => isBodyField(endpoint, field));

const toExampleText = (value: unknown) => {
  if (value === undefined) return 'VALOR';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
};

const resolvePathTemplate = (endpoint: ApiExplorerEndpoint) => {
  const pathFields = getPathFields(endpoint);

  return endpoint.path.replace(/:([A-Za-z0-9_]+)/g, (_match, paramName) => {
    const field = pathFields.find((item) => item.name === paramName);
    const example = field?.example;
    if (example === undefined || example === null || example === '') {
      return paramName;
    }
    return encodeURIComponent(String(example));
  });
};

const buildQueryString = (fields: ApiExplorerField[]) =>
  fields
    .filter((field) => field.example !== undefined)
    .map((field) => `${encodeURIComponent(field.name)}=${encodeURIComponent(toExampleText(field.example))}`)
    .join('&');

const buildBodyExample = (fields: ApiExplorerField[]) => {
  const example: Record<string, unknown> = {};
  fields.forEach((field) => {
    if (field.example !== undefined) {
      example[field.name] = field.example;
    }
  });
  return JSON.stringify(example, null, 2);
};

const METHOD_STYLES: Record<HttpMethod, string> = {
  GET: 'bg-green-500/20 text-green-400 border border-green-500/30',
  POST: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border border-red-500/30',
};

const MethodBadge = ({ method }: { method: HttpMethod }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold tracking-wide ${METHOD_STYLES[method]}`}>
    {method}
  </span>
);

const StatusBadge = ({ code }: { code: number }) => {
  const color = code < 300
    ? 'text-green-400 bg-green-500/10 border-green-500/20'
    : code < 500
      ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
      : 'text-red-400 bg-red-500/10 border-red-500/20';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold border ${color}`}>
      {code}
    </span>
  );
};

const CodeBlock = ({
  code,
  id,
  onCopy,
  copied,
}: {
  code: string;
  id: string;
  onCopy: (code: string, id: string) => void;
  copied: string | null;
}) => (
  <div className="relative group">
    <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto font-mono leading-relaxed">
      {code}
    </pre>
    <button
      onClick={() => onCopy(code, id)}
      className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
    >
      {copied === id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  </div>
);

const TryItPanel = ({ endpoint, baseUrl }: { endpoint: ApiExplorerEndpoint; baseUrl: string }) => {
  const queryFields = getQueryFields(endpoint);
  const bodyFields = getBodyFields(endpoint);
  const [apiKey, setApiKey] = useState('');
  const [queryParams, setQueryParams] = useState(() => buildQueryString(queryFields));
  const [bodyJson, setBodyJson] = useState(() => (endpoint.method === 'GET' ? '' : buildBodyExample(bodyFields)));
  const [response, setResponse] = useState<{ status: number; body: string; time: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState('');

  const validateJson = (value: string) => {
    try {
      JSON.parse(value);
      setJsonError('');
    } catch {
      setJsonError('JSON invalido');
    }
  };

  const run = useCallback(async () => {
    setLoading(true);
    setResponse(null);

    const start = Date.now();

    try {
      const resolvedPath = resolvePathTemplate(endpoint);
      const baseEndpointUrl = buildFunctionsUrl(resolvedPath, baseUrl);
      const url = endpoint.method === 'GET' && queryParams
        ? `${baseEndpointUrl}?${queryParams}`
        : baseEndpointUrl;

      const headers: Record<string, string> = {};
      if (endpoint.authType === 'api-key' && apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const opts: RequestInit = { method: endpoint.method, headers };
      if (endpoint.method !== 'GET' && bodyJson.trim() && bodyJson.trim() !== '{}') {
        headers['Content-Type'] = 'application/json';
        opts.body = bodyJson;
      }

      const res = await fetch(url, opts);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // keep raw text
      }

      setResponse({ status: res.status, body: pretty, time: Date.now() - start });
    } catch (err: any) {
      setResponse({ status: 0, body: `Network error: ${err.message}`, time: Date.now() - start });
    } finally {
      setLoading(false);
    }
  }, [endpoint, baseUrl, apiKey, bodyJson, queryParams]);

  return (
    <div className="space-y-4">
      {endpoint.authType === 'api-key' && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Clave API
          </label>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk_live_..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {queryFields.length > 0 && (
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
            Query Parameters
          </label>
          <input
            value={queryParams}
            onChange={(e) => setQueryParams(e.target.value)}
            placeholder="token=abc123&action=view"
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {endpoint.method !== 'GET' && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Request Body (JSON)
            </label>
            {jsonError && <span className="text-xs text-red-400">{jsonError}</span>}
          </div>
          <textarea
            value={bodyJson}
            onChange={(e) => {
              setBodyJson(e.target.value);
              validateJson(e.target.value);
            }}
            rows={8}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono resize-none"
          />
        </div>
      )}

      <button
        onClick={run}
        disabled={loading || !!jsonError}
        className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-semibold text-sm transition-colors"
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {loading ? 'Ejecutando...' : 'Ejecutar'}
      </button>

      {response && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <StatusBadge code={response.status} />
            <span className="text-xs text-slate-500">{response.time}ms</span>
            {response.status >= 200 && response.status < 300
              ? <CheckCircle className="w-4 h-4 text-green-400" />
              : <AlertCircle className="w-4 h-4 text-red-400" />
            }
          </div>
          <pre className="bg-slate-950 border border-slate-700/50 rounded-lg p-4 text-xs text-slate-300 overflow-x-auto font-mono max-h-72 overflow-y-auto leading-relaxed">
            {response.body}
          </pre>
        </div>
      )}
    </div>
  );
};

const EndpointCard = ({
  endpoint,
  baseUrl,
  expanded,
  onToggle,
  copiedCode,
  onCopy,
}: {
  endpoint: ApiExplorerEndpoint;
  baseUrl: string;
  expanded: boolean;
  onToggle: () => void;
  copiedCode: string | null;
  onCopy: (code: string, id: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<'docs' | 'try'>('docs');
  const Icon = endpoint.icon;
  const resolvedPath = resolvePathTemplate(endpoint);
  const queryFields = getQueryFields(endpoint);
  const bodyFields = getBodyFields(endpoint);

  const curlUrl = `${buildFunctionsUrl(resolvedPath, baseUrl)}${queryFields.length ? `?${buildQueryString(queryFields)}` : ''}`;
  const curlHeaders = endpoint.authType === 'api-key'
    ? ' \\\n  -H "x-api-key: YOUR_API_KEY"'
    : '';
  const curlBody = bodyFields.length > 0
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
        Object.fromEntries(
          bodyFields
            .filter((field) => field.required || field.example !== undefined)
            .map((field) => [field.name, field.example ?? '']),
        ),
        null,
        2,
      ).replace(/\n/g, '\n  ')}'`
    : '';
  const curlExample = endpoint.method === 'GET'
    ? `curl -X GET "${curlUrl}"${curlHeaders}`
    : `curl -X ${endpoint.method} "${curlUrl}"${curlHeaders}${curlBody}`;

  return (
    <div className="border border-slate-700/70 rounded-xl overflow-hidden bg-slate-800/30">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-800/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-slate-700/50">
            <Icon className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <MethodBadge method={endpoint.method} />
              <span className="text-sm font-mono text-slate-400 truncate">{cleanFunctionPath(endpoint.path)}</span>
            </div>
            <p className="text-white font-semibold text-sm mt-0.5">{endpoint.title}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-700/50">
          <div className="flex border-b border-slate-700/50">
            {(['docs', 'try'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  activeTab === tab
                    ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'docs' ? <BookOpen className="w-3.5 h-3.5" /> : <Terminal className="w-3.5 h-3.5" />}
                {tab === 'docs' ? 'Documentacion' : 'Probar'}
              </button>
            ))}
          </div>

          <div className="p-5 space-y-6">
            {activeTab === 'docs' ? (
              <>
                <p className="text-slate-300 text-sm leading-relaxed">{endpoint.description}</p>

                <div className="flex items-center gap-2 text-sm">
                  <Lock className="w-4 h-4 text-slate-400" />
                  {endpoint.authType === 'api-key' ? (
                    <span className="text-slate-300">
                      Requiere header <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded text-xs">x-api-key</code> con la clave API de tu aplicacion
                    </span>
                  ) : (
                    <span className="text-slate-400">Sin autenticacion manual requerida</span>
                  )}
                </div>

                {endpoint.fields.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      {endpoint.method === 'GET' ? 'Parametros' : 'Parametros del body'}
                    </h4>
                    <div className="space-y-2">
                      {endpoint.fields.map((field) => {
                        const location = field.location || (endpoint.method === 'GET' ? 'query' : 'body');
                        return (
                          <div key={field.name} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3">
                            <div className="flex items-start gap-2 flex-wrap">
                              <code className="text-cyan-400 text-sm font-mono font-semibold">{field.name}</code>
                              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{field.type}</span>
                              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded font-mono">{location}</span>
                              {field.required ? (
                                <span className="text-xs text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">requerido</span>
                              ) : (
                                <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">opcional</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1.5">{field.description}</p>
                            {field.example !== undefined && (
                              <p className="text-xs text-slate-500 mt-1 font-mono">
                                Ejemplo: <span className="text-slate-400">{typeof field.example === 'object' ? JSON.stringify(field.example) : String(field.example)}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" /> Ejemplo cURL
                  </h4>
                  <CodeBlock code={curlExample} id={`curl-${endpoint.id}`} onCopy={onCopy} copied={copiedCode} />
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Respuestas</h4>
                  <div className="space-y-3">
                    {endpoint.responses.map((resp) => (
                      <div key={resp.code} className="bg-slate-900/50 border border-slate-700/50 rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/70 border-b border-slate-700/30">
                          <StatusBadge code={resp.code} />
                          <span className="text-sm text-slate-400">{resp.label}</span>
                        </div>
                        <CodeBlock
                          code={JSON.stringify(resp.body, null, 2)}
                          id={`resp-${endpoint.id}-${resp.code}`}
                          onCopy={onCopy}
                          copied={copiedCode}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <TryItPanel endpoint={endpoint} baseUrl={baseUrl} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ApiExplorer() {
  const catalog = buildApiExplorerCatalog();
  const { groups, endpoints } = catalog;
  const [expandedEndpoints, setExpandedEndpoints] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => groups.map((group) => group.id));
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string>('all');
  useAuth();

  const baseUrl = getFunctionsBaseUrl();

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  }, []);

  const toggleEndpoint = (id: string) => {
    setExpandedEndpoints((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => (prev.includes(groupId) ? prev.filter((item) => item !== groupId) : [...prev, groupId]));
  };

  const visibleEndpoints = filterGroup === 'all'
    ? endpoints
    : endpoints.filter((endpoint) => endpoint.groupId === filterGroup);

  const visibleGroups = filterGroup === 'all'
    ? groups
    : groups.filter((group) => group.id === filterGroup);

  const queryExample = visibleEndpoints.find((endpoint) => getQueryFields(endpoint).length > 0);

  return (
    <Layout currentPage="api-explorer">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Zap className="w-6 h-6 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold text-white">API Explorer</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Documentacion interactiva para los endpoints publicos del marketplace.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="font-mono truncate max-w-xs">{baseUrl}</span>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-amber-300 font-semibold mb-1">Autenticacion por clave API</p>
            <p className="text-slate-400">
              La mayoria de los endpoints requieren <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">x-api-key</code>.
              Los webhooks de tracking no requieren autenticacion manual.
            </p>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Base URL</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-cyan-400 font-mono bg-slate-900 px-3 py-2 rounded-lg border border-slate-700/50 overflow-x-auto">
              {baseUrl}
            </code>
            <button
              onClick={() => copyToClipboard(baseUrl, 'base-url')}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors text-slate-400 hover:text-white flex-shrink-0"
            >
              {copiedCode === 'base-url' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', ...groups.map((group) => group.id)] as string[]).map((groupId) => {
            const group = groups.find((item) => item.id === groupId);
            const GroupIcon = groupId === 'all' ? Zap : group?.icon || Zap;
            const count = groupId === 'all'
              ? endpoints.length
              : endpoints.filter((endpoint) => endpoint.groupId === groupId).length;

            return (
              <button
                key={groupId}
                onClick={() => setFilterGroup(groupId)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filterGroup === groupId
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:text-white'
                }`}
              >
                <GroupIcon className="w-3.5 h-3.5" />
                {groupId === 'all' ? 'Todos' : group?.label || groupId}
                <span className="text-xs opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const groupEndpoints = visibleEndpoints.filter((endpoint) => endpoint.groupId === group.id);
            if (groupEndpoints.length === 0) return null;

            const isGroupExpanded = expandedGroups.includes(group.id);
            const GroupIcon = group.icon;

            return (
              <div key={group.id} className="bg-slate-800/20 border border-slate-700/40 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-800/40 transition-colors text-left"
                >
                  <GroupIcon className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-white flex-1">{group.label}</span>
                  <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    {groupEndpoints.length} endpoint{groupEndpoints.length !== 1 ? 's' : ''}
                  </span>
                  {isGroupExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {isGroupExpanded && (
                  <div className="border-t border-slate-700/40 p-4 space-y-3">
                    {groupEndpoints.map((endpoint) => (
                      <EndpointCard
                        key={endpoint.id}
                        endpoint={endpoint}
                        baseUrl={baseUrl}
                        expanded={expandedEndpoints.includes(endpoint.id)}
                        onToggle={() => toggleEndpoint(endpoint.id)}
                        copiedCode={copiedCode}
                        onCopy={copyToClipboard}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-slate-800/20 border border-slate-700/40 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-cyan-400" />
            Ejemplo rapido
          </h3>
          <p className="text-slate-400 text-sm mb-4">
            Usa este punto de entrada para validar una integracion simple con fetch.
          </p>
          <CodeBlock
            code={`const response = await fetch("${buildFunctionsUrl('/send-email', baseUrl)}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_API_KEY"
  },
  body: JSON.stringify({
    recipient_email: "cliente@empresa.com",
    template_name: "welcome",
    data: { nombre: "Juan Perez" }
  })
});`}
            id="quick-fetch"
            onCopy={copyToClipboard}
            copied={copiedCode}
          />
          {queryExample && (
            <p className="text-slate-500 text-xs mt-3">
              El catalogo tambien incluye ejemplos con query params y path params para endpoints como {cleanFunctionPath(queryExample.path)}.
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}
