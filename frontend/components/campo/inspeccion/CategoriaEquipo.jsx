'use client';

import React from 'react';
import { vibrar } from '../../../utils/haptics';

export function CategoriaEquipo({ categoriaSeleccionada, onSelectCategoria, categorias = ['Succión', 'Impulsión', 'General'] }) {
  return (
    <div className="space-y-1 pt-1">
      <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
        Fotografías a subir
      </span>
      <div className="grid grid-cols-3 gap-2">
        {categorias.map((cat) => {
          const isSelected = categoriaSeleccionada === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                vibrar(20);
                if (onSelectCategoria) onSelectCategoria(cat);
              }}
              className={`py-2 px-1 text-xs font-black rounded-xl border transition-all text-center uppercase tracking-wide active:scale-95 shadow-sm ${
                isSelected
                  ? 'bg-[#0284c7] text-white border-sky-400 shadow-sky-950/40'
                  : 'bg-[#131c2e] text-slate-300 border-slate-800 hover:bg-[#1a263d] hover:text-white'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

