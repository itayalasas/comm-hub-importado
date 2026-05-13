import { Shield, Check, ArrowRight, Mail, FileText, Zap, Star, Building2, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePlans, Plan, PlanFeature } from '../hooks/usePlans';

const USE_CASES = [
  { icon: Mail,      title: 'Emails masivos',        desc: 'Campañas, notificaciones y alertas con alta entregabilidad.' },
  { icon: FileText,  title: 'Documentos & PDFs',     desc: 'Facturas, cotizaciones y reportes generados automáticamente.' },
  { icon: Zap,       title: 'Automatizaciones',      desc: 'Disparadores por eventos en tu sistema vía API REST.' },
  { icon: Building2, title: 'Multi-tenant',          desc: 'Varios equipos con aislamiento y roles por tenant.' },
];

// Map entitlement codes to human-readable labels
const FEATURE_LABELS: Record<string, string> = {
  total_de_correos_mensuales: 'Emails / mes',
  pdf_generations_monthly: 'PDFs / mes',
  max_applications: 'Aplicaciones',
  max_templates: 'Templates',
  max_users: 'Máximo de usuarios',
  two_factor_auth: '2FA',
  advanced_reports: 'Reportes avanzados',
  priority_support: 'Soporte prioritario',
  custom_domain: 'Dominio personalizado',
  api_access: 'Acceso API',
  acceso_api_resend: 'Acceso API Resend',
  configuracion_smtp: 'Configuración SMTP',
};

// Card color themes by index
const CARD_THEMES = [
  { color: 'from-cyan-500/15 to-teal-500/10',     border: 'border-cyan-500/25',    accent: 'text-cyan-400',    btn: 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-500/25' },
  { color: 'from-blue-500/20 to-cyan-500/10',     border: 'border-blue-400/35',    accent: 'text-blue-400',    btn: 'bg-blue-500 hover:bg-blue-400 shadow-blue-500/25' },
  { color: 'from-emerald-500/15 to-teal-500/10',  border: 'border-emerald-400/30', accent: 'text-emerald-400', btn: 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/25' },
  { color: 'from-amber-500/15 to-orange-500/10',  border: 'border-amber-400/30',   accent: 'text-amber-400',   btn: 'bg-amber-500 hover:bg-amber-400 shadow-amber-500/25' },
];

const BADGE_LABELS = ['', 'Más popular', 'Máximo poder', ''];

function formatFeatureValue(f: PlanFeature): string | boolean {
  if (f.value_type === 'boolean') return f.value === 'true';
  const n = Number(f.value);
  if (!isNaN(n)) return n.toLocaleString('es-UY');
  return f.value;
}

function PlanCard({ plan, index, onSubscribe }: { plan: Plan; index: number; onSubscribe: () => void }) {
  const theme = CARD_THEMES[index % CARD_THEMES.length];
  const badge = BADGE_LABELS[index] || '';
  const features = plan.entitlements?.features ?? [];

  const priceLabel = plan.price
    ? `${plan.currency} ${plan.price.toLocaleString('es-UY')}`
    : 'Gratis';

  return (
    <div className={`plan-card relative rounded-2xl border bg-gradient-to-b ${theme.color} ${theme.border} overflow-hidden flex flex-col`}>
      {badge && (
        <div className="absolute top-0 right-0 left-0 flex justify-center">
          <span className={`text-xs font-bold px-4 py-1 rounded-b-lg ${theme.btn.split(' ')[0]} text-white`}>
            {badge}
          </span>
        </div>
      )}

      <div className={`p-6 flex-1 flex flex-col ${badge ? 'pt-9' : ''}`}>
        <div className="mb-5">
          <h3 className={`text-xl font-extrabold mb-1 ${theme.accent}`}>{plan.name}</h3>
          {plan.description && <p className="text-slate-400 text-xs">{plan.description}</p>}
        </div>

        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-white">{priceLabel}</span>
            {plan.price > 0 && <span className="text-slate-400 text-sm">/mes</span>}
          </div>
          {plan.trial_days > 0 && (
            <p className="text-xs text-slate-500 mt-1">{plan.trial_days} días de prueba gratis</p>
          )}
        </div>

        <ul className="space-y-2.5 flex-1">
          {features.map((f) => {
            const label = FEATURE_LABELS[f.code] ?? f.name;
            const val = formatFeatureValue(f);
            return (
              <li key={f.code} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-300">{label}</span>
                {typeof val === 'boolean' ? (
                  val ? (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </span>
                  ) : (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                      <span className="w-2 h-px bg-slate-500 block" />
                    </span>
                  )
                ) : (
                  <span className={`flex-shrink-0 font-bold text-xs ${theme.accent}`}>{val}</span>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={onSubscribe}
          className={`mt-6 w-full py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all ${theme.btn}`}
        >
          Suscribirse
        </button>
      </div>
    </div>
  );
}

export const Landing = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const { plans, loading: plansLoading } = usePlans();

  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      <style>{`
        @keyframes glow-pulse { 0%,100% { opacity:0.07; } 50% { opacity:0.13; } }
        @keyframes slide-up { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position:-200% center; } 100% { background-position:200% center; } }
        .glow-pulse { animation: glow-pulse 5s ease-in-out infinite; }
        .slide-1 { animation: slide-up 0.5s ease-out 0.05s both; }
        .slide-2 { animation: slide-up 0.5s ease-out 0.15s both; }
        .slide-3 { animation: slide-up 0.5s ease-out 0.25s both; }
        .slide-4 { animation: slide-up 0.5s ease-out 0.35s both; }
        .slide-5 { animation: slide-up 0.5s ease-out 0.45s both; }
        .btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(to right, #06b6d4 0%, #0891b2 40%, #22d3ee 60%, #06b6d4 100%);
        }
        .btn-shimmer:hover { animation: shimmer 1.6s linear infinite; }
        .plan-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .plan-card:hover { transform: translateY(-4px); }
      `}</style>

      {/* ── HERO ── */}
      <div className="flex min-h-screen overflow-hidden">
        {/* LEFT */}
        <div className="w-full lg:w-1/2 relative flex flex-col justify-between p-8 sm:p-14 pb-36 lg:pb-14 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="glow-pulse absolute -top-32 -left-32 w-[480px] h-[480px] bg-cyan-500 rounded-full blur-[130px]" />
            <div className="glow-pulse absolute bottom-0 right-0 w-[350px] h-[350px] bg-blue-600 rounded-full blur-[120px]" style={{ animationDelay: '2.5s' }} />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.15) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          </div>

          <div className="relative z-10 slide-1">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-30" />
              <img src="/logo.svg" alt="SendCraft" className="h-9 sm:h-10 relative" />
            </div>
          </div>

          <div className="relative z-10">
            <div className="slide-2 mb-8">
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-tight mb-5 tracking-tight">
                Bienvenido a<br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  SendCraft
                </span>
              </h1>
              <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-md">
                Gestiona emails, templates y documentos PDF desde una plataforma unificada, segura y orientada a equipos.
              </p>
            </div>

            <div className="slide-3 space-y-3">
              {[
                { icon: Shield,    title: 'Seguridad Avanzada',   desc: 'Autenticación empresarial con altos estándares de seguridad.' },
                { icon: ArrowRight, title: 'Acceso Rápido',       desc: 'Inicia sesión en segundos con tu cuenta empresarial.' },
                { icon: Check,     title: 'Gestión Unificada',    desc: 'Administra comunicaciones, templates y analítica desde un solo lugar.' },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4 p-4 rounded-xl border border-white/6 bg-white/[0.025] hover:bg-white/[0.045] hover:border-cyan-500/20 transition-all group">
                  <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/15 transition-colors">
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-white mb-0.5">{title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 hidden lg:block">
            <p className="text-slate-600 text-sm">Copyright 2024 SendCraft. Todos los derechos reservados.</p>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/8 to-transparent flex-shrink-0" />

        {/* RIGHT */}
        <div className="hidden lg:flex w-1/2 relative items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="glow-pulse absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500 rounded-full blur-[130px]" style={{ animationDelay: '1s' }} />
            <div className="glow-pulse absolute bottom-0 left-0 w-[300px] h-[300px] bg-teal-600 rounded-full blur-[110px]" style={{ animationDelay: '3s' }} />
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.12) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
          </div>

          <div className="relative z-10 w-full max-w-md slide-1">
            <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500/15 via-transparent to-teal-500/15 rounded-3xl blur-xl" />
            <div className="relative bg-white/[0.04] backdrop-blur-sm border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
              <div className="p-10">
                <div className="slide-2 flex justify-center mb-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-25" />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-2xl flex items-center justify-center">
                      <Shield className="w-10 h-10 text-cyan-400" />
                    </div>
                  </div>
                </div>

                <div className="slide-2 text-center mb-8">
                  <h2 className="text-3xl font-bold text-white mb-3">Iniciar Sesión</h2>
                  <p className="text-slate-400 leading-relaxed">
                    Usa tu sistema de autenticación empresarial para acceder de forma segura.
                  </p>
                </div>

                <div className="slide-3 mb-7">
                  <button
                    onClick={login}
                    className="btn-shimmer w-full group flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-lg transition-all hover:shadow-2xl hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Shield className="w-5 h-5" />
                    <span>Iniciar Sesión</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="slide-4 bg-white/[0.03] border border-white/8 rounded-xl p-6 mb-8">
                  <h4 className="text-sm font-semibold text-white mb-4">
                    ¿Por qué usar autenticación empresarial?
                  </h4>
                  <ul className="space-y-3">
                    {[
                      'Máxima seguridad con encriptación avanzada.',
                      'Acceso unificado a todos tus servicios.',
                      'Gestión centralizada de permisos y roles.',
                      'Soporte técnico especializado.',
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <div className="w-4 h-4 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-cyan-400" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="slide-5 text-center mb-4">
                  <p className="text-slate-500 text-sm">
                    ¿No tienes cuenta?{' '}
                    <button onClick={() => register()} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors">
                      Crear cuenta
                    </button>
                  </p>
                </div>

                <div className="slide-5 text-center">
                  <button
                    onClick={() => navigate('/')}
                    className="text-slate-600 text-sm hover:text-slate-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-4 h-4 rotate-180" />
                    <span>Volver al inicio</span>
                  </button>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-teal-400/25 to-transparent" />
            </div>
          </div>
        </div>
      </div>

      {/* ── USE CASES ── */}
      <section className="bg-[#060e1c] border-t border-white/5 py-20 px-6 sm:px-14">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Desde emails transaccionales hasta documentos generados en batch.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {USE_CASES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group p-6 rounded-2xl border border-white/6 bg-white/[0.025] hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all">
                <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/15 transition-colors">
                  <Icon className="w-6 h-6 text-cyan-400" />
                </div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-24 px-6 sm:px-10 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-pulse absolute top-0 left-1/4 w-[600px] h-[400px] bg-cyan-500 rounded-full blur-[160px]" style={{ animationDelay: '1s' }} />
          <div className="glow-pulse absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-teal-500 rounded-full blur-[140px]" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full mb-4">
              <Star className="w-3 h-3" />
              Planes y Precios
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 leading-tight">
              Elige el plan que se ajusta<br className="hidden sm:block" /> a tu equipo
            </h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Todos los planes incluyen acceso multi-tenant. Los límites son compartidos
              <br className="hidden sm:block" />por todo el tenant y solo los administradores pueden actualizarlo.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : plans.length > 0 ? (
            <div className={`grid grid-cols-1 gap-6 max-w-5xl mx-auto ${
              plans.length === 1 ? 'sm:grid-cols-1 max-w-sm' :
              plans.length === 2 ? 'sm:grid-cols-2' :
              'sm:grid-cols-3'
            }`}>
              {plans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} index={i} onSubscribe={() => register()} />
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-500 py-10">No hay planes disponibles en este momento.</p>
          )}

          <p className="text-center text-slate-600 text-sm mt-10">
            Límites compartidos por tenant · Solo administradores pueden cambiar el plan · Los precios son en pesos uruguayos (UYU)
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-600 text-sm">© {new Date().getFullYear()} SendCraft. Todos los derechos reservados.</p>
          <div className="flex items-center gap-6 text-sm">
            <button onClick={() => navigate('/privacy')} className="text-slate-500 hover:text-slate-300 transition-colors">Privacidad</button>
            <button onClick={() => navigate('/terms')} className="text-slate-500 hover:text-slate-300 transition-colors">Términos</button>
            <a href="mailto:soporte@sendcraft.app" className="text-slate-500 hover:text-slate-300 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>

      {/* ── MOBILE bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#050d1a]/95 backdrop-blur-xl border-t border-white/8 p-4 z-50">
        <button
          onClick={login}
          className="btn-shimmer w-full group flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-base transition-all hover:shadow-xl hover:shadow-cyan-500/30 active:scale-95"
        >
          <Shield className="w-5 h-5" />
          <span>Iniciar Sesión</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="text-center mt-3">
          <p className="text-slate-400 text-sm">
            ¿No tienes cuenta?{' '}
            <button onClick={() => register()} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors">
              Crear cuenta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
