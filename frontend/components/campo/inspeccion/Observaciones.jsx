'use client';

import React from 'react';
import { Mic } from 'lucide-react';

export function Observaciones({
  notasTexto,
  onNotasChange,
  isEscuchandoDictado,
  onToggleDictadoVoz,
  onClearNotas
}) {
  return (
    <div className="space-y-1.5 my-2">
      <div className="flex items-center justify-between px-0.5">
        <label htmlFor="notas-campo" className="block text-xs font-bold text-slate-300">
          Observaciones
        </label>
        <span className="text-[11px] text-slate-400 font-semibold">
          {notasTexto?.length || 0} caracteres
        </span>
      </div>

      <div className="relative bg-[#131c2e] border border-slate-800 focus-within:border-sky-500 rounded-xl p-3 shadow-inner transition-colors">
        <textarea
          id="notas-campo"
          rows={3}
          value={notasTexto}
          onChange={onNotasChange}
          placeholder="Escriba o use el dictado de voz..."
          className="w-full bg-transparent text-slate-100 text-xs font-medium placeholder:text-slate-500 focus:outline-none resize-none pr-10 leading-relaxed"
        />
        <button
          type="button"
          onClick={onToggleDictadoVoz}
          className={`absolute right-2.5 bottom-2.5 p-2.5 rounded-xl transition-all active:scale-90 touch-target min-h-[44px] min-w-[44px] flex items-center justify-center ${
            isEscuchandoDictado
              ? 'text-red-400 bg-red-950/90 border border-red-500/60 animate-pulse shadow-md shadow-red-950/40'
              : 'text-sky-400 bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/60'
          }`}
          title="Dictado por voz (Web Speech API)"
          aria-label="Dictado por voz"
        >
          <Mic className="w-4 h-4" />
        </button>
      </div>

      {notasTexto && (
        <div className="flex justify-end px-0.5 pt-0.5">
          <button
            type="button"
            onClick={onClearNotas || (() => onNotasChange({ target: { value: '' } }))}
            className="text-[11px] text-slate-400 hover:text-slate-200 font-semibold p-1 touch-target min-h-[44px]"
          >
            Limpiar observaciones
          </button>
        </div>
      )}
    </div>
  );
}

export default Observaciones;
