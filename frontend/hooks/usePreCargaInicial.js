'use client';

import { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { apiService } from '../services/api';

export function usePreCargaInicial() {
  const [isPreCargando, setIsPreCargando] = useState(true);

  useEffect(() => {
    let active = true;

    async function ejecutarPrecarga() {
      try {
        if (typeof window !== 'undefined' && navigator.onLine) {
          // 1. Precargar Equipos reales desde Backend
          try {
            const equipos = await apiService.getEquipos();
            if (active && Array.isArray(equipos) && equipos.length > 0) {
              await db.transaction('rw', db.equipos_cache, async () => {
                await db.equipos_cache.clear();
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
              });
            }
          } catch (e) {
            console.warn('[usePreCargaInicial] Error descargando equipos reales:', e);
          }

          // 2. Precargar Itinerario real de hoy desde Backend
          try {
            const itinerario = await apiService.getItinerarioHoy();
            if (active && Array.isArray(itinerario) && itinerario.length > 0) {
              await db.transaction('rw', db.itinerario_cache, async () => {
                await db.itinerario_cache.clear();
                await db.itinerario_cache.bulkPut(
                  itinerario.map((item, index) => ({
                    id: item.id || index + 1,
                    activo_id: item.activo_id || item.equipo_id || item.id,
                    orden: item.orden || index + 1,
                    codigo: item.codigo || item.codigo_activo || `EQ-${item.id}`,
                    nombre: item.nombre || item.nombre_activo || 'Equipo Asignado',
                    estado_anterior: item.estado_actual || item.estado_anterior || 'BUENO'
                  }))
                );
              });
            } else if (active && Array.isArray(itinerario) && itinerario.length === 0) {
              await db.itinerario_cache.clear();
            }
          } catch (e) {
            console.warn('[usePreCargaInicial] Error descargando itinerario real:', e);
          }
        }
      } catch (err) {
        console.warn('[usePreCargaInicial] Error:', err);
      } finally {
        if (active) setIsPreCargando(false);
      }
    }

    ejecutarPrecarga();

    return () => {
      active = false;
    };
  }, []);

  return { isPreCargando };
}
