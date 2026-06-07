import { useState } from 'react';
import { Shield, Check, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [pendingAction, setPendingAction] = useState<'login' | 'register' | null>(null);

  const handleLogin = async () => {
    if (pendingAction) return;
    setPendingAction('login');
    try {
      await login();
    } catch (error) {
      console.error(error);
      setPendingAction(null);
    }
  };

  const handleRegister = async () => {
    if (pendingAction) return;
    setPendingAction('register');
    try {
      await register();
    } catch (error) {
      console.error(error);
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex">
      <div className="w-full lg:w-1/2 bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 p-12 flex flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPBlVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50"></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-16">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-lg opacity-30"></div>
              <img src="/logo.svg" alt="SendCraft" className="h-10 relative" />
            </div>
          </div>

          <div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Bienvenido a SendCraft
            </h1>
            <p className="text-xl text-white/90 mb-12 leading-relaxed max-w-lg">
              Accede a tu cuenta y gestiona emails, templates y campanas desde SendCraft de forma segura y eficiente.
            </p>

            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Seguridad Avanzada</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Autenticacion empresarial con altos estandares de seguridad.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl flex items-center justify-center">
                  <ArrowRight className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Acceso Rapido</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Inicia sesion en segundos con tu cuenta empresarial.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-cyan-500/10 backdrop-blur-sm border border-cyan-500/20 rounded-xl flex items-center justify-center">
                  <Check className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">Gestion Unificada</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Administra comunicaciones, templates y analitica desde un solo lugar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-slate-400">
          Copyright 2024 SendCraft. Todos los derechos reservados.
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 bg-gradient-to-br from-slate-900 to-slate-950">
        <div className="w-full max-w-md">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border border-cyan-500/30 rounded-2xl mb-6">
                <Shield className="w-10 h-10 text-cyan-400" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-3">Iniciar Sesion</h2>
              <p className="text-slate-400">
                Usa tu sistema de autenticacion empresarial para acceder de forma segura.
              </p>
            </div>

            <button
              onClick={handleLogin}
              disabled={pendingAction === 'login'}
              className="w-full group relative px-6 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] mb-6 disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative flex items-center justify-center gap-2">
                {pendingAction === 'login' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                <span>{pendingAction === 'login' ? 'Iniciando...' : 'Iniciar Sesion'}</span>
                {pendingAction === 'login' ? null : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              </span>
            </button>

            <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-6">
              <h4 className="text-sm font-semibold text-white mb-3">
                Por que usar autenticacion empresarial?
              </h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Maxima seguridad con encriptacion avanzada.</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Acceso unificado a todos tus servicios.</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Gestion centralizada de permisos y roles.</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span>Soporte tecnico especializado.</span>
                </li>
              </ul>
            </div>

            <div className="text-center mt-8">
              <p className="text-slate-400 text-sm">
                No tienes cuenta?{' '}
                <button
                  onClick={handleRegister}
                  disabled={pendingAction === 'register'}
                  className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {pendingAction === 'register' ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Iniciando...
                    </span>
                  ) : 'Crear cuenta'}
                </button>
              </p>
            </div>

            <div className="text-center mt-6">
              <button
                onClick={() => navigate('/')}
                className="text-slate-500 text-sm hover:text-slate-400 transition-colors inline-flex items-center space-x-1"
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                <span>Volver al inicio</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-6">
        <button
          onClick={handleLogin}
          disabled={pendingAction === 'login'}
          className="w-full group relative px-6 py-4 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-semibold text-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-cyan-500/30 disabled:opacity-80 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <span className="relative flex items-center justify-center gap-2">
            {pendingAction === 'login' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            <span>{pendingAction === 'login' ? 'Iniciando...' : 'Iniciar Sesion'}</span>
            {pendingAction === 'login' ? null : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </span>
        </button>
        <div className="text-center mt-4">
          <p className="text-slate-400 text-sm">
            No tienes cuenta?{' '}
            <button
              onClick={handleRegister}
              disabled={pendingAction === 'register'}
              className="text-cyan-400 font-semibold hover:text-cyan-300 transition-colors disabled:opacity-80 disabled:cursor-not-allowed"
            >
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
