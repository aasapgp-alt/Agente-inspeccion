'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '../utils/db';
import { apiService } from '../services/api';

export function usePreCargaInicial() {
  const [isPreCargando, setIsPreCargando] = useState(true);

  const sincronizarDatos = useCallback(async () => {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return;
    }
    try {
      // 1. Precargar Equipos
      try {
        const equipos = await apiService.getEquipos();
        if (Array.isArray(equipos)) {
          await db.transaction('rw', db.equipos_cache, async () => {
            await db.equipos_cache.clear();
            if (equipos.length > 0) {
              await db.equipos_cache.bulkPut(
                equipos.map((eq) => ({
                  id: eq.id,
                  codigo: eq.codigo || eq.tag || `EQ-${eq.id}`,
                  nombre: eq.nombre || eq.descripcion || 'Sin Nombre',
                  empresa: eq.empresa || '',
                  area: eq.area || '',
                  tag: eq.tag || '',
                  ubicacion_id: eq.ubicacion_id || null,
                  estado_anterior: eq.estado_actual || eq.estado_anterior || eq.ultimo_estado || 'BUENO',
                  diagnostico: eq.diagnostico || eq.diagnostico_reciente || '',
                  recomendacion: eq.recomendacion || eq.recomendacion_preventiva || ''
                }))
              );
            }
          });
        }
      } catch (e) {
        console.warn('[usePreCargaInicial] Error descargando equipos reales:', e);
      }

      // 2. Precargar Itinerario
      await apiService.recargarItinerarioLocal();
    } catch (err) {
      console.warn('[usePreCargaInicial] Error en sincronización:', err);
    }
  }, []);

  const recargarItinerario = useCallback(async () => {
    setIsPreCargando(true);
    try {
      if (typeof window !== 'undefined' && navigator.onLine) {
        await apiService.recargarItinerarioLocal();
      }
    } catch (err) {
      console.warn('[usePreCargaInicial.recargarItinerario] Error:', err);
    } finally {
      setIsPreCargando(false);
    }
  }, []);

  const recargarTodo = useCallback(async () => {
    setIsPreCargando(true);
    try {
      await sincronizarDatos();
    } finally {
      setIsPreCargando(false);
    }
  }, [sincronizarDatos]);

  useEffect(() => {
    let active = true;

    async function init() {
      await sincronizarDatos();
      if (active) {
        setIsPreCargando(false);
      }
    }

    init();

    return () => {
      active = false;
    };
  }, [sincronizarDatos]);

  return { isPreCargando, recargarItinerario, recargarTodo };
}


