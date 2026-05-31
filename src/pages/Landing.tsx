import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Check, FileText, Loader2, Mail, Shield, Star, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PricingPlansSection } from '../components/PricingPlansSection';

const USE_CASES = [
  {
    icon: Mail,
    title: 'Emails transaccionales',
    desc: 'Envía confirmaciones, alertas y notificaciones con templates dinámicos.',
  },
  {
    icon: FileText,
    title: 'PDF y documentos',
    desc: 'Genera facturas, comprobantes y reportes automáticos en un solo flujo.',
  },
  {
    icon: Zap,
    title: 'Automatizaciones',
    desc: 'Dispara procesos desde tu sistema con una API simple y consistente.',
  },
  {
    icon: Building2,
    title: 'Multi-tenant',
    desc: 'Organiza equipos y clientes con límites compartidos por tenant.',
  },
];

export const Landing = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<'login' | 'register' | null>(null);

  const handleLogin = () => {
    setPendingAction('login');
    login();
  };

  const handleRegister = () => {
    setPendingAction('register');
    register();
  };

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
      `}</style>

      <div className="flex min-h-screen overflow-hidden">
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
            <div className="slide-2 mb-8 max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 mb-5">
                <Star className="w-3.5 h-3.5" />
                Planes y acceso
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-tight mb-5 tracking-tight">
                Bienvenido a <br />
                <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  SendCraft
                </span>
              </h1>
              <p className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-md">
                Gestiona emails, templates, PDFs y automatizaciones desde una sola plataforma.
              </p>
            </div>

            <div className="slide-3 space-y-3">
              {[
                { icon: Shield, title: 'Seguridad avanzada', desc: 'Autenticación empresarial con control de acceso centralizado.' },
                { icon: ArrowRight, title: 'Acceso rápido', desc: 'Inicia sesión en segundos y entra directo al panel.' },
                { icon: Check, title: 'Gestión unificada', desc: 'Administra comunicaciones, límites y analítica desde un lugar.' },
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
            <p className="text-slate-600 text-sm">Copyright {new Date().getFullYear()} SendCraft. Todos los derechos reservados.</p>
          </div>
        </div>

        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/8 to-transparent flex-shrink-0" />

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
                  <h2 className="text-3xl font-bold text-white mb-3">Iniciar sesión</h2>
                  <p className="text-slate-400 leading-relaxed">
                    Usa tu sistema de autenticación empresarial para acceder de forma segura.
                  </p>
                </div>

                <div className="slide-3 mb-7">
                  <button
                    onClick={handleLogin}
                    disabled={pendingAction === 'login'}
                    className="btn-shimmer w-full group flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-lg transition-all hover:shadow-2xl hover:shadow-cyan-500/35 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed"
                  >
                    {pendingAction === 'login' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                    <span>{pendingAction === 'login' ? 'Iniciando...' : 'Iniciar sesión'}</span>
                    {pendingAction === 'login' ? null : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
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
                    <button onClick={handleRegister} disabled={pendingAction === 'register'} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors disabled:opacity-80 disabled:cursor-not-allowed">
                      {pendingAction === 'register' ? (
                        <span className="inline-flex items-center gap-1">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Iniciando...
                        </span>
                      ) : 'Crear cuenta'}
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

      <PricingPlansSection />

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

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#050d1a]/95 backdrop-blur-xl border-t border-white/8 p-4 z-50">
        <button
          onClick={handleLogin}
          disabled={pendingAction === 'login'}
          className="btn-shimmer w-full group flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-base transition-all hover:shadow-xl hover:shadow-cyan-500/30 active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed"
        >
          {pendingAction === 'login' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
          <span>{pendingAction === 'login' ? 'Iniciando...' : 'Iniciar sesión'}</span>
          {pendingAction === 'login' ? null : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
        </button>
        <div className="text-center mt-3">
          <p className="text-slate-400 text-sm">
            ¿No tienes cuenta?{' '}
            <button onClick={handleRegister} disabled={pendingAction === 'register'} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors disabled:opacity-80 disabled:cursor-not-allowed">
              {pendingAction === 'register' ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Iniciando...
                </span>
              ) : 'Crear cuenta'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
