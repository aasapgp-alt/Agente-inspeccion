'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, limpiarBaseDatosLocal } from '../../utils/db';
import { apiService } from '../../services/api';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePreCargaInicial } from '../../hooks/usePreCargaInicial';

import { CampoShell } from '../../components/campo/layout/CampoShell';
import { CampoStatusBar } from '../../components/campo/layout/CampoStatusBar';
import { CampoHeader } from '../../components/campo/layout/CampoHeader';
import { QuickActions } from '../../components/campo/home/QuickActions';
import { EquipoSearch } from '../../components/campo/home/EquipoSearch';
import { ActivitySummary } from '../../components/campo/home/ActivitySummary';
import { ItinerarioList } from '../../components/campo/home/ItinerarioList';
import { CampoBottomNav } from '../../components/campo/navegacion/CampoBottomNav';
import { CampoMenuDrawer } from '../../components/campo/navegacion/CampoMenuDrawer';
import { DriveMobile } from '../../components/campo/drive/DriveMobile';

export default function CampoHomePage() {
  const router = useRouter();
  const { isOnline, pendingCount, errorCount, draftCount, completedTodayCount, forceSync, retryErrors } = useOnlineStatus();
  const { isPreCargando } = usePreCargaInicial();

  const [searchTerm, setSearchTerm] = useState('');
  const [showDriveDrawer, setShowDriveDrawer] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [driveFolderActual, setDriveFolderActual] = useState({ id: '', title: '' });

  useEffect(() => {
    const user = apiService.getCurrentUser();
    if (user) {
      setUsuarioActual(user);
    }
    if (typeof window !== 'undefined') {
      const fId = localStorage.getItem('campo_drive_folder_id');
      const fTitle = localStorage.getItem('campo_drive_folder_title');
      if (fId) {
        setDriveFolderActual({ id: fId, title: fTitle || 'Raíz de Drive' });
      }
    }
  }, []);

  const equiposResultado = useLiveQuery(
    async () => {
      if (!searchTerm || searchTerm.trim().length === 0) return [];
      const term = searchTerm.trim().toLowerCase();
      const list = await db.equipos_cache.toArray();
      return list
        .filter((eq) =>
          (eq.codigo && eq.codigo.toLowerCase().includes(term)) ||
          (eq.nombre && eq.nombre.toLowerCase().includes(term)) ||
          (eq.tag && eq.tag.toLowerCase().includes(term))
        )
        .slice(0, 5);
    },
    [searchTerm],
    []
  );

  const itinerarioHoy = useLiveQuery(
    async () => {
      return await db.itinerario_cache.orderBy('orden').toArray();
    },
    [],
    []
  );

  const handleSearchSubmit = (term) => {
    if (term && term.trim()) {
      router.push(`/campo/buscar?q=${encodeURIComponent(term.trim())}`);
    }
  };

  const handleLogout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
    }
    await limpiarBaseDatosLocal();
    router.push('/login');
  };

  return (
    <CampoShell>
      <CampoStatusBar
        isOnline={isOnline}
        pendingCount={pendingCount}
        errorCount={errorCount}
        draftCount={draftCount}
        forceSync={forceSync}
        retryErrors={retryErrors}
      />

      <main className="flex-1 max-w-md w-full mx-auto px-4 py-3 space-y-4">
        {/* 1 & 2: Encabezado y Usuario */}
        <CampoHeader
          usuarioActual={usuarioActual}
          isOnline={isOnline}
          onOpenNotifications={() => setShowMenuDrawer(true)}
        />

        {/* 3: Buscar Equipo */}
        <EquipoSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onSubmit={handleSearchSubmit}
          resultados={equiposResultado}
        />

        {/* 4: Accesos Rápidos (Grilla 2x2) */}
        <QuickActions
          pendingCount={pendingCount}
          onOpenDrive={() => setShowDriveDrawer(true)}
        />

        {/* 5: Estado de Actividades */}
        <ActivitySummary
          pendingCount={pendingCount}
          completedTodayCount={completedTodayCount}
        />

        {/* 6: Mi Itinerario de Hoy */}
        <ItinerarioList
          itinerarioHoy={itinerarioHoy}
          isPreCargando={isPreCargando}
        />
      </main>

      {/* Navegación Inferior Flotante */}
      <CampoBottomNav
        onOpenMenu={() => setShowMenuDrawer(true)}
        onOpenNuevo={() => {
          const el = document.getElementById('equipo-search');
          if (el) el.focus();
        }}
      />

      {/* Drawer / Modal de Drive de la Planta */}
      {showDriveDrawer && (
        <div className="fixed inset-0 z-50 bg-[#090d16] md:bg-black/85 md:backdrop-blur-sm md:p-4 flex items-center justify-center">
          <div className="bg-[#090d16] border-0 md:border md:border-slate-800 w-full h-[100dvh] md:h-auto md:max-w-lg md:max-h-[90vh] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <DriveMobile
              token={apiService.getToken()}
              onSelectFolder={(id, title) => {
                setDriveFolderActual({ id, title });
                if (typeof window !== 'undefined') {
                  localStorage.setItem('campo_drive_folder_id', id);
                  localStorage.setItem('campo_drive_folder_title', title);
                }
              }}
              initialFolderId={driveFolderActual?.id || ''}
              onClose={() => setShowDriveDrawer(false)}
            />
          </div>
        </div>
      )}


      {/* Drawer de Menú Inspector */}
      <CampoMenuDrawer
        isOpen={showMenuDrawer}
        onClose={() => setShowMenuDrawer(false)}
        usuarioActual={usuarioActual}
        onOpenDrive={() => setShowDriveDrawer(true)}
        onLogout={handleLogout}
        pendingCount={pendingCount}
      />
    </CampoShell>
  );
}
