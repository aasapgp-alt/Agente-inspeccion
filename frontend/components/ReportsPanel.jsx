'use client';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import VersionHistoryModal from './VersionHistoryModal';

const API_BASE_URL = 'http://localhost:8000/api';

export default function ReportsPanel() {
  const { user, token } = useAuth();
  
  // Tab state: 'individuales' | 'libros'
  const [activeTab, setActiveTab] = useState('individuales');
  
  // Data states
  const [reportes, setReportes] = useState([]);
  const [libros, setLibros] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination states
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filter states
  const [ubicacionFilter, setUbicacionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [search, setSearch] = useState('');

  // Generation action states
  const [generandoReportes, setGenerandoReportes] = useState(false);
  const [generandoLibro, setGenerandoLibro] = useState(false);
  const [libroProgress, setLibroProgress] = useState(null);

  // Version history modal state
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [selectedDocTipo, setSelectedDocTipo] = useState(null);

  // Custom Delete Modal State
  const [docToDelete, setDocToDelete] = useState(null);

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, page, reportes, libros]);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const currentList = activeTab === 'individuales' ? reportes : libros;
      setSelectedIds(currentList.map(item => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Load locations on mount
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE_URL}/ubicaciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async res => {
          if (!res.ok) {
            let detail = '';
            try {
              const errData = await res.json();
              detail = errData.detail || errData.message || JSON.stringify(errData);
            } catch (e) {
              try {
                detail = await res.text();
              } catch (e2) {}
            }
            throw new Error(`Error al cargar ubicaciones: HTTP ${res.status}${detail ? ` - ${detail}` : ''}`);
          }
          return res.json();
        })
        .then(data => setUbicaciones(data || []))
        .catch(err => console.error(err));
    }
  }, [token]);

  // Fetch reports or books when dependencies change
  const fetchData = () => {
    if (!token) return;
    setLoading(true);

    const offset = (page - 1) * limit;
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    if (ubicacionFilter) params.append('ubicacion_id', ubicacionFilter);
    if (statusFilter) params.append('estado', statusFilter);
    if (fechaDesde) params.append('fecha_desde', fechaDesde);
    if (fechaHasta) params.append('fecha_hasta', fechaHasta);

    if (activeTab === 'individuales') {
      if (campaignFilter) params.append('campania', campaignFilter);
      if (search) params.append('search', search);

      fetch(`${API_BASE_URL}/reportes/individuales?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async res => {
          if (!res.ok) {
            let detail = '';
            try {
              const errData = await res.json();
              detail = errData.detail || errData.message || JSON.stringify(errData);
            } catch (e) {
              try {
                detail = await res.text();
              } catch (e2) {}
            }
            throw new Error(`Error al cargar reportes: HTTP ${res.status}${detail ? ` - ${detail}` : ''}`);
          }
          return res.json();
        })
        .then(data => {
          setReportes(data.results || []);
          setTotalCount(data.total || 0);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    } else {
      // Books tab
      fetch(`${API_BASE_URL}/libros?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(async res => {
          if (!res.ok) {
            let detail = '';
            try {
              const errData = await res.json();
              detail = errData.detail || errData.message || JSON.stringify(errData);
            } catch (e) {
              try {
                detail = await res.text();
              } catch (e2) {}
            }
            throw new Error(`Error al cargar libros: HTTP ${res.status}${detail ? ` - ${detail}` : ''}`);
          }
          return res.json();
        })
        .then(data => {
          setLibros(data.results || []);
          setTotalCount(data.total || 0);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, activeTab, page, ubicacionFilter, statusFilter, campaignFilter, fechaDesde, fechaHasta]);

  // Reset page when switching tabs or modifying filters
  useEffect(() => {
    setPage(1);
  }, [activeTab, ubicacionFilter, statusFilter, campaignFilter, fechaDesde, fechaHasta]);

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      setPage(1);
      fetchData();
    }
  };

  const handleClearFilters = () => {
    setUbicacionFilter('');
    setStatusFilter('');
    setCampaignFilter('');
    setFechaDesde('');
    setFechaHasta('');
    setSearch('');
    setPage(1);
  };

  // Authenticated SPA Download
  const handleDownloadPDF = async (id, tipo, filename) => {
    try {
      const url = tipo === 'libro' 
        ? `${API_BASE_URL}/libro/descargar/${id}`
        : `${API_BASE_URL}/reportes/${id}/download`;
        
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al descargar archivo PDF');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Error al descargar: " + err.message);
    }
  };

  // Download all reports as ZIP for a selected location
  const handleExportZip = async () => {
    if (!ubicacionFilter) {
      alert("Por favor seleccione una ubicación técnica en los filtros para exportar sus reportes como ZIP.");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/reportes/exportar-zip/${ubicacionFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || 'Error al exportar ZIP');
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      
      // Get safe filename from headers if possible
      let filename = `reportes_ubicacion_${ubicacionFilter}.zip`;
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      alert("Error al exportar ZIP: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin Actions
  const handleGenerarTodosReportes = async () => {
    if (!ubicacionFilter) {
      alert("Debe seleccionar una ubicación técnica para generar todos los reportes.");
      return;
    }
    
    const ubiObj = ubicaciones.find(u => u.id === parseInt(ubicacionFilter));
    const ubiName = ubiObj ? ubiObj.nombre : 'seleccionada';
    
    if (!confirm(`¿Está seguro de que desea generar los reportes individuales pendientes para TODOS los equipos en la ubicación '${ubiName}'?`)) {
      return;
    }

    setGenerandoReportes(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reportes/generar-todos/${ubicacionFilter}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        alert(`¡Generación masiva completada!\n- Reportes Generados: ${data.generados}\n- Existentes (omitidos): ${data.existentes}\n- Errores/Falta Inspección: ${data.errores}`);
        fetchData();
      } else {
        const data = await res.json();
        alert(`Error al generar reportes: ${data.detail || 'Error desconocido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error de red al intentar generar los reportes.');
    } finally {
      setGenerandoReportes(false);
    }
  };

  const handleGenerarLibroArea = async () => {
    if (!ubicacionFilter) {
      alert("Debe seleccionar una ubicación técnica para generar el libro por área.");
      return;
    }
    
    const ubiObj = ubicaciones.find(u => u.id === parseInt(ubicacionFilter));
    const ubiName = ubiObj ? ubiObj.nombre : 'seleccionada';
    
    if (!confirm(`¿Está seguro de que desea generar el libro consolidado por área para '${ubiName}'?`)) {
      return;
    }

    setGenerandoLibro(true);
    setLibroProgress("Generando...");

    // Start progress polling
    let intervalId = setInterval(async () => {
      try {
        const pRes = await fetch(`${API_BASE_URL}/libro/progreso/${ubicacionFilter}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.status && pData.status !== "No iniciado") {
            setLibroProgress(pData.status);
          }
        }
      } catch (err) {
        console.error("Error polling progress:", err);
      }
    }, 1000);

    try {
      const res = await fetch(`${API_BASE_URL}/libro/generar/${ubicacionFilter}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      clearInterval(intervalId);

      if (res.ok) {
        alert(`¡Libro consolidado por área generado exitosamente para '${ubiName}'!`);
        setLibroProgress(null);
        fetchData();
      } else {
        const errData = await res.json();
        setLibroProgress(`Error: ${errData.detail || 'Error al generar'}`);
        alert("Error al generar el libro por área: " + (errData.detail || JSON.stringify(errData)));
      }
    } catch (e) {
      clearInterval(intervalId);
      console.error(e);
      setLibroProgress("Error de conexión");
      alert("Error de conexión al generar el libro por área.");
    } finally {
      setGenerandoLibro(false);
    }
  };

  const handleDeleteDoc = async (id, tipo, displayInfo) => {
    setDocToDelete({ id, tipo, displayInfo, isBulk: false });
  };

  const confirmDeleteDoc = async () => {
    if (!docToDelete) return;
    
    if (docToDelete.isBulk) {
      try {
        await Promise.all(docToDelete.ids.map(id => {
          const url = docToDelete.tipo === 'libro' ? `${API_BASE_URL}/libros/${id}` : `${API_BASE_URL}/reportes/${id}`;
          return fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }});
        }));
        fetchData();
        setSelectedIds([]);
        setDocToDelete(null);
      } catch (err) {
        console.error(err);
        alert('Error de red al intentar eliminar múltiples documentos.');
        setDocToDelete(null);
      }
    } else {
      const { id, tipo } = docToDelete;
      try {
        const url = tipo === 'libro' 
          ? `${API_BASE_URL}/libros/${id}`
          : `${API_BASE_URL}/reportes/${id}`;
          
        const res = await fetch(url, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
          fetchData();
          setDocToDelete(null);
        } else {
          const data = await res.json();
          alert(`Error al eliminar: ${data.detail || 'Desconocido'}`);
          setDocToDelete(null);
        }
      } catch (err) {
        console.error(err);
        alert('Error de red al intentar eliminar.');
        setDocToDelete(null);
      }
    }
  };

  // State Badge Renderers
  const getStatusBadge = (status) => {
    const st = status ? status.toUpperCase() : '';
    let bgColor = 'rgba(148, 163, 184, 0.15)';
    let textColor = '#94a3b8';
    let border = '1px solid rgba(148, 163, 184, 0.3)';

    if (st.includes('BUENO')) {
      bgColor = 'rgba(16, 185, 129, 0.15)';
      textColor = '#10b981';
      border = '1px solid rgba(16, 185, 129, 0.4)';
    } else if (st.includes('REGULAR')) {
      bgColor = 'rgba(245, 158, 11, 0.15)';
      textColor = '#f59e0b';
      border = '1px solid rgba(245, 158, 11, 0.4)';
    } else if (st.includes('CRITICO')) {
      bgColor = 'rgba(239, 68, 68, 0.15)';
      textColor = '#ef4444';
      border = '1px solid rgba(239, 68, 68, 0.4)';
    } else if (st.includes('FUERA')) {
      bgColor = 'rgba(147, 51, 234, 0.15)';
      textColor = '#a855f7';
      border = '1px solid rgba(147, 51, 234, 0.4)';
    }

    return (
      <span style={{ 
        padding: '0.3rem 0.8rem', 
        borderRadius: '20px', 
        fontSize: '0.72rem', 
        fontWeight: 600,
        backgroundColor: bgColor,
        color: textColor,
        border: border,
        display: 'inline-block',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {status || 'PENDIENTE'}
      </span>
    );
  };

  const getBookStatesBadges = (resumen) => {
    if (!resumen) return <span style={{ color: 'var(--text-secondary)' }}>-</span>;
    const r = typeof resumen === 'string' ? JSON.parse(resumen) : resumen;
    
    return (
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {r.BUENO > 0 && (
          <span title="Buenos" style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            ✅ {r.BUENO}
          </span>
        )}
        {r.REGULAR > 0 && (
          <span title="Regulares" style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            ⚠️ {r.REGULAR}
          </span>
        )}
        {r.CRITICO > 0 && (
          <span title="Críticos" style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            🚨 {r.CRITICO}
          </span>
        )}
        {r["FUERA DE RUTA"] > 0 && (
          <span title="Fuera de Ruta" style={{ padding: '0.2rem 0.5rem', backgroundColor: 'rgba(147,51,234,0.15)', color: '#a855f7', border: '1px solid rgba(147,51,234,0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
            ⚙️ {r["FUERA DE RUTA"]}
          </span>
        )}
      </div>
    );
  };

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '';
    try {
      const date = new Date(fechaStr.replace(' ', 'T'));
      return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return fechaStr;
    }
  };

  const openDriveLink = (driveLink) => {
    if (!driveLink) return;
    window.open(driveLink, '_blank', 'noopener,noreferrer');
  };

  const hasUbiSelected = !!ubicacionFilter;

  // Pagination totals
  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', fontFamily: 'var(--font-sans)' }}>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          .custom-tab {
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--text-secondary);
            border-bottom: 2px solid transparent;
            transition: all 0.2s ease-in-out;
            display: flex;
            alignItems: center;
            gap: 0.5rem;
          }
          .custom-tab.active {
            color: var(--accent-primary);
            border-bottom: 2px solid var(--accent-primary);
          }
          .filter-label {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.4rem;
            display: block;
          }
        `}
      </style>

      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>📁 Panel de Reportes Consolidado</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Centro de control para la descarga, exportación y control de versiones de actas individuales y libros consolidados por área.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', gap: '1rem' }}>
        <div 
          className={`custom-tab ${activeTab === 'individuales' ? 'active' : ''}`}
          onClick={() => { setActiveTab('individuales'); setPage(1); }}
        >
          📄 Reportes Individuales
        </div>
        <div 
          className={`custom-tab ${activeTab === 'libros' ? 'active' : ''}`}
          onClick={() => { setActiveTab('libros'); setPage(1); }}
        >
          📚 Libros por Área
        </div>
      </div>

      {/* Filters Panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', backgroundColor: 'rgba(30, 41, 59, 0.4)', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          
          <div>
            <label className="filter-label">Ubicación Técnica</label>
            <select 
              value={ubicacionFilter} 
              onChange={(e) => setUbicacionFilter(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="">TODAS LAS UBICACIONES</option>
              {ubicaciones.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="filter-label">Estado Salud</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              <option value="">TODOS LOS ESTADOS</option>
              <option value="BUENO">BUENO</option>
              <option value="REGULAR">REGULAR</option>
              <option value="CRITICO">CRÍTICO</option>
              <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            </select>
          </div>

          {activeTab === 'individuales' && (
            <div>
              <label className="filter-label">Campaña</label>
              <select 
                value={campaignFilter} 
                onChange={(e) => setCampaignFilter(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="">TODAS LAS CAMPAÑAS</option>
                <option value="PGP 2026">PGP 2026</option>
                <option value="PGP 2027">PGP 2027</option>
              </select>
            </div>
          )}

          <div>
            <label className="filter-label">Rango Fechas (Desde / Hasta)</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input 
                type="date" 
                value={fechaDesde} 
                onChange={(e) => setFechaDesde(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.8rem', flex: '1 1 120px', minWidth: '110px' }}
              />
              <input 
                type="date" 
                value={fechaHasta} 
                onChange={(e) => setFechaHasta(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.8rem', flex: '1 1 120px', minWidth: '110px' }}
              />
            </div>
          </div>

          {activeTab === 'individuales' && (
            <div>
              <label className="filter-label">Buscar Texto</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder="Código, Nombre o Acta + [Enter]" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyPress}
                  style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
                />
                <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6 }}>🔍</span>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons & Filters Cleanup */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          
          {/* Global Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {activeTab === 'individuales' ? (
              <>
                {user?.rol === 'admin' && (
                  <button 
                    onClick={handleGenerarTodosReportes}
                    disabled={!hasUbiSelected || generandoReportes}
                    className="btn btn-primary"
                    style={{ 
                      padding: '0.55rem 1rem', 
                      fontSize: '0.82rem', 
                      backgroundColor: hasUbiSelected ? '#0ea5e9' : 'rgba(14, 165, 233, 0.2)',
                      color: hasUbiSelected ? 'white' : '#94a3b8',
                      cursor: hasUbiSelected && !generandoReportes ? 'pointer' : 'not-allowed',
                      opacity: generating => generating ? 0.7 : 1
                    }}
                  >
                    {generandoReportes ? '⏳ Generando...' : '⚡ Generar Reportes Faltantes'}
                  </button>
                )}
                
                <button 
                  onClick={handleExportZip}
                  disabled={!hasUbiSelected}
                  style={{ 
                    padding: '0.55rem 1rem', 
                    fontSize: '0.82rem',
                    backgroundColor: hasUbiSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.02)',
                    color: hasUbiSelected ? '#38bdf8' : '#64748b',
                    border: hasUbiSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                    cursor: hasUbiSelected ? 'pointer' : 'not-allowed'
                  }}
                >
                  📥 Exportar todo como ZIP
                </button>
              </>
            ) : (
              <>
                {user?.rol === 'admin' && (
                  <button 
                    onClick={handleGenerarLibroArea}
                    disabled={!hasUbiSelected || generandoLibro}
                    className="btn btn-primary"
                    style={{ 
                      padding: '0.55rem 1rem', 
                      fontSize: '0.82rem',
                      backgroundColor: hasUbiSelected ? '#10b981' : 'rgba(16, 185, 129, 0.2)',
                      color: hasUbiSelected ? 'white' : '#94a3b8',
                      cursor: hasUbiSelected && !generandoLibro ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {generandoLibro ? '⏳ Generando...' : '📖 Generar Libro por Área'}
                  </button>
                )}

                {libroProgress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ width: '12px', height: '12px', border: '2px solid rgba(16,185,129,0.1)', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    {libroProgress}
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {selectedIds.length > 0 && user?.rol === 'admin' && (
              <button 
                onClick={() => setDocToDelete({ isBulk: true, ids: selectedIds, tipo: activeTab === 'individuales' ? 'individual' : 'libro' })}
                style={{ 
                  padding: '0.55rem 1rem', 
                  fontSize: '0.82rem',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '4px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                🗑️ Eliminar {selectedIds.length} Seleccionados
              </button>
            )}
            <button 
              onClick={handleClearFilters}
              style={{ 
                padding: '0.55rem 1rem', 
                fontSize: '0.82rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              🧹 Limpiar Filtros
            </button>
            <button 
              onClick={fetchData}
              style={{ 
                padding: '0.55rem 1.25rem', 
                fontSize: '0.82rem',
                backgroundColor: 'var(--accent-primary)',
                color: 'white'
              }}
            >
              🔄 Buscar
            </button>
          </div>

        </div>

      </div>

      {/* Data Table */}
      <div className="glass-panel" style={{ overflow: 'auto', padding: '1rem', flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '350px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent-primary)' }} />
              <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>Cargando documentos...</div>
            </div>
          </div>
        ) : (activeTab === 'individuales' ? reportes : libros).length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</span>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Sin registros</h4>
            <p style={{ fontSize: '0.85rem' }}>No se encontraron documentos para la búsqueda y filtros seleccionados.</p>
          </div>
        ) : activeTab === 'individuales' ? (
          /* TABLE: INDIVIDUAL REPORTS */
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem', width: '40px' }}>
                  <input type="checkbox" onChange={handleSelectAll} checked={reportes.length > 0 && selectedIds.length === reportes.length} />
                </th>
                <th style={{ padding: '0.75rem 1rem' }}>Acta</th>
                <th style={{ padding: '0.75rem 1rem' }}>Equipo</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ubicación</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem 1rem' }}>Campaña</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr 
                  key={r.id} 
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => handleSelectOne(r.id)} />
                  </td>
                  <td style={{ padding: '0.9rem 1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                    {r.numero_acta || `ACTA-${r.id}`}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.nombre_equipo}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{r.codigo_equipo}</div>
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>
                    {r.nombre_ubicacion || 'S/N'}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                    {getStatusBadge(r.estado_general)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatFecha(r.fecha_generacion)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {r.campania}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleDownloadPDF(r.id, 'individual', `${r.numero_acta || 'ACTA'}.pdf`)}
                        style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                        title="Descargar localmente"
                      >
                        📥
                      </button>

                      {r.ruta_pdf_drive ? (
                        <button 
                          onClick={() => openDriveLink(r.ruta_pdf_drive)}
                          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                          title="Abrir en Google Drive"
                        >
                          ☁️ Drive
                        </button>
                      ) : (
                        <button disabled style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(255,255,255,0.02)', color: '#475569', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'not-allowed' }} title="No disponible en Drive">
                          💻
                        </button>
                      )}

                      <button 
                        onClick={() => { setSelectedDocId(r.id); setSelectedDocTipo('individual'); }}
                        style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                        title="Ver versiones del reporte"
                      >
                        📜 Versiones
                      </button>

                      {user?.rol === 'admin' && (
                        <button 
                          onClick={() => handleDeleteDoc(r.id, 'individual', r.nombre_equipo)}
                          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                          title="Eliminar reporte y versiones"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* TABLE: AREA BOOKS */
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem', width: '40px' }}>
                  <input type="checkbox" onChange={handleSelectAll} checked={libros.length > 0 && selectedIds.length === libros.length} />
                </th>
                <th style={{ padding: '0.75rem 1rem' }}>Libro</th>
                <th style={{ padding: '0.75rem 1rem' }}>Ubicación</th>
                <th style={{ padding: '0.75rem 1rem' }}>Empresa</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Equipos</th>
                <th style={{ padding: '0.75rem 1rem' }}>Estados</th>
                <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {libros.map((l) => (
                <tr 
                  key={l.id} 
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <td style={{ padding: '0.9rem 1rem' }}>
                    <input type="checkbox" checked={selectedIds.includes(l.id)} onChange={() => handleSelectOne(l.id)} />
                  </td>
                  <td style={{ padding: '0.9rem 1rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                    📖 Libro - {l.nombre_ubicacion}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>
                    {l.nombre_ubicacion}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>
                    {l.nombre_empresa}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    {l.numero_equipos}
                  </td>
                  <td style={{ padding: '0.9rem 1rem' }}>
                    {getBookStatesBadges(l.resumen_estados)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {formatFecha(l.fecha_generacion)}
                  </td>
                  <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                      <button 
                        onClick={() => handleDownloadPDF(l.id, 'libro', `LIBRO-${l.nombre_ubicacion.replace(/\s+/g, '_')}.pdf`)}
                        style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                        title="Descargar localmente"
                      >
                        📥
                      </button>

                      {l.ruta_pdf_drive ? (
                        <button 
                          onClick={() => openDriveLink(l.ruta_pdf_drive)}
                          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                          title="Abrir en Google Drive"
                        >
                          ☁️ Drive
                        </button>
                      ) : (
                        <button disabled style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(255,255,255,0.02)', color: '#475569', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '4px', fontSize: '0.75rem', cursor: 'not-allowed' }} title="No disponible en Drive">
                          💻
                        </button>
                      )}

                      <button 
                        onClick={() => { setSelectedDocId(l.id); setSelectedDocTipo('libro'); }}
                        style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                        title="Ver versiones del libro"
                      >
                        📜 Versiones
                      </button>

                      {user?.rol === 'admin' && (
                        <button 
                          onClick={() => handleDeleteDoc(l.id, 'libro', l.nombre_ubicacion)}
                          style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500 }}
                          title="Eliminar libro y versiones"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && totalCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Mostrando registros {(page - 1) * limit + 1} - {Math.min(page * limit, totalCount)} de {totalCount}
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button 
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                backgroundColor: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                color: page === 1 ? '#475569' : 'white',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: page === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              ◀ Anterior
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', margin: '0 0.5rem' }}>
              Página {page} de {totalPages}
            </span>
            <button 
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                backgroundColor: page === totalPages ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                color: page === totalPages ? '#475569' : 'white',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Siguiente ▶
            </button>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {selectedDocId && (
        <VersionHistoryModal 
          reporteId={selectedDocId} 
          tipo={selectedDocTipo} 
          onClose={() => { setSelectedDocId(null); setSelectedDocTipo(null); }} 
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {docToDelete && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '450px', width: '100%', backgroundColor: 'rgba(30, 41, 59, 0.95)', border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#ef4444' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Confirmar Eliminación</h3>
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              {docToDelete.isBulk ? (
                <p>¿Está seguro de que desea eliminar permanentemente <strong>{docToDelete.ids.length} documentos seleccionados</strong> y todas sus versiones?</p>
              ) : (
                <p>¿Está seguro de que desea eliminar permanentemente {docToDelete.tipo === 'libro' ? 'el libro por área' : 'el reporte'} de <strong>{docToDelete.displayInfo}</strong> y todas sus versiones?</p>
              )}
              <p style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600 }}>Esta acción es irreversible.</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button onClick={() => setDocToDelete(null)} className="btn btn-secondary" style={{ padding: '0.6rem 1.2rem' }}>Cancelar</button>
              <button onClick={confirmDeleteDoc} className="btn" style={{ padding: '0.6rem 1.2rem', backgroundColor: '#ef4444', color: 'white' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
