'use client';
import { useState, useEffect, useMemo } from 'react';
import { apiService, API_BASE_URL } from '../services/api';
import { useAuth } from './AuthProvider';

const cleanStr = (val) => (val !== undefined && val !== null ? String(val).trim() : '');

export default function MinutaResumenPanel({ empresaIdInicial = null, onSelectEquipoAndTab }) {
  const { token } = useAuth();
  const [data, setData] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [campanias, setCampanias] = useState([]);
  const [empresaId, setEmpresaId] = useState(empresaIdInicial || '');
  const [campania, setCampania] = useState('');
  const [search, setSearch] = useState('');
  const [criticidadFiltro, setCriticidadFiltro] = useState('');
  const [areaFiltro, setAreaFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingPdfId, setLoadingPdfId] = useState(null);

  // Cargar empresas para el selector
  useEffect(() => {
    async function loadEmpresas() {
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
      if (!activeToken) return;
      try {
        const res = await fetch(`${API_BASE_URL}/empresas`, {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (res.ok) {
          const list = await res.json();
          setEmpresas(list);
          if (Array.isArray(list) && list.length > 0) {
            setEmpresaId(prev => {
              if (!prev || !list.some(e => String(e.id) === String(prev))) {
                return list[0].id;
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error('Error cargando empresas:', err);
      }
    }
    loadEmpresas();
  }, [token]);

  // Sincronizar empresaId desde el prop inicial (Sidebar)
  useEffect(() => {
    if (empresaIdInicial !== undefined && empresaIdInicial !== null && empresaIdInicial !== '') {
      setEmpresaId(empresaIdInicial);
      setAreaFiltro('');
      setCampania('');
    }
  }, [empresaIdInicial]);

  // Cargar campañas disponibles para la empresa seleccionada
  useEffect(() => {
    async function loadCampanias() {
      try {
        const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
        const url = empresaId ? `${API_BASE_URL}/campanias?empresa_id=${empresaId}` : `${API_BASE_URL}/campanias`;
        const res = await fetch(url, {
          headers: activeToken ? { 'Authorization': `Bearer ${activeToken}` } : {}
        });
        if (res.ok) {
          const list = await res.json();
          setCampanias(list);
        }
      } catch (err) {
        console.error('Error cargando campañas:', err);
      }
    }
    loadCampanias();
  }, [empresaId, token]);

  // Cargar datos de la minuta resumen dinámicamente
  const fetchData = async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (!activeToken) return;

    setLoading(true);
    try {
      const activeEmpresa = empresaId || (empresas.length > 0 ? empresas[0].id : null);
      const result = await apiService.getMinutaResumen(activeEmpresa, search, criticidadFiltro, campania, activeToken, areaFiltro);
      setData(result || []);
    } catch (err) {
      console.error('Error cargando Minuta Resumen:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [empresaId, search, criticidadFiltro, campania, areaFiltro, token]);

  // Escuchar eventos globales de inspección actualizada para refrescar automáticamente
  useEffect(() => {
    const handleRefresh = () => {
      fetchData();
    };
    window.addEventListener('inspeccion_actualizada', handleRefresh);
    return () => window.removeEventListener('inspeccion_actualizada', handleRefresh);
  }, [empresaId, search, criticidadFiltro, campania, areaFiltro, token]);

  // Empresa activa resuelta
  const empresaActivaObj = empresas.find(e => String(e.id) === String(empresaId));
  const nombreEmpresaActiva = empresaActivaObj ? empresaActivaObj.nombre : (empresaId ? `Empresa ${empresaId}` : 'Todas las Empresas');

  // Derivar lista de Áreas únicas disponibles
  const uniqueAreas = useMemo(() => {
    const set = new Set();
    data.forEach(d => {
      const area = d.sector_completo || d.sector;
      if (area && area.trim()) set.add(area.trim());
    });
    return Array.from(set).sort();
  }, [data]);

  // Filtrado de data en cliente si aplica
  const displayData = useMemo(() => {
    if (!areaFiltro) return data;
    return data.filter(d => {
      const area = d.sector_completo || d.sector || '';
      return area.toLowerCase().includes(areaFiltro.toLowerCase());
    });
  }, [data, areaFiltro]);

  // Cálculos de métricas KPI y Avance
  const stats = useMemo(() => {
    const total = displayData.length;
    const inspeccionados = displayData.filter(d => d.tiene_inspeccion).length;
    const pendientes = total - inspeccionados;
    const condicionales = displayData.filter(d => (d.observaciones || '').toLowerCase().includes('condicional') || d.estado === 'REGULAR').length;
    const nivel1 = displayData.filter(d => cleanStr(d.criticidad) === '1' || cleanStr(d.criticidad).startsWith('1')).length;
    const proximaPrioritaria = displayData.filter(d => 
      cleanStr(d.criticidad) === '1' || 
      cleanStr(d.criticidad).startsWith('1') ||
      (d.proxima_inspeccion || '').includes('1 año') || 
      (d.proxima_inspeccion || '').includes('Prioritaria') || 
      d.estado === 'CRITICO'
    ).length;
    const porcentajeAvance = total > 0 ? Math.round((inspeccionados / total) * 100) : 0;
    
    return { total, inspeccionados, pendientes, condicionales, nivel1, proximaPrioritaria, porcentajeAvance };
  }, [displayData]);

  // Abrir reporte técnico PDF
  const handleOpenPDF = async (equipoId, informeRef) => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (!activeToken) {
      alert('Debe iniciar sesión para abrir el reporte.');
      return;
    }
    setLoadingPdfId(equipoId);
    try {
      await apiService.openReportPDF(equipoId, activeToken, campania);
    } catch (err) {
      console.error('Error al abrir PDF:', err);
    } finally {
      setLoadingPdfId(null);
    }
  };

  // Exportar a CSV
  const exportToCSV = () => {
    if (!displayData.length) return;
    const headers = ['Nº', 'TAG', 'Sector', 'Descripción Ubicación Técnica', 'Estado Inspección', 'Informe Ref.', 'Recom', 'Acc. Correctivas', 'Acc. Preventivas', 'Comentarios', 'Observaciones', 'Criticidad', 'Próx. Inspección'];
    const rows = displayData.map(d => [
      d.numero,
      `"${d.tag}"`,
      `"${d.sector}"`,
      `"${d.equipo_nombre || ''}"`,
      `"${d.tiene_inspeccion ? 'Inspeccionado' : 'Pendiente'}"`,
      `"${d.informe}"`,
      d.recom,
      d.acciones_correctivas,
      d.acciones_preventivas,
      `"${d.comentarios}"`,
      `"${d.observaciones}"`,
      d.criticidad,
      `"${d.proxima_inspeccion}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Minuta_Resumen_PGP_${empresaId || 'Todas'}_${areaFiltro ? areaFiltro.replace(/\s+/g, '_') : 'General'}_${campania || 'Actual'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
      
      {/* Encabezado del Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-primary)', fontWeight: 700, marginBottom: '0.2rem' }}>
            Minuta Resumen PGP {campania ? `· ${campania}` : '· Dinámica'}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Tabla Resumen de Inspecciones Técnicas</span>
            {empresaId && (
              <span style={{ fontSize: '1.1rem', color: '#38bdf8', fontWeight: 700, backgroundColor: 'rgba(56, 189, 248, 0.12)', padding: '2px 10px', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                🏢 {nombreEmpresaActiva}
              </span>
            )}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0 0' }}>
            Consolidado general sincronizado en tiempo real con el registro de inspecciones y campañas PGP.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Badge de avance global */}
          <div style={{ 
            backgroundColor: 'rgba(15, 23, 42, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            padding: '6px 12px', 
            borderRadius: '10px',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}>
            <span style={{ color: 'var(--text-secondary)' }}>Avance Inspección:</span>
            <strong style={{ color: stats.porcentajeAvance === 100 ? '#4ade80' : '#38bdf8' }}>
              {stats.inspeccionados} / {stats.total} ({stats.porcentajeAvance}%)
            </strong>
          </div>

          <button
            onClick={fetchData}
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.85rem'
            }}
            title="Refrescar matriz resumen"
          >
            🔄 Actualizar
          </button>

          <button
            onClick={exportToCSV}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.15)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#4ade80',
              padding: '8px 16px',
              borderRadius: '10px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.2s'
            }}
          >
            📊 Exportar a Excel (CSV)
          </button>
        </div>
      </div>

      {/* KPI Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        
        {/* Card 1: Total Equipos */}
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Equipos en Matriz</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.2rem' }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', display: 'flex', gap: '0.5rem' }}>
            <span>✅ {stats.inspeccionados} Realizados</span>
            <span>·</span>
            <span style={{ color: stats.pendientes > 0 ? '#fbbf24' : '#4ade80' }}>⏳ {stats.pendientes} Pendientes</span>
          </div>
        </div>

        {/* Card 2: Servicio Condicional */}
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Servicio Condicional</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.2rem' }}>{stats.condicionales}</div>
          <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '0.2rem' }}>Requieren intervención técnica</div>
        </div>

        {/* Card 3: Criticidad Nivel 1 */}
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', borderLeft: '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Criticidad Nivel 1 (Alta)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', marginTop: '0.2rem' }}>{stats.nivel1}</div>
          <div style={{ fontSize: '0.75rem', color: '#f87171', marginTop: '0.2rem' }}>Monitoreo prioritario</div>
        </div>

        {/* Card 4: Reinspección Prioritaria */}
        <div className="glass-panel" style={{ padding: '1.2rem', borderRadius: '14px', borderLeft: '4px solid #ec4899' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Reinspección Prioritaria (1 Año)</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ec4899', marginTop: '0.2rem' }}>{stats.proximaPrioritaria}</div>
          <div style={{ fontSize: '0.75rem', color: '#f472b6', marginTop: '0.2rem' }}>Próxima parada anual</div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="glass-panel" style={{ padding: '1rem', borderRadius: '12px', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        
        {/* Selector de Empresa */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(e.target.value);
              setAreaFiltro('');
              setCampania('');
            }}
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          >
            <option value="">Todas las Empresas</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
        </div>

        {/* Selector de Campaña PGP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '1 1 180px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Campaña / Parada Anual</label>
          <select
            value={campania}
            onChange={(e) => setCampania(e.target.value)}
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          >
            <option value="">Todas / Última Inspección</option>
            {campanias.map(c => (
              <option key={c.id || c.nombre} value={c.nombre}>{c.nombre}</option>
            ))}
          </select>
        </div>

        {/* Selector de Criticidad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '1 1 150px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nivel de Criticidad</label>
          <select
            value={criticidadFiltro}
            onChange={(e) => setCriticidadFiltro(e.target.value)}
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          >
            <option value="">Todas las Criticidades</option>
            <option value="1">Nivel 1 (Crítico)</option>
            <option value="2">Nivel 2 (Medio)</option>
            <option value="3">Nivel 3 (Bajo)</option>
          </select>
        </div>

        {/* Selector de Área */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '1 1 170px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Área</label>
          <select
            value={areaFiltro}
            onChange={(e) => setAreaFiltro(e.target.value)}
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          >
            <option value="">Todas las Áreas</option>
            {uniqueAreas.map(area => (
              <option key={area} value={area}>{area}</option>
            ))}
          </select>
        </div>

        {/* Buscador general */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: '2 1 220px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Buscar por TAG, Informe o Área</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: T-2240, ARC MDA, Sorbent..."
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '0.88rem',
              outline: 'none'
            }}
          />
        </div>

      </div>

      {/* Tabla Principal Estilo Pág. 15 del Reporte Unificado */}
      <div className="glass-panel" style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.08)', width: '100%' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            Sincronizando minuta resumen con inspecciones...
          </div>
        ) : displayData.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            🔍 No se encontraron registros de inspección con los filtros seleccionados.
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderBottom: '2px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8', fontSize: '0.70rem' }}>
                  <th style={{ padding: '8px 4px', textAlign: 'center', width: '32px', whiteSpace: 'nowrap' }}>Nº</th>
                  <th style={{ padding: '8px 6px', fontWeight: 700, color: '#f8fafc', width: '70px', whiteSpace: 'nowrap' }}>TAG</th>
                  <th style={{ padding: '8px 6px', width: '60px', whiteSpace: 'nowrap' }}>SECTOR</th>
                  <th style={{ padding: '8px 8px', minWidth: '180px' }}>DESCRIPCIÓN UBICACIÓN TÉCNICA</th>
                  <th style={{ padding: '8px 2px', textAlign: 'center', width: '40px', whiteSpace: 'nowrap' }} title="Recomendaciones">REC.</th>
                  <th style={{ padding: '8px 2px', textAlign: 'center', width: '42px', whiteSpace: 'nowrap' }} title="Acciones Correctivas">CORR.</th>
                  <th style={{ padding: '8px 2px', textAlign: 'center', width: '42px', whiteSpace: 'nowrap' }} title="Acciones Preventivas">PREV.</th>
                  <th style={{ padding: '8px 6px', width: '115px' }}>COMENTARIOS</th>
                  <th style={{ padding: '8px 6px', width: '115px' }}>OBSERVACIONES</th>
                  <th style={{ padding: '8px 2px', textAlign: 'center', width: '36px', whiteSpace: 'nowrap' }} title="Nivel de Criticidad">CRIT.</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '85px', whiteSpace: 'nowrap' }}>PRÓX. INSP.</th>
                  <th style={{ padding: '8px 6px', textAlign: 'center', width: '125px', whiteSpace: 'nowrap' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((row, i) => {
                  const crit = cleanStr(row.criticidad);
                  const prox = cleanStr(row.proxima_inspeccion);
                  
                  // Estilos de badge para criticidad (idéntico a Pág. 15)
                  const critBg = crit === '1' ? '#ef4444' : crit === '2' ? '#f59e0b' : '#22c55e';
                  const critColor = '#ffffff';

                  // Estilos para Próxima Inspección
                  let proxBg = 'rgba(56, 189, 248, 0.15)';
                  let proxColor = '#38bdf8';

                  if (crit === '1' || prox.includes('Prioritaria') || prox.includes('1 año')) {
                    proxBg = '#be123c'; // Rojo/rosa destacado (Criticidad 1)
                    proxColor = '#ffffff';
                  } else if (crit === '2' || prox.includes('2 años')) {
                    proxBg = '#d97706'; // Dorado/Naranja (Criticidad 2)
                    proxColor = '#ffffff';
                  } else if (crit === '3' || prox.includes('5 años')) {
                    proxBg = '#15803d'; // Verde (Criticidad 3)
                    proxColor = '#ffffff';
                  }

                  const isInspeccionado = row.tiene_inspeccion;
                  const isPdfLoading = loadingPdfId === row.equipo_id;

                  return (
                    <tr 
                      key={row.equipo_id || i}
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        backgroundColor: i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'}
                    >
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {row.numero}
                      </td>

                      <td style={{ padding: '6px 6px', fontWeight: 800, color: '#38bdf8', whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                        {row.tag}
                      </td>

                      <td style={{ padding: '6px 6px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                        {row.sector}
                      </td>

                      {/* DESCRIPCIÓN UBICACIÓN TÉCNICA */}
                      <td style={{ padding: '6px 8px', whiteSpace: 'normal', wordBreak: 'normal', lineHeight: '1.25' }}>
                        {isInspeccionado ? (
                          <button
                            onClick={() => handleOpenPDF(row.equipo_id, row.informe)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: '#34d399',
                              fontWeight: 600,
                              textDecoration: 'underline',
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'inline',
                              lineHeight: '1.25',
                              fontSize: '0.76rem'
                            }}
                            title={`Abrir Reporte PDF (${row.informe || 'Informe'})`}
                          >
                            📄 {row.equipo_nombre || row.informe}
                          </button>
                        ) : (
                          <span style={{ color: '#e2e8f0', fontWeight: 500, lineHeight: '1.25', fontSize: '0.76rem' }}>
                            {row.equipo_nombre || row.informe || '-'}
                          </span>
                        )}
                      </td>

                      {/* RECOM */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: row.recom === 'SI' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: row.recom === 'SI' ? '#34d399' : '#94a3b8'
                        }}>
                          {row.recom}
                        </span>
                      </td>

                      {/* ACCIONES CORRECTIVAS */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: row.acciones_correctivas === 'SI' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: row.acciones_correctivas === 'SI' ? '#fbbf24' : '#94a3b8'
                        }}>
                          {row.acciones_correctivas}
                        </span>
                      </td>

                      {/* ACCIONES PREVENTIVAS */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          backgroundColor: row.acciones_preventivas === 'SI' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: row.acciones_preventivas === 'SI' ? '#38bdf8' : '#94a3b8'
                        }}>
                          {row.acciones_preventivas}
                        </span>
                      </td>

                      {/* COMENTARIOS */}
                      <td style={{ padding: '6px 6px', color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: '1.2' }}>
                        {row.comentarios}
                      </td>

                      {/* OBSERVACIONES */}
                      <td style={{ padding: '6px 6px', color: '#cbd5e1', fontWeight: row.observaciones ? 600 : 400, fontSize: '0.72rem', lineHeight: '1.2' }}>
                        {row.observaciones || '-'}
                      </td>

                      {/* NIVEL CRITICIDAD */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '18px',
                          height: '18px',
                          lineHeight: '18px',
                          borderRadius: '50%',
                          backgroundColor: critBg,
                          color: critColor,
                          fontWeight: 800,
                          fontSize: '0.72rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}>
                          {crit}
                        </span>
                      </td>

                      {/* PROXIMA INSPECCION */}
                      <td style={{ padding: '6px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: proxBg,
                          color: proxColor,
                          fontWeight: 700,
                          fontSize: '0.70rem',
                          whiteSpace: 'nowrap'
                        }}>
                          {prox}
                        </span>
                      </td>

                      {/* ACCIONES DE INTERACCIÓN */}
                      <td style={{ padding: '6px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isInspeccionado ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleOpenPDF(row.equipo_id, row.informe)}
                              disabled={isPdfLoading}
                              style={{
                                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                                border: '1px solid rgba(34, 197, 94, 0.4)',
                                color: '#4ade80',
                                padding: '3px 7px',
                                borderRadius: '5px',
                                fontSize: '0.70rem',
                                fontWeight: 700,
                                cursor: isPdfLoading ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                whiteSpace: 'nowrap'
                              }}
                              title="Abrir Reporte PDF"
                            >
                              {isPdfLoading ? '⏳' : '📄 Reporte'}
                            </button>

                            <button
                              onClick={() => {
                                if (onSelectEquipoAndTab) {
                                  onSelectEquipoAndTab(row.equipo_id, 'MANUAL');
                                }
                              }}
                              style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                padding: '3px 6px',
                                borderRadius: '5px',
                                fontSize: '0.70rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Editar inspección"
                            >
                              ✏️
                            </button>

                            {row.ruta_pdf_drive && (
                              <a
                                href={row.ruta_pdf_drive}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  backgroundColor: 'rgba(14, 165, 233, 0.12)',
                                  border: '1px solid rgba(14, 165, 233, 0.25)',
                                  color: '#38bdf8',
                                  padding: '3px 5px',
                                  borderRadius: '5px',
                                  fontSize: '0.70rem',
                                  textDecoration: 'none'
                                }}
                                title="Abrir en Google Drive"
                              >
                                ☁️
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              if (onSelectEquipoAndTab) {
                                onSelectEquipoAndTab(row.equipo_id, 'MANUAL');
                              }
                            }}
                            style={{
                              backgroundColor: '#0284c7',
                              border: '1px solid #38bdf8',
                              color: '#ffffff',
                              padding: '3px 9px',
                              borderRadius: '5px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              whiteSpace: 'nowrap'
                            }}
                            title="Iniciar y registrar inspección para este equipo"
                          >
                            ✏️ Inspeccionar
                          </button>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
