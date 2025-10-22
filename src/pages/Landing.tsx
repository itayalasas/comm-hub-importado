import { Mail, Shield, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Landing = () => {
  const { login, register } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 p-12 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-16">
            <div className="relative">
              <div className="absolute inset-0 bg-white blur-lg opacity-30"></div>
              <Mail className="w-10 h-10 text-white relative" />
            </div>
            <div>
              <span className="text-2xl font-bold text-white">
                CommHub
              </span>
              <div className="flex items-center space-x-1 -mt-1">
                <Sparkles className="w-3 h-3 text-white/70" />
                <span className="text-[10px] text-white/70 font-medium tracking-wider">
                  BY DOGCATIFY
                </span>
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Bienvenido de vuelta
            </h1>
            <p className="text-xl text-white/90 mb-12 leading-relaxed max-w-lg">
              Accede a tu cuenta y gestiona tus comunicaciones, templates y campañas de forma segura y eficiente.
            </p>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Seguridad Avanzada</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Autenticación empresarial con los más altos estándares de seguridad
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Acceso Rápido</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Inicia sesión en segundos con tu cuenta empresarial
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Gestión Unificada</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Administra comunicaciones, templates y análisis desde un solo lugar
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-white/60">
          © 2024 CommHub. Todos los derechos reservados.
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 items-center justify-center p-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6">
                <Shield className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Iniciar Sesión</h2>
              <p className="text-slate-600">
                Usa tu sistema de autenticación empresarial para acceder de forma segura
              </p>
            </div>

            <button
              onClick={login}
              className="w-full group relative px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:scale-[1.02] mb-6"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center justify-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>Iniciar Sesión</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">
                ¿Por qué usar autenticación empresarial?
              </h4>
              <ul className="space-y-2 text-sm text-slate-700">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Máxima seguridad con encriptación avanzada</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Acceso unificado a todos tus servicios</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Gestión centralizada de permisos y roles</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span>Soporte técnico especializado 24/7</span>
                </li>
              </ul>
            </div>

            <div className="text-center mt-8">
              <p className="text-slate-600 text-sm">
                ¿No tienes cuenta?{' '}
                <button
                  onClick={register}
                  className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
                >
                  Crear cuenta
                </button>
              </p>
            </div>

            <div className="text-center mt-6">
              <a
                href="#"
                className="text-slate-500 text-sm hover:text-slate-700 transition-colors inline-flex items-center space-x-1"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span>Volver al inicio</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-6">
        <button
          onClick={login}
          className="w-full group relative px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/30"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative flex items-center justify-center space-x-2">
            <Shield className="w-5 h-5" />
            <span>Iniciar Sesión</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </span>
        </button>
        <div className="text-center mt-4">
          <p className="text-slate-600 text-sm">
            ¿No tienes cuenta?{' '}
            <button
              onClick={register}
              className="text-blue-600 font-semibold hover:text-blue-700 transition-colors"
            >
              Crear cuenta
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
