import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

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
  const [selectedAsset, setSelectedAsset] = useState(null);

  // Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [editMaterial, setEditMaterial] = useState('');
  const [editFluido, setEditFluido] = useState('');
  const [editPresion, setEditPresion] = useState(0);
  const [editTemperatura, setEditTemperatura] = useState(0);
  const [editEstado, setEditEstado] = useState('Bueno');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDeleteAsset = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/equipos/${selectedAsset.id}`, {
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

  useEffect(() => {
    if (selectedAsset) {
      setEditMaterial(selectedAsset.material || '');
      setEditFluido(selectedAsset.fluido || '');
      setEditPresion(selectedAsset.presion_diseno || 0);
      setEditTemperatura(selectedAsset.temperatura_diseno || 0);
      setEditEstado(selectedAsset.estado_actual || 'BUENO');
      setIsEditing(false);
    }
  }, [selectedAsset]);

  const handleSaveAssetDetails = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/equipos/${selectedAsset.id}`, {
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

  useEffect(() => {
    setLoading(true);
    const urlParams = empresaId ? `?empresa_id=${empresaId}` : '';
    
    fetch(`http://localhost:8000/api/dashboard/history${urlParams}`, {
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

  // Derive unique materials for the filter dropdown
  const uniqueMaterials = Array.from(new Set(assets.map(a => a.material).filter(m => m && m.trim() !== ''))).sort();

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

    return matchesSearch && matchesStatus && matchesMaterial;
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
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '250px' }}>
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
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Diagnóstico Reciente (Gemini):</span>
                <p style={{ 
                  margin: '0.3rem 0 0 0', 
                  fontSize: '0.85rem', 
                  backgroundColor: 'rgba(0,0,0,0.2)', 
                  padding: '0.6rem', 
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {renderVal(selectedAsset.diagnostico) || 'No hay diagnósticos registrados para este activo.'}
                </p>
              </div>

              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.8rem', fontWeight: 600 }}>Recomendación Preventiva:</span>
                <p style={{ 
                  margin: '0.3rem 0 0 0', 
                  fontSize: '0.85rem', 
                  backgroundColor: 'rgba(0,0,0,0.2)', 
                  padding: '0.6rem', 
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}>
                  {renderVal(selectedAsset.recomendaciones) || 'Ninguna recomendación disponible.'}
                </p>
              </div>
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
    </div>
  );
}
