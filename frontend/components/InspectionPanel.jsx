import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { apiService } from '../services/api';
import VersionHistoryModal from './VersionHistoryModal';
import AnnotationModal from './AnnotationModal';

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

export default function InspectionPanel({ equipoId }) {
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

  // Drive Browser state
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderHistory, setFolderHistory] = useState([]);
  const [items, setItems] = useState({ folders: {}, images: [] });
  const [selectedImages, setSelectedImages] = useState([]);
  const [rootFolderId, setRootFolderId] = useState(null);

  // IA State
  const [analisis, setAnalisis] = useState(null);
  const [historial2024, setHistorial2024] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [chatMessage, setChatMessage] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // States for IA proposed values editable by user
  const [editedEstado, setEditedEstado] = useState("");
  const [editedDiagnostico, setEditedDiagnostico] = useState("");
  const [editedAcciones, setEditedAcciones] = useState("");
  const [editedRecomendaciones, setEditedRecomendaciones] = useState("");

  // Report States
  const [inspeccionId, setInspeccionId] = useState(null);
  const [reportState, setReportState] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [annotatingImage, setAnnotatingImage] = useState(null);
  const [annotationsRefreshKey, setAnnotationsRefreshKey] = useState(0);

  useEffect(() => {
    if (analisis) {
      setEditedEstado(analisis.estado || "");
      setEditedDiagnostico(renderVal(analisis.diagnostico));
      setEditedAcciones(renderVal(analisis.acciones));
      setEditedRecomendaciones(renderVal(analisis.recomendaciones));
    } else {
      setEditedEstado("");
      setEditedDiagnostico("");
      setEditedAcciones("");
      setEditedRecomendaciones("");
    }
  }, [analisis]);

  // Folder Suggestion States
  const [sugerencias, setSugerencias] = useState([]);
  const [autoDetected, setAutoDetected] = useState(null);
  const [indicacionesPrevias, setIndicacionesPrevias] = useState("");

  // Polling for report generation status
  useEffect(() => {
    let interval;
    if (reportState?.estado_generacion === 'generando' && inspeccionId) {
      interval = setInterval(async () => {
        const data = await apiService.getEstadoReporte(inspeccionId, token);
        if (data) {
          setReportState(data);
          if (data.estado_generacion !== 'generando') {
            clearInterval(interval);
          }
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [reportState?.estado_generacion, inspeccionId, token]);

  const fetchContents = (folderId) => {
    authFetch(`${API_BASE_URL}/drive/carpetas?parent_id=${folderId}`)
      .then(r => r.json())
      .then(data => {
        setItems(prev => ({ ...prev, folders: data.carpetas }));
      });
    // Get Images
    authFetch(`${API_BASE_URL}/drive/imagenes?folder_id=${folderId}`)
      .then(r => r.json())
      .then(data => {
        setItems(prev => ({ ...prev, images: data.imagenes }));
      });
  };

  useEffect(() => {
    if (!equipoId) return;

    const initializeFolder = async () => {
      setLoading(true);
      try {
        // 1. Fetch equipo
        const eqRes = await authFetch(`${API_BASE_URL}/equipos`);
        const eqData = await eqRes.json();
        const eq = eqData.equipos.find(e => e.id.toString() === equipoId.toString());
        setEquipo(eq);
        setLoading(false);

        // 2. Fetch root ID if not loaded
        let currentRootId = rootFolderId;
        if (!currentRootId) {
          const rootRes = await authFetch(`${API_BASE_URL}/drive/root`);
          const rootData = await rootRes.json();
          currentRootId = rootData.root_id;
          setRootFolderId(currentRootId);
        }

        // 3. Fetch suggestions
        const sugRes = await authFetch(`${API_BASE_URL}/drive/sugerir_carpetas?equipo_id=${equipoId}`);
        const sugData = await sugRes.json();

        setSelectedImages([]);
        setAnalisis(null);
        setIndicacionesPrevias("");

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
  }, [equipoId]);

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

  const handleAnalizar = async () => {
    if (selectedImages.length === 0) return alert("Selecciona imágenes primero");
    setIsAnalyzing(true);

    // Obtener anotaciones locales de las imágenes seleccionadas para enviar a la IA
    const annotationsMap = {};
    selectedImages.forEach(imgId => {
      const saved = localStorage.getItem(`annotations_${imgId}`);
      if (saved) {
        try {
          annotationsMap[imgId] = JSON.parse(saved);
        } catch (e) {
          console.error("Error al parsear anotaciones para", imgId, e);
        }
      }
    });

    try {
      const res = await authFetch(`${API_BASE_URL}/ia/analizar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          equipo_id: equipoId, 
          image_drive_ids: selectedImages,
          indicaciones_previas: indicacionesPrevias,
          anotaciones: annotationsMap
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error del servidor: " + (data.detail || JSON.stringify(data)));
        setIsAnalyzing(false);
        return;
      }
      setSessionId(data.session_id);
      setAnalisis(data.analisis);
      setHistorial2024(data.historial_2024);
    } catch (e) {
      console.error(e);
      alert("Error al analizar");
    }
    setIsAnalyzing(false);
  };

  const handleChat = async () => {
    if (!chatMessage.trim()) return;
    setIsAnalyzing(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/ia/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session_id: sessionId, mensaje: chatMessage })
      });
      const data = await res.json();
      setAnalisis(data.analisis);
      setChatMessage("");
    } catch (e) {
      console.error(e);
    }
    setIsAnalyzing(false);
  };

  const handleGuardar = async (generarPdf = true) => {
    if (!analisis) return;
    setIsSaving(true);

    // Obtener anotaciones locales de las imágenes seleccionadas para guardar en backend
    const annotationsMap = {};
    selectedImages.forEach(imgId => {
      const saved = localStorage.getItem(`annotations_${imgId}`);
      if (saved) {
        try {
          annotationsMap[imgId] = JSON.parse(saved);
        } catch (e) {
          console.error("Error al parsear anotaciones para", imgId, e);
        }
      }
    });
    
    // Compare original with edited values to see if there are any changes
    const changes = [];
    const origEstado = analisis.estado || "";
    const origDiagnostico = renderVal(analisis.diagnostico);
    const origAcciones = renderVal(analisis.acciones);
    const origRecomendaciones = renderVal(analisis.recomendaciones);

    if (origEstado !== editedEstado) {
      changes.push(`Estado: ${origEstado} -> ${editedEstado}`);
    }
    if (origDiagnostico !== editedDiagnostico) {
      changes.push(`Diagnóstico modificado`);
    }
    if (origAcciones !== editedAcciones) {
      changes.push(`Acciones modificadas`);
    }
    if (origRecomendaciones !== editedRecomendaciones) {
      changes.push(`Recomendaciones modificadas`);
    }

    let leccionAprendida = "";
    if (changes.length > 0) {
      leccionAprendida = `Equipo ${equipo?.nombre || 'equipo'}: ` + changes.join(', ');
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/ia/guardar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoId,
          session_id: sessionId,
          estado: editedEstado,
          acciones: editedAcciones,
          diagnostico: editedDiagnostico,
          recomendaciones: editedRecomendaciones,
          leccion_aprendida: leccionAprendida || null,
          image_drive_ids: selectedImages,
          generar_pdf: generarPdf,
          anotaciones: annotationsMap
        })
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Error del servidor al guardar: " + (data.detail || JSON.stringify(data)));
        setIsSaving(false);
        return;
      }

      if (data.inspeccion_id) {
        setInspeccionId(data.inspeccion_id);
      }

      if (generarPdf) {
        alert(`Guardado y PDF generado: ${data.pdf_status}`);
        if (data.inspeccion_id) {
           apiService.getEstadoReporte(data.inspeccion_id, token).then(setReportState);
        }
      } else {
        let msg = "Guardado exitoso en base de datos.";
        if (leccionAprendida) {
          msg += "\n\nSe ha registrado el aprendizaje en Drive.";
        }
        alert(msg);
        if (data.inspeccion_id) {
           apiService.getEstadoReporte(data.inspeccion_id, token).then(setReportState);
        }
      }
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    }
    setIsSaving(false);
  };

  const handleGenerarManual = async () => {
    if (!inspeccionId) return;
    try {
      await apiService.generarReporteManual(inspeccionId, token);
      setReportState({ ...reportState, estado_generacion: 'generando' });
      // Trigger actual generation via save
      handleGuardar(true); 
    } catch (err) {
      console.error(err);
      alert("Error al iniciar la generación: " + err.message);
    }
  };

  if (!equipoId) return <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><h3>Selecciona un equipo</h3></div>;
  if (loading) return <div className="glass-panel">Cargando datos del equipo...</div>;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>{equipo?.nombre || equipo?.equipo}</h2>
        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{equipo?.area} - Número: {equipo?.numero}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
        
        {/* Drive Browser */}
        <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', overflowY: 'auto', maxHeight: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ margin: 0 }}>Explorador de Drive</h4>
              {/* Contador de imágenes anotadas en el panel */}
              {(() => {
                let annotatedCount = 0;
                if (items.images) {
                  items.images.forEach(img => {
                    const saved = typeof window !== 'undefined' ? localStorage.getItem(`annotations_${img.id}`) : null;
                    if (saved) {
                      try {
                        const count = JSON.parse(saved).length;
                        if (count > 0) annotatedCount++;
                      } catch (e) {}
                    }
                  });
                }
                if (annotatedCount > 0) {
                  return (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      📝 {annotatedCount} {annotatedCount === 1 ? 'imagen anotada' : 'imágenes anotadas'}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            {folderHistory.length > 1 && <button onClick={goBack} className="btn" style={{ padding: '0.2rem 0.5rem' }}>⬅ Atrás</button>}
          </div>

          {sugerencias.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '0.8rem', backgroundColor: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '6px' }}>
              <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                🔍 Carpetas sugeridas para este equipo:
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
                      fontSize: '0.8rem', 
                      cursor: 'pointer', 
                      padding: '0.3rem 0.5rem', 
                      borderRadius: '4px',
                      backgroundColor: autoDetected?.id === sug.id ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: autoDetected?.id === sug.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.2s',
                      color: 'white'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = autoDetected?.id === sug.id ? 'rgba(14, 165, 233, 0.2)' : 'rgba(255,255,255,0.03)'}
                  >
                    <span>📁 {sug.name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {autoDetected?.id === sug.id ? 'Seleccionada' : 'Relevancia: Alta'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {items.folders && Object.entries(items.folders).map(([name, id]) => (
              <li 
                key={id} 
                onClick={() => navigateToFolder(id, name)} 
                style={{ 
                  padding: '0.8rem', 
                  cursor: 'pointer', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  borderRadius: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '1.4rem' }}>📁</span>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{name}</span>
              </li>
            ))}
            {items.images && items.images.map((img) => (
              <li 
                key={img.id} 
                style={{ 
                  padding: '0.8rem', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  transition: 'background 0.2s',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
                onClick={() => toggleImage(img.id)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <input 
                  type="checkbox" 
                  checked={selectedImages.includes(img.id)} 
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleImage(img.id);
                  }} 
                  style={{ width: 'auto', cursor: 'pointer' }}
                />
                <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)', backgroundColor: 'rgba(0,0,0,0.2)', flexShrink: 0 }}>
                  <img 
                    src={`http://localhost:8000/api/drive/imagen/${img.id}?token=${token}`} 
                    alt={img.name}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', zIndex: -1 }}>
                    🖼️
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.9rem', color: selectedImages.includes(img.id) ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                      {img.name}
                    </span>
                    {/* Badge de anotaciones */}
                    {(() => {
                      const saved = typeof window !== 'undefined' ? localStorage.getItem(`annotations_${img.id}`) : null;
                      if (saved) {
                        try {
                          const count = JSON.parse(saved).length;
                          if (count > 0) {
                            return (
                              <span style={{
                                fontSize: '0.7rem',
                                color: 'var(--accent-primary)',
                                backgroundColor: 'rgba(0, 200, 215, 0.1)',
                                border: '1px solid var(--accent-primary)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }} title={`${count} anotación(es)`}>
                                📝 {count}
                              </span>
                            );
                          }
                        } catch (e) {}
                      }
                      return null;
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginTop: '0.2rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(img.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAnnotatingImage(img);
                      }}
                      className="btn"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(btn) => {
                        btn.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                        btn.currentTarget.style.borderColor = 'var(--accent-primary)';
                      }}
                      onMouseLeave={(btn) => {
                        btn.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                        btn.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      }}
                    >
                      ✏️ Anotar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* IA Panel */}
        <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', overflowY: 'auto', maxHeight: '600px', display: 'flex', flexDirection: 'column' }}>
          <h4>Análisis con Gemini</h4>
          
          {!analisis ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'center' }}>
              <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                Selecciona imágenes del Drive y presiona el botón.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Indicaciones previas para la IA (Opcional):
                </label>
                <textarea
                  value={indicacionesPrevias}
                  onChange={(e) => setIndicacionesPrevias(e.target.value)}
                  placeholder="Ej: Prestar atención a fisuras en el soporte o desgaste en pernos..."
                  style={{
                    width: '100%',
                    height: '80px',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    fontSize: '0.85rem',
                    resize: 'none',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                />
              </div>

              {isAnalyzing ? (
                <div className="loading-container">
                  <div className="spinner"></div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'white', fontWeight: 500, margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                      Generando análisis con IA...
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: 0 }}>
                      Evaluando imágenes y consolidando recomendaciones para PGP 2027
                    </p>
                  </div>
                  <div className="loading-bar-wrapper">
                    <div className="loading-bar-progress"></div>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleAnalizar} 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '0.5rem' }}
                >
                  Iniciar Análisis IA
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {historial2024 && (
                <div style={{ padding: '0.8rem', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '6px' }}>
                  <h5 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)' }}>Historial 2024</h5>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Estado:</strong> {renderVal(historial2024.estado)}</p>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem' }}><strong>Diagnóstico:</strong> {renderVal(historial2024.diagnostico)}</p>
                </div>
              )}

              <div style={{ padding: '0.8rem', backgroundColor: 'rgba(0, 200, 215, 0.05)', border: '1px solid var(--accent-primary)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <h5 style={{ margin: 0, color: 'var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Propuesta Gemini (2026)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Editable antes de guardar</span>
                </h5>
                
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Estado Recomendado:</label>
                  <select
                    value={editedEstado}
                    onChange={(e) => setEditedEstado(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none',
                      marginTop: '0.2rem',
                      fontFamily: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="BUENO">BUENO</option>
                    <option value="REGULAR">REGULAR</option>
                    <option value="CRITICO">CRITICO</option>
                    <option value="FUERA DE RUTA">FUERA DE RUTA</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Diagnóstico:</label>
                  <textarea
                    value={editedDiagnostico}
                    onChange={(e) => setEditedDiagnostico(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none',
                      marginTop: '0.2rem',
                      fontFamily: 'inherit',
                      minHeight: '80px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Acciones:</label>
                  <textarea
                    value={editedAcciones}
                    onChange={(e) => setEditedAcciones(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none',
                      marginTop: '0.2rem',
                      fontFamily: 'inherit',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Recomendaciones (2027):</label>
                  <textarea
                    value={editedRecomendaciones}
                    onChange={(e) => setEditedRecomendaciones(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      color: 'white',
                      fontSize: '0.85rem',
                      outline: 'none',
                      marginTop: '0.2rem',
                      fontFamily: 'inherit',
                      minHeight: '60px',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  value={chatMessage} 
                  onChange={e => setChatMessage(e.target.value)} 
                  placeholder="Corrige a la IA (ej. 'El estado es REGULAR')" 
                  style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)', backgroundColor: 'transparent', color: 'white' }}
                />
                <button onClick={handleChat} disabled={isAnalyzing} className="btn btn-secondary">
                  {isAnalyzing ? 'Enviando...' : 'Enviar'}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button onClick={() => handleGuardar(false)} disabled={isSaving} className="btn btn-secondary" style={{ flex: 1 }}>
                  {isSaving ? 'Guardando en BD...' : 'Guardar en BD'}
                </button>
                <button onClick={() => handleGuardar(true)} disabled={isSaving} className="btn btn-primary" style={{ flex: 1 }}>
                  {isSaving ? 'Generando PDF...' : 'Guardar PDF'}
                </button>
              </div>

              {/* Seccion Acciones de Reporte */}
              {inspeccionId && reportState && (
                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h5 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                    Acciones de Reporte
                  </h5>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Estado:</span>
                        {reportState.estado_generacion === 'pendiente' && <span style={{ color: '#facc15', fontSize: '0.9rem' }}>⏳ Pendiente</span>}
                        {reportState.estado_generacion === 'generando' && <span style={{ color: '#38bdf8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div className="spinner" style={{width: '14px', height: '14px', borderTopColor: '#38bdf8'}}></div> Generando...</span>}
                        {reportState.estado_generacion === 'completado' && <span style={{ color: '#10b981', fontSize: '0.9rem' }}>✅ Completado</span>}
                        {reportState.estado_generacion === 'error' && <span style={{ color: '#ef4444', fontSize: '0.9rem' }}>❌ Error</span>}
                      </div>

                      {reportState.estado_generacion === 'pendiente' && (
                        <button onClick={handleGenerarManual} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}>
                          Generar Reporte
                        </button>
                      )}
                      
                      {reportState.estado_generacion === 'error' && (
                        <button onClick={handleGenerarManual} className="btn btn-primary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.8rem', backgroundColor: '#ef4444', borderColor: '#ef4444' }}>
                          Reintentar
                        </button>
                      )}
                    </div>

                    {reportState.estado_generacion === 'error' && reportState.error_generacion && (
                      <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', fontSize: '0.8rem', color: '#fca5a5' }}>
                        <strong>Detalle del error:</strong> {reportState.error_generacion}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {reportState.estado_generacion === 'completado' && (
                        <>
                          <button onClick={() => alert('Para descargar, abre el archivo en Drive usando el botón contiguo y utiliza la opción de descarga de Google Drive.')} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}>
                            Descargar PDF
                          </button>
                          {reportState.drive_file_id && (
                            <a href={`https://drive.google.com/file/d/${reportState.drive_file_id}/view`} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', textAlign: 'center', textDecoration: 'none' }}>
                              Ver en Drive
                            </a>
                          )}
                        </>
                      )}
                      <button onClick={() => setShowHistoryModal(true)} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}>
                        Ver versiones
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {showHistoryModal && inspeccionId && (
        <VersionHistoryModal 
          inspeccionId={inspeccionId} 
          onClose={() => setShowHistoryModal(false)} 
        />
      )}

      {annotatingImage && (
        <AnnotationModal
          image={annotatingImage}
          token={token}
          equipoId={equipoId}
          onClose={() => setAnnotatingImage(null)}
          onSave={() => setAnnotationsRefreshKey(prev => prev + 1)}
        />
      )}
    </div>
  );
}
