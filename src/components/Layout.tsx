import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Settings, Book, Menu, X, Zap,
  AlertTriangle, Loader2, Check, Minus, ChevronDown, ChevronRight,
  Mail, Briefcase, AppWindow, Package, MessageSquare, FlaskConical,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrialBanner } from './TrialBanner';
import { UserMenu } from './UserMenu';
import { usePlans } from '../hooks/usePlans';
import { configManager } from '../lib/config';

interface LayoutProps {
  children: ReactNode;
  currentPage: string;
}

/* ── Plan styles ─────────────────────────────────────────────────── */

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
  if (plan.mercadopago?.init_point) return plan.mercadopago.init_point;
  const base = configManager.authUrl;
  const appId = configManager.authAppId;
  const apiKey = configManager.authApiKey;
  const redirectUri = configManager.redirectUri;
  return `${base}/register-tenant?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&api_key=${apiKey}&plan_id=${plan.id}`;
}

/* ── Plan card list (shared by blockers) ────────────────────────── */

const PlanCards = ({ highlightUsersAbove }: { highlightUsersAbove?: number }) => {
  const { plans, loading } = usePlans();
  const paidPlans = plans.filter(p => p.price > 0 || p.trial_days === 0);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
        {paidPlans.map((plan, i) => {
          const styleIdx = Math.min(i + 1, 3);
          const style = PLAN_STYLE[styleIdx];
          const sortedFeatures = [...(plan.entitlements?.features ?? [])].sort((a, b) => {
            const ia = FEATURE_ORDER.indexOf(a.code);
            const ib = FEATURE_ORDER.indexOf(b.code);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
          });

          const planMaxUsers = plan.entitlements?.features?.find(f => f.code === 'max_users');
          const planUserLimit = planMaxUsers ? parseInt(planMaxUsers.value, 10) : null;
          const coversNeeds = highlightUsersAbove === undefined || planUserLimit === null || planUserLimit > highlightUsersAbove;

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border ${style.border} ${style.bg} flex flex-col overflow-hidden transition-transform hover:-translate-y-1 duration-200 ${
                highlightUsersAbove !== undefined && !coversNeeds ? 'opacity-60' : ''
              } ${highlightUsersAbove !== undefined && coversNeeds ? 'ring-1 ring-cyan-500/30' : ''}`}
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
                  {highlightUsersAbove !== undefined ? `Actualizar a ${plan.name}` : 'Suscribirse'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-slate-600 text-xs">
        Precios en pesos uruguayos (UYU) · Límites compartidos por tenant
      </p>
    </>
  );
};

/* ── Testing environment banner ────────────────────────────────────── */

const isTestingEnvironment = () =>
  typeof window !== 'undefined' && window.location.hostname === 'test.sendcraft.net';

const TestingBanner = () => {
  if (!isTestingEnvironment()) return null;
  return (
    <div className="w-full bg-gradient-to-r from-teal-600/90 to-cyan-700/90 border-b border-teal-400/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2">
        <FlaskConical className="w-4 h-4 text-teal-200 flex-shrink-0" />
        <p className="text-sm text-teal-100 font-medium">
          Ambiente de <span className="font-bold text-white">Testing</span> — los cambios y datos de este entorno no afectan producción.
        </p>
      </div>
    </div>
  );
};

/* ── Trial-expired blocker ─────────────────────────────────────────── */

const TrialExpiredBlocker = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';

  return (
    <div className="fixed inset-0 z-[999] bg-[#050d1a]/98 backdrop-blur-sm flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-red-500 rounded-full blur-[160px] opacity-[0.06]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500 rounded-full blur-[140px] opacity-[0.06]" />
      </div>
      <div className="relative z-10 w-full max-w-5xl mx-auto">
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
        {isAdmin ? <PlanCards /> : (
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

/* ── User limit blocker ─────────────────────────────────────────── */

const UserLimitBlocker = ({ activeUsersCount, maxUsers }: { activeUsersCount: number; maxUsers: number }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'administrador' || user?.role === 'admin';

  return (
    <div className="fixed inset-0 z-[999] bg-[#050d1a]/98 backdrop-blur-sm flex flex-col items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[600px] h-[400px] bg-amber-500 rounded-full blur-[160px] opacity-[0.06]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-cyan-500 rounded-full blur-[140px] opacity-[0.06]" />
      </div>
      <div className="relative z-10 w-full max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 mb-5">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
            Límite de usuarios alcanzado
          </h1>
          <p className="text-slate-400 text-base max-w-lg mx-auto leading-relaxed">
            Tu plan permite hasta <span className="text-white font-bold">{maxUsers} {maxUsers === 1 ? 'usuario' : 'usuarios'}</span>,
            pero tu cuenta tiene <span className="text-amber-400 font-bold">{activeUsersCount} usuarios activos</span>.
            {isAdmin ? ' Actualiza tu plan para restablecer el acceso.' : ' Contacta a tu administrador para actualizar el plan.'}
          </p>
          <div className="inline-flex items-center gap-4 mt-6 bg-slate-800/60 border border-slate-700/60 rounded-2xl px-6 py-4">
            <div className="text-center">
              <p className="text-2xl font-extrabold text-amber-400">{activeUsersCount}</p>
              <p className="text-xs text-slate-500 mt-0.5">Usuarios activos</p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="text-center">
              <p className="text-2xl font-extrabold text-slate-300">{maxUsers}</p>
              <p className="text-xs text-slate-500 mt-0.5">Límite del plan</p>
            </div>
          </div>
        </div>
        {isAdmin ? <PlanCards highlightUsersAbove={activeUsersCount} /> : (
          <div className="text-center mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl max-w-sm mx-auto">
            <p className="text-slate-400 text-sm">
              Por favor comunícate con el administrador de tu cuenta para actualizar el plan de suscripción.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Nav item types ─────────────────────────────────────────────── */

interface SubItem {
  name: string;
  icon: any;
  route: string;
  page: string;
  permissionKey: string;
}

interface NavItem {
  name: string;
  icon: any;
  page: string;
  route: string;
  permissionKey: string;
  children?: SubItem[];
}

/* ── Sidebar nav item ───────────────────────────────────────────── */

const NavItemRow = ({
  item,
  currentPage,
  onClose,
}: {
  item: NavItem;
  currentPage: string;
  onClose: () => void;
}) => {
  const location = useLocation();

  const isActive = location.pathname === `/${item.route}` || currentPage === item.page;
  const isChildActive = item.children?.some(
    c => location.pathname === `/${c.route}` || currentPage === c.page
  );

  const [open, setOpen] = useState(isActive || !!isChildActive);
  const Icon = item.icon;

  if (!item.children || item.children.length === 0) {
    return (
      <Link
        to={`/${item.route}`}
        onClick={onClose}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
          isActive
            ? 'bg-cyan-500/10 text-cyan-400'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium">{item.name}</span>
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
          isChildActive
            ? 'bg-cyan-500/10 text-cyan-400'
            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm font-medium flex-1 text-left">{item.name}</span>
        {open
          ? <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          : <ChevronRight className="w-3.5 h-3.5 opacity-60" />
        }
      </button>

      {open && (
        <div className="mt-0.5 ml-3 pl-4 border-l border-slate-700/60 space-y-0.5">
          {item.children.map(child => {
            const CIcon = child.icon;
            const childActive = location.pathname === `/${child.route}` || currentPage === child.page;
            return (
              <Link
                key={child.route}
                to={`/${child.route}`}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 ${
                  childActive
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-slate-500 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <CIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs font-medium">{child.name}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ── Main Layout ────────────────────────────────────────────────── */

export const Layout = ({ children, currentPage }: LayoutProps) => {
  const { hasMenuAccess, hasSubmenuAccess, subscription, user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobile = () => setIsMobileMenuOpen(false);

  const allNavItems: NavItem[] = ([
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      page: 'dashboard',
      route: 'dashboard',
      permissionKey: 'dashboard',
    },
    {
      name: 'Templates',
      icon: FileText,
      page: 'templates',
      route: 'templates',
      permissionKey: 'templates',
      children: [
        { name: 'Correos',   icon: Mail,           route: 'templates',          page: 'templates',           permissionKey: 'templates.correos' },
        { name: 'WhatsApp',  icon: MessageSquare,  route: 'templates/whatsapp', page: 'templates-whatsapp',  permissionKey: 'templates.whatsapp' },
      ],
    },
    {
      name: 'Tareas',
      icon: Briefcase,
      page: 'statistics',
      route: 'statistics',
      permissionKey: 'statistics',
      children: [
        { name: 'Jobs — Email', icon: Mail, route: 'statistics', page: 'statistics', permissionKey: 'statistics.jobs_email' },
        { name: 'Jobs — WhatsApp', icon: MessageSquare, route: 'whatsapp', page: 'whatsapp', permissionKey: 'statistics.jobs_whatsapp' },
      ],
    },
    {
      name: 'Documentación',
      icon: Book,
      page: 'documentation',
      route: 'documentation',
      permissionKey: 'documentation',
    },
    {
      name: 'API Explorer',
      icon: Zap,
      page: 'api-explorer',
      route: 'api-explorer',
      permissionKey: 'api_explorer',
    },
    {
      name: 'Marketplace',
      icon: Package,
      page: 'marketplace',
      route: 'marketplace',
      permissionKey: 'marketplace',
    },
    {
      name: 'Configuración',
      icon: Settings,
      page: 'settings',
      route: 'settings',
      permissionKey: 'settings',
      children: [
        { name: 'Aplicaciones',       icon: AppWindow,  route: 'settings/apps',  page: 'settings-apps',  permissionKey: 'settings.aplicaciones' },
        { name: 'Correo Electrónico', icon: Mail,       route: 'settings/email', page: 'settings-email', permissionKey: 'settings.correo_electronico' },
        { name: 'Acceso al Embed',    icon: Package,    route: 'settings/embed', page: 'settings-embed', permissionKey: 'settings.acceso_embed' },
      ],
    },
  ] as NavItem[])
    .filter(item => hasMenuAccess(item.permissionKey))
    .map(item => ({
      ...item,
      children: item.children?.filter(child => hasSubmenuAccess(child.permissionKey)),
    }));

  const isTrialing = subscription?.status === 'trialing';
  const trialEndDate = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const trialExpiredBlocked = isTrialing && trialEndDate !== null && trialEndDate < new Date();

  const maxUsersFeature = subscription?.entitlements?.features?.find(f => f.code === 'max_users');
  const maxUsers = maxUsersFeature ? parseInt(maxUsersFeature.value, 10) : null;
  const activeUsersCount = user?.active_users_count ?? 0;
  const userLimitExceeded = maxUsers !== null && activeUsersCount > maxUsers;

  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* Top header — only for mobile hamburger + user menu */}
      {/* Top header — UserMenu always visible here on all screen sizes */}
      <header className="sticky top-0 z-40 border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-sm">
        <TestingBanner />
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen
                ? <X className="w-5 h-5 text-slate-400" />
                : <Menu className="w-5 h-5 text-slate-400" />
              }
            </button>
            <img src="/logo.svg" alt="SendCraft" className="h-7 lg:hidden" />
          </div>
          <UserMenu />
        </div>
      </header>

      <TrialBanner />
      {trialExpiredBlocked && <TrialExpiredBlocker />}
      {!trialExpiredBlocked && userLimitExceeded && maxUsers !== null && (
        <UserLimitBlocker activeUsersCount={activeUsersCount} maxUsers={maxUsers} />
      )}

      <div className="flex">
        {/* Mobile overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-30 lg:hidden"
            onClick={closeMobile}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky lg:top-0
          inset-y-0 left-0 z-40
          w-60 min-h-screen
          bg-[#07111f] border-r border-slate-700/50
          flex flex-col
          transform transition-transform duration-300 ease-in-out lg:transform-none
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          {/* Logo section */}
          <div className="flex flex-col items-center py-6 px-4 border-b border-slate-700/40">
            <img src="/logo.svg" alt="SendCraft" className="h-9 mb-1" />
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
            {allNavItems.map(item => (
              <NavItemRow
                key={item.route + item.name}
                item={item}
                currentPage={currentPage}
                onClose={closeMobile}
              />
            ))}
          </nav>

        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 lg:min-h-screen">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
