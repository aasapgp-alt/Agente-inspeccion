import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { apiService, API_BASE_URL } from '../services/api';

const renderVal = (val) => {
  if (!val) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join('\n');
    }
    return Object.entries(val)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('\n');
  }
  return String(val);
};

export default function AssetHistory({ empresaId }) {
  const { user, token } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [areaFilter, setAreaFilter] = useState('ALL');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [assetInspections, setAssetInspections] = useState([]);
  const [loadingInspections, setLoadingInspections] = useState(false);
  const [loadingReportPdf, setLoadingReportPdf] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2024);

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editMaterial, setEditMaterial] = useState('');
  const [editFluido, setEditFluido] = useState('');
  const [editPresion, setEditPresion] = useState(0);
  const [editTemperatura, setEditTemperatura] = useState(0);
  const [editEstado, setEditEstado] = useState('Bueno');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertingAsset, setRevertingAsset] = useState(false);

  useEffect(() => {
    if (selectedAsset) {
      setEditMaterial(selectedAsset.material || '');
      setEditFluido(selectedAsset.fluido || '');
      setEditPresion(selectedAsset.presion_diseno || 0);
      setEditTemperatura(selectedAsset.temperatura_diseno || 0);
      setEditEstado(selectedAsset.estado_actual || 'BUENO');
      setIsEditing(false);

      // Fetch historial de inspecciones para este equipo
      setLoadingInspections(true);
      fetch(`${API_BASE_URL}/inspecciones/${selectedAsset.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            setAssetInspections(data);
            // Default to the first year available (e.g. 2026 or 2024)
            setSelectedYear(data[0].anio);
          } else {
            setAssetInspections([]);
          }
          setLoadingInspections(false);
        })
        .catch(err => {
          console.error("Error fetching inspections:", err);
          setAssetInspections([]);
          setLoadingInspections(false);
        });
    }
  }, [selectedAsset]);

  const handleRevertAsset = async () => {
    if (!revertReason.trim()) {
      return alert("Debe ingresar obligatoriamente el motivo del cambio a no inspeccionado.");
    }
    setRevertingAsset(true);
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/${selectedAsset.id}/revertir-inspeccion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: revertReason.trim()
        })
      });
      if (res.ok) {
        alert("El equipo ha sido pasado a NO INSPECCIONADO (PENDIENTE) exitosamente.");
        const updatedAsset = { ...selectedAsset, estado_actual: 'PENDIENTE' };
        setSelectedAsset(updatedAsset);
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
        setShowRevertModal(false);
        setRevertReason('');
      } else {
        const errData = await res.json();
        alert(`Error al revertir la inspección: ${errData.detail || 'Error en el servidor'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al revertir la inspección.");
    } finally {
      setRevertingAsset(false);
    }
  };

  const handleDeleteAsset = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/${selectedAsset.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert("El equipo ha sido eliminado correctamente de todas las bases de datos.");
        setAssets(prev => prev.filter(a => a.id !== selectedAsset.id));
        setSelectedAsset(null);
        setShowDeleteModal(false);
      } else {
        alert("Error al eliminar el equipo de la base de datos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error de conexión al eliminar el equipo.");
    }
  };

  const handleSaveAssetDetails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/${selectedAsset.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          material: editMaterial,
          fluido: editFluido,
          presion_diseno: parseFloat(editPresion) || 0,
          temperatura_diseno: parseFloat(editTemperatura) || 0,
          estado_actual: editEstado
        })
      });
      if (res.ok) {
        const updatedAsset = {
          ...selectedAsset,
          material: editMaterial,
          fluido: editFluido,
          presion_diseno: parseFloat(editPresion) || 0,
          temperatura_diseno: parseFloat(editTemperatura) || 0,
          estado_actual: editEstado
        };
        setSelectedAsset(updatedAsset);
        setIsEditing(false);
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? updatedAsset : a));
        alert("Datos del activo actualizados correctamente.");
      } else {
        alert("Error al actualizar los datos.");
      }
    } catch (err) {
      console.error(err);
      alert("Error al guardar.");
    }
  };

  const currentInsp = assetInspections.find(i => i.anio === selectedYear) || assetInspections[0] || {};

  useEffect(() => {
    setLoading(true);
    const urlParams = empresaId ? `?empresa_id=${empresaId}` : '';
    
    fetch(`${API_BASE_URL}/dashboard/history${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setAssets(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [empresaId]);

  // Derive unique materials & areas for the filter dropdowns
  const uniqueMaterials = Array.from(new Set(assets.map(a => a.material).filter(m => m && m.trim() !== ''))).sort();
  const uniqueAreas = Array.from(new Set(assets.map(a => a.area_nombre).filter(m => m && m.trim() !== ''))).sort();

  // Review Report Handler
  const handleReviewReport = async () => {
    if (!selectedAsset) return;
    setLoadingReportPdf(true);
    try {
      const campaniaTarget = selectedYear ? `PGP ${selectedYear}` : undefined;
      await apiService.openReportPDF(selectedAsset.id, token, campaniaTarget);
    } catch (err) {
      console.error('Error al abrir reporte:', err);
    } finally {
      setLoadingReportPdf(false);
    }
  };

  // Filtered Assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.tag_codigo.toLowerCase().includes(search.toLowerCase()) ||
      asset.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      asset.area_nombre.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = 
      statusFilter === 'ALL' || 
      asset.estado_actual.toUpperCase() === statusFilter.toUpperCase() ||
      (statusFilter === 'CRITICO' && (asset.estado_actual.toUpperCase() === 'CRÍTICO' || asset.estado_actual.toUpperCase() === 'ROTO')) ||
      (statusFilter === 'REGULAR' && asset.estado_actual.toUpperCase() === 'ALERTA');

    const matchesMaterial =
      materialFilter === 'ALL' ||
      asset.material === materialFilter;

    const matchesArea =
      areaFilter === 'ALL' ||
      asset.area_nombre === areaFilter;

    return matchesSearch && matchesStatus && matchesMaterial && matchesArea;
  });

  const getStatusBadge = (status) => {
    const st = status ? status.toUpperCase() : '';
    let bgColor = 'rgba(100, 116, 139, 0.2)';
    let textColor = 'var(--text-secondary)';
    let border = '1px solid rgba(100, 116, 139, 0.4)';

    if (st.includes('BUENO') || st === 'GOOD') {
      bgColor = 'rgba(16, 185, 129, 0.15)';
      textColor = '#10b981';
      border = '1px solid rgba(16, 185, 129, 0.4)';
    } else if (st.includes('ALERTA') || st.includes('REGULAR') || st === 'WARNING') {
      bgColor = 'rgba(245, 158, 11, 0.15)';
      textColor = '#f59e0b';
      border = '1px solid rgba(245, 158, 11, 0.4)';
    } else if (st.includes('ROTO') || st.includes('CRÍTICO') || st === 'CRITICO' || st === 'DANGER') {
      bgColor = 'rgba(239, 68, 68, 0.15)';
      textColor = '#ef4444';
      border = '1px solid rgba(239, 68, 68, 0.4)';
    } else if (st.includes('FUERA') || st.includes('RUTA')) {
      bgColor = 'rgba(147, 51, 234, 0.15)';
      textColor = '#a855f7';
      border = '1px solid rgba(147, 51, 234, 0.4)';
    }

    return (
      <span style={{ 
        padding: '0.3rem 0.8rem', 
        borderRadius: '20px', 
        fontSize: '0.75rem', 
        fontWeight: 600,
        backgroundColor: bgColor,
        color: textColor,
        border: border,
        display: 'inline-block',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {status || 'Desconocido'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
      
      {/* Header with Search and Status Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Resumen de Activos e Historial</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Filtros interactivos de la base de datos.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <input 
              type="text" 
              placeholder="Buscar por Tag, Área o Nombre..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: '2.5rem',
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderColor: 'rgba(255,255,255,0.1)'
              }}
            />
            <span style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>🔍</span>
          </div>

          {/* Area Select */}
          <div style={{ minWidth: '150px' }}>
            <select 
              value={areaFilter} 
              onChange={(e) => setAreaFilter(e.target.value)}
              style={{
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px'
              }}
            >
              <option value="ALL">TODAS LAS ÁREAS</option>
              {uniqueAreas.map(area => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </div>

          {/* Status Select */}
          <div style={{ minWidth: '150px' }}>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px'
              }}
            >
              <option value="ALL">TODOS LOS ESTADOS</option>
              <option value="BUENO">BUENO</option>
              <option value="ALERTA">ALERTA / REGULAR</option>
              <option value="CRÍTICO">CRÍTICO / ROTO</option>
              <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            </select>
          </div>

          {/* Material Select */}
          <div style={{ minWidth: '150px' }}>
            <select 
              value={materialFilter} 
              onChange={(e) => setMaterialFilter(e.target.value)}
              style={{
                fontSize: '0.9rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: 'white',
                padding: '0.5rem',
                borderRadius: '4px'
              }}
            >
              <option value="ALL">TODOS LOS MATERIALES</option>
              {uniqueMaterials.map(mat => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid Layout: Table & Detail Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedAsset ? '2.2fr 1fr' : '1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
        
        {/* Main Table Container */}
        <div className="glass-panel" style={{ overflow: 'auto', padding: '1rem', maxHeight: '550px', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
              <div style={{ color: 'var(--accent-primary)', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }}>Cargando historial de activos...</div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-secondary)' }}>
              <span>⚠️</span>
              <p style={{ marginTop: '0.5rem' }}>No se encontraron activos con los filtros seleccionados.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Tag / Código</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Área / Planta</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Descripción</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Material</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fluido</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Presión / Temp</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Estado</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Diagnóstico Reciente</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => (
                  <tr 
                    key={asset.id} 
                    onClick={() => setSelectedAsset(asset)}
                    style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)', 
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      backgroundColor: selectedAsset?.id === asset.id ? 'rgba(14, 165, 233, 0.1)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedAsset?.id !== asset.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedAsset?.id !== asset.id) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                      {asset.tag_codigo}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {asset.area_nombre}
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 500 }}>
                      {asset.descripcion}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {asset.material}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {asset.fluido}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {asset.presion_diseno} psi / {asset.temperatura_diseno} °C
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      {getStatusBadge(asset.estado_actual)}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {asset.diagnostico || 'Sin registro'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detailed Sidebar Panel */}
        {selectedAsset && (
          <div className="glass-panel" style={{ 
            padding: '1.5rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.2rem', 
            position: 'relative',
            maxHeight: '550px',
            overflowY: 'auto',
            borderLeft: '2px solid var(--accent-primary)',
            backgroundColor: 'rgba(30, 41, 59, 0.95)'
          }}>
            <button 
              onClick={() => setSelectedAsset(null)} 
              style={{
                position: 'absolute',
                right: '1rem',
                top: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0.2rem'
              }}
            >
              ✕
            </button>

            <div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', textTransform: 'uppercase' }}>
                Detalles del Activo
              </span>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0.2rem 0' }}>{selectedAsset.tag_codigo}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedAsset.descripcion}</p>
            </div>

            {!isEditing ? (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Empresa:</span>
                    <span style={{ fontWeight: 500 }}>{selectedAsset.empresa_nombre}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Área / Planta:</span>
                    <span style={{ fontWeight: 500 }}>{selectedAsset.area_nombre}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Material:</span>
                    <span style={{ fontWeight: 500 }}>{selectedAsset.material}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Fluido:</span>
                    <span style={{ fontWeight: 500 }}>{selectedAsset.fluido}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Presión Diseño:</span>
                    <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{selectedAsset.presion_diseno} psi</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Temp. Diseño:</span>
                    <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{selectedAsset.temperatura_diseno} °C</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Estado de Salud:</span>
                  {getStatusBadge(selectedAsset.estado_actual)}
                </div>

                {(user?.rol === 'supervisor' || user?.rol === 'admin') && (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="btn btn-secondary" 
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.5rem' }}
                  >
                    ✏️ Editar Datos Técnicos
                  </button>
                )}
                {user?.rol === 'admin' && selectedAsset.estado_actual && selectedAsset.estado_actual.toUpperCase() !== 'PENDIENTE' && (
                  <button 
                    onClick={() => {
                      setRevertReason('');
                      setShowRevertModal(true);
                    }} 
                    className="btn" 
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.5rem', backgroundColor: '#f59e0b', color: 'white' }}
                  >
                    ↩️ Pasar a No Inspeccionado
                  </button>
                )}
                {user?.rol === 'admin' && (
                  <button 
                    onClick={() => setShowDeleteModal(true)} 
                    className="btn" 
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginTop: '0.5rem', backgroundColor: '#ef4444', color: 'white' }}
                  >
                    🗑️ Eliminar Equipo
                  </button>
                )}
              </div>
            ) : (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Material:</span>
                    <input 
                      type="text" 
                      value={editMaterial} 
                      onChange={e => setEditMaterial(e.target.value)} 
                      style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Fluido:</span>
                    <input 
                      type="text" 
                      value={editFluido} 
                      onChange={e => setEditFluido(e.target.value)} 
                      style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Presión Diseño (psi):</span>
                    <input 
                      type="number" 
                      step="0.1"
                      value={editPresion} 
                      onChange={e => setEditPresion(parseFloat(e.target.value) || 0)} 
                      style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Temp. Diseño (°C):</span>
                    <input 
                      type="number" 
                      step="1"
                      value={editTemperatura} 
                      onChange={e => setEditTemperatura(parseInt(e.target.value) || 0)} 
                      style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Estado de Salud:</span>
                  <select 
                    value={editEstado} 
                    onChange={e => setEditEstado(e.target.value)}
                    style={{ padding: '0.3rem', fontSize: '0.85rem', width: '100%', backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px' }}
                  >
                    <option value="BUENO">BUENO</option>
                    <option value="REGULAR">REGULAR</option>
                    <option value="CRITICO">CRITICO</option>
                    <option value="FUERA DE RUTA">FUERA DE RUTA</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    onClick={() => setIsEditing(false)} 
                    className="btn btn-secondary" 
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveAssetDetails} 
                    className="btn btn-primary" 
                    style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📜 Historial por Campaña
                </span>
                {loadingInspections && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cargando...</span>}
              </div>

              {/* Selector de Años / Campañas */}
              {assetInspections.length > 0 ? (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {assetInspections.map(insp => (
                    <button
                      key={insp.anio}
                      onClick={() => setSelectedYear(insp.anio)}
                      style={{
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.78rem',
                        borderRadius: '4px',
                        border: selectedYear === insp.anio ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: selectedYear === insp.anio ? 'rgba(14, 165, 233, 0.25)' : 'rgba(0,0,0,0.3)',
                        color: selectedYear === insp.anio ? '#38bdf8' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: selectedYear === insp.anio ? 700 : 500
                      }}
                    >
                      PGP {insp.anio}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* Detalle de la Inspección Seleccionada */}
              {currentInsp && currentInsp.anio ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Estado Campaña {currentInsp.anio}:</span>
                    {getStatusBadge(currentInsp.estado)}
                  </div>

                  {currentInsp.acciones && (
                    <div>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Acciones Realizadas:</span>
                      <p style={{ 
                        margin: '0.2rem 0 0 0', 
                        fontSize: '0.82rem', 
                        backgroundColor: 'rgba(0,0,0,0.25)', 
                        padding: '0.5rem', 
                        borderRadius: '6px',
                        color: 'var(--text-primary)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {renderVal(currentInsp.acciones)}
                      </p>
                    </div>
                  )}

                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Diagnóstico Técnico:</span>
                    <p style={{ 
                      margin: '0.2rem 0 0 0', 
                      fontSize: '0.82rem', 
                      backgroundColor: 'rgba(0,0,0,0.25)', 
                      padding: '0.5rem', 
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {renderVal(currentInsp.diagnostico) || 'Sin diagnóstico registrado para este año.'}
                    </p>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Recomendaciones:</span>
                    <p style={{ 
                      margin: '0.2rem 0 0 0', 
                      fontSize: '0.82rem', 
                      backgroundColor: 'rgba(0,0,0,0.25)', 
                      padding: '0.5rem', 
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {renderVal(currentInsp.recomendaciones) || 'Sin recomendaciones registradas para este año.'}
                    </p>
                  </div>

                  {/* Botón para Realizar Revisión de Reporte */}
                  <button
                    onClick={handleReviewReport}
                    disabled={loadingReportPdf}
                    className="btn"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.18)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      color: '#4ade80',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      cursor: loadingReportPdf ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '0.6rem',
                      width: '100%',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loadingReportPdf ? '⏳ Abriendo Reporte...' : '🔍 Revisión de Reporte Técnico (PDF)'}
                  </button>

                  {currentInsp.ruta_pdf_drive && (
                    <a
                      href={currentInsp.ruta_pdf_drive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ 
                        display: 'block', 
                        textAlign: 'center', 
                        padding: '0.4rem', 
                        fontSize: '0.8rem', 
                        marginTop: '0.3rem',
                        textDecoration: 'none',
                        color: '#38bdf8'
                      }}
                    >
                      ☁️ Ver Informe PDF en Google Drive
                    </a>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Diagnóstico Reciente:</span>
                    <p style={{ 
                      margin: '0.2rem 0 0 0', 
                      fontSize: '0.82rem', 
                      backgroundColor: 'rgba(0,0,0,0.25)', 
                      padding: '0.5rem', 
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {renderVal(selectedAsset.diagnostico) || 'No hay diagnósticos registrados para este activo.'}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem', fontWeight: 600 }}>Recomendación Preventiva:</span>
                    <p style={{ 
                      margin: '0.2rem 0 0 0', 
                      fontSize: '0.82rem', 
                      backgroundColor: 'rgba(0,0,0,0.25)', 
                      padding: '0.5rem', 
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      {renderVal(selectedAsset.recomendaciones) || 'Ninguna recomendación disponible.'}
                    </p>
                  </div>

                  {/* Botón para Realizar Revisión de Reporte en Activo General */}
                  <button
                    onClick={handleReviewReport}
                    disabled={loadingReportPdf}
                    className="btn"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.18)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      color: '#4ade80',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      borderRadius: '8px',
                      cursor: loadingReportPdf ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      marginTop: '0.6rem',
                      width: '100%',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loadingReportPdf ? '⏳ Abriendo Reporte...' : '🔍 Revisión de Reporte Técnico (PDF)'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Warning Delete Modal Overlay */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '500px',
            width: '100%',
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 0 30px rgba(239, 68, 68, 0.15)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            borderRadius: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', color: '#ef4444' }}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Advertencia de Eliminación</h3>
            </div>
            
            <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '1rem' }}>
                ¿Está seguro de que desea eliminar permanentemente el equipo <strong>{selectedAsset.tag_codigo} - {selectedAsset.descripcion}</strong>?
              </p>
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid #ef4444', padding: '1rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#ef4444' }}>Esta acción es irreversible y realizará lo siguiente:</strong>
                <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                  <li>Eliminará el activo de la lista de equipos en Planta.</li>
                  <li>Borrará todo el historial de inspecciones y diagnósticos de 2024 a 2026.</li>
                  <li>Eliminará el registro correspondiente en la base original legacy.</li>
                  <li>Borrará el registro en la base PostgreSQL si se encuentra activa.</li>
                </ul>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowDeleteModal(false)} 
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteAsset} 
                className="btn"
                style={{ 
                  padding: '0.6rem 1.2rem', 
                  fontSize: '0.85rem', 
                  backgroundColor: '#ef4444', 
                  color: 'white',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.target.style.backgroundColor = '#dc2626'}
                onMouseLeave={e => e.target.style.backgroundColor = '#ef4444'}
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Revertir Inspección a No Inspeccionado */}
      {showRevertModal && selectedAsset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-panel" style={{
            width: '90%',
            maxWidth: '500px',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🔄</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f59e0b', fontWeight: 700 }}>
                  Pasar a No Inspeccionado
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Equipo: {selectedAsset.tag_codigo} - {selectedAsset.descripcion}
                </span>
              </div>
            </div>
            
            <div style={{ color: 'var(--text-primary)', fontSize: '0.88rem', lineHeight: '1.5' }}>
              <p style={{ margin: '0 0 0.8rem 0' }}>
                Vas a cambiar el estado de este equipo de <strong>{selectedAsset.estado_actual}</strong> a <strong>PENDIENTE (No Inspeccionado)</strong>.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Motivo o razón del error (Obligatorio) *
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  placeholder="Ej: Se inspeccionó por error / asignación incorrecta de tag / fotos equivocadas"
                  rows={3}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.88rem',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setShowRevertModal(false)} 
                className="btn btn-secondary"
                disabled={revertingAsset}
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
              >
                Cancelar
              </button>
              <button 
                onClick={handleRevertAsset}
                disabled={revertingAsset || !revertReason.trim()}
                className="btn"
                style={{ 
                  padding: '0.6rem 1.2rem', 
                  fontSize: '0.85rem', 
                  backgroundColor: (!revertReason.trim() || revertingAsset) ? 'rgba(245, 158, 11, 0.4)' : '#f59e0b', 
                  color: 'white',
                  fontWeight: 700,
                  cursor: (!revertReason.trim() || revertingAsset) ? 'not-allowed' : 'pointer'
                }}
              >
                {revertingAsset ? 'Procesando...' : 'Confirmar Reversión'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
