'use client';

import React, { useState, useEffect } from 'react';
import { HardDrive, CheckCircle2, X, ArrowLeft, ChevronRight } from 'lucide-react';
import { apiService } from '../../../services/api';
import { vibrar } from '../../../utils/haptics';
import { DriveFolderList } from './DriveFolderList';
import { DriveFolderActions } from './DriveFolderActions';

export function DriveMobile({ token, onSelectFolder, initialFolderId = '', onClose }) {
  const [currentFolderId, setCurrentFolderId] = useState('');
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [navStack, setNavStack] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState({ id: '', title: '', path: '' });

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const initDrive = async () => {
      setLoading(true);
      try {
        let targetId = initialFolderId || '';
        let initialStack = [];

        if (initialFolderId) {
          const ancestroData = await apiService.getDriveAncestro(initialFolderId, token);
          if (ancestroData?.ancestro && ancestroData.ancestro.length > 0) {
            initialStack = ancestroData.ancestro;
            targetId = initialStack[initialStack.length - 1].id;
          } else {
            initialStack = [{ id: initialFolderId, title: 'Carpeta seleccionada' }];
            targetId = initialFolderId;
          }
        } else {
          const rootData = await apiService.getDriveRoot(token);
          const rootId = rootData?.root_id || '1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD';
          initialStack = [{ id: rootId, title: 'Raíz de Drive' }];
          targetId = rootId;
        }

        setCurrentFolderId(targetId);
        setNavStack(initialStack);
        const currentTitle = initialStack[initialStack.length - 1].title;
        const fullPath = initialStack.map(item => item.title).join(' / ');
        setSelectedFolder({ id: targetId, title: currentTitle, path: fullPath });
        if (onSelectFolder) onSelectFolder(targetId, currentTitle, fullPath);

        await fetchSubfolders(targetId);
      } catch (err) {
        console.error('Error initializing Drive selector:', err);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      initDrive();
    }
  }, [token, initialFolderId]);

  const fetchSubfolders = async (folderId) => {
    setLoading(true);
    try {
      const data = await apiService.getDriveCarpetas(folderId, token);
      const list = Object.entries(data.carpetas || {}).map(([title, id]) => ({ id, title }));
      setFolders(list);
    } catch (err) {
      console.error(`Error fetching folders for parent ${folderId}:`, err);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigateDown = async (folder) => {
    vibrar(20);
    const updatedStack = [...navStack, { id: folder.id, title: folder.title }];
    setNavStack(updatedStack);
    setCurrentFolderId(folder.id);
    const fullPath = updatedStack.map(item => item.title).join(' / ');
    setSelectedFolder({ id: folder.id, title: folder.title, path: fullPath });
    if (onSelectFolder) onSelectFolder(folder.id, folder.title, fullPath);
    setShowCreateForm(false);
    await fetchSubfolders(folder.id);
  };

  const handleNavigateUp = async (index) => {
    vibrar(20);
    if (index === navStack.length - 1) return;
    const updatedStack = navStack.slice(0, index + 1);
    const targetFolder = updatedStack[index];

    setNavStack(updatedStack);
    setCurrentFolderId(targetFolder.id);
    const fullPath = updatedStack.map(item => item.title).join(' / ');
    setSelectedFolder({ id: targetFolder.id, title: targetFolder.title, path: fullPath });
    if (onSelectFolder) onSelectFolder(targetFolder.id, targetFolder.title, fullPath);
    setShowCreateForm(false);
    await fetchSubfolders(targetFolder.id);
  };

  const handleGoUpOneLevel = async () => {
    vibrar(20);
    if (navStack.length > 1) {
      const updatedStack = navStack.slice(0, navStack.length - 1);
      const parentFolder = updatedStack[updatedStack.length - 1];
      setNavStack(updatedStack);
      setCurrentFolderId(parentFolder.id);
      const fullPath = updatedStack.map(item => item.title).join(' / ');
      setSelectedFolder({ id: parentFolder.id, title: parentFolder.title, path: fullPath });
      if (onSelectFolder) onSelectFolder(parentFolder.id, parentFolder.title, fullPath);
      setShowCreateForm(false);
      await fetchSubfolders(parentFolder.id);
    }
  };

  const handleCreateFolder = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!newFolderName.trim()) return alert('Debe ingresar un nombre para la carpeta');

    setCreating(true);
    try {
      const data = await apiService.crearDriveCarpeta(newFolderName.trim(), currentFolderId, token);
      setNewFolderName('');
      setShowCreateForm(false);
      await fetchSubfolders(currentFolderId);
      const fullPath = [...navStack, { id: data.id, title: data.title }].map(i => i.title).join(' / ');
      setSelectedFolder({ id: data.id, title: data.title, path: fullPath });
      if (onSelectFolder) onSelectFolder(data.id, data.title, fullPath);
      vibrar(30);
    } catch (err) {
      console.error('Error creating folder:', err);
      alert('Error al crear carpeta: ' + (err.message || 'Desconocido'));
    } finally {
      setCreating(false);
    }
  };

  const currentFolderTitle = navStack.length > 0 ? navStack[navStack.length - 1].title : 'Raíz de Drive';
  const canGoUp = navStack.length > 1;

  return (
    <div className="w-full h-full flex flex-col justify-between text-slate-100 font-sans overflow-hidden p-4 md:p-0">
      {/* Encabezado Móvil: ← Drive / Planta          X */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={canGoUp ? handleGoUpOneLevel : onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg active:bg-slate-800"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-base text-white m-0 leading-tight">
            Drive / Ubicación Técnica
          </h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg active:bg-slate-800"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Área Principal Scrolleable */}
      <div className="flex-1 overflow-y-auto space-y-4 py-3 min-h-0 pr-0.5 custom-scrollbar">
        {/* Ruta de Referencia (Breadcrumb Miga de Pan) */}
        {navStack.length > 0 && (
          <div className="bg-[#0f172a] border border-slate-800/90 p-2.5 px-3 rounded-2xl overflow-x-auto whitespace-nowrap custom-scrollbar shadow-inner">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 shrink-0 mr-1 flex items-center gap-1">
                📍 Ruta:
              </span>
              {navStack.map((item, idx) => (
                <React.Fragment key={item.id || idx}>
                  {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
                  <button
                    type="button"
                    onClick={() => handleNavigateUp(idx)}
                    className={`truncate max-w-[140px] text-[11px] transition-all rounded px-1.5 py-0.5 font-bold ${
                      idx === navStack.length - 1
                        ? 'text-sky-300 bg-sky-950/80 border border-sky-700/60 shadow-sm'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                    title={item.title}
                  >
                    {item.title}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Carpeta Seleccionada */}
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-slate-300 block">
            Carpeta seleccionada
          </span>
          <div className="bg-[#131c2e] border border-slate-800/80 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-amber-400" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-white m-0 leading-tight truncate">
                  {selectedFolder.title || currentFolderTitle}
                </h4>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                  Conectado <CheckCircle2 className="w-3.5 h-3.5 inline" />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de Carpetas */}
        <DriveFolderList
          folders={folders}
          selectedFolderId={selectedFolder.id}
          loading={loading}
          onSelectFolder={(id, title) => {
            const currentPath = navStack.map(i => i.title).join(' / ');
            setSelectedFolder({ id, title, path: currentPath });
            if (onSelectFolder) onSelectFolder(id, title, currentPath);
          }}
          onNavigateDown={handleNavigateDown}
        />

        {/* Acciones */}
        <DriveFolderActions
          canGoUp={canGoUp}
          onGoUp={handleGoUpOneLevel}
          currentFolderTitle={currentFolderTitle}
          currentFolderId={currentFolderId}
          selectedFolderId={selectedFolder.id}
          onSelectCurrentFolder={(id, title) => {
            setSelectedFolder({ id, title });
            if (onSelectFolder) onSelectFolder(id, title);
          }}
          showCreateForm={showCreateForm}
          onToggleCreateForm={setShowCreateForm}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
          onCreateFolder={handleCreateFolder}
          creating={creating}
        />
      </div>

      {/* Confirmación Final */}
      <div className="pt-2 border-t border-slate-800/80 shrink-0">
        <button
          type="button"
          onClick={() => {
            vibrar(40);
            if (onClose) onClose();
          }}
          className="w-full h-[50px] bg-[#10b981] hover:bg-[#059669] active:scale-[0.99] text-white font-extrabold rounded-2xl text-xs sm:text-sm tracking-wider uppercase shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all"
        >
          <span>Confirmar y Usar Carpeta</span>
        </button>
      </div>
    </div>
  );
}

