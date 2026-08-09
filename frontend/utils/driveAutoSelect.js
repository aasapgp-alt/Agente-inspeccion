import { apiService } from '../services/api';
import { db } from './db';

/**
 * Automáticamente busca y vincula la carpeta de Drive adecuada para un equipo.
 * Soporta tanto consulta al servidor como búsqueda rápida en caché local en IndexedDB.
 * Retorna { id, title, autoMatched: boolean }
 */
export async function autoVincularCarpetaDrive(equipo, token) {
  if (!equipo) return null;

  const equipoId = equipo.id || equipo.equipo_id;
  const codigo = (equipo.codigo || '').trim().toLowerCase();
  const nombre = (equipo.nombre || '').trim().toLowerCase();
  const tag = (equipo.tag || '').trim().toLowerCase();

  // 1. Intentar sugerencias desde la API del servidor (si hay conexión)
  if (equipoId) {
    try {
      const data = await apiService.sugerirCarpetas(equipoId, token);
      const sugerencias = data?.sugerencias || [];
      if (sugerencias.length > 0) {
        const topMatch = sugerencias[0];
        if (topMatch && topMatch.id) {
          const matchTitle = topMatch.name || topMatch.title || 'Carpeta Equipo';
          guardarEnLocalStorage(topMatch.id, matchTitle);
          return { id: topMatch.id, title: matchTitle, autoMatched: true };
        }
      }
    } catch (err) {
      console.warn('[driveAutoSelect] Servidor no disponible, usando búsqueda local en caché:', err.message);
    }
  }

  // 2. Búsqueda local en la caché de carpetas (IndexedDB db.equipos_cache / db.drive_folders_cache)
  try {
    if (typeof window !== 'undefined' && db && db.drive_folders_cache) {
      const allFolders = await db.drive_folders_cache.toArray();
      if (allFolders && allFolders.length > 0) {
        // Buscar carpeta cuyo nombre contenga el código, tag o coincidencia relevante del nombre
        const folderMatched = allFolders.find((f) => {
          const fName = (f.nombre || f.title || '').toLowerCase();
          return (
            (codigo && fName.includes(codigo)) ||
            (tag && fName.includes(tag)) ||
            (nombre && fName.includes(nombre))
          );
        });

        if (folderMatched) {
          const matchedId = folderMatched.drive_id || folderMatched.id;
          const matchedTitle = folderMatched.nombre || folderMatched.title;
          guardarEnLocalStorage(matchedId, matchedTitle);
          return { id: matchedId, title: matchedTitle, autoMatched: true };
        }
      }
    }
  } catch (dbErr) {
    console.warn('[driveAutoSelect] Error en búsqueda local de carpetas:', dbErr);
  }

  return null;
}

function guardarEnLocalStorage(id, title) {
  if (typeof window !== 'undefined' && id) {
    localStorage.setItem('campo_drive_folder_id', id);
    localStorage.setItem('campo_drive_folder_title', title || 'Carpeta Seleccionada');
  }
}
