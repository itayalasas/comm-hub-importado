import {
  Mail,
  Zap,
  CheckCircle,
  BarChart,
  Lock,
  ArrowRight,
  Sparkles,
  Globe,
  Bell,
  FileText,
  TrendingUp,
  Users,
  Clock,
  ChevronRight,
  Star,
  Check,
  MessageSquare,
  Send,
  Activity,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const STATS = [
  { value: '99.9%', label: 'Uptime garantizado', icon: Activity },
  { value: '10M+', label: 'Emails enviados', icon: Send },
  { value: '500+', label: 'Empresas activas', icon: Users },
  { value: '<2s', label: 'Tiempo de entrega', icon: Clock },
];

const FEATURES = [
  {
    icon: Mail,
    title: 'Gestion de Emails',
    description:
      'Envia y rastrea emails transaccionales y de marketing con seguimiento en tiempo real de entregas, aperturas y clics.',
    color: 'cyan',
  },
  {
    icon: Zap,
    title: 'Templates Dinamicos',
    description:
      'Crea y personaliza templates con variables dinamicas y preview en tiempo real para distintos tipos de comunicacion.',
    color: 'blue',
  },
  {
    icon: BarChart,
    title: 'Analitica Avanzada',
    description:
      'Dashboards interactivos con metricas detalladas, reportes de rendimiento y tendencias de tus comunicaciones.',
    color: 'teal',
  },
  {
    icon: FileText,
    title: 'Generacion de PDFs',
    description:
      'Convierte tus templates en documentos PDF profesionales listos para enviar o descargar automaticamente.',
    color: 'cyan',
  },
  {
    icon: Bell,
    title: 'Webhooks Automaticos',
    description:
      'Recibe notificaciones de eventos en tiempo real y mantiene tus sistemas sincronizados sin esfuerzo.',
    color: 'blue',
  },
  {
    icon: Globe,
    title: 'API RESTful Completa',
    description:
      'Integra SendCraft con tus sistemas existentes usando nuestra API bien documentada y facil de usar.',
    color: 'teal',
  },
  {
    icon: Lock,
    title: 'Seguridad Empresarial',
    description:
      'Autenticacion robusta con gestion de permisos, roles y cifrado de extremo a extremo.',
    color: 'cyan',
  },
  {
    icon: MessageSquare,
    title: 'Comunicaciones Pendientes',
    description:
      'Gestiona colas de comunicaciones, reprograma envios y monitorea el estado de cada mensaje.',
    color: 'blue',
  },
  {
    icon: TrendingUp,
    title: 'Optimizacion Continua',
    description:
      'Sugerencias inteligentes para mejorar tasas de apertura, entregabilidad y engagement general.',
    color: 'teal',
  },
];

const TESTIMONIALS = [
  {
    name: 'Carlos Mendoza',
    role: 'CTO, TechCorp Mexico',
    text: 'SendCraft transformo nuestra infraestructura de comunicaciones. La entregabilidad mejoro un 40% en el primer mes.',
    avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop',
    stars: 5,
  },
  {
    name: 'Ana Gomez',
    role: 'Directora de Operaciones, Finanza360',
    text: 'La generacion automatica de PDFs y el sistema de templates nos ahorra horas cada semana. Increible plataforma.',
    avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop',
    stars: 5,
  },
  {
    name: 'Roberto Silva',
    role: 'Gerente IT, LogiExpress',
    text: 'La integracion via API fue muy sencilla y el soporte tecnico es excepcional. Totalmente recomendado.',
    avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=80&h=80&fit=crop',
    stars: 5,
  },
];

const colorMap: Record<string, string> = {
  cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400',
  blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-400',
  teal: 'from-teal-500/20 to-teal-600/10 border-teal-500/30 text-teal-400',
};

export const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-cyan-500/8 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-[120px]" />
      </div>

      {/* NAV */}
      <nav className="relative z-50 border-b border-white/5 backdrop-blur-xl bg-[#050d1a]/80 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-25" />
                <img src="/logo.svg" alt="SendCraft" className="h-8 relative" />
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
              <a href="#how" className="hover:text-white transition-colors">Como funciona</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Testimonios</a>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg font-semibold text-sm hover:shadow-lg hover:shadow-cyan-500/30 transition-all hover:scale-105"
            >
              Inicia prueba gratis
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-cyan-400/20 bg-cyan-400/8 text-cyan-300 text-xs font-semibold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Plataforma de Comunicaciones Empresariales</span>
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.08] tracking-tight">
              Comunicaciones
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
                que impulsan tu negocio
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              SendCraft centraliza emails, templates, PDFs y analitica desde una sola plataforma. Automatiza, rastrea y optimiza cada comunicacion empresarial.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="group inline-flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:shadow-2xl hover:shadow-cyan-500/30 transition-all hover:scale-105"
              >
                <span>Comienza gratis hoy</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#features"
                className="inline-flex items-center justify-center space-x-2 px-8 py-4 border border-white/10 text-white rounded-xl font-semibold text-base hover:bg-white/5 hover:border-white/20 transition-all"
              >
                <span>Ver funcionalidades</span>
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Hero image dashboard mockup */}
          <div className="relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-[#050d1a] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-blue-500/10 to-teal-500/20 rounded-2xl blur-xl" />
            <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
              <img
                src="https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1200&h=600&fit=crop"
                alt="Dashboard de comunicaciones"
                className="w-full object-cover"
                style={{ height: '420px' }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/70" />
              {/* Floating cards */}
              <div className="absolute top-6 right-6 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-slate-400">Emails enviados hoy</span>
                </div>
                <div className="text-2xl font-bold text-white">24,891</div>
                <div className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                  <TrendingUp className="w-3 h-3" /> +12.4% vs ayer
                </div>
              </div>
              <div className="absolute bottom-6 left-6 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl p-4 shadow-xl">
                <div className="text-xs text-slate-400 mb-1">Tasa de entrega</div>
                <div className="text-2xl font-bold text-cyan-400">99.2%</div>
                <div className="flex gap-1 mt-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-1.5 w-6 rounded-full bg-cyan-500/60" style={{ opacity: 0.4 + i * 0.12 }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div key={label} className="text-center group">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 mb-3 group-hover:bg-cyan-500/15 transition-colors">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Como funciona</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              De la idea al envio en minutos
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Un flujo simplificado para que tu equipo se enfoque en lo que importa, no en la infraestructura.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* connector line */}
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
            {[
              {
                step: '01',
                title: 'Crea tu template',
                desc: 'Diseña templates HTML con variables dinamicas usando nuestro editor visual.',
                img: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',
              },
              {
                step: '02',
                title: 'Configura el envio',
                desc: 'Define destinatarios, programacion y reglas de entrega desde el dashboard.',
                img: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',
              },
              {
                step: '03',
                title: 'Analiza resultados',
                desc: 'Monitorea entregas, aperturas, clics y genera reportes PDF automaticamente.',
                img: 'https://images.pexels.com/photos/590022/pexels-photo-590022.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',
              },
            ].map(({ step, title, desc, img }) => (
              <div key={step} className="relative group">
                <div className="rounded-2xl overflow-hidden border border-white/8 mb-6 shadow-xl group-hover:border-cyan-500/30 transition-all">
                  <div className="relative" style={{ height: '180px' }}>
                    <img src={img} alt={title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050d1a] via-slate-900/50 to-transparent" />
                    <div className="absolute top-4 left-4 w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 backdrop-blur-sm flex items-center justify-center text-cyan-400 font-bold text-sm">
                      {step}
                    </div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Funcionalidades</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Todo lo que necesitas para comunicarte
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Una suite completa de herramientas de comunicacion empresarial, lista para usar desde el primer dia.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description, color }) => (
              <div
                key={title}
                className="group bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:bg-white/[0.06] hover:border-cyan-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/5"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[color]} border rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${colorMap[color].split(' ').pop()}`} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VISUAL SHOWCASE */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
            <div>
              <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Entregabilidad</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                Infraestructura diseñada para escalar
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Nuestra plataforma garantiza la maxima entregabilidad con autenticacion SPF, DKIM y DMARC configurada automaticamente. Tus emails llegan al inbox, no al spam.
              </p>
              <ul className="space-y-3">
                {[
                  'Autenticacion SPF, DKIM y DMARC automatica',
                  'IPs dedicadas para alta reputacion',
                  'Monitoreo de listas negras en tiempo real',
                  'Reintentos inteligentes en caso de fallo',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-cyan-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/1181263/pexels-photo-1181263.jpeg?auto=compress&cs=tinysrgb&w=700&h=500&fit=crop"
                  alt="Infraestructura de emails"
                  className="w-full object-cover"
                  style={{ height: '360px' }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-slate-900/70" />
                <div className="absolute bottom-6 right-6 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
                  <div className="text-xs text-slate-400 mb-1">Uptime este mes</div>
                  <div className="text-xl font-bold text-green-400">100%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=700&h=500&fit=crop"
                  alt="Analytics y reportes"
                  className="w-full object-cover"
                  style={{ height: '360px' }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900/50 to-slate-900/70" />
                <div className="absolute top-6 left-6 bg-slate-900/90 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-3">
                  <div className="text-xs text-slate-400 mb-1">Tasa de apertura</div>
                  <div className="text-xl font-bold text-cyan-400">68.4%</div>
                  <div className="text-xs text-green-400 flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3" /> Industria: 21%
                  </div>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="text-xs font-semibold tracking-widest text-teal-400 uppercase mb-4">Analitica</div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">
                Datos que informan cada decision
              </h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Comprende el comportamiento de tus destinatarios con reportes detallados y visualizaciones claras. Optimiza tus comunicaciones basandote en datos reales.
              </p>
              <ul className="space-y-3">
                {[
                  'Metricas en tiempo real por campana',
                  'Mapas de calor de clics en emails',
                  'Segmentacion y comparacion de audiencias',
                  'Reportes PDF automaticos programables',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-teal-400" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative z-10 py-24 px-4 sm:px-6 lg:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-4">Testimonios</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Lo que dicen nuestros clientes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(({ name, role, text, avatar, stars }) => (
              <div
                key={name}
                className="bg-white/[0.03] border border-white/8 rounded-2xl p-6 hover:border-cyan-500/25 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(stars)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-6">"{text}"</p>
                <div className="flex items-center gap-3">
                  <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                  <div>
                    <div className="text-sm font-semibold text-white">{name}</div>
                    <div className="text-xs text-slate-500">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=1200&h=500&fit=crop"
                alt="Team"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#050d1a]/90 via-slate-900/85 to-[#050d1a]/90" />
            </div>
            <div className="relative z-10 text-center p-12 md:p-16">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-cyan-400/20 bg-cyan-400/10 text-cyan-300 text-xs font-semibold tracking-widest uppercase">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Sin tarjeta de credito requerida</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
                Listo para transformar tus comunicaciones?
              </h2>
              <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
                Unete a mas de 500 empresas que confian en SendCraft para sus comunicaciones criticas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate('/login')}
                  className="group inline-flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-base hover:shadow-2xl hover:shadow-cyan-500/40 transition-all hover:scale-105"
                >
                  <span>Comenzar prueba gratuita</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
              <div className="flex flex-wrap gap-6 justify-center mt-8">
                {['14 dias gratis', 'Sin compromiso', 'Soporte incluido', 'Configuracion en minutos'].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-slate-400">
                    <CheckCircle className="w-4 h-4 text-cyan-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/5 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20" />
              <img src="/logo.svg" alt="SendCraft" className="h-7 relative" />
            </div>
          </div>
          <div className="text-slate-500 text-sm">
            Copyright 2024 SendCraft. Todos los derechos reservados.
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <a href="#" className="hover:text-slate-300 transition-colors">Privacidad</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Terminos</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Soporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
};
