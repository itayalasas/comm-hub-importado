import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileText, Settings, BarChart3, Book, Menu, X, Zap, AlertTriangle, Loader2, Check, Minus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrialBanner } from './TrialBanner';
import { UserMenu } from './UserMenu';
import { usePlans } from '../hooks/usePlans';
import { configManager } from '../lib/config';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
}

/* ── Trial-expired blocker ─────────────────────────────────────── */

const PLAN_STYLE: Record<number, { accent: string; border: string; bg: string; btn: string; badge: string | null }> = {
  0: { accent: 'text-slate-300',   border: 'border-white/10',      bg: 'bg-white/[0.03]',                                 btn: 'bg-slate-600 hover:bg-slate-500 text-white',                              badge: null },
  1: { accent: 'text-cyan-400',    border: 'border-cyan-500/25',   bg: 'bg-white/[0.03]',                                 btn: 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-500/20',    badge: null },
  2: { accent: 'text-blue-400',    border: 'border-blue-400/50',   bg: 'bg-gradient-to-b from-blue-500/10 to-blue-500/5', btn: 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-500/30',    badge: 'Más popular' },
  3: { accent: 'text-emerald-400', border: 'border-emerald-400/25',bg: 'bg-white/[0.03]',                                 btn: 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20', badge: 'Máximo poder' },
};

const FEATURE_LABEL: Record<string, string> = {
  total_de_correos_mensuales: 'Emails / mes',
  pdf_generations_monthly:    'PDFs / mes',
  max_applications:           'Aplicaciones',
  templates:                  'Templates',
  api_access:                 'Acceso API',
  two_factor_auth:            '2FA',
  priority_support:           'Soporte prioritario',
  advanced_reports:           'Reportes avanzados',
  custom_domain:              'Dominio pers.',
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

function buildSubscribeUrl(plan: import('../hooks/usePlans').Plan): string {
  // Use init_point as-is — back_url is already correctly set by the subscription service
  if (plan.mercadopago?.init_point) {
    return plan.mercadopago.init_point;
  }
  const base = configManager.authUrl;
  const appId = configManager.authAppId;
  const apiKey = configManager.authApiKey;
  const redirectUri = configManager.redirectUri;
  return `${base}/register-tenant?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&api_key=${apiKey}&plan_id=${plan.id}`;
}

const TrialExpiredBlocker = () => {
  const { plans, loading } = usePlans();
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';

  // Filter out trial plan — only show paid plans
  const paidPlans = plans.filter(p => p.price > 0 || p.trial_days === 0);

  return (
    <div className="fixed inset-0 z-[999] bg-[#050d1a]/98 backdrop-blur-sm flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-red-500 rounded-full blur-[160px] opacity-[0.06]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500 rounded-full blur-[140px] opacity-[0.06]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto">
        {/* Alert header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/30 mb-5">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Tu período de prueba ha finalizado
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            {isAdmin
              ? 'Elige un plan para continuar usando SendCraft. Tu equipo no puede acceder hasta que actives una suscripción.'
              : 'El período de prueba de tu cuenta ha finalizado. Contacta a tu administrador para activar una suscripción.'
            }
          </p>
        </div>

        {/* Plans grid */}
        {isAdmin && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
                {paidPlans.map((plan, i) => {
                  // Map index to style (skip Trial style at index 0)
                  const styleIdx = Math.min(i + 1, 3);
                  const style = PLAN_STYLE[styleIdx];
                  const sortedFeatures = [...(plan.entitlements?.features ?? [])].sort((a, b) => {
                    const ia = FEATURE_ORDER.indexOf(a.code);
                    const ib = FEATURE_ORDER.indexOf(b.code);
                    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                  });

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl border ${style.border} ${style.bg} flex flex-col overflow-hidden transition-transform hover:-translate-y-1 duration-200`}
                    >
                      {style.badge && (
                        <div className="absolute top-0 left-0 right-0 flex justify-center">
                          <span className={`text-xs font-bold px-4 py-1 rounded-b-lg ${styleIdx === 2 ? 'bg-blue-500 text-white' : 'bg-emerald-500 text-white'}`}>
                            {style.badge}
                          </span>
                        </div>
                      )}

                      <div className={`p-5 flex flex-col flex-1 ${style.badge ? 'pt-9' : ''}`}>
                        <div className="mb-4">
                          <h3 className={`text-lg font-extrabold mb-0.5 ${style.accent}`}>{plan.name}</h3>
                          <p className="text-slate-500 text-xs">{plan.description}</p>
                        </div>

                        <div className="mb-4 flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-white">
                            {plan.currency} {plan.price.toLocaleString('es-UY')}
                          </span>
                          <span className="text-slate-400 text-sm">/mes</span>
                        </div>

                        <div className="h-px bg-white/6 mb-4" />

                        <ul className="space-y-2.5 flex-1 mb-5">
                          {sortedFeatures.map((f) => {
                            const label = FEATURE_LABEL[f.code] ?? f.name;
                            const isBool = f.value_type === 'boolean';
                            const boolOn = isBool && (f.value === 'true' || f.value === '1');
                            const numVal = !isBool ? parseInt(f.value, 10) : null;
                            return (
                              <li key={f.code} className="flex items-center justify-between gap-2 text-sm">
                                <span className="text-slate-400 text-xs">{label}</span>
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
                                  <span className={`flex-shrink-0 font-bold text-xs ${style.accent}`}>
                                    {numVal !== null ? numVal.toLocaleString('es-UY') : f.value}
                                    {f.unit ? ` ${f.unit}` : ''}
                                  </span>
                                )}
                              </li>
                            );
                          })}
                        </ul>

                        <button
                          onClick={() => { window.location.href = buildSubscribeUrl(plan); }}
                          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 ${style.btn}`}
                        >
                          Suscribirse
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-center text-slate-600 text-xs">
              Precios en pesos uruguayos (UYU) · Límites compartidos por tenant
            </p>
          </>
        )}

        {!isAdmin && (
          <div className="text-center mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl max-w-sm mx-auto">
            <p className="text-slate-400 text-sm">
              Por favor comunícate con el administrador de tu cuenta para renovar la suscripción.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Main Layout ────────────────────────────────────────────────── */

export const Layout = ({ children, currentPage }: LayoutProps) => {
  const { hasMenuAccess, subscription } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard',     icon: LayoutDashboard, page: 'dashboard',    route: 'dashboard',    permissionKey: 'dashboard' },
    { name: 'Templates',     icon: FileText,        page: 'templates',    route: 'templates',    permissionKey: 'templates' },
    { name: 'Estadísticas',  icon: BarChart3,        page: 'statistics',   route: 'statistics',   permissionKey: 'statistics' },
    { name: 'Documentación', icon: Book,            page: 'documentation',route: 'documentation',permissionKey: 'documentation' },
    { name: 'API Explorer',  icon: Zap,             page: 'api-explorer', route: 'api-explorer', permissionKey: 'documentation' },
    { name: 'Configuración', icon: Settings,        page: 'settings',     route: 'settings',     permissionKey: 'settings' },
  ].filter(item => hasMenuAccess(item.permissionKey));

  // Determine if trial is expired and no active subscription exists
  const isTrialing = subscription?.status === 'trialing';
  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialExpiredBlocked = isTrialing && trialEndDate !== null && trialEndDate < new Date();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 text-slate-400" />
                ) : (
                  <Menu className="w-6 h-6 text-slate-400" />
                )}
              </button>
              <img src="/logo.svg" alt="SendCraft" className="h-8" />
            </div>
            <UserMenu />
          </div>
        </div>
      </nav>

      <TrialBanner />

      {/* Full-page blocker when trial has expired */}
      {trialExpiredBlocked && <TrialExpiredBlocker />}

      <div className="flex relative">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-40
          w-64 min-h-[calc(100vh-4rem)] border-r border-slate-700 bg-slate-900/95 backdrop-blur-sm
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <nav className="p-4 space-y-2 mt-16 lg:mt-0">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === `/${item.route}` || currentPage === item.page;
              return (
                <Link
                  key={item.name}
                  to={`/${item.route}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
