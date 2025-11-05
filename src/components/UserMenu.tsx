import { useState, useRef, useEffect } from 'react';
import { User, CreditCard, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfileModal } from './UserProfileModal';
import { SubscriptionModal } from './SubscriptionModal';

export const UserMenu = () => {
  const { user, logout, subscription } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center space-x-3">
            {user?.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-9 h-9 rounded-full border-2 border-cyan-400/30"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center border-2 border-cyan-400/30">
                <span className="text-white text-sm font-semibold">
                  {getInitials(user?.name)}
                </span>
              </div>
            )}
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-white">{user?.name || 'Usuario'}</div>
              <div className="text-xs text-slate-400">{user?.email}</div>
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl shadow-black/50 z-[100]">
            <div className="p-3 border-b border-slate-700">
              <div className="text-sm font-medium text-white">{user?.name}</div>
              <div className="text-xs text-slate-400">{user?.email}</div>
              {user?.role && (
                <div className="mt-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {user.role}
                  </span>
                </div>
              )}
            </div>

            <div className="py-2">
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center space-x-3 transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Mi Perfil</span>
              </button>

              <button
                onClick={() => {
                  setShowSubscriptionModal(true);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center space-x-3 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                <div className="flex-1 flex items-center justify-between">
                  <span>Suscripción</span>
                  {subscription && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      subscription.status === 'active'
                        ? 'bg-green-500/10 text-green-400'
                        : subscription.status === 'trialing'
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {subscription.status === 'trialing' ? 'Trial' : subscription.status}
                    </span>
                  )}
                </div>
              </button>
            </div>

            <div className="border-t border-slate-700 py-2">
              <button
                onClick={() => {
                  logout();
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center space-x-3 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showProfileModal && (
        <UserProfileModal onClose={() => setShowProfileModal(false)} />
      )}

      {showSubscriptionModal && (
        <SubscriptionModal onClose={() => setShowSubscriptionModal(false)} />
      )}
    </>
  );
};
