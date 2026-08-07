'use client';

import React from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, FileEdit, CheckCircle2 } from 'lucide-react';
import { vibrar } from '../../utils/haptics';

export function BadgeEstadoSync({ isOnline, pendingCount, errorCount, draftCount, forceSync, retryErrors }) {
  const [isSyncing, setIsSyncing] = React.useState(false);

  const handleForceSync = async () => {
    vibrar(30);
    setIsSyncing(true);
    try {
      await forceSync();
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryErrors = async () => {
    vibrar(40);
    setIsSyncing(true);
    try {
      await retryErrors();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="w-full border-b-2 p-3 sticky top-0 z-50 shadow-2xl" style={{ backgroundColor: '#090d16', borderColor: '#1e293b' }}>
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Estado de Red */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider" style={{ backgroundColor: '#022c22', color: '#34d399', border: '1px solid #059669' }}>
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse-fast" style={{ color: '#34d399' }} />
              ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider" style={{ backgroundColor: '#451a03', color: '#fbbf24', border: '1px solid #d97706' }}>
              <WifiOff className="w-4 h-4 text-amber-400" style={{ color: '#fbbf24' }} />
              OFFLINE (MODO CAMPO)
            </span>
          )}
        </div>

        {/* Indicadores de Cola */}
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: '#0f172a', color: '#7dd3fc', border: '1px solid #0284c7' }}>
              <FileEdit className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} />
              Borrador: {draftCount}
            </span>
          )}

          {errorCount > 0 ? (
            <button
              type="button"
              onClick={handleRetryErrors}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black shadow active:scale-95 animate-bounce"
              style={{ backgroundColor: '#dc2626', color: '#ffffff', border: '1px solid #f87171' }}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Error: {errorCount} (Reintentar)
            </button>
          ) : pendingCount > 0 ? (
            <button
              type="button"
              onClick={handleForceSync}
              disabled={!isOnline || isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black shadow active:scale-95"
              style={{ backgroundColor: '#d97706', color: '#000000', border: '1px solid #fbbf24' }}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              ⏳ Pendiente: {pendingCount}
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1" style={{ color: '#94a3b8' }}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" style={{ color: '#34d399' }} />
              Al día
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
