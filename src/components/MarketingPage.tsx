import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, ChevronRight, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Seo, type SeoProps } from './Seo';

export interface MarketingPageStat {
  value: string;
  label: string;
}

export interface MarketingPageHighlight {
  title: string;
  description: string;
  tag?: string;
}

export interface MarketingPageFeature {
  title: string;
  description: string;
}

export interface MarketingPageStep {
  title: string;
  description: string;
}

export interface MarketingPageFaq {
  question: string;
  answer: string;
}

export interface MarketingPageLink {
  label: string;
  to: string;
  description: string;
}

export interface MarketingPageProps {
  seo: SeoProps;
  eyebrow: string;
  headline: ReactNode;
  description: string;
  primaryAction: {
    label: string;
    to: string;
  };
  secondaryAction?: {
    label: string;
    to: string;
  };
  navLinks?: Array<{
    label: string;
    to: string;
  }>;
  stats?: MarketingPageStat[];
  highlights?: MarketingPageHighlight[];
  features?: MarketingPageFeature[];
  steps?: MarketingPageStep[];
  faq?: MarketingPageFaq[];
  relatedLinks?: MarketingPageLink[];
  children?: ReactNode;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <div className="text-center max-w-3xl mx-auto mb-10">
      <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-widest uppercase text-cyan-300 mb-4">
        <Sparkles className="w-3.5 h-3.5" />
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">{title}</h2>
      {description ? <p className="text-slate-400">{description}</p> : null}
    </div>
  );
}

export function MarketingPage({
  seo,
  eyebrow,
  headline,
  description,
  primaryAction,
  secondaryAction,
  navLinks = [],
  stats,
  highlights,
  features,
  steps,
  faq,
  relatedLinks,
  children,
}: MarketingPageProps) {
  return (
    <div className="min-h-screen bg-[#050d1a] text-white overflow-x-hidden">
      <Seo {...seo} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[18%] w-[700px] h-[700px] rounded-full bg-cyan-500/25 blur-[140px]" />
        <div className="absolute top-[38%] right-[8%] w-[540px] h-[540px] rounded-full bg-blue-500/20 blur-[120px]" />
        <div className="absolute bottom-[8%] left-[28%] w-[620px] h-[620px] rounded-full bg-teal-500/18 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <header className="relative z-20 sticky top-0 border-b border-white/5 bg-[#050d1a]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-20" />
                <img src="/logo.svg" alt="SendCraft" className="h-8 relative" />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm text-slate-400">
              {navLinks.map((link) => (
                <Link key={link.to} to={link.to} className="hover:text-cyan-300 transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>

            <Link
              to={primaryAction.to}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              {primaryAction.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-10 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold tracking-widest uppercase text-cyan-300 mb-5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {eyebrow}
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-extrabold leading-[1.02] tracking-tight mb-6">
                  {headline}
                </h1>

                <p className="text-lg sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
                  {description}
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Link
                    to={primaryAction.to}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-6 py-4 font-semibold text-white hover:shadow-2xl hover:shadow-cyan-500/40 transition-all"
                  >
                    {primaryAction.label}
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  {secondaryAction ? (
                    <Link
                      to={secondaryAction.to}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-6 py-4 font-semibold text-white hover:bg-white/5 transition-all"
                    >
                      {secondaryAction.label}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : null}
                </div>

                {stats && stats.length > 0 ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
                    {stats.map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="text-2xl font-bold text-cyan-300">{stat.value}</div>
                        <div className="mt-1 text-sm text-slate-400">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-cyan-500/20 via-transparent to-teal-500/20 blur-xl" />
                <div className="relative rounded-3xl border border-white/10 bg-[#0a1628] shadow-2xl overflow-hidden">
                  <div className="h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
                  <div className="p-6 sm:p-7">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Qué incluye</div>
                        <div className="text-lg font-bold text-white">Todo listo para crecer</div>
                      </div>
                      <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                        Listo para usar
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(highlights && highlights.length > 0 ? highlights : [
                        {
                          title: 'Contenido claro',
                          description: 'Títulos, descripciones y estructura para explicar bien cada propuesta.',
                          tag: 'Claridad',
                        },
                        {
                          title: 'Conexiones entre secciones',
                          description: 'La navegación lleva de una página a otra de forma natural.',
                          tag: 'Flujo',
                        },
                        {
                          title: 'Base preparada para crecer',
                          description: 'Puedes sumar nuevas secciones sin rehacer la estructura.',
                          tag: 'Escala',
                        },
                      ]).map((item) => (
                        <div key={item.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-300 mb-3">
                            {item.tag || 'Focus'}
                          </div>
                          <div className="font-semibold text-white mb-1">{item.title}</div>
                          <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="h-px bg-gradient-to-r from-transparent via-teal-400/25 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {children ? (
          <section className="px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">{children}</div>
          </section>
        ) : null}

        {features && features.length > 0 ? (
          <section className="px-4 sm:px-6 lg:px-8 py-16">
            <div className="max-w-7xl mx-auto">
              <SectionTitle
                eyebrow="Capacidades"
                title="Lo que te ayuda a crecer y convertir"
                description="Cada página responde una necesidad concreta, con contenido útil y una ruta sencilla para avanzar."
              />

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                {features.map((feature) => (
                  <div key={feature.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                        <p className="text-sm leading-relaxed text-slate-400">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {steps && steps.length > 0 ? (
          <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white/[0.015]">
            <div className="max-w-7xl mx-auto">
              <SectionTitle
                eyebrow="Proceso"
                title="Cómo funciona el recorrido desde la web"
                description="Landing clara + prueba social + CTA directa. Menos fricción, más conversión."
              />

              <div className="grid lg:grid-cols-3 gap-5">
                {steps.map((step, index) => (
                  <div key={step.title} className="relative rounded-2xl border border-white/8 bg-[#0a1628] p-6">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-slate-400 leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {relatedLinks && relatedLinks.length > 0 ? (
          <section className="px-4 sm:px-6 lg:px-8 py-16">
            <div className="max-w-7xl mx-auto">
              <SectionTitle
                eyebrow="Recursos"
                title="Siguientes temas para explorar"
                description="Estos enlaces ordenan el recorrido y llevan al usuario al siguiente paso."
              />

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                {relatedLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="group rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-cyan-500/20 hover:bg-white/[0.05] transition-all"
                  >
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                      <LinkIcon className="w-3.5 h-3.5" />
                      Enlace interno
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-cyan-300 transition-colors">
                      {link.label}
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-400">{link.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {faq && faq.length > 0 ? (
          <section className="px-4 sm:px-6 lg:px-8 py-16 bg-white/[0.015]">
            <div className="max-w-4xl mx-auto">
              <SectionTitle
                eyebrow="FAQ"
                title="Preguntas que suelen frenar conversiones"
                description="Responder estas dudas en la página ayuda a cerrar la venta sin mandar al usuario a otro lado."
              />

              <div className="space-y-4">
                {faq.map((item) => (
                  <div key={item.question} className="rounded-2xl border border-white/8 bg-[#0a1628] p-6">
                    <h3 className="text-lg font-semibold text-white mb-2">{item.question}</h3>
                    <p className="text-slate-400 leading-relaxed">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="px-4 sm:px-6 lg:px-8 py-20">
          <div className="max-w-5xl mx-auto">
            <div className="relative overflow-hidden rounded-3xl border border-white/8">
              <div className="absolute inset-0 bg-gradient-to-br from-[#071a2e] via-[#0a1f35] to-[#071a2e]" />
              <div className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />
              <div className="relative z-10 px-8 py-14 md:px-14 md:py-16 text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-xs font-semibold tracking-widest uppercase text-cyan-300 mb-5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Listo para publicar
                </div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                  Publica estas páginas y conecta tu analítica
                </h2>
                <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
                  El siguiente salto no es solo crear contenido, sino dejarlo enlazado, medible y con una propuesta clara para cada necesidad.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to={primaryAction.to}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-7 py-4 font-semibold text-white hover:shadow-2xl hover:shadow-cyan-500/40 transition-all"
                  >
                    {primaryAction.label}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  {secondaryAction ? (
                    <Link
                      to={secondaryAction.to}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-7 py-4 font-semibold text-white hover:bg-white/5 transition-all"
                    >
                      {secondaryAction.label}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="SendCraft" className="h-6" />
            <span>Plataforma de email marketing y comunicaciones transaccionales</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/docs" className="hover:text-slate-300 transition-colors">Documentación</Link>
            <Link to="/precios" className="hover:text-slate-300 transition-colors">Precios</Link>
            <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacidad</Link>
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Términos</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
