// Utilidades IndexedDB para almacenamiento offline de inspecciones en planta

const DB_NAME = 'AgenteInspectorOfflineDB';
const DB_VERSION = 1;
const STORE_INSPECCIONES = 'inspecciones_pendientes';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB no soportado en este entorno'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_INSPECCIONES)) {
        const store = db.createObjectStore(STORE_INSPECCIONES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('equipoId', 'equipoId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

export async function guardarInspeccionOffline(inspeccionData) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_INSPECCIONES, 'readwrite');
      const store = tx.objectStore(STORE_INSPECCIONES);
      
      const item = {
        ...inspeccionData,
        timestamp: new Date().toISOString(),
        synced: false
      };

      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Error guardando inspección offline:', err);
    throw err;
  }
}

export async function obtenerInspeccionesOffline() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_INSPECCIONES, 'readonly');
      const store = tx.objectStore(STORE_INSPECCIONES);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Error obteniendo inspecciones offline:', err);
    return [];
  }
}

export async function eliminarInspeccionOffline(id) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_INSPECCIONES, 'readwrite');
      const store = tx.objectStore(STORE_INSPECCIONES);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Error eliminando inspección offline:', err);
    return false;
  }
}

export async function limpiarInspeccionesOffline() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_INSPECCIONES, 'readwrite');
      const store = tx.objectStore(STORE_INSPECCIONES);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Error limpiando IndexedDB:', err);
    return false;
  }
}
