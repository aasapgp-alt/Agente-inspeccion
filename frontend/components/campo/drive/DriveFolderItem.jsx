'use client';

import React from 'react';
import { Folder, ChevronRight } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

export function DriveFolderItem({ folder, isSelected = false, onSelect, onNavigateDown }) {
  return (
    <div
      onClick={() => {
        vibrar(20);
        if (onSelect) onSelect(folder.id, folder.title);
      }}
      className={`h-[56px] px-3.5 bg-[#131c2e] hover:bg-[#1a263d] border border-slate-800/80 rounded-2xl flex items-center justify-between transition-all cursor-pointer shadow-sm active:scale-[0.99] ${
        isSelected ? 'border-sky-500 bg-sky-950/30' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
        <Folder className="w-5 h-5 text-amber-400 shrink-0" />
        <span className="font-bold text-xs text-slate-100 truncate block">
          {folder.title}
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onNavigateDown) onNavigateDown(folder);
        }}
        className="p-1.5 text-slate-400 hover:text-white shrink-0 rounded-lg active:bg-slate-800"
        aria-label={`Abrir subcarpeta ${folder.title}`}
      >
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </button>
    </div>
  );
}

