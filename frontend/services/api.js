const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const getAuthHeaders = (tokenOverride) => {
  const token = tokenOverride || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const checkAuthStatus = (response) => {
  if (response.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_info');
  }
};

export const apiService = {
  login: async (username, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Error al iniciar sesión');
    }

    const data = await response.json();
    if (data.access_token && typeof window !== 'undefined') {
      localStorage.setItem('auth_token', data.access_token);

      const userProfile = data.user || { username, nombre_completo: username };
      localStorage.setItem('user_info', JSON.stringify(userProfile));
    }
    return data;
  },

  getCurrentUser: () => {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('user_info');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  getToken: () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('auth_token') || '';
  },

  getEquipos: async (q = '') => {
    try {
      const url = q ? `${API_BASE_URL}/equipos/?q=${encodeURIComponent(q)}` : `${API_BASE_URL}/equipos/`;
      const response = await fetch(url, { headers: getAuthHeaders() });
      checkAuthStatus(response);
      if (!response.ok) {
        console.warn(`[apiService.getEquipos] HTTP ${response.status}: fallback a caché local.`);
        return [];
      }
      const data = await response.json();
      return Array.isArray(data) ? data : (data.equipos || []);
    } catch (error) {
      console.warn('[apiService.getEquipos] Red no disponible:', error.message);
      return [];
    }
  },

  getEquipoById: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/equipos/${id}`, { headers: getAuthHeaders() });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.warn(`[apiService.getEquipoById] Error:`, error.message);
      return null;
    }
  },

  getItinerarioHoy: async () => {
    try {
      let response = await fetch(`${API_BASE_URL}/itinerarios/`, { headers: getAuthHeaders() });
      checkAuthStatus(response);
      if (!response.ok) {
        response = await fetch(`${API_BASE_URL}/itinerario/hoy/`, { headers: getAuthHeaders() });
        checkAuthStatus(response);
      }

      if (!response.ok) {
        console.warn(`[apiService.getItinerarioHoy] HTTP ${response.status}: usando caché IndexedDB.`);
        return [];
      }

      const data = await response.json();
      return Array.isArray(data) ? data : (data.itinerario || data.itinerarios || data.equipos || []);
    } catch (error) {
      console.warn('[apiService.getItinerarioHoy] Red no disponible:', error.message);
      return [];
    }
  },

  getHistorial: async (equipoId) => {
    try {
      if (!equipoId) return [];

      // 1. Consultar /api/dashboard/history (endpoint idéntico al dashboard principal)
      const resDash = await fetch(`${API_BASE_URL}/dashboard/history`, { headers: getAuthHeaders() });
      if (resDash.ok) {
        const dashData = await resDash.json();
        if (Array.isArray(dashData)) {
          const eqItem = dashData.find((item) => String(item.id) === String(equipoId));
          if (eqItem) {
            return [{
              id: `dash-${eqItem.id}`,
              fecha: eqItem.fecha_ultima_inspeccion || eqItem.updated_at || new Date().toISOString(),
              estado: eqItem.estado_actual || eqItem.estado || 'CRITICO',
              inspector: 'Campaña PGP (Gemini Vision)',
              observaciones: 'Diagnóstico histórico registrado en base de datos oficial.',
              hallazgos: eqItem.diagnostico || eqItem.diagnostico_reciente || ''
            }];
          }
        }
      }

      // 2. Fallback a /api/equipos/{id}
      const response = await fetch(`${API_BASE_URL}/equipos/${equipoId}`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        if (data.inspecciones && Array.isArray(data.inspecciones) && data.inspecciones.length > 0) return data.inspecciones;
        if (data.historial && Array.isArray(data.historial) && data.historial.length > 0) return data.historial;
        if (data.diagnostico || data.diagnostico_reciente || data.estado_actual) {
          return [{
            id: `eq-${data.id}`,
            fecha: data.fecha_ultima_inspeccion || new Date().toISOString(),
            estado: data.estado_actual || data.estado || 'BUENO',
            inspector: 'Oficial PGP',
            observaciones: data.observaciones || 'Diagnóstico de campaña en planta',
            hallazgos: data.diagnostico || data.diagnostico_reciente || ''
          }];
        }
      }

      return [];
    } catch (error) {
      console.warn('[apiService.getHistorial] Red no disponible:', error.message);
      return [];
    }
  },

  subirInspeccionesBatch: async (loteInspecciones) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inspecciones/batch`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ inspecciones: loteInspecciones })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const err = new Error(errorData.detail || `Error en servidor (${response.status})`);
        err.status = response.status;
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error('[apiService.subirInspeccionesBatch] Error:', error);
      throw error;
    }
  },

  getStats: async (equipoId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/equipos/${equipoId}/stats`, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Error fetching stats');
      return await response.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  getEstadoReporte: async (inspeccionId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/estado/${inspeccionId}`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) throw new Error('Error fetching report status');
      return await response.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  generarReporteManual: async (inspeccionId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/generar-manual/${inspeccionId}`, {
        method: 'POST',
        headers: getAuthHeaders(token)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Error generating report');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getVersiones: async (inspeccionId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/versiones/${inspeccionId}`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) throw new Error('Error fetching report versions');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getSettings: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) throw new Error('Error al obtener configuraciones');
      return await response.json();
    } catch (error) {
      console.error(error);
      return { settings: {} };
    }
  },

  saveSettings: async (settingsData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ settings: settingsData })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Error al guardar configuraciones');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getAprendizajes: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ia/aprendizaje`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) throw new Error('Error al obtener aprendizajes');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  deleteAprendizaje: async (id, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ia/aprendizaje/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Error al eliminar aprendizaje');
      }
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getManual: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/manual`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) throw new Error('Error al obtener el manual');
      return await response.json();
    } catch (error) {
      console.error(error);
      return {};
    }
  },

  getMinutaResumen: async (empresaId, search, criticidad, campania, token) => {
    try {
      const params = new URLSearchParams();
      if (empresaId) params.append('empresa_id', empresaId);
      if (search) params.append('search', search);
      if (criticidad) params.append('criticidad', criticidad);
      if (campania) params.append('campania', campania);

      const response = await fetch(`${API_BASE_URL}/reportes/minuta_resumen?${params.toString()}`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) {
        console.warn(`[getMinutaResumen] HTTP Error ${response.status}`);
        return [];
      }
      return await response.json();
    } catch (error) {
      console.error('[getMinutaResumen] Error:', error);
      return [];
    }
  },

  getDriveRoot: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/drive/root`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) return { root_id: '1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD' };
      return await response.json();
    } catch (error) {
      console.warn('[apiService.getDriveRoot] Error:', error.message);
      return { root_id: '1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD' };
    }
  },

  getDriveCarpetas: async (parentId, token) => {
    try {
      const url = parentId ? `${API_BASE_URL}/drive/carpetas?parent_id=${encodeURIComponent(parentId)}` : `${API_BASE_URL}/drive/carpetas`;
      const response = await fetch(url, { headers: getAuthHeaders(token) });
      if (!response.ok) return { carpetas: {} };
      return await response.json();
    } catch (error) {
      console.warn('[apiService.getDriveCarpetas] Error:', error.message);
      return { carpetas: {} };
    }
  },

  getDriveAncestro: async (folderId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/drive/ancestro?folder_id=${encodeURIComponent(folderId)}`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) return { ancestro: [] };
      return await response.json();
    } catch (error) {
      console.warn('[apiService.getDriveAncestro] Error:', error.message);
      return { ancestro: [] };
    }
  },

  crearDriveCarpeta: async (nombre, parentId, token) => {
    const response = await fetch(`${API_BASE_URL}/drive/crear_carpeta`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ nombre, parent_id: parentId })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.detail || 'Error al crear carpeta en Drive');
    }
    return await response.json();
  },

  sugerirCarpetas: async (equipoId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/drive/sugerir_carpetas?equipo_id=${encodeURIComponent(equipoId)}`, {
        headers: getAuthHeaders(token)
      });
      if (!response.ok) return { sugerencias: [] };
      return await response.json();
    } catch (error) {
      console.warn('[apiService.sugerirCarpetas] Error:', error.message);
      return { sugerencias: [] };
    }
  },

  subirInspeccionesBatch: async (lote, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/inspecciones/batch`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ inspecciones: lote })
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || 'Error al subir batch de inspecciones');
      }
      return await response.json();
    } catch (error) {
      console.error('[subirInspeccionesBatch] Error:', error);
      throw error;
    }
  }
};
