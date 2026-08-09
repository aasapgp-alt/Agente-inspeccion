'use client';

import React from 'react';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

export function EquipoHeader({ codigoActivo, nombreActivo, onVolver, onOpenOptions }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 pt-1">
      {/* Botón Volver ← Equipo */}
      <button
        type="button"
        onClick={() => {
          vibrar(20);
          if (onVolver) onVolver();
        }}
        className="flex items-center gap-1.5 px-3 py-2 bg-[#131c2e] hover:bg-[#1a263d] text-slate-200 hover:text-white rounded-xl border border-slate-800 text-xs font-bold transition-all active:scale-95 shadow-sm touch-target min-h-[44px]"
        aria-label="Volver a equipos"
      >
        <ArrowLeft className="w-4 h-4 text-sky-400 shrink-0" />
        <span>Equipo</span>
      </button>

      {/* Código · Nombre */}
      <div className="text-center px-2 flex-1 min-w-0">
        <h2 className="text-sm font-black text-white m-0 leading-tight truncate">
          <span className="text-sky-400">{codigoActivo}</span>
          <span className="text-slate-500 mx-1.5">·</span>
          <span className="text-slate-100">{nombreActivo}</span>
        </h2>
      </div>

      {/* Menú de Opciones */}
      <button
        type="button"
        onClick={() => {
          vibrar(20);
          if (onOpenOptions) onOpenOptions();
        }}
        className="p-2.5 bg-[#131c2e] hover:bg-[#1a263d] text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all active:scale-95 shrink-0 shadow-sm touch-target min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Opciones e Historial"
        title="Historial y opciones"
      >
        <MoreHorizontal className="w-4 h-4 text-slate-300" />
      </button>
    </div>
  );
}

export default EquipoHeader;
