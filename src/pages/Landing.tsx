import { Shield, Check, ArrowRight, Mail, BarChart2, FileText, Zap, Send, Activity, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

/* ── Mini live-feed mockup shown in the left panel ── */
const LiveFeedMockup = () => {
  const events = [
    { icon: Send, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', label: 'Email entregado', sub: 'cliente@empresa.com', time: 'hace 2s' },
    { icon: Mail, color: 'text-green-400 bg-green-500/10 border-green-500/20', label: 'Email abierto', sub: 'newsletter@corp.mx', time: 'hace 8s' },
    { icon: FileText, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', label: 'PDF generado', sub: 'Factura #FAC-2891', time: 'hace 14s' },
    { icon: Zap, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Webhook disparado', sub: 'CRM actualizado', time: 'hace 21s' },
    { icon: BarChart2, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20', label: 'Reporte listo', sub: 'Campana Junio 2026', time: 'hace 35s' },
  ];

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/10 bg-[#0a1628]/80 backdrop-blur-sm shadow-2xl shadow-cyan-500/10">
      {/* window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/6 bg-white/[0.02]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <div className="ml-3 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-medium">Activity Feed — en vivo</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-px bg-white/5 border-b border-white/6">
        {[
          { label: 'Enviados hoy', value: '24,891', icon: Send, color: 'text-cyan-400' },
          { label: 'Tasa apertura', value: '68.4%', icon: Activity, color: 'text-teal-400' },
          { label: 'Entregados', value: '99.2%', icon: TrendingUp, color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0a1628]/60 px-3 py-2.5 text-center">
            <Icon className={`w-3 h-3 ${color} mx-auto mb-0.5`} />
            <div className={`text-sm font-bold ${color}`}>{value}</div>
            <div className="text-[9px] text-slate-600">{label}</div>
          </div>
        ))}
      </div>

      {/* Chart bars */}
      <div className="px-4 pt-3 pb-2 border-b border-white/4">
        <div className="text-[9px] text-slate-500 mb-2">Emails — ultimos 7 dias</div>
        <div className="flex items-end gap-1.5" style={{ height: '36px' }}>
          {[48, 70, 55, 88, 65, 82, 94].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-cyan-600/80 to-cyan-400/30"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {['L','M','X','J','V','S','D'].map(d => (
            <div key={d} className="flex-1 text-center text-[8px] text-slate-700">{d}</div>
          ))}
        </div>
      </div>

      {/* Live events */}
      <div className="p-3 space-y-2">
        {events.map(({ icon: Icon, color, label, sub, time }, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 bg-white/[0.02] border border-white/4 rounded-xl px-3 py-2 hover:bg-white/[0.04] transition-colors"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold text-white truncate">{label}</div>
              <div className="text-[9px] text-slate-500 truncate">{sub}</div>
            </div>
            <div className="text-[8px] text-slate-600 flex-shrink-0">{time}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Page ── */
export const Landing = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050d1a] flex text-white overflow-hidden">
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
        @keyframes float-card { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes glow-pulse { 0%,100% { opacity:0.07; } 50% { opacity:0.14; } }
        @keyframes slide-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in { from { opacity:0; } to { opacity:1; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .float { animation: float 6s ease-in-out infinite; }
        .float-card { animation: float-card 4s ease-in-out infinite; }
        .glow-pulse { animation: glow-pulse 4s ease-in-out infinite; }
        .slide-up-1 { animation: slide-up 0.6s ease-out 0.1s both; }
        .slide-up-2 { animation: slide-up 0.6s ease-out 0.2s both; }
        .slide-up-3 { animation: slide-up 0.6s ease-out 0.3s both; }
        .slide-up-4 { animation: slide-up 0.6s ease-out 0.4s both; }
        .slide-up-5 { animation: slide-up 0.6s ease-out 0.5s both; }
        .fade-in { animation: fade-in 1s ease-out both; }
        .btn-shimmer {
          background-size: 200% auto;
          background-image: linear-gradient(to right, #06b6d4 0%, #0ea5e9 30%, #22d3ee 60%, #06b6d4 100%);
        }
        .btn-shimmer:hover { animation: shimmer 1.4s linear infinite; }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div className="w-full lg:w-[52%] relative flex flex-col justify-between p-8 sm:p-14 pb-36 lg:pb-14 overflow-hidden">

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-pulse absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-cyan-500 rounded-full blur-[130px]" />
          <div className="glow-pulse absolute bottom-[-20%] right-[-5%] w-[400px] h-[400px] bg-blue-600 rounded-full blur-[110px]" style={{ animationDelay: '2s' }} />
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        </div>

        {/* Logo */}
        <div className="relative z-10 slide-up-1">
          <div className="inline-flex items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-35" />
              <img src="/logo.svg" alt="SendCraft" className="h-9 relative" />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 my-12 lg:my-0">
          {/* Badge */}
          <div className="slide-up-2 inline-flex items-center gap-2 px-3 py-1.5 mb-6 rounded-full border border-cyan-400/20 bg-cyan-400/8 text-cyan-300 text-xs font-semibold tracking-widest uppercase">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Plataforma Empresarial
          </div>

          <h1 className="slide-up-2 text-4xl sm:text-5xl font-extrabold mb-5 leading-[1.1] tracking-tight">
            Bienvenido a<br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
              SendCraft
            </span>
          </h1>
          <p className="slide-up-3 text-slate-400 text-base leading-relaxed mb-10 max-w-md">
            Accede a tu cuenta y gestiona emails, templates, PDFs y campanas desde una plataforma unificada, segura y de clase empresarial.
          </p>

          {/* Feature pills */}
          <div className="slide-up-3 space-y-3">
            {[
              { icon: Shield, title: 'Seguridad Avanzada', desc: 'Autenticacion empresarial con cifrado de extremo a extremo.', delay: '3' },
              { icon: Zap, title: 'Acceso Rapido', desc: 'Inicia sesion en segundos con tu cuenta empresarial.', delay: '4' },
              { icon: BarChart2, title: 'Gestion Unificada', desc: 'Emails, templates, analitica y PDFs desde un solo lugar.', delay: '4' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="group flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/20 transition-all cursor-default">
                <div className="flex-shrink-0 w-10 h-10 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center group-hover:bg-cyan-500/15 group-hover:scale-110 transition-all">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
                  <div className="text-xs text-slate-500 leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Mockup — visible only on large screens */}
          <div className="slide-up-5 hidden lg:block mt-10">
            <div className="float">
              <LiveFeedMockup />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 hidden lg:block">
          <div className="text-xs text-slate-600">Copyright 2024 SendCraft. Todos los derechos reservados.</div>
        </div>
      </div>

      {/* ── DIVIDER glow line ── */}
      <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-cyan-500/20 to-transparent flex-shrink-0" />

      {/* ── RIGHT PANEL ── */}
      <div className="hidden lg:flex w-[48%] relative items-center justify-center p-10 overflow-hidden">

        {/* Ambient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-pulse absolute top-[10%] right-[-5%] w-[400px] h-[400px] bg-cyan-500 rounded-full blur-[120px]" style={{ animationDelay: '1s' }} />
          <div className="glow-pulse absolute bottom-[10%] left-[-5%] w-[350px] h-[350px] bg-teal-600 rounded-full blur-[110px]" style={{ animationDelay: '3s' }} />
          <div className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        </div>

        <div className="relative z-10 w-full max-w-sm slide-up-1">
          {/* Card */}
          <div className="relative">
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/25 via-blue-500/15 to-teal-500/25 rounded-3xl blur-xl" />

            <div className="relative bg-[#0a1628]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

              {/* Top accent bar */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />

              <div className="p-8">
                {/* Icon */}
                <div className="slide-up-2 flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500 blur-2xl opacity-30" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-2xl flex items-center justify-center">
                      <Shield className="w-8 h-8 text-cyan-400" />
                    </div>
                  </div>
                </div>

                <div className="slide-up-2 text-center mb-7">
                  <h2 className="text-2xl font-extrabold text-white mb-2">Iniciar Sesion</h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Accede de forma segura usando tu cuenta empresarial.
                  </p>
                </div>

                {/* Login button */}
                <div className="slide-up-3 mb-5">
                  <button
                    onClick={login}
                    className="btn-shimmer w-full group relative flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-base overflow-hidden transition-all hover:shadow-2xl hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Shield className="w-5 h-5 relative z-10" />
                    <span className="relative z-10">Iniciar Sesion</span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                {/* Divider */}
                <div className="slide-up-3 flex items-center gap-3 mb-5">
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-xs text-slate-600">acceso seguro</span>
                  <div className="flex-1 h-px bg-white/6" />
                </div>

                {/* Benefits card */}
                <div className="slide-up-4 bg-white/[0.03] border border-white/6 rounded-xl p-4 mb-6">
                  <div className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-cyan-400" />
                    Por que autenticacion empresarial?
                  </div>
                  <ul className="space-y-2">
                    {[
                      'Cifrado avanzado de extremo a extremo',
                      'Acceso unificado a todos tus servicios',
                      'Gestion centralizada de permisos y roles',
                      'Soporte tecnico especializado 24/7',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-slate-400">
                        <div className="w-4 h-4 rounded-full bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-cyan-400" />
                        </div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Register link */}
                <div className="slide-up-5 text-center mb-4">
                  <p className="text-slate-500 text-sm">
                    No tienes cuenta?{' '}
                    <button
                      onClick={register}
                      className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors"
                    >
                      Crear cuenta
                    </button>
                  </p>
                </div>

                {/* Back */}
                <div className="slide-up-5 text-center">
                  <button
                    onClick={() => navigate('/')}
                    className="text-slate-600 text-xs hover:text-slate-400 transition-colors inline-flex items-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    Volver al inicio
                  </button>
                </div>
              </div>

              {/* Bottom accent */}
              <div className="h-0.5 bg-gradient-to-r from-transparent via-teal-400/30 to-transparent" />
            </div>
          </div>

          {/* Floating stat badges */}
          <div className="float-card absolute -left-10 top-1/4 bg-[#0a1628]/95 border border-white/10 rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm"
            style={{ animationDelay: '0.5s' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-white">Sistema activo</div>
                <div className="text-[8px] text-green-400">Uptime 99.9%</div>
              </div>
            </div>
          </div>

          <div className="float-card absolute -right-8 bottom-1/4 bg-[#0a1628]/95 border border-white/10 rounded-xl px-3 py-2.5 shadow-xl backdrop-blur-sm">
            <div className="text-[9px] text-slate-500 mb-0.5">Emails hoy</div>
            <div className="text-base font-extrabold text-cyan-400">24,891</div>
            <div className="flex items-center gap-1 text-[8px] text-green-400">
              <TrendingUp className="w-2.5 h-2.5" /> +12.4%
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE bottom bar ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0a1628]/98 backdrop-blur-xl border-t border-white/8 p-4 z-50">
        <button
          onClick={login}
          className="btn-shimmer w-full group flex items-center justify-center gap-2.5 px-6 py-4 text-white rounded-xl font-bold text-base transition-all hover:shadow-xl hover:shadow-cyan-500/30 active:scale-95"
        >
          <Shield className="w-5 h-5" />
          Iniciar Sesion
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="text-center mt-3">
          <p className="text-slate-400 text-sm">
            No tienes cuenta?{' '}
            <button onClick={register} className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors">
              Crear cuenta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
