import React from 'react';
import { AlertTriangle, Lock } from 'lucide-react';

interface SingleSessionModalProps {
  conflictInfo: {
    deviceLabel: string;
  } | null;
  kickedMessage: string | null;
  busy: boolean;
  onCancelConflict: () => void;
  onTakeOverSession: () => void;
  onDismissKicked: () => void;
}

export const SingleSessionModal: React.FC<SingleSessionModalProps> = ({
  conflictInfo,
  kickedMessage,
  busy,
  onCancelConflict,
  onTakeOverSession,
  onDismissKicked,
}) => {
  if (!conflictInfo && !kickedMessage) return null;

  if (kickedMessage) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Active Session Ended
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            {kickedMessage}
          </p>
          <button
            type="button"
            onClick={onDismissKicked}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] transition-colors"
          >
            Acknowledge
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-xl p-5 sm:p-6 space-y-4 sm:space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-800 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Account Already Logged In
          </h2>
        </div>

        <p className="text-sm text-slate-600 leading-relaxed">
          This account is currently active on{' '}
          <span className="font-semibold text-slate-900">{conflictInfo?.deviceLabel}</span>.
          LAW STEAD allows only one person to be logged in at the same time.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={onCancelConflict}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors text-center"
          >
            Cancel Login
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onTakeOverSession}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors text-center"
          >
            {busy ? 'Switching...' : 'Log In Here & End Other'}
          </button>
        </div>
      </div>
    </div>
  );
};
