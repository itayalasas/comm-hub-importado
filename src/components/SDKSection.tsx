import { useState, type FC } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Coffee,
  Code2,
  Copy,
  Download,
  Package,
  ShieldCheck,
  Sparkles,
  Cog,
} from 'lucide-react';
import { getRuntimeConfig } from '../lib/config';
import { createZipBlob } from '../lib/zip';
import { buildSdkBundle, MARKETPLACE_SDK_GROUPS, SDK_LANGUAGES, SDK_SUPPORT_SUMMARY } from '../lib/sdkTemplates';

type SdkLanguageId = 'node' | 'dotnet' | 'java';

const DEFAULT_BASE_URL = 'https://api.sendcraft.net';

const LANGUAGE_ICONS: Record<SdkLanguageId, FC<{ className?: string }>> = {
  node: Code2,
  dotnet: Cog,
  java: Coffee,
};

const LANGUAGE_ACCENTS: Record<SdkLanguageId, string> = {
  node: 'from-cyan-500/20 to-blue-500/10',
  dotnet: 'from-blue-500/20 to-slate-500/10',
  java: 'from-amber-500/20 to-orange-500/10',
};

const LANGUAGE_BORDERS: Record<SdkLanguageId, string> = {
  node: 'border-cyan-500/20',
  dotnet: 'border-blue-500/20',
  java: 'border-amber-500/20',
};

const LANGUAGE_TEXT: Record<SdkLanguageId, string> = {
  node: 'text-cyan-400',
  dotnet: 'text-blue-400',
  java: 'text-amber-400',
};

function triggerDownload(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-3 text-[11px] text-slate-300 overflow-x-auto leading-relaxed font-mono whitespace-pre-wrap break-words">
      {code}
    </pre>
  );
}

function SdkCard({
  language,
  baseUrl,
  onCopy,
  onDownload,
  copying,
  downloading,
}: {
  language: SdkLanguageId;
  baseUrl: string;
  onCopy: (value: string, language: SdkLanguageId) => void;
  onDownload: (language: SdkLanguageId) => void;
  copying: SdkLanguageId | null;
  downloading: SdkLanguageId | null;
}) {
  const bundle = buildSdkBundle(language, baseUrl);
  const Icon = LANGUAGE_ICONS[language];
  const isCopying = copying === language;
  const isDownloading = downloading === language;

  return (
    <div className={`rounded-2xl border ${LANGUAGE_BORDERS[language]} bg-slate-900/60 overflow-hidden flex flex-col`}>
      <div className={`h-1 bg-gradient-to-r ${LANGUAGE_ACCENTS[language]}`} />

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl bg-slate-950/80 border ${LANGUAGE_BORDERS[language]} flex items-center justify-center ${LANGUAGE_TEXT[language]}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{bundle.label}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{bundle.runtime} · {bundle.packageLabel}</p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LANGUAGE_BORDERS[language]} ${LANGUAGE_TEXT[language]}`}>
            SDK
          </span>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{bundle.description}</p>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Incluye</p>
          <ul className="space-y-1.5">
            {bundle.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${LANGUAGE_TEXT[language]}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Instalacion</span>
              <button
                onClick={() => onCopy(bundle.installCommand, language)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 transition-colors"
              >
                {isCopying ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {isCopying ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <code className={`block text-xs ${LANGUAGE_TEXT[language]} break-all font-mono`}>{bundle.installCommand}</code>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Descarga</span>
              <button
                onClick={() => onDownload(language)}
                disabled={isDownloading}
                className={`flex items-center gap-1 text-[11px] ${LANGUAGE_TEXT[language]} hover:text-white transition-colors disabled:opacity-50`}
              >
                {isDownloading ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {isDownloading ? 'Generando' : 'ZIP'}
              </button>
            </div>
            <p className="text-xs text-slate-400">Archivo: {bundle.archiveName}</p>
            <p className="text-xs text-slate-500 mt-1">Carpeta raiz: <code className="text-slate-300">{bundle.folderName}</code></p>
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Vista previa</p>
          <CodeBlock code={bundle.preview} />
        </div>

        <div className="pt-3 border-t border-slate-800/70">
          <div className="flex items-center gap-2 mb-2">
            <Package className={`w-3.5 h-3.5 ${LANGUAGE_TEXT[language]}`} />
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Endpoints cubiertos</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bundle.supportedEndpoints.slice(0, 5).map((endpoint) => (
              <span
                key={endpoint}
                className="text-[10px] px-2 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-slate-400"
              >
                {endpoint}
              </span>
            ))}
            {bundle.supportedEndpoints.length > 5 && (
              <span className={`text-[10px] px-2 py-1 rounded-full border ${LANGUAGE_BORDERS[language]} ${LANGUAGE_TEXT[language]}`}>
                +{bundle.supportedEndpoints.length - 5} mas
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SDKSection() {
  const runtime = getRuntimeConfig();
  const baseUrl = runtime.functionsBaseUrlRaw || runtime.functionsBaseUrl || DEFAULT_BASE_URL;
  const productCount = MARKETPLACE_SDK_GROUPS.length;
  const endpointCount = SDK_SUPPORT_SUMMARY.length;
  const [copying, setCopying] = useState<SdkLanguageId | null>(null);
  const [downloading, setDownloading] = useState<SdkLanguageId | null>(null);

  const handleCopy = async (value: string, language: SdkLanguageId) => {
    await navigator.clipboard.writeText(value);
    setCopying(language);
    setTimeout(() => setCopying(null), 1800);
  };

  const handleDownload = async (language: SdkLanguageId) => {
    setDownloading(language);

    try {
      const bundle = buildSdkBundle(language, baseUrl);
      const blob = createZipBlob(bundle.files, bundle.folderName);
      triggerDownload(blob, bundle.archiveName);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section id="sdk-packages" className="border border-slate-700 rounded-2xl overflow-hidden bg-slate-900/40">
      <div className="px-5 py-4 border-b border-slate-700/60 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">SDKs instalables</h2>
              <p className="text-xs text-slate-500 mt-0.5">Generados desde el catalogo oficial del Marketplace, con solo las APIs que vendemos.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-mono break-all">{baseUrl}</span>
        </div>
      </div>

      <div className="px-5 py-4 border-b border-slate-700/50 bg-slate-950/30">
        <p className="text-sm text-slate-300 leading-relaxed">
          Reutilizan la misma <code className="text-cyan-400">x-api-key</code> y la misma URL de funciones que ya sale de <code className="text-slate-200">/get-env</code>.
          El paquete incluye cliente HTTP, manejo de errores y un ZIP descargable por lenguaje.
        </p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {SDK_LANGUAGES.map((language) => (
            <SdkCard
              key={language.id}
              language={language.id}
              baseUrl={baseUrl}
              onCopy={handleCopy}
              onDownload={handleDownload}
              copying={copying}
              downloading={downloading}
            />
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-700/60 bg-slate-950/40 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ChevronRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            <span>
              {productCount} productos y {endpointCount} endpoints publicos listos para reutilizar entre el Marketplace, el Api Explorer y los clientes generados.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {SDK_LANGUAGES.map((language) => (
              <span key={language.id} className="text-[10px] px-2 py-1 rounded-full border border-slate-700 text-slate-400 bg-slate-900/60">
                {language.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default SDKSection;
