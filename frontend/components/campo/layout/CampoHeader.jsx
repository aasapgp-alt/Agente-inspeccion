'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { UserCard } from '../home/UserCard';

export function CampoHeader({ usuarioActual, isOnline, onOpenNotifications }) {
  const nombreInspector = usuarioActual?.nombre_completo?.split(' ')[0] || usuarioActual?.username || 'Diego';

  return (
    <div className="space-y-3">
      {/* Top Status Bar & Bell */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenNotifications}
          className="p-1 text-slate-400 hover:text-white bg-transparent border-0 shadow-none outline-none cursor-pointer transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="w-5 h-5 text-slate-300" />
        </button>
      </div>

      {/* Greeting Header */}
      <div className="space-y-1">
        <span className="text-xs font-bold text-sky-400 block tracking-wide">
          Hola, {nombreInspector}
        </span>
        <h1 className="text-2xl font-black tracking-tight text-white m-0 leading-tight">
          Inspector PGP
        </h1>
        <p className="text-xs text-slate-400 font-medium m-0">
          Todo listo para tu jornada
        </p>
      </div>

      {/* User Card */}
      <UserCard usuarioActual={usuarioActual} />
    </div>
  );
}
