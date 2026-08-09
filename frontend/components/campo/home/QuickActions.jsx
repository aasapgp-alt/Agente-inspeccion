'use client';

import React from 'react';
import Link from 'next/link';
import { ClipboardList, Clock, HardDrive, AlertCircle } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';
import { CampoSection } from '../shared/CampoSection';
import { CampoCard } from '../shared/CampoCard';

export function QuickActions({ pendingCount = 0, onOpenDrive }) {
  return (
    <CampoSection title="Accesos rápidos">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Equipos */}
        <Link
          href="/campo/buscar"
          onClick={() => vibrar(20)}
          style={{ textDecoration: 'none' }}
        >
          <CampoCard interactive padding="small" className="h-[52px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-950/90 border border-sky-800/80 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-sky-400" />
            </div>
            <span className="font-bold text-xs text-slate-100 truncate">Equipos</span>
          </CampoCard>
        </Link>

        {/* Historial */}
        <Link
          href="/campo"
          onClick={() => vibrar(20)}
          style={{ textDecoration: 'none' }}
        >
          <CampoCard interactive padding="small" className="h-[52px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/90 border border-emerald-800/80 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-bold text-xs text-slate-100 truncate">Historial</span>
          </CampoCard>
        </Link>

        {/* Drive / Planta */}
        <button
          type="button"
          onClick={() => {
            vibrar(25);
            if (onOpenDrive) onOpenDrive();
          }}
          className="w-full text-left bg-transparent border-0 p-0 shadow-none outline-none cursor-pointer block"
        >
          <CampoCard interactive padding="small" className="h-[52px] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950/90 border border-amber-800/80 flex items-center justify-center shrink-0">
              <HardDrive className="w-4 h-4 text-amber-400" />
            </div>
            <span className="font-bold text-xs text-slate-100 truncate">Drive / Planta</span>
          </CampoCard>
        </button>

        {/* Pendientes */}
        <button
          type="button"
          onClick={() => vibrar(20)}
          className="w-full text-left bg-transparent border-0 p-0 shadow-none outline-none cursor-pointer block"
        >
          <CampoCard interactive padding="small" className="h-[52px] flex items-center gap-2.5 relative">
            <div className="w-8 h-8 rounded-lg bg-red-950/90 border border-red-800/80 flex items-center justify-center shrink-0 relative">
              <AlertCircle className="w-4 h-4 text-red-400" />
              {(pendingCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-md">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className="font-bold text-xs text-slate-100 truncate">Pendientes</span>
          </CampoCard>
        </button>
      </div>
    </CampoSection>
  );
}

export default QuickActions;
