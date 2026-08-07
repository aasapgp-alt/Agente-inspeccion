'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';
import { sincronizarColaPendientes, reintentarErrores } from '../utils/sync';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof window !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      sincronizarColaPendientes();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Consultas reactivas sobre IndexedDB con Dexie
  const pendingCount = useLiveQuery(
    async () => {
      return await db.inspecciones_pendientes
        .where('estado_sync')
        .anyOf(['pendiente', 'subiendo'])
        .count();
    },
    [],
    0
  );

  const errorCount = useLiveQuery(
    async () => {
      return await db.inspecciones_pendientes
        .where('estado_sync')
        .equals('error')
        .count();
    },
    [],
    0
  );

  const draftCount = useLiveQuery(
    async () => {
      return await db.inspecciones_pendientes
        .where('estado_sync')
        .equals('borrador')
        .count();
    },
    [],
    0
  );

  const completedTodayCount = useLiveQuery(
    async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const timestampCutoff = todayStart.getTime();

      const list = await db.inspecciones_pendientes
        .where('timestamp')
        .aboveOrEqual(timestampCutoff)
        .toArray();

      return list.length;
    },
    [],
    0
  );

  const forceSync = useCallback(async () => {
    if (isOnline) {
      return await sincronizarColaPendientes();
    }
    return { success: false, offline: true };
  }, [isOnline]);

  const retryAllErrors = useCallback(async () => {
    if (isOnline) {
      return await reintentarErrores();
    }
    return { success: false, offline: true };
  }, [isOnline]);

  return {
    isOnline,
    pendingCount: pendingCount || 0,
    errorCount: errorCount || 0,
    draftCount: draftCount || 0,
    completedTodayCount: completedTodayCount || 0,
    forceSync,
    retryErrors: retryAllErrors
  };
}
