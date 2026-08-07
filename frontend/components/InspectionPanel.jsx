import { useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { apiService } from '../services/api';
import VersionHistoryModal from './VersionHistoryModal';
import AnnotationModal from './AnnotationModal';
import VoiceDictationButton from './VoiceDictationButton';
import { guardarInspeccionOffline } from '../utils/offlineStore';

const API_BASE_URL = 'http://localhost:8000/api';
const DRIVE_FALLBACK_FOLDER_ID = '19OdKrn1SLDLSuMj8e73q-8tovcw-CJA_';

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
  const [maximizedPanel, setMaximizedPanel] = useState(null); // 'drive', 'ia', or null

  const cameraInputRef = useRef(null);

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64Data = evt.target.result;
      // Generar ID único temporal para la foto capturada con cámara
      const tempId = `cam_${Date.now()}`;
      setItems(prev => ({
        ...prev,
        images: [{ id: tempId, name: `Cam_${new Date().toLocaleTimeString()}.jpg`, size: file.size, data: base64Data }, ...prev.images]
      }));
      setSelectedImages(prev => [...prev, tempId]);
      alert('📸 Foto tomada con cámara y añadida a la selección.');
    };
    reader.readAsDataURL(file);
  };

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
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const indicacionesRef = useRef(null);
  const diagnosticoRef = useRef(null);
  const accionesRef = useRef(null);
  const recomendacionesRef = useRef(null);

  const adjustTextarea = (el, minH = 70) => {
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.max(el.scrollHeight + 6, minH)}px`;
    }
  };

  useEffect(() => {
    adjustTextarea(indicacionesRef.current, 80);
  }, [indicacionesPrevias]);

  useEffect(() => {
    adjustTextarea(diagnosticoRef.current, 90);
  }, [editedDiagnostico]);

  useEffect(() => {
    adjustTextarea(accionesRef.current, 80);
  }, [editedAcciones]);

  useEffect(() => {
    adjustTextarea(recomendacionesRef.current, 100);
  }, [editedRecomendaciones]);

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
        setHistorial2024(null);
        setIndicacionesPrevias("");

        // Fetch PGP 2024 history for display in the panel
        try {
          const histRes = await authFetch(`${API_BASE_URL}/equipos/${equipoId}/inspeccion/2024`);
          if (histRes.ok) {
            const histData = await histRes.json();
            setHistorial2024(histData);
          }
        } catch (histErr) {
          console.error("Error fetching PGP 2024 history:", histErr);
        }

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
        
        // Fallback to the PGP directory folder if no highly relevant suggestion is found
        const fallbackId = DRIVE_FALLBACK_FOLDER_ID;
        setCurrentFolderId(fallbackId);
        setFolderHistory([{ id: fallbackId, name: 'Inicio PGP' }]);
        fetchContents(fallbackId);
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

  const handleCrearCarpetaEquipo = async () => {
    if (!equipo) return;
    const parentFolder = folderHistory[folderHistory.length - 1];
    const parentId = parentFolder ? parentFolder.id : 'root';
    const folderName = equipo.nombre || equipo.equipo;
    
    setIsCreatingFolder(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/drive/crear_carpeta`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          nombre: folderName,
          parent_id: parentId
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Carpeta '${folderName}' creada exitosamente.`);
        
        // Auto-select and navigate to the newly created folder
        const newFolderObj = { id: data.id, name: data.title };
        setCurrentFolderId(data.id);
        setFolderHistory([...folderHistory, newFolderObj]);
        fetchContents(data.id);
        setAutoDetected(newFolderObj);
        
        // Update suggestions list
        setSugerencias([{ id: data.id, name: data.title, score: 100 }]);
      } else {
        const errData = await res.json();
        alert('Error al crear carpeta: ' + (errData.detail || 'Desconocido'));
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      alert('Error de red al crear carpeta');
    } finally {
      setIsCreatingFolder(false);
    }
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

    const payload = {
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
    };

    if (typeof window !== 'undefined' && !navigator.onLine) {
      try {
        await guardarInspeccionOffline({ equipoId, payload });
        alert('⚡ Modo Offline: Inspección guardada localmente en tu teléfono. Se sincronizará automáticamente cuando recuperes la conexión.');
      } catch (err) {
        alert('Error guardando inspección offline: ' + err.message);
      }
      setIsSaving(false);
      return;
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/ia/guardar`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
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
      // Fallback offline si falla la conexión de red
      try {
        await guardarInspeccionOffline({ equipoId, payload });
        alert('⚡ Red inestable: La inspección se ha guardado localmente en tu celular. Podrás sincronizarla cuando vuelva la señal.');
      } catch (offlineErr) {
        alert("Error de red y no se pudo guardar localmente");
      }
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

      <div style={{
        display: 'grid',
        gridTemplateColumns: maximizedPanel ? '1fr' : '1fr 1fr',
        gap: '1rem',
        flex: 1
      }}>
        
        {/* Drive Browser */}
        {maximizedPanel !== 'ia' && (
          <div style={{
            backgroundColor: 'var(--bg-color)',
            padding: '1rem',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: maximizedPanel === 'drive' ? '850px' : '600px',
            height: maximizedPanel === 'drive' ? '800px' : 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleCameraCapture} />
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Tomar foto con la cámara del celular"
                >
                  📷 Cámara
                </button>
                {folderHistory.length > 1 && <button onClick={goBack} className="btn" style={{ padding: '0.2rem 0.5rem' }}>⬅ Atrás</button>}
                <button
                  type="button"
                  onClick={() => setMaximizedPanel(maximizedPanel === 'drive' ? null : 'drive')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '4px',
                    transition: 'color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--accent-primary)';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  title={maximizedPanel === 'drive' ? 'Minimizar' : 'Maximizar'}
                >
                  {maximizedPanel === 'drive' ? '🗗' : '🗖'}
                </button>
              </div>
            </div>

            {/* Scrollable content container */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>

              {/* Breadcrumbs for Drive Browser */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            marginBottom: '0.75rem',
            backgroundColor: 'rgba(255,255,255,0.02)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {folderHistory.map((folder, idx) => (
              <span key={folder.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {idx > 0 && <span>&gt;</span>}
                <span style={{
                  color: idx === folderHistory.length - 1 ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  fontWeight: idx === folderHistory.length - 1 ? '600' : 'normal'
                }}>
                  {folder.name}
                </span>
              </span>
            ))}
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

          {!autoDetected && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.8rem',
              backgroundColor: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              borderRadius: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️</span>
                <span>No se encontró una carpeta de Drive para este equipo.</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Navegue en el explorador inferior al área correspondiente y presione el botón para crear la carpeta.
              </div>
              <button
                type="button"
                onClick={handleCrearCarpetaEquipo}
                disabled={isCreatingFolder}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {isCreatingFolder ? 'Creando...' : `📁 Crear carpeta '${equipo?.nombre || 'equipo'}' en '${folderHistory[folderHistory.length - 1]?.name || 'Inicio PGP'}'`}
              </button>
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
          </div>
        )}

        {/* IA Panel */}
        {maximizedPanel !== 'drive' && (
          <div style={{
            backgroundColor: 'var(--bg-color)',
            padding: '1rem',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: maximizedPanel === 'ia' ? '850px' : '600px',
            height: maximizedPanel === 'ia' ? '800px' : 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
              <h4 style={{ margin: 0 }}>Análisis con Gemini</h4>
              <button
                type="button"
                onClick={() => setMaximizedPanel(maximizedPanel === 'ia' ? null : 'ia')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'color 0.2s, background 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-primary)';
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                title={maximizedPanel === 'ia' ? 'Minimizar' : 'Maximizar'}
              >
                {maximizedPanel === 'ia' ? '🗗' : '🗖'}
              </button>
            </div>

            {/* Scrollable content container */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
              
              {!analisis ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start' }}>
              
              {/* Box de Historial PGP 2024 previo al análisis */}
              {historial2024 ? (
                <div style={{
                  padding: '1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem',
                  textAlign: 'left',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  backdropFilter: 'blur(10px)',
                  marginBottom: '0.5rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.4rem', marginBottom: '0.1rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📋 Historial PGP 2024
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: historial2024.estado === 'CRITICO' ? 'rgba(239, 68, 68, 0.15)' : historial2024.estado === 'REGULAR' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: historial2024.estado === 'CRITICO' ? '#fca5a5' : historial2024.estado === 'REGULAR' ? '#fcd34d' : '#a7f3d0',
                      border: `1px solid ${historial2024.estado === 'CRITICO' ? 'rgba(239, 68, 68, 0.3)' : historial2024.estado === 'REGULAR' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      {historial2024.estado}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Diagnóstico Anterior:</span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {renderVal(historial2024.diagnostico) || 'Sin diagnóstico previo registrado.'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Recomendaciones Anteriores:</span>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                      {renderVal(historial2024.recomendaciones) || 'Sin recomendaciones previas registradas.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                  border: '1px dashed rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  marginBottom: '0.5rem'
                }}>
                  ℹ️ Sin datos históricos registrados del PGP 2024.
                </div>
              )}

              <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', textAlign: 'center', fontSize: '0.85rem' }}>
                Selecciona imágenes del Drive y presiona el botón.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Indicaciones previas para la IA (Opcional):
                  </label>
                  <VoiceDictationButton
                    onTranscript={(txt) => setIndicacionesPrevias(txt)}
                    initialValue={indicacionesPrevias}
                    placeholder="Dictar voz"
                  />
                </div>
                <textarea
                  ref={indicacionesRef}
                  value={indicacionesPrevias}
                  onChange={(e) => {
                    setIndicacionesPrevias(e.target.value);
                    adjustTextarea(indicacionesRef.current, 80);
                  }}
                  placeholder="Ej: Prestar atención a fisuras en el soporte o desgaste en pernos..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    fontSize: '0.85rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    overflowY: 'hidden',
                    resize: 'none',
                    minHeight: '80px'
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Diagnóstico:</label>
                    <VoiceDictationButton
                      onTranscript={(txt) => setEditedDiagnostico(txt)}
                      initialValue={editedDiagnostico}
                      placeholder="Dictar"
                    />
                  </div>
                  <textarea
                    ref={diagnosticoRef}
                    value={editedDiagnostico}
                    onChange={(e) => {
                      setEditedDiagnostico(e.target.value);
                      adjustTextarea(diagnosticoRef.current, 90);
                    }}
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
                      overflowY: 'hidden',
                      resize: 'none',
                      minHeight: '90px'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Acciones:</label>
                    <VoiceDictationButton
                      onTranscript={(txt) => setEditedAcciones(txt)}
                      initialValue={editedAcciones}
                      placeholder="Dictar"
                    />
                  </div>
                  <textarea
                    ref={accionesRef}
                    value={editedAcciones}
                    onChange={(e) => {
                      setEditedAcciones(e.target.value);
                      adjustTextarea(accionesRef.current, 80);
                    }}
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
                      overflowY: 'hidden',
                      resize: 'none',
                      minHeight: '80px'
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Recomendaciones (2027):</label>
                    <VoiceDictationButton
                      onTranscript={(txt) => setEditedRecomendaciones(txt)}
                      initialValue={editedRecomendaciones}
                      placeholder="Dictar"
                    />
                  </div>
                  <textarea
                    ref={recomendacionesRef}
                    value={editedRecomendaciones}
                    onChange={(e) => {
                      setEditedRecomendaciones(e.target.value);
                      adjustTextarea(recomendacionesRef.current, 100);
                    }}
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
                      overflowY: 'hidden',
                      resize: 'none',
                      minHeight: '100px'
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
        )}
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
