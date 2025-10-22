import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail } from 'lucide-react';

export const Settings = () => {
  const { user } = useAuth();

  return (
    <Layout currentPage="settings">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Configuración</h1>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <User className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Perfil de Usuario</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Nombre</label>
              <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                {user?.name || 'N/A'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
              <div className="flex items-center space-x-2 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white">
                <Mail className="w-4 h-4 text-slate-500" />
                <span>{user?.email || 'N/A'}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">User ID</label>
              <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                <code className="text-sm text-cyan-400 font-mono break-all">
                  {user?.sub || 'N/A'}
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Información</h3>
          <p className="text-slate-400 text-sm">
            Para cambiar tu información de perfil, por favor contacta al administrador del sistema.
          </p>
        </div>
      </div>
    </Layout>
  );
};
