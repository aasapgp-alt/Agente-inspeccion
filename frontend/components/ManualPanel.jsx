import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const API_BASE_URL = 'http://localhost:8000/api';

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

export default function ManualPanel({ equipoId }) {
  const { token } = useAuth();
  const [equipo, setEquipo] = useState(null);
  const [loading, setLoading] = useState(true);

  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  };

  // Form fields (2026)
  const [estado, setEstado] = useState('BUENO');
  const [acciones, setAcciones] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');

  // 2024 History for reference
  const [history2024, setHistory2024] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Drive Browser state
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [items, setItems] = useState({ folders: {}, images: [] });
  const [selectedImages, setSelectedImages] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [autoDetected, setAutoDetected] = useState(null);

  const fetchContents = (folderId) => {
    authFetch(`${API_BASE_URL}/drive/carpetas?parent_id=${folderId}`)
      .then(r => r.json())
      .then(data => {
        setItems(prev => ({ ...prev, folders: data.carpetas }));
      });
    authFetch(`${API_BASE_URL}/drive/imagenes?folder_id=${folderId}`)
      .then(r => r.json())
      .then(data => {
        setItems(prev => ({ ...prev, images: data.imagenes }));
      });
  };

  const navigateToFolder = (id, name) => {
    setCurrentFolderId(id);
    setFolderHistory(prev => [...prev, { id, name }]);
    fetchContents(id);
  };

  const goBack = () => {
    if (folderHistory.length > 1) {
      const newHistory = [...folderHistory];
      newHistory.pop();
      const parent = newHistory[newHistory.length - 1];
      setCurrentFolderId(parent.id);
      setFolderHistory(newHistory);
      fetchContents(parent.id);
    }
  };

  const toggleImage = (id) => {
    setSelectedImages(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Estados de generación de reporte
  const [generandoReporte, setGenerandoReporte] = useState(false);
  const [reporteStatus, setReporteStatus] = useState(null); // null, 'generating', 'completed', 'error'
  const [reporteUrl, setReporteUrl] = useState('');
  const [reporteDriveLink, setReporteDriveLink] = useState('');

  useEffect(() => {
    if (!equipoId) return;
    setLoading(true);

    // Resetear estados del reporte al cambiar de equipo
    setReporteStatus(null);
    setGenerandoReporte(false);
    setReporteUrl('');
    setReporteDriveLink('');

    // 1. Fetch equipo details & Drive root
    const initializeFolder = async () => {
      try {
        const eqRes = await authFetch(`${API_BASE_URL}/equipos/${equipoId}`);
        const eqData = await eqRes.json();
        setEquipo(eqData);

        let currentRootId = rootFolderId;
        if (!currentRootId) {
          const rootRes = await authFetch(`${API_BASE_URL}/drive/root`);
          const rootData = await rootRes.json();
          currentRootId = rootData.root_id;
          setRootFolderId(currentRootId);
        }

        const sugRes = await authFetch(`${API_BASE_URL}/drive/sugerir_carpetas?equipo_id=${equipoId}`);
        const sugData = await sugRes.json();

        setSelectedImages([]);

        if (sugData.sugerencias && sugData.sugerencias.length > 0) {
          setSugerencias(sugData.sugerencias);
          const best = sugData.sugerencias[0];
          if (best.score >= 100) {
            setCurrentFolderId(best.id);
            setFolderHistory([{ id: currentRootId || 'root', name: 'Root' }, { id: best.id, name: best.name }]);
            fetchContents(best.id);
            setAutoDetected(best);
            return;
          }
        }

        setSugerencias(sugData.sugerencias || []);
        setAutoDetected(null);
        if (currentRootId) {
          setCurrentFolderId(currentRootId);
          setFolderHistory([{ id: currentRootId, name: 'Root' }]);
          fetchContents(currentRootId);
        }
      } catch (err) {
        console.error("Error initializing folder for equipo:", err);
      }
    };
    initializeFolder();

    // 2. Fetch current 2026 inspection data if it exists
    authFetch(`${API_BASE_URL}/equipos/${equipoId}/inspeccion/2026`)
      .then(r => r.json())
      .then(data => {
        setEstado(renderVal(data.estado) || 'BUENO');
        setAcciones(renderVal(data.acciones) || '');
        setDiagnostico(renderVal(data.diagnostico) || '');
        setRecomendaciones(renderVal(data.recomendaciones) || '');
      })
      .catch(err => console.error("Error fetching 2026 inspection:", err));

    // 3. Fetch 2024 inspection data for reference
    authFetch(`${API_BASE_URL}/equipos/${equipoId}/inspeccion/2024`)
      .then(r => r.json())
      .then(data => {
        setHistory2024(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching 2024 history:", err);
        setLoading(false);
      });
  }, [equipoId]);

    const [saveStatus, setSaveStatus] = useState(null);

  const handleGuardar = async (generarPdf = false) => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch(`${API_BASE_URL}/ia/guardar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: parseInt(equipoId),
          estado: estado,
          acciones: acciones,
          diagnostico: diagnostico,
          recomendaciones: recomendaciones,
          image_drive_ids: selectedImages,
          generar_pdf: generarPdf
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        setSaveStatus({ type: 'error', text: "Error al guardar: " + (errData.detail || JSON.stringify(errData)) });
        setIsSaving(false);
        return;
      }

      const data = await res.json();
      if (generarPdf) {
        setSaveStatus({ type: 'success', text: `Guardado y PDF generado: ${data.pdf_status}` });
      } else {
        setSaveStatus({ type: 'success', text: "¡Guardado exitoso en base de datos!" });
        // Desaparecer mensaje después de 3 segundos
        setTimeout(() => setSaveStatus(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setSaveStatus({ type: 'error', text: "Error de conexión al guardar." });
    }
    setIsSaving(false);
  };

  const handleGenerarReporte = async () => {
    setGenerandoReporte(true);
    setReporteStatus('generating');
    try {
      // 1. Guardar primero en BD para asegurar que el PDF tenga los últimos datos ingresados en pantalla
      const saveRes = await fetch(`${API_BASE_URL}/ia/guardar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: parseInt(equipoId),
          estado: estado,
          acciones: acciones,
          diagnostico: diagnostico,
          recomendaciones: recomendaciones,
          image_drive_ids: selectedImages,
          generar_pdf: false
        })
      });

      if (!saveRes.ok) {
        const errData = await saveRes.json();
        alert("Error al guardar antes de generar: " + (errData.detail || JSON.stringify(errData)));
        setReporteStatus('error');
        setGenerandoReporte(false);
        return;
      }

      // 2. Generar el reporte llamando a la nueva API
      const res = await fetch(`${API_BASE_URL}/reportes/generar/${equipoId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        const errData = await res.json();
        alert("Error al generar reporte: " + (errData.detail || JSON.stringify(errData)));
        setReporteStatus('error');
        setGenerandoReporte(false);
        return;
      }
      
      const data = await res.json();
      setReporteStatus('completed');
      setReporteUrl(`${API_BASE_URL}/reportes/${data.reporte_id}/download`);
      setReporteDriveLink(data.drive_link);
    } catch (e) {
      console.error(e);
      setReporteStatus('error');
      alert("Error de conexión al generar reporte.");
    }
    setGenerandoReporte(false);
  };

  if (!equipoId) return <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><h3>Selecciona un equipo</h3></div>;
  if (loading) return <div className="glass-panel">Cargando datos del equipo...</div>;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
      
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{equipo?.nombre}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{equipo?.area} - Número/Código: {equipo?.numero}</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          {equipo?.material && <span><strong>Material:</strong> {equipo.material}</span>}
          {equipo?.fluido && <span><strong>Fluido:</strong> {equipo.fluido}</span>}
          {equipo?.presion_diseno && <span><strong>Presión:</strong> {equipo.presion_diseno}</span>}
          {equipo?.temperatura_diseno && <span><strong>Temp:</strong> {equipo.temperatura_diseno}</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1 }}>
        
        {/* Left Side: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h4>Registro de Inspección 2026</h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              ESTADO S/PGP 2026:
            </label>
            <select 
              value={estado} 
              onChange={e => setEstado(e.target.value)}
              style={{
                width: '100%',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: '#000000',
                color: 'white',
                outline: 'none',
                colorScheme: 'dark'
              }}
            >
              <option value="BUENO">BUENO</option>
              <option value="REGULAR">REGULAR</option>
              <option value="CRITICO">CRITICO</option>
              <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Acciones PGP 2026:
            </label>
            <textarea
              value={acciones}
              onChange={e => setAcciones(e.target.value)}
              placeholder="Describa las acciones preventivas o correctivas ejecutadas..."
              style={{
                width: '100%',
                height: '100px',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              DIAGNOSTICO 2026:
            </label>
            <textarea
              value={diagnostico}
              onChange={e => setDiagnostico(e.target.value)}
              placeholder="Escriba el diagnóstico del estado actual del activo..."
              style={{
                width: '100%',
                height: '100px',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              RECOMENDACIONES PGP 2027:
            </label>
            <textarea
              value={recomendaciones}
              onChange={e => setRecomendaciones(e.target.value)}
              placeholder="Recomendaciones sugeridas para el próximo régimen de inspección..."
              style={{
                width: '100%',
                height: '100px',
                padding: '0.6rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(0,0,0,0.2)',
                color: 'white',
                fontSize: '0.85rem',
                resize: 'none',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleGuardar(false)} 
              disabled={isSaving || generandoReporte} 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
            >
              {isSaving ? 'Guardando en BD...' : 'Guardar en BD'}
            </button>
            {(equipoId && (acciones.trim() !== '' || diagnostico.trim() !== '' || recomendaciones.trim() !== '')) && (
              <button 
                onClick={handleGenerarReporte} 
                disabled={isSaving || generandoReporte} 
                className="btn btn-primary" 
                style={{ flex: 1 }}
              >
                {generandoReporte ? 'Generando...' : 'Generar Reporte'}
              </button>
            )}
          </div>

          {saveStatus && (
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.6rem', 
              borderRadius: '6px', 
              backgroundColor: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              border: saveStatus.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: saveStatus.type === 'success' ? '#4ade80' : '#f87171',
              fontSize: '0.85rem',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              {saveStatus.text}
            </div>
          )}

          {reporteStatus === 'generating' && (
            <div style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Generando reporte... por favor espere.
            </div>
          )}
          
          {reporteStatus === 'completed' && (
            <div style={{ 
              marginTop: '0.5rem', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              padding: '0.8rem', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              border: '1px solid rgba(34, 197, 94, 0.2)' 
            }}>
              <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 600 }}>¡Reporte generado con éxito!</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a 
                  href={reporteUrl} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="btn btn-secondary" 
                  style={{ 
                    padding: '0.4rem 0.8rem', 
                    fontSize: '0.8rem', 
                    textDecoration: 'none', 
                    display: 'inline-block', 
                    textAlign: 'center',
                    flex: 1
                  }}
                >
                  Descargar PDF
                </a>
                {reporteDriveLink && !reporteDriveLink.includes('mock-link') && (
                  <a 
                    href={reporteDriveLink} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-primary" 
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.8rem', 
                      textDecoration: 'none', 
                      display: 'inline-block', 
                      textAlign: 'center',
                      flex: 1
                    }}
                  >
                    Ver en Drive
                  </a>
                )}
              </div>
            </div>
          )}
          
          {reporteStatus === 'error' && (
            <div style={{ marginTop: '0.5rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600 }}>
              Error al generar el reporte. Verifique la inspección e intente nuevamente.
            </div>
          )}
        </div>

        {/* Right Side */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* History 2024 Reference */}
          <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h4 style={{ margin: '0 0 1rem 0' }}>Historial de Referencia (2024)</h4>
            
            {history2024 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ESTADO 2024:</span>
                  <div style={{ fontWeight: 600, color: history2024.estado === 'CRITICO' ? '#ef4444' : history2024.estado === 'REGULAR' ? '#f59e0b' : '#10b981' }}>
                    {renderVal(history2024.estado) || 'N/A'}
                  </div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ACCIONES 2024:</span>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {renderVal(history2024.acciones) || 'Sin acciones registradas.'}
                  </div>
                </div>
                
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DIAGNÓSTICO 2024:</span>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {renderVal(history2024.diagnostico) || 'Sin diagnóstico previo.'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>RECOMENDACIONES 2024:</span>
                  <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {renderVal(history2024.recomendaciones) || 'Sin recomendaciones previas.'}
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>No se encontraron registros de inspección del 2024 para este equipo.</p>
            )}
          </div>

          {/* Drive Browser for Manual Image Selection */}
          <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', overflowY: 'auto', maxHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0 }}>Seleccionar Fotos (Opcional)</h4>
              {folderHistory.length > 1 && <button onClick={goBack} className="btn" style={{ padding: '0.2rem 0.5rem' }}>⬅ Atrás</button>}
            </div>

            {sugerencias.length > 0 && folderHistory.length <= 1 && (
              <div style={{ marginBottom: '1rem', padding: '0.8rem', backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '6px' }}>
                <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                  🔍 Carpetas sugeridas:
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {sugerencias.map((sug) => (
                    <div 
                      key={sug.id} 
                      onClick={() => {
                        setCurrentFolderId(sug.id);
                        setFolderHistory([{ id: 'root', name: 'Root' }, { id: sug.id, name: sug.name }]);
                        fetchContents(sug.id);
                        setAutoDetected(sug);
                      }}
                      style={{ 
                        fontSize: '0.8rem', cursor: 'pointer', padding: '0.3rem 0.5rem', borderRadius: '4px',
                        backgroundColor: autoDetected?.id === sug.id ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: autoDetected?.id === sug.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        color: 'white'
                      }}
                    >
                      <span>📁 {sug.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                        {autoDetected?.id === sug.id ? 'Seleccionada' : 'Alta'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Folders List */}
              {items.folders && Object.keys(items.folders).length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem', margin: 0 }}>
                  {Object.entries(items.folders).map(([name, id]) => (
                    <li 
                      key={id} onClick={() => navigateToFolder(id, name)} 
                      style={{ padding: '0.6rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '1rem', borderRadius: '6px', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '1.2rem' }}>📁</span>
                      <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{name}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Images Grid */}
              {items.images && items.images.length > 0 && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                  gap: '1rem',
                  paddingTop: '0.5rem'
                }}>
                  {items.images.map((img) => {
                    const isSelected = selectedImages.includes(img.id);
                    return (
                      <div 
                        key={img.id} 
                        style={{ 
                          position: 'relative',
                          borderRadius: '8px', 
                          cursor: 'pointer',
                          overflow: 'hidden',
                          border: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
                          boxShadow: isSelected ? '0 0 0 2px rgba(14, 165, 233, 0.3)' : '0 2px 5px rgba(0,0,0,0.2)',
                          backgroundColor: 'rgba(255,255,255,0.02)',
                          transition: 'all 0.2s',
                          aspectRatio: '1 / 1'
                        }}
                        onClick={() => toggleImage(img.id)}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={(e) => { e.stopPropagation(); toggleImage(img.id); }} 
                          style={{ 
                            position: 'absolute', 
                            top: '8px', 
                            left: '8px', 
                            width: '18px', 
                            height: '18px', 
                            cursor: 'pointer',
                            zIndex: 2,
                            boxShadow: '0 0 5px rgba(0,0,0,0.5)'
                          }} 
                        />
                        <img 
                          src={`http://localhost:8000/api/drive/imagen/${img.id}?token=${token}`} 
                          alt={img.name} 
                          loading="lazy"
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            transition: 'transform 0.3s',
                            transform: isSelected ? 'scale(1.05)' : 'scale(1)'
                          }} 
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)'}
                        />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', zIndex: -1 }}>
                          🖼️
                        </div>
                        <div style={{ 
                          position: 'absolute', 
                          bottom: 0, 
                          left: 0, 
                          right: 0, 
                          background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', 
                          padding: '20px 8px 8px 8px',
                          pointerEvents: 'none'
                        }}>
                          <span style={{ 
                            display: 'block',
                            fontSize: '0.7rem', 
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            color: 'white',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                          }}>
                            {img.name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
