import { useState, useRef, useEffect } from 'react';
import { User, CreditCard, LogOut, ChevronDown, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserProfileModal } from './UserProfileModal';
import { SubscriptionModal } from './SubscriptionModal';
import { InvitationsModal } from './InvitationsModal';

export const UserMenu = () => {
  const { user, logout, subscription, subscriptionHasAccess, isSystemAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showInvitationsModal, setShowInvitationsModal] = useState(false);

  const isAdmin = isSystemAdmin || user?.role === 'administrador' || user?.role === 'admin';
  const menuRef = useRef<HTMLDivElement>(null);
  const normalizedStatus = String(subscription?.status ?? '').toLowerCase();
  const trialEnd = subscription?.trial_end ? new Date(subscription.trial_end) : null;
  const accessUntilSource =
    subscription?.current_period_end ||
    subscription?.period_end ||
    subscription?.next_payment_date ||
    subscription?.trial_end ||
    null;
  const accessUntilDate = accessUntilSource ? new Date(accessUntilSource) : null;
  const trialActive = normalizedStatus === 'trialing' && trialEnd !== null && trialEnd >= new Date();
  const accessWindowActive =
    accessUntilDate !== null &&
    !Number.isNaN(accessUntilDate.getTime()) &&
    accessUntilDate >= new Date();
  const isCancellationScheduled =
    normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
  const isCancellationPending = isCancellationScheduled && accessWindowActive;
  const isCancellationExpired = isCancellationScheduled && !accessWindowActive;
  const isFreeActivePlan =
    normalizedStatus === 'active' && typeof subscription?.plan_price === 'number' && subscription.plan_price === 0;
  const subscriptionLabel = isSystemAdmin
    ? 'Administrador'
    : trialActive
    ? 'En prueba'
    : isCancellationPending
    ? 'Cancelada'
    : isCancellationExpired
    ? 'Cancelada'
    : subscriptionHasAccess === true || normalizedStatus === 'authorized' || isFreeActivePlan || accessWindowActive || normalizedStatus === 'active'
    ? 'Activa'
    : subscription?.status
    ? String(subscription.status).replace(/_/g, ' ')
    : 'Sin plan';
  const subscriptionBadgeTitle = isCancellationPending
    ? 'Se canceló, pero sigue vigente hasta que termine el período actual'
    : isCancellationExpired
    ? 'Suscripción cancelada'
    : trialActive
    ? 'Suscripción en prueba'
    : 'Estado de la suscripción';
  const subscriptionBadgeClass =
    isCancellationPending
      ? 'bg-amber-500/10 text-amber-300'
      : isCancellationExpired
      ? 'bg-red-500/10 text-red-400'
      : isSystemAdmin
      ? 'bg-cyan-500/10 text-cyan-300'
      : subscriptionHasAccess === true || normalizedStatus === 'authorized' || isFreeActivePlan || accessWindowActive || normalizedStatus === 'active'
      ? 'bg-green-500/10 text-green-400'
      : trialActive
      ? 'bg-blue-500/10 text-blue-400'
      : 'bg-red-500/10 text-red-400';

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
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {user?.role && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    {user.role}
                  </span>
                )}
                {user?.tenant_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
                    <Building2 className="w-3 h-3" />
                    {user.tenant_name}
                  </span>
                )}
              </div>
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

              {isAdmin && (
                <button
                  onClick={() => {
                    setShowInvitationsModal(true);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center space-x-3 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invitaciones</span>
                </button>
              )}

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
                    <span
                      className={`text-xs px-2 py-0.5 rounded whitespace-nowrap ${subscriptionBadgeClass}`}
                      title={subscriptionBadgeTitle}
                    >
                      {subscriptionLabel}
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

      {showInvitationsModal && (
        <InvitationsModal onClose={() => setShowInvitationsModal(false)} />
      )}
    </>
  );
};
