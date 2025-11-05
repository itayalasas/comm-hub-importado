import { useState } from 'react';
import { X, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserProfileModalProps {
  onClose: () => void;
}

export const UserProfileModal = ({ onClose }: UserProfileModalProps) => {
  const { user } = useAuth();
  const [isEditing] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <UserIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-2xl font-bold text-white">Perfil de Usuario</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-6 pb-6 border-b border-slate-700">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-24 h-24 rounded-full border-4 border-cyan-400/30"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center border-4 border-cyan-400/30">
                <span className="text-white text-3xl font-bold">
                  {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold text-white">{user?.name || 'Usuario'}</h3>
              <p className="text-slate-400">{user?.email}</p>
              {user?.role && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {user.role}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={user?.name || ''}
                disabled={!isEditing}
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white opacity-60 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-slate-500">
                El email no puede ser modificado
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                User ID
              </label>
              <div className="px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg">
                <code className="text-xs text-cyan-400 break-all">{user?.sub}</code>
              </div>
            </div>

            {user?.role && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Rol
                </label>
                <input
                  type="text"
                  value={user.role}
                  disabled
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-white opacity-60 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-slate-500">
                  El rol es gestionado por el administrador del sistema
                </p>
              </div>
            )}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              ℹ️ La edición del perfil estará disponible próximamente. Por ahora, los cambios deben realizarse desde el sistema de autenticación.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
