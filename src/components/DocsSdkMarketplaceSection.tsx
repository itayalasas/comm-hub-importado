import { CheckCircle2, Code2, Coffee, Cog, Layers3, Package } from 'lucide-react';
import {
  MARKETPLACE_SDK_GROUPS,
  SDK_LANGUAGES,
  SDK_SUPPORT_SUMMARY,
  buildSdkBundle,
} from '../lib/sdkTemplates';

interface DocsSdkMarketplaceSectionProps {
  baseUrl: string;
}

const LANGUAGE_VISUALS = {
  node: {
    icon: Code2,
    accent: 'text-cyan-400',
    badge: 'border-cyan-500/20 text-cyan-400 bg-cyan-500/10',
    cardBorder: 'border-cyan-500/20',
  },
  dotnet: {
    icon: Cog,
    accent: 'text-blue-400',
    badge: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
    cardBorder: 'border-blue-500/20',
  },
  java: {
    icon: Coffee,
    accent: 'text-amber-400',
    badge: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
    cardBorder: 'border-amber-500/20',
  },
} as const;

function CommandBlock({ title, command, note }: { title: string; command: string; note: string }) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="w-4 h-4 text-cyan-400" />
        <h4 className="text-sm font-semibold text-white">{title}</h4>
      </div>
      <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 text-xs text-cyan-300 overflow-x-auto">
        {command}
      </pre>
      <p className="text-xs text-slate-400 mt-2">{note}</p>
    </div>
  );
}

export function DocsSdkMarketplaceSection({ baseUrl }: DocsSdkMarketplaceSectionProps) {
  const sdkBundles = SDK_LANGUAGES.map((language) => buildSdkBundle(language.id, baseUrl));
  const totalGroups = MARKETPLACE_SDK_GROUPS.length;
  const totalEndpoints = SDK_SUPPORT_SUMMARY.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">SDKs y Marketplace</h2>
        <p className="text-slate-300 mb-4">
          Esta seccion resume el contenido de <code className="text-cyan-400">sdk/README.md</code> y de los README
          por lenguaje. Es informativa: no hay descargas desde la UI y todo se genera desde el catalogo publico
          oficial de SendCraft.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">SDKs</p>
              <h3 className="text-lg font-semibold text-white">3 paquetes</h3>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Node.js, .NET y Java. Los tres consumen la misma API Key y la misma base URL de funciones.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Layers3 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Marketplace</p>
              <h3 className="text-lg font-semibold text-white">{totalGroups} grupos</h3>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Solo se documentan y exponen las capacidades oficiales que forman parte del producto comercial.
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Cobertura</p>
              <h3 className="text-lg font-semibold text-white">{totalEndpoints} endpoints</h3>
            </div>
          </div>
          <p className="text-sm text-slate-300">
            El catalogo public se comparte entre los SDKs, el Api Explorer y la seccion de Marketplace.
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Puntos importantes</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-slate-300">
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>El origen de la documentacion es el catalogo publico del Marketplace.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Los SDKs se regeneran desde el mismo proyecto usando <code className="text-cyan-400">node tools/generate-sdk-artifacts.mjs</code>.</span>
            </li>
          </ul>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Para validar lo desplegado podes usar <code className="text-cyan-400">npm run sdk:status</code>.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>La base URL puede sobreescribirse con <code className="text-cyan-400">--base-url</code> o <code className="text-cyan-400">SDK_BASE_URL</code>.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {sdkBundles.map((bundle) => {
          const visuals = LANGUAGE_VISUALS[bundle.id];
          const Icon = visuals.icon;

          return (
            <div key={bundle.id} className={`bg-slate-800/50 border ${visuals.cardBorder} rounded-lg p-5`}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-950/70 border border-slate-700 flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${visuals.accent}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{bundle.label}</h3>
                    <p className="text-xs text-slate-500">{bundle.runtime} · {bundle.packageLabel}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${visuals.badge}`}>SDK</span>
              </div>

              <p className="text-sm text-slate-300 mb-4">{bundle.description}</p>

              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Instalacion local</p>
                <code className={`block text-xs ${visuals.accent} font-mono break-all`}>{bundle.installCommand}</code>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Incluye</p>
                <ul className="space-y-1.5">
                  {bundle.highlights.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${visuals.accent}`} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700/60">
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">Cobertura</p>
                <p className="text-xs text-slate-400">
                  {bundle.supportedEndpoints.length} endpoints publicos cubiertos por el paquete.
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommandBlock
          title="Comando de estado"
          command={`npm run sdk:status\nnpm run sdk:status -- --base-url=${baseUrl}`}
          note="Lista el catalogo del SDK y permite probar una URL concreta cuando se quiere validar un despliegue."
        />

        <CommandBlock
          title="Regeneracion"
          command="node tools/generate-sdk-artifacts.mjs"
          note="Vuelve a materializar los paquetes Node, .NET y Java desde el catalogo publico."
        />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-2">Catalogo publico del Marketplace</h3>
          <p className="text-slate-300 text-sm">
            Estos son los grupos oficiales que usan los SDKs. Cada grupo agrupa solo las APIs que realmente vendemos.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {MARKETPLACE_SDK_GROUPS.map((group) => (
            <div key={group.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h4 className="text-white font-semibold">{group.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{group.tagline}</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-600 bg-slate-700/50 text-slate-300">
                  {group.category}
                </span>
              </div>

              <p className="text-sm text-slate-300 mb-4">{group.description}</p>

              <div className="flex flex-wrap gap-2 mb-4">
                {group.features.map((feature) => (
                  <span key={feature} className="text-[10px] px-2 py-1 rounded-full border border-slate-700 text-slate-400 bg-slate-900/60">
                    {feature}
                  </span>
                ))}
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Endpoints ({group.actions.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.actions.map((action) => (
                    <code key={action.id} className="text-[11px] px-2 py-1 rounded-md bg-slate-950 border border-slate-800 text-cyan-300">
                      {action.method} {action.path}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default DocsSdkMarketplaceSection;
