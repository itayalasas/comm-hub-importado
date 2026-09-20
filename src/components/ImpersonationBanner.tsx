import { useState } from 'react';
import { UserCog, LogOut, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const ImpersonationBanner = () => {
  const { impersonation, endImpersonation } = useAuth();
  const [isEnding, setIsEnding] = useState(false);

  if (!impersonation) return null;

  const handleEnd = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      await endImpersonation();
    } catch {
      setIsEnding(false);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-600/90 to-orange-700/90 border-b border-amber-400/40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <UserCog className="w-4 h-4 text-amber-100 flex-shrink-0" />
          <p className="text-sm text-amber-50 font-medium">
            Viendo como <span className="font-bold text-white">{impersonation.target.name || impersonation.target.email}</span>
            {' '}({impersonation.target.email}) · Motivo: {impersonation.reason}
          </p>
        </div>
        <button
          type="button"
          onClick={handleEnd}
          disabled={isEnding}
          className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/40 bg-black/20 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-black/30 disabled:opacity-60"
        >
          {isEnding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
          Volver a administrador
        </button>
      </div>
    </div>
  );
};
