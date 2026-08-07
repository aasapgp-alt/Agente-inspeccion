import Dexie from 'dexie';

export const db = new Dexie('AgenteInspectorDB');

db.version(2).stores({
  inspecciones_pendientes: '++id, client_uuid, id_activo, codigo_activo, estado, timestamp, sincronizado, estado_sync',
  archivos_pendientes: '++id, inspeccion_id, tipo, timestamp',
  equipos_cache: 'id, codigo, nombre, empresa, area, tag',
  itinerario_cache: 'id, activo_id, orden',
  historial_cache: '++id, equipo_id, fecha, estado, inspector'
});

export async function limpiarBaseDatosLocal() {
  await db.inspecciones_pendientes.clear();
  await db.archivos_pendientes.clear();
  await db.equipos_cache.clear();
  await db.itinerario_cache.clear();
  await db.historial_cache.clear();
}
