'use client';

import React from 'react';
import { WifiOff, RefreshCw, AlertTriangle, FileEdit, CheckCircle2 } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';
import { CampoBadge } from '../shared/CampoBadge';

export function CampoStatusBar({
  isOnline,
  pendingCount,
  errorCount,
  draftCount,
  forceSync,
  retryErrors
}) {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleForceSync = async () => {
    vibrar(30);
    setIsSyncing(true);
    try {
      if (forceSync) await forceSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryErrors = async () => {
    vibrar(40);
    setIsSyncing(true);
    try {
      if (retryErrors) await retryErrors();
    } finally {
      setIsSyncing(false);
    }
  };

  // Render sync bar only when offline or when there are drafts, errors or pending items to sync
  if (isOnline && draftCount === 0 && errorCount === 0 && pendingCount === 0) {
    return null;
  }

  return (
    <div className="w-full bg-slate-900/90 border-b border-slate-800 px-3 py-1.5 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2 text-xs font-bold">
        {/* Estado de Red */}
        <div className="flex items-center gap-1.5">
          <CampoBadge
            status={isOnline ? 'online' : 'offline'}
            label={isOnline ? 'ONLINE' : 'OFFLINE (MODO CAMPO)'}
          />
        </div>

        {/* Indicadores de Cola */}
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-sky-300">
              <FileEdit className="w-3 h-3 text-sky-400" />
              Borradores: {draftCount}
            </span>
          )}

          {errorCount > 0 ? (
            <button
              type="button"
              onClick={handleRetryErrors}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-black transition-transform active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Error: {errorCount}
            </button>
          ) : pendingCount > 0 ? (
            <button
              type="button"
              onClick={handleForceSync}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-black text-[11px] font-black transition-transform active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar: {pendingCount}
            </button>
          ) : (
            <CampoBadge status="completado" label="Al día" />
          )}
        </div>
      </div>
    </div>
  );
}

export default CampoStatusBar;
