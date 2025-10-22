import { Mail, Code, Zap, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Landing = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <nav className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Mail className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold text-white">CommHub</span>
            </div>
            <button
              onClick={login}
              className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-6">
            Gestiona tus Comunicaciones
            <span className="text-cyan-400"> con Facilidad</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
            CommHub es tu plataforma todo-en-uno para gestionar templates de email,
            generar PDFs y enviar comunicaciones profesionales desde tus aplicaciones.
          </p>
          <button
            onClick={login}
            className="px-8 py-4 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors font-medium text-lg"
          >
            Comenzar Ahora
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 hover:border-cyan-500/50 transition-colors">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
              <Code className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Templates Dinámicos</h3>
            <p className="text-slate-400">
              Crea templates de email con HTML y variables dinámicas. Personaliza cada comunicación
              con datos de tus usuarios.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 hover:border-cyan-500/50 transition-colors">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">API Rápida</h3>
            <p className="text-slate-400">
              Integra fácilmente con tu aplicación usando nuestra API REST. Envía emails en
              segundos desde cualquier plataforma.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-8 hover:border-cyan-500/50 transition-colors">
            <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Seguro y Confiable</h3>
            <p className="text-slate-400">
              Tus datos están seguros con encriptación de extremo a extremo. Logs detallados de
              todas las comunicaciones.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
