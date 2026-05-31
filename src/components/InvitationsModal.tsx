import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, UserPlus, Mail, RefreshCw, XCircle, CheckCircle,
  Clock, AlertCircle, Send, ChevronDown, Users, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { configManager } from '../lib/config';

interface Role {
  id: string;
  name: string;
  display_name: string;
  description: string;
  is_default: boolean;
  is_active: boolean;
}

interface Invitation {
  id: string;
  email: string;
  name?: string;
  role_id?: string;
  role_name?: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invited_by_email?: string;
  created_at: string;
  expires_at?: string;
}

interface InvitationsModalProps {
  onClose: () => void;
}

const STATUS_CONFIG = {
  pending:  { label: 'Pendiente',  color: 'text-amber-400  bg-amber-500/10  border-amber-500/20',  icon: Clock },
  accepted: { label: 'Aceptada',   color: 'text-green-400  bg-green-500/10  border-green-500/20',  icon: CheckCircle },
  revoked:  { label: 'Revocada',   color: 'text-red-400    bg-red-500/10    border-red-500/20',    icon: XCircle },
  expired:  { label: 'Expirada',   color: 'text-slate-400  bg-slate-700     border-slate-600',     icon: AlertCircle },
};

export const InvitationsModal = ({ onClose }: InvitationsModalProps) => {
  const { user } = useAuth();

  // ── Invite form state ──────────────────────────────────────────────────────
  const [tab, setTab] = useState<'invite' | 'list'>('invite');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  // ── Invitations list state ─────────────────────────────────────────────────
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [revoking, setRevoking] = useState<string | null>(null);

  // ── Load roles on mount ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setRolesLoading(true);
      try {
        const res = await fetch(
          `${configManager.authFunctionsBaseUrl}/list-roles?application_id=${configManager.authAppId}&api_key=${configManager.authApiKey}`
        );
        const json = await res.json();
        if (json.success && json.data?.roles) {
          const active = json.data.roles.filter((r: Role) => r.is_active);
          setRoles(active);
          const def = active.find((r: Role) => r.is_default);
          if (def) setRoleId(def.id);
        }
      } catch {
        // non-blocking: roles will be empty
      } finally {
        setRolesLoading(false);
      }
    };
    load();
  }, []);

  // ── Load invitations ───────────────────────────────────────────────────────
  const loadInvitations = useCallback(async () => {
    if (!user?.email) return;
    setListLoading(true);
    setListError('');
    try {
      const body: Record<string, string> = {
        application_id: configManager.authAppId,
        api_key: configManager.authApiKey,
        invited_by_email: user.email,
      };
      if (filterStatus) body.status = filterStatus;

      const res = await fetch(`${configManager.authFunctionsBaseUrl}/invitations-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        setInvitations(json.data?.invitations || json.data || []);
      } else {
        setListError(json.error?.message || 'Error al cargar invitaciones');
      }
    } catch {
      setListError('Error de conexión');
    } finally {
      setListLoading(false);
    }
  }, [user?.email, filterStatus]);

  useEffect(() => {
    if (tab === 'list') loadInvitations();
  }, [tab, loadInvitations]);

  // ── Send invitation ────────────────────────────────────────────────────────
  const sendInvitation = async () => {
    if (!email.trim() || !roleId) return;
    setSending(true);
    setSendError('');
    setSendSuccess('');
    try {
      const res = await fetch(`${configManager.authFunctionsBaseUrl}/invitations-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: configManager.authAppId,
          api_key: configManager.authApiKey,
          invited_by_email: user?.email || '',
          email: email.trim(),
          role_id: roleId,
          ...(name.trim() ? { name: name.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        const resent = json.data?.resent;
        setSendSuccess(
          resent
            ? `Invitación reenviada a ${email.trim()} (ya tenía una pendiente).`
            : `Invitación enviada exitosamente a ${email.trim()}.`
        );
        setEmail('');
        setName('');
        const def = roles.find(r => r.is_default);
        if (def) setRoleId(def.id);
      } else {
        setSendError(json.error?.message || 'Error al enviar la invitación');
      }
    } catch {
      setSendError('Error de conexión al enviar la invitación');
    } finally {
      setSending(false);
    }
  };

  // ── Revoke invitation ──────────────────────────────────────────────────────
  const revokeInvitation = async (invitationId: string) => {
    if (!user?.email) return;
    setRevoking(invitationId);
    try {
      const res = await fetch(`${configManager.authFunctionsBaseUrl}/invitations-revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: configManager.authAppId,
          api_key: configManager.authApiKey,
          invited_by_email: user.email,
          invitation_id: invitationId,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setInvitations(prev =>
          prev.map(inv => inv.id === invitationId ? { ...inv, status: 'revoked' as const } : inv)
        );
      } else {
        setListError(json.error?.message || 'Error al revocar la invitación');
      }
    } catch {
      setListError('Error de conexión al revocar');
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getInitials = (emailOrName?: string) => {
    if (!emailOrName) return '?';
    return emailOrName.charAt(0).toUpperCase();
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      style={{ margin: 0, left: 0, right: 0 }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Invitaciones</h2>
              {user?.tenant_name && (
                <p className="text-xs text-slate-400 mt-0.5">{user.tenant_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 flex-shrink-0">
          <button
            onClick={() => setTab('invite')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'invite'
                ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            Nueva Invitación
          </button>
          <button
            onClick={() => setTab('list')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              tab === 'list'
                ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Bandeja
            {invitations.filter(i => i.status === 'pending').length > 0 && (
              <span className="ml-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">
                {invitations.filter(i => i.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Invite Tab ── */}
          {tab === 'invite' && (
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-400">
                Invita a un colaborador a unirse al tenant <strong className="text-white">{user?.tenant_name || 'tu organización'}</strong>. Se enviará un email con el link de acceso.
              </p>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nombre <span className="text-slate-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="colaborador@empresa.com"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
                  onKeyDown={e => { if (e.key === 'Enter') sendInvitation(); }}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Rol <span className="text-red-400">*</span>
                </label>
                {rolesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando roles...
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={roleId}
                      onChange={e => setRoleId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors appearance-none pr-10"
                    >
                      <option value="" disabled>Selecciona un rol</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>
                          {role.display_name || role.name}
                          {role.description ? ` — ${role.description}` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Feedback */}
              {sendError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{sendError}</p>
                </div>
              )}
              {sendSuccess && (
                <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-400">{sendSuccess}</p>
                </div>
              )}

              {/* Send button */}
              <button
                onClick={sendInvitation}
                disabled={sending || !email.trim() || !roleId}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sending ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </div>
          )}

          {/* ── List Tab ── */}
          {tab === 'list' && (
            <div className="p-6 space-y-4">
              {/* Filter + refresh */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 appearance-none pr-10"
                  >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendientes</option>
                    <option value="accepted">Aceptadas</option>
                    <option value="revoked">Revocadas</option>
                    <option value="expired">Expiradas</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <button
                  onClick={loadInvitations}
                  disabled={listLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition-colors flex-shrink-0"
                >
                  <RefreshCw className={`w-4 h-4 ${listLoading ? 'animate-spin' : ''}`} />
                  Actualizar
                </button>
              </div>

              {/* Error */}
              {listError && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{listError}</p>
                </div>
              )}

              {/* Loading */}
              {listLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              )}

              {/* Empty */}
              {!listLoading && !listError && invitations.length === 0 && (
                <div className="text-center py-12">
                  <Mail className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No hay invitaciones{filterStatus ? ` con estado "${filterStatus}"` : ''}</p>
                </div>
              )}

              {/* Invitation rows */}
              {!listLoading && invitations.length > 0 && (
                <div className="space-y-2">
                  {invitations.map(inv => {
                    const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                    const StatusIcon = cfg.icon;
                    const canRevoke = inv.status === 'pending';

                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3"
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold border border-slate-600">
                          {getInitials(inv.name || inv.email)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {inv.name || inv.email}
                          </p>
                          {inv.name && (
                            <p className="text-xs text-slate-400 truncate">{inv.email}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {inv.role_name && (
                              <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                {inv.role_name}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">{formatDate(inv.created_at)}</span>
                          </div>
                        </div>

                        {/* Status badge */}
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${cfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>

                        {/* Revoke */}
                        {canRevoke && (
                          <button
                            onClick={() => revokeInvitation(inv.id)}
                            disabled={revoking === inv.id}
                            title="Revocar invitación"
                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          >
                            {revoking === inv.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <XCircle className="w-4 h-4" />
                            }
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-slate-700 p-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;
  return createPortal(modalContent, modalRoot);
};
