import { useState, useEffect } from 'react';
import { obtenerInspeccionesOffline, eliminarInspeccionOffline } from '../utils/offlineStore';
import { useAuth } from './AuthProvider';

export default function OfflineBanner({ onSyncComplete }) {
  const { token } = useAuth();
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  const checkPending = async () => {
    const list = await obtenerInspeccionesOffline();
    setPendingCount(list.length);
  };

  useEffect(() => {
    checkPending();

    const handleOnline = () => {
      setIsOnline(true);
      checkPending();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Revisar periódicamente items pendientes
    const interval = setInterval(checkPending, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSyncAll = async () => {
    if (!token || pendingCount === 0 || isSyncing) return;

    setIsSyncing(true);
    setSyncStatus('Sincronizando registros con el servidor...');
    const list = await obtenerInspeccionesOffline();
    let exitoCount = 0;

    for (const item of list) {
      try {
        const res = await fetch('http://localhost:8000/api/ia/guardar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(item.payload)
        });

        if (res.ok) {
          await eliminarInspeccionOffline(item.id);
          exitoCount++;
        }
      } catch (err) {
        console.error('Error sincronizando ítem:', err);
      }
    }

    setIsSyncing(false);
    setSyncStatus(exitoCount > 0 ? `¡${exitoCount} inspección(es) sincronizada(s) con éxito!` : 'Error durante la sincronización');
    checkPending();
    if (onSyncComplete) onSyncComplete();

    setTimeout(() => setSyncStatus(''), 4000);
  };

  if (isOnline && pendingCount === 0 && !syncStatus) {
    return null; // Ocultar si estamos online y no hay pendientes
  }

  return (
    <div style={{
      backgroundColor: !isOnline ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
      border: !isOnline ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
      backdropFilter: 'blur(10px)',
      padding: '8px 16px',
      borderRadius: '12px',
      margin: '8px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      color: '#f8fafc',
      fontSize: '0.85rem',
      fontWeight: 600,
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{!isOnline ? '⚡ Modo Offline (Sin Señal)' : '📶 Conexión Restablecida'}</span>
        {pendingCount > 0 && (
          <span style={{
            backgroundColor: 'rgba(255,255,255,0.15)',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '0.78rem'
          }}>
            {pendingCount} pendiente(s) por subir
          </span>
        )}
        {syncStatus && <span style={{ color: '#38bdf8', marginLeft: '6px' }}>{syncStatus}</span>}
      </div>

      {isOnline && pendingCount > 0 && (
        <button
          onClick={handleSyncAll}
          disabled={isSyncing}
          style={{
            backgroundColor: '#38bdf8',
            color: '#0f172a',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.8rem',
            boxShadow: '0 0 10px rgba(56, 189, 248, 0.3)'
          }}
        >
          {isSyncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
        </button>
      )}
    </div>
  );
}
