import { db } from './db';
import { apiService } from '../services/api';
import { vibrarExito, vibrarError } from './haptics';

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

let syncEnProgreso = false;

export async function sincronizarColaPendientes() {
  if (typeof window === 'undefined') return { success: false, reason: 'SSR' };
  if (!navigator.onLine) {
    return { success: false, offline: true };
  }
  if (syncEnProgreso) {
    return { success: false, busy: true };
  }

  syncEnProgreso = true;

  try {
    const pendientes = await db.inspecciones_pendientes
      .where('estado_sync')
      .anyOf(['pendiente', 'error'])
      .toArray();

    if (!pendientes || pendientes.length === 0) {
      syncEnProgreso = false;
      return { success: true, count: 0 };
    }

    // Marcar como subiendo
    const idsToSync = pendientes.map((item) => item.id);
    await db.inspecciones_pendientes
      .where('id')
      .anyOf(idsToSync)
      .modify({ estado_sync: 'subiendo' });

    // Preparar el lote
    const lotePayload = await Promise.all(
      pendientes.map(async (insp) => {
        const archivos = await db.archivos_pendientes
          .where('inspeccion_id')
          .equals(insp.id)
          .toArray();

        const fotos = [];
        const audios = [];

        for (const arch of archivos) {
          const b64 = await blobToBase64(arch.blob);
          if (arch.tipo === 'foto') {
            fotos.push({ categoria: insp.categoria_foto || 'General', data: b64, timestamp: arch.timestamp });
          } else if (arch.tipo === 'audio') {
            audios.push({ data: b64, timestamp: arch.timestamp });
          }
        }

        return {
          client_uuid: insp.client_uuid,
          id_activo: insp.id_activo,
          codigo_activo: insp.codigo_activo,
          estado: insp.estado,
          categoria_foto: insp.categoria_foto || 'General',
          notas: insp.notas || '',
          drive_folder_id: insp.drive_folder_id || null,
          timestamp: insp.timestamp,
          fotos,
          audios
        };
      })
    );

    // Enviar lote al backend
    await apiService.subirInspeccionesBatch(lotePayload);

    // Si tuvo éxito, borrar de IndexedDB
    await db.transaction('rw', db.inspecciones_pendientes, db.archivos_pendientes, async () => {
      await db.inspecciones_pendientes.where('id').anyOf(idsToSync).delete();
      await db.archivos_pendientes.where('inspeccion_id').anyOf(idsToSync).delete();
    });

    vibrarExito();
    syncEnProgreso = false;
    return { success: true, count: lotePayload.length };
  } catch (error) {
    console.error('[sync.js] Error al sincronizar lote:', error);

    // Si falló por error de red
    if (!navigator.onLine) {
      await db.inspecciones_pendientes
        .where('estado_sync')
        .equals('subiendo')
        .modify({ estado_sync: 'pendiente' });
      syncEnProgreso = false;
      return { success: false, offline: true };
    }

    // Si falló por error del backend (5xx, validación, etc.), marcar con 'error'
    await db.inspecciones_pendientes
      .where('estado_sync')
      .equals('subiendo')
      .modify({ estado_sync: 'error' });

    vibrarError();
    syncEnProgreso = false;
    return { success: false, error: error.message || 'Error de servidor' };
  }
}

export async function reintentarErrores() {
  await db.inspecciones_pendientes
    .where('estado_sync')
    .equals('error')
    .modify({ estado_sync: 'pendiente' });

  return await sincronizarColaPendientes();
}

// Inicialización de auto-sync (Foreground polling + event listener)
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    sincronizarColaPendientes();
  });

  setInterval(() => {
    if (navigator.onLine) {
      sincronizarColaPendientes();
    }
  }, 30000);
}
