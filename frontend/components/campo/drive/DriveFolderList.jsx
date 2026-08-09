'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { DriveFolderItem } from './DriveFolderItem';

export function DriveFolderList({ folders = [], selectedFolderId = '', loading = false, onSelectFolder, onNavigateDown }) {
  return (
    <div className="space-y-2 flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <span className="text-xs font-bold text-slate-300 block">
          Carpetas disponibles
        </span>
        {loading && (
          <span className="text-xs text-sky-400 flex items-center gap-1 font-bold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando...
          </span>
        )}
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[36vh] md:max-h-56 pr-1 custom-scrollbar">
        {folders.length > 0 ? (
          folders.map((folder) => (
            <DriveFolderItem
              key={folder.id}
              folder={folder}
              isSelected={selectedFolderId === folder.id}
              onSelect={onSelectFolder}
              onNavigateDown={onNavigateDown}
            />
          ))
        ) : (
          <div className="bg-[#131c2e] border border-slate-800/80 p-4 rounded-2xl text-center text-xs text-slate-400 font-medium">
            {loading ? 'Buscando carpetas...' : 'No hay subcarpetas en este nivel.'}
          </div>
        )}
      </div>
    </div>
  );
}

