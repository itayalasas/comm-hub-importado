import { useState } from 'react';
import { Check, Minus, Loader2, Star } from 'lucide-react';
import { sortPlansByOrder, usePlans, type Plan } from '../hooks/usePlans';
import { configManager } from '../lib/config';
import { buildLegacyRegisterUrl } from '../lib/subscriptionCheckout';

const PLAN_STYLE: Record<number, { accentClass: string; borderClass: string; bgClass: string; btnClass: string; highlight: boolean; badge: string | null }> = {
  0: { accentClass: 'text-slate-300', borderClass: 'border-white/8', bgClass: 'bg-white/[0.03]', btnClass: 'bg-slate-600 hover:bg-slate-500 text-white', highlight: false, badge: null },
  1: { accentClass: 'text-cyan-400', borderClass: 'border-cyan-500/20', bgClass: 'bg-white/[0.03]', btnClass: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20', highlight: false, badge: null },
  2: { accentClass: 'text-blue-400', borderClass: 'border-blue-400/50', bgClass: 'bg-gradient-to-b from-blue-500/10 to-blue-500/5', btnClass: 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30', highlight: true, badge: 'Más popular' },
  3: { accentClass: 'text-emerald-400', borderClass: 'border-emerald-400/25', bgClass: 'bg-white/[0.03]', btnClass: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20', highlight: false, badge: 'Máximo poder' },
};

const FEATURE_LABEL: Record<string, string> = {
  total_de_correos_mensuales: 'Emails / mes',
  pdf_generations_monthly: 'PDFs / mes',
  max_applications: 'Aplicaciones',
  templates: 'Templates',
  api_access: 'Acceso API',
  two_factor_auth: '2FA',
  priority_support: 'Soporte prioritario',
  advanced_reports: 'Reportes avanzados',
  custom_domain: 'Dominio personalizado',
};

const FEATURE_ORDER = [
  'total_de_correos_mensuales',
  'pdf_generations_monthly',
  'max_applications',
  'templates',
  'api_access',
  'two_factor_auth',
  'advanced_reports',
  'custom_domain',
  'priority_support',
];

function formatNumber(val: string): string {
  const n = parseInt(val, 10);
  if (isNaN(n)) return val;
  return n.toLocaleString('es-UY');
}

function buildRegisterUrl(planId: string): string {
  return buildLegacyRegisterUrl(planId);
}

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
  const style = PLAN_STYLE[index] ?? PLAN_STYLE[1];
  const isFreePlan = plan.price === 0;
  const isDefaultPlan = plan.is_default === true;
  const [isRedirecting, setIsRedirecting] = useState(false);
  const cardHighlightClass = isDefaultPlan
    ? 'ring-1 ring-cyan-400/40 shadow-lg shadow-cyan-500/10'
    : style.highlight
    ? 'ring-1 ring-blue-400/30'
    : '';

  const sortedFeatures = [...(plan.entitlements?.features ?? [])].sort((a, b) => {
    const ia = FEATURE_ORDER.indexOf(a.code);
    const ib = FEATURE_ORDER.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const handleCta = () => {
    if (!configManager.isLoaded() || isRedirecting) return;

    setIsRedirecting(true);
    window.setTimeout(() => {
      window.location.href = buildRegisterUrl(plan.id);
    }, 140);
  };

  return (
    <div className={`relative rounded-2xl border ${style.borderClass} ${style.bgClass} flex flex-col overflow-hidden card-hover ${cardHighlightClass}`}>
      {isDefaultPlan && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 shadow-lg shadow-cyan-500/15 backdrop-blur">
            <Star className="w-3 h-3 fill-current" />
            Predeterminado
          </span>
        </div>
      )}

      {style.badge && (
        <div className="absolute top-0 left-0 right-0 flex justify-center">
          <span className={`text-xs font-bold px-4 py-1 rounded-b-lg ${index === 2 ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
            {style.badge}
          </span>
        </div>
      )}

      <div className={`p-6 flex flex-col flex-1 ${style.badge ? 'pt-10' : ''}`}>
        <div className="mb-5">
          <h3 className={`text-xl font-extrabold mb-1 ${style.accentClass}`}>{plan.name}</h3>
          <p className="text-slate-500 text-xs">{plan.description}</p>
        </div>

        <div className="mb-6 flex items-baseline gap-1">
          {isFreePlan ? (
            <>
              <span className="text-3xl font-extrabold text-white">Gratis</span>
              {plan.trial_days > 0 && (
                <span className="text-slate-400 text-sm">· {plan.trial_days} días</span>
              )}
            </>
          ) : (
            <>
              <span className="text-3xl font-extrabold text-white">
                {plan.currency} {plan.price.toLocaleString('es-UY')}
              </span>
              <span className="text-slate-400 text-sm">/mes</span>
            </>
          )}
        </div>

        <div className="h-px bg-white/6 mb-5" />

        <ul className="space-y-3 flex-1 mb-6">
          {sortedFeatures.map((f) => {
            const label = FEATURE_LABEL[f.code] ?? f.name;
            const isBool = f.value_type === 'boolean';
            const boolOn = isBool && (f.value === 'true' || f.value === '1');
            return (
              <li key={f.code} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-400">{label}</span>
                {isBool ? (
                  boolOn ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/8 flex items-center justify-center">
                      <Minus className="w-3 h-3 text-slate-600" />
                    </span>
                  )
                ) : (
                  <span className={`flex-shrink-0 font-bold text-xs ${style.accentClass}`}>{formatNumber(f.value)}</span>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={handleCta}
          disabled={isRedirecting}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-80 disabled:cursor-not-allowed ${isRedirecting ? 'scale-100' : 'hover:scale-[1.02] active:scale-95'} ${style.btnClass}`}
        >
          {isRedirecting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Iniciando...
            </span>
          ) : isFreePlan ? 'Comenzar gratis' : 'Suscribirse'}
        </button>
      </div>
    </div>
  );
}

export function PricingPlansSection() {
  const { plans, loading } = usePlans();
  const orderedPlans = sortPlansByOrder(plans);

  return (
    <section id="pricing" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full mb-4">
            <Star className="w-3 h-3" />
            Planes y Precios
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Elige el plan que se ajusta a tu equipo
          </h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            Todos los planes incluyen acceso multi-tenant. Los límites son compartidos por todo el tenant y solo los administradores pueden actualizarlo.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <div className={`grid gap-6 ${
            plans.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' :
            plans.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' :
            plans.length === 3 ? 'grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto' :
            'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
          }`}>
            {orderedPlans.map((plan, index) => (
              <PlanCard key={plan.id} plan={plan} index={index} />
            ))}
          </div>
        )}

        <p className="text-center text-slate-600 text-sm mt-10">
          Límites compartidos por tenant · Solo administradores pueden cambiar el plan
        </p>
      </div>
    </section>
  );
}
