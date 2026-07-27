const API_BASE_URL = 'http://localhost:8000/api';

export const apiService = {
  getEquipos: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/equipos`);
      if (!response.ok) throw new Error('Error fetching equipos');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },
  
  getStats: async (equipoId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/equipos/${equipoId}/stats`);
      if (!response.ok) throw new Error('Error fetching stats');
      return await response.json();
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  getHistorial: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/inspecciones/historial`);
      if (!response.ok) throw new Error('Error fetching historial');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  },

  getEstadoReporte: async (inspeccionId, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/estado/${inspeccionId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
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
        headers: { 'Authorization': `Bearer ${token}` }
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
        headers: { 'Authorization': `Bearer ${token}` }
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener configuraciones');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  saveSettings: async (settingsData, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener aprendizajes');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  deleteAprendizaje: async (id, token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ia/aprendizaje/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al obtener el manual');
      return await response.json();
    } catch (error) {
      console.error(error);
      throw error;
    }
  },

  getMinutaResumen: async (empresaId, search, criticidad, token) => {
    try {
      const params = new URLSearchParams();
      if (empresaId) params.append('empresa_id', empresaId);
      if (search) params.append('search', search);
      if (criticidad) params.append('criticidad', criticidad);

      const response = await fetch(`${API_BASE_URL}/reportes/minuta_resumen?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error('Error fetching minuta resumen');
      return await response.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  }
};

