'use client';

import React from 'react';
import { ArrowUp, Pin, Plus, CheckCircle2 } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';
import { CampoSection } from '../shared/CampoSection';
import { CampoCard } from '../shared/CampoCard';
import { CampoButton } from '../shared/CampoButton';
import { CampoInput } from '../shared/CampoInput';

export function DriveFolderActions({
  canGoUp = false,
  onGoUp,
  currentFolderTitle = 'Raíz de Drive',
  currentFolderId = '',
  selectedFolderId = '',
  onSelectCurrentFolder,
  showCreateForm = false,
  onToggleCreateForm,
  newFolderName = '',
  onNewFolderNameChange,
  onCreateFolder,
  creating = false
}) {
  return (
    <CampoSection title="Acciones">
      <div className="space-y-2">
        {/* ↑ Subir nivel */}
        <button
          type="button"
          onClick={onGoUp}
          disabled={!canGoUp}
          className="w-full text-left"
        >
          <CampoCard interactive={canGoUp} padding="small" className={`h-[50px] flex items-center gap-3 ${!canGoUp ? 'opacity-40 cursor-not-allowed' : ''}`}>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <ArrowUp className="w-4 h-4 text-sky-400" />
            </div>
            <span className="font-bold text-xs text-slate-200">Subir nivel</span>
          </CampoCard>
        </button>

        {/* 📌 Carpeta actual */}
        <button
          type="button"
          onClick={() => {
            vibrar(20);
            if (onSelectCurrentFolder) onSelectCurrentFolder(currentFolderId, currentFolderTitle);
          }}
          className="w-full text-left"
        >
          <CampoCard
            interactive
            padding="small"
            className={`h-[50px] flex items-center justify-between ${
              selectedFolderId === currentFolderId ? 'border-sky-500 bg-sky-950/20' : ''
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Pin className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-xs text-slate-200 block truncate">Carpeta actual</span>
                <span className="text-[11px] text-slate-400 truncate block">{currentFolderTitle}</span>
              </div>
            </div>
            {selectedFolderId === currentFolderId && (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 ml-2" />
            )}
          </CampoCard>
        </button>

        {/* ＋ Nueva carpeta */}
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => {
              vibrar(20);
              if (onToggleCreateForm) onToggleCreateForm(true);
            }}
            className="w-full text-left"
          >
            <CampoCard interactive padding="small" className="h-[50px] flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4 text-sky-400" />
              </div>
              <span className="font-bold text-xs text-slate-200">Nueva carpeta</span>
            </CampoCard>
          </button>
        ) : (
          <CampoCard padding="small" className="border-sky-500 space-y-2">
            <form onSubmit={onCreateFolder} className="space-y-2">
              <CampoInput
                type="text"
                value={newFolderName}
                onChange={(e) => onNewFolderNameChange(e.target.value)}
                placeholder="Nombre de la nueva carpeta..."
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1">
                <CampoButton
                  type="button"
                  variant="secondary"
                  size="small"
                  fullWidth={false}
                  onClick={() => onToggleCreateForm(false)}
                >
                  Cancelar
                </CampoButton>
                <CampoButton
                  type="submit"
                  variant="primary"
                  size="small"
                  fullWidth={false}
                  disabled={creating}
                >
                  {creating ? 'Creando...' : 'Crear'}
                </CampoButton>
              </div>
            </form>
          </CampoCard>
        )}
      </div>
    </CampoSection>
  );
}

export default DriveFolderActions;
