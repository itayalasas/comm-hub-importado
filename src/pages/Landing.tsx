import { Mail, Zap, Shield, Code, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Landing = () => {
  const { login, register } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>

      <nav className="relative border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500 blur-xl opacity-20"></div>
                <Mail className="w-9 h-9 text-cyan-400 relative" />
              </div>
              <div>
                <span className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  CommHub
                </span>
                <div className="flex items-center space-x-1 -mt-1">
                  <Sparkles className="w-3 h-3 text-cyan-400/50" />
                  <span className="text-[10px] text-slate-500 font-medium tracking-wider">
                    BY DOGCATIFY
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={login}
                className="px-5 py-2.5 text-slate-300 hover:text-white transition-colors font-medium"
              >
                Iniciar Sesión
              </button>
              <button
                onClick={register}
                className="group relative px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-medium overflow-hidden transition-all hover:shadow-lg hover:shadow-cyan-500/30"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center space-x-2">
                  <span>Comenzar Gratis</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center mb-16 relative">
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full mb-8">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-cyan-300 font-medium">
                Plataforma de Comunicaciones Profesional
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
              Comunicaciones que
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent animate-gradient">
                impulsan tu negocio
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Gestiona templates, envía emails personalizados y genera PDFs dinámicos
              desde una sola plataforma. Todo con APIs simples y potentes.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={register}
                className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-105"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center space-x-2">
                  <span>Crear Cuenta Gratis</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <button
                onClick={login}
                className="px-8 py-4 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-white rounded-xl font-semibold text-lg transition-all"
              >
                Ver Demo
              </button>
            </div>

            <div className="flex items-center justify-center space-x-8 mt-12 text-sm text-slate-500">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-cyan-400" />
                <span>Sin tarjeta de crédito</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-cyan-400" />
                <span>Configuración en 5 minutos</span>
              </div>
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 text-cyan-400" />
                <span>Soporte 24/7</span>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-24">
            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Code className="w-7 h-7 text-cyan-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Templates Dinámicos</h3>
                <p className="text-slate-400 leading-relaxed mb-6">
                  Crea templates HTML reutilizables con variables dinámicas. Inserta logos, QR codes y genera PDFs automáticamente.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-300">
                    HTML/CSS
                  </span>
                  <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-300">
                    Variables
                  </span>
                  <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-xs text-cyan-300">
                    PDFs
                  </span>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">API Potente</h3>
                <p className="text-slate-400 leading-relaxed mb-6">
                  Integra en minutos con nuestra API REST. Endpoints simples, documentación clara y ejemplos en múltiples lenguajes.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
                    REST API
                  </span>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
                    Webhooks
                  </span>
                  <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
                    SDK
                  </span>
                </div>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 hover:border-cyan-500/50 transition-all hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-7 h-7 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Seguro & Confiable</h3>
                <p className="text-slate-400 leading-relaxed mb-6">
                  Infraestructura robusta con logs detallados, tracking de emails y análisis de rendimiento en tiempo real.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">
                    Encriptación
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">
                    Logs
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-300">
                    Analytics
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-32 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              ¿Listo para empezar?
            </h2>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Únete a cientos de empresas que ya confían en CommHub para sus comunicaciones
            </p>
            <button
              onClick={register}
              className="group relative px-10 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-xl overflow-hidden transition-all hover:shadow-2xl hover:shadow-cyan-500/30 hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center space-x-2">
                <span>Crear Cuenta Gratis</span>
                <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s ease infinite;
        }
      `}</style>
    </div>
  );
};
