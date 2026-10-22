import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import VoiceDictationButton from './VoiceDictationButton';
import ImageViewerModal from './ImageViewerModal';
import imageCompression from 'browser-image-compression';
import { Sparkles, Camera, RefreshCw, FileText, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, ExternalLink, MapPin } from 'lucide-react';
import { API_BASE_URL, getCachedEvidencia, setCachedEvidencia, clearCachedEvidencia } from '../services/api';

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

export default function ManualPanel({ equipoId, onChangeTab }) {
  const { token } = useAuth();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
  const [equipo, setEquipo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState(null);

  const authFetch = (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${activeToken || token}`
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
  const [showHistory2024, setShowHistory2024] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  // Evidencia Clasificada Directa por UT (Cero Navegación)
  const [evidenciaData, setEvidenciaData] = useState(null);
  const [activeEvidenceChip, setActiveEvidenceChip] = useState('CAMPANIA'); // 'CAMPANIA', 'PLANOS', 'HISTORICO'
  const [selectedSubSeccion, setSelectedSubSeccion] = useState('todas');
  const [isRefreshingEvidence, setIsRefreshingEvidence] = useState(false);
  const [isAnalyzingIA, setIsAnalyzingIA] = useState(false);
  const [iaSuccessToast, setIaSuccessToast] = useState(false);

  // Selección de fotos y comentarios
  const [selectedImages, setSelectedImages] = useState([]);
  const [imageComments, setImageComments] = useState({});
  const [imageRegistry, setImageRegistry] = useState({});

  // Cámara
  const cameraInputRef = useRef(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Estados de generación de reporte
  const [generandoReporte, setGenerandoReporte] = useState(false);
  const [reporteStatus, setReporteStatus] = useState(null); // null, 'generating', 'completed', 'error'
  const [reporteUrl, setReporteUrl] = useState('');
  const [reporteDriveLink, setReporteDriveLink] = useState('');

  // Función para obtener la evidencia clasificada de la UT
  const fetchEvidencia = async (eqId = equipoId, showRefreshNotice = false) => {
    if (!eqId) return;

    // 1. Usar memoria caché inmediata (0ms) si no es actualización manual forzada
    if (!showRefreshNotice) {
      const cached = getCachedEvidencia(eqId);
      if (cached) {
        setEvidenciaData(cached);
        if (cached.seccion_recomendada) {
          setSelectedSubSeccion(cached.seccion_recomendada);
        }
        const newRegistry = {};
        if (cached.fotos_campania) {
          cached.fotos_campania.forEach(img => { newRegistry[img.id] = img; });
        }
        if (cached.fotos_historico) {
          Object.values(cached.fotos_historico).flat().forEach(img => { newRegistry[img.id] = img; });
        }
        setImageRegistry(prev => ({ ...prev, ...newRegistry }));
        return;
      }
    }

    if (showRefreshNotice) setIsRefreshingEvidence(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/drive/equipo/${eqId}/evidencia?campania=PGP%202026`);
      if (res.ok) {
        const data = await res.json();
        setEvidenciaData(data);
        setCachedEvidencia(eqId, data);

        // Preseleccionar la sub-sección recomendada si existe
        if (data.seccion_recomendada) {
          setSelectedSubSeccion(data.seccion_recomendada);
        } else {
          setSelectedSubSeccion('todas');
        }

        // Registrar en imageRegistry
        const newRegistry = {};
        if (data.fotos_campania) {
          data.fotos_campania.forEach(img => { newRegistry[img.id] = img; });
        }
        if (data.fotos_historico) {
          Object.values(data.fotos_historico).flat().forEach(img => { newRegistry[img.id] = img; });
        }
        setImageRegistry(prev => ({ ...prev, ...newRegistry }));

        // Si hay fotos de campaña y ninguna seleccionada, preseleccionar la primera
        if (data.fotos_campania && data.fotos_campania.length > 0 && selectedImages.length === 0) {
          setSelectedImages([data.fotos_campania[0].id]);
        }
      }
    } catch (err) {
      console.error("Error al obtener evidencia del equipo:", err);
    } finally {
      if (showRefreshNotice) setIsRefreshingEvidence(false);
    }
  };

  // Captura y subida directa de foto a la carpeta de la UT en Drive
  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    let fileToUpload = file;
    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.75,
        fileType: 'image/jpeg'
      };
      fileToUpload = await imageCompression(file, options);
    } catch (compErr) {
      console.warn('Compresión en cliente omitida o fallida, subiendo original:', compErr);
    }

    const formData = new FormData();
    formData.append('file', fileToUpload, file.name || `foto_pgp2026_${Date.now()}.jpg`);
    if (equipoId) formData.append('equipo_id', equipoId);

    // Buscar el ID de la subcarpeta según la sub-sección seleccionada o recomendada
    let targetFolderId = null;
    if (selectedSubSeccion && selectedSubSeccion !== 'todas') {
      const matchSec = evidenciaData?.secciones_campania?.find(s => s.nombre === selectedSubSeccion);
      if (matchSec) targetFolderId = matchSec.id;
    }
    if (!targetFolderId) {
      targetFolderId = evidenciaData?.seccion_recomendada_id ||
        evidenciaData?.carpetas_detectadas?.find(c => c.tipo === 'campania_activa')?.id ||
        evidenciaData?.equipo?.drive_folder_id;
    }
    if (targetFolderId) {
      formData.append('carpeta_id', targetFolderId);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/drive/subir`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.id) {
        // Refrescar evidencia
        await fetchEvidencia(equipoId, false);
        setSelectedImages(prev => [data.id, ...prev]);
        alert('📸 Foto subida exitosamente a la carpeta de la UT en Google Drive.');
      } else {
        alert('⚠️ Error al subir foto: ' + (data.detail || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error subiendo foto:', err);
      alert('Error de conexión al subir la foto a Google Drive.');
    } finally {
      setIsUploadingPhoto(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Asistencia Inteligente con IA (Gemini Multimodal)
  const handleAsistirIA = async () => {
    let imagesToSend = [...selectedImages];
    // Si no hay seleccionada, intentar usar la primera disponible de la campaña
    if (imagesToSend.length === 0 && evidenciaData?.fotos_campania?.length > 0) {
      imagesToSend = [evidenciaData.fotos_campania[0].id];
      setSelectedImages(imagesToSend);
    }

    if (imagesToSend.length === 0) {
      alert("⚠️ Selecciona o toma al menos una foto de la izquierda para que el Asistente IA pueda analizar el estado del activo.");
      return;
    }

    setIsAnalyzingIA(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/ia/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: parseInt(equipoId),
          image_drive_ids: imagesToSend,
          indicaciones_previas: diagnostico ? `Contexto previo: ${diagnostico}` : ''
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(`Error al consultar IA: ${errData.detail || 'Error en el servicio de IA'}`);
        setIsAnalyzingIA(false);
        return;
      }

      const data = await res.json();
      if (data.analisis) {
        if (data.analisis.estado) setEstado(data.analisis.estado);
        if (data.analisis.diagnostico) setDiagnostico(renderVal(data.analisis.diagnostico));
        if (data.analisis.acciones) setAcciones(renderVal(data.analisis.acciones));
        if (data.analisis.recomendaciones) setRecomendaciones(renderVal(data.analisis.recomendaciones));
        
        setIaSuccessToast(true);
        setTimeout(() => setIaSuccessToast(false), 5000);
      }
    } catch (err) {
      console.error("Error en análisis IA:", err);
      alert("Error de conexión al procesar el análisis con IA.");
    } finally {
      setIsAnalyzingIA(false);
    }
  };

  const toggleImage = (id) => {
    setSelectedImages(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const fotosActuales = useMemo(() => {
    if (!evidenciaData?.fotos_campania) return [];
    if (!selectedSubSeccion || selectedSubSeccion === 'todas') {
      return evidenciaData.fotos_campania;
    }
    return evidenciaData.fotos_campania.filter(f => f.sub_ubicacion === selectedSubSeccion);
  }, [evidenciaData, selectedSubSeccion]);

  const currentConcatenatedPath = useMemo(() => {
    if (!evidenciaData?.path_completo) return '';
    if (activeEvidenceChip === 'CAMPANIA') {
      if (selectedSubSeccion && selectedSubSeccion !== 'todas') {
        return `${evidenciaData.path_completo} > PGP 2026 > ${selectedSubSeccion}`;
      }
      return `${evidenciaData.path_completo} > PGP 2026`;
    }
    if (activeEvidenceChip === 'PLANOS') {
      return `${evidenciaData.path_completo} > Documentación Técnica`;
    }
    if (activeEvidenceChip === 'HISTORICO') {
      return `${evidenciaData.path_completo} > Campañas Históricas`;
    }
    return evidenciaData.path_completo;
  }, [evidenciaData, activeEvidenceChip, selectedSubSeccion]);

  useEffect(() => {
    if (!equipoId) return;
    setLoading(true);

    // Resetear estados del reporte al cambiar de equipo
    setReporteStatus(null);
    setGenerandoReporte(false);
    setReporteUrl('');
    setReporteDriveLink('');
    setSaveStatus(null);
    setIaSuccessToast(false);

    // 1. Fetch equipo details & Evidencia
    const initializeData = async () => {
      try {
        const eqRes = await authFetch(`${API_BASE_URL}/equipos/${equipoId}`);
        if (eqRes.ok) {
          const eqData = await eqRes.json();
          setEquipo(eqData);
        }

        // Cargar evidencia clasificada
        await fetchEvidencia(equipoId, false);
      } catch (err) {
        console.error("Error inicializando datos del equipo:", err);
      }
    };
    initializeData();

    // 2. Fetch inspección 2026 actual si existe
    authFetch(`${API_BASE_URL}/equipos/${equipoId}/inspeccion/2026`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setEstado(renderVal(data.estado) || 'BUENO');
          setAcciones(renderVal(data.acciones) || '');
          setDiagnostico(renderVal(data.diagnostico) || '');
          setRecomendaciones(renderVal(data.recomendaciones) || '');
          if (data.image_drive_ids && Array.isArray(data.image_drive_ids) && data.image_drive_ids.length > 0) {
            setSelectedImages(data.image_drive_ids);
          }
        }
      })
      .catch(err => console.error("Error fetching 2026 inspection:", err));

    // Fetch comentarios y anotaciones
    authFetch(`${API_BASE_URL}/anotaciones/${equipoId}`)
      .then(r => r.json())
      .then(data => {
        if (data.comentarios) {
          setImageComments(data.comentarios);
        }
      })
      .catch(err => console.error("Error fetching comments:", err));

    // 3. Fetch inspección 2024 de referencia
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
          comentarios: imageComments,
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
      window.dispatchEvent(new CustomEvent('inspeccion_actualizada'));
      if (generarPdf) {
        setSaveStatus({ type: 'success', text: `Guardado y PDF generado: ${data.pdf_status}` });
      } else {
        setSaveStatus({ type: 'success', text: "¡Guardado exitoso en base de datos!" });
        setTimeout(() => setSaveStatus(null), 3500);
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
      // 1. Guardar primero en BD
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
          comentarios: imageComments,
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

      // 2. Generar el reporte
      const res = await fetch(`${API_BASE_URL}/reportes/generar/${equipoId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
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

  if (!equipoId) {
    return (
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '3rem' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <FileText style={{ width: '48px', height: '48px', margin: '0 auto 12px auto', opacity: 0.4 }} />
          <h3 style={{ margin: 0, color: 'white' }}>Selecciona un Equipo</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>Elige un activo en la barra lateral para abrir su Cockpit de Inspección.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <RefreshCw style={{ width: '32px', height: '32px', margin: '0 auto 12px auto', animation: 'spin 1s linear infinite' }} />
        <div>Cargando datos y evidencia de la UT...</div>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
      
      {/* CABECERA DEL ACTIVO */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{equipo?.nombre}</h2>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>
              Tag: {equipo?.numero || equipo?.codigo}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <span><strong>Área:</strong> {equipo?.area}</span>
            {equipo?.material && <span><strong>Material:</strong> {equipo.material}</span>}
            {equipo?.fluido && <span><strong>Fluido:</strong> {equipo.fluido}</span>}
            {equipo?.presion_diseno && <span><strong>Presión:</strong> {equipo.presion_diseno} psi</span>}
          </div>
        </div>

        {/* Input oculto para cámara */}
        <input 
          type="file" 
          ref={cameraInputRef} 
          accept="image/*" 
          capture="environment" 
          style={{ display: 'none' }} 
          onChange={handleCameraCapture} 
        />
      </div>

      {/* TOAST DE ASISTENCIA IA */}
      {iaSuccessToast && (
        <div style={{
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          color: '#c7d2fe',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Sparkles style={{ width: '18px', height: '18px', color: '#a5b4fc', flexShrink: 0 }} />
          <span><strong>¡Diagnóstico Asistido por IA Aplicado!</strong> Se completaron el estado sugerido, diagnóstico y recomendaciones con base en las fotos seleccionadas.</span>
        </div>
      )}

      {/* COCKPIT: MESA DE TRABAJO DIVIDIDA (50% EVIDENCIA | 50% REGISTRO) */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', 
        gap: '1.25rem',
        alignItems: 'start'
      }}>
        
        {/* ========================================================= */}
        {/* COLUMNA IZQUIERDA: EVIDENCIA VISUAL Y PLANOS (DRIVE)       */}
        {/* ========================================================= */}
        <div style={{ 
          backgroundColor: 'rgba(255,255,255,0.02)', 
          border: '1px solid rgba(255,255,255,0.08)', 
          borderRadius: '12px', 
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem'
        }}>
          {/* Header de la Columna Evidencia */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Evidencia y Documentación</span>
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={isUploadingPhoto}
                style={{
                  padding: '4px 9px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Tomar o subir foto de terreno"
              >
                <Camera style={{ width: '13px', height: '13px' }} />
                <span>{isUploadingPhoto ? 'Subiendo...' : '📷 Cámara'}</span>
              </button>

              <button
                type="button"
                onClick={() => fetchEvidencia(equipoId, true)}
                disabled={isRefreshingEvidence}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  color: 'var(--text-secondary)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Actualizar fotos desde Drive"
              >
                <RefreshCw style={{ width: '12px', height: '12px', animation: isRefreshingEvidence ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* RUTA JERÁRQUICA CONCATENADA (BREADCRUMB MULTI-NIVEL) */}
          {currentConcatenatedPath && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontSize: '0.73rem',
              color: '#94a3b8',
              overflowX: 'auto',
              whiteSpace: 'nowrap'
            }}>
              <MapPin style={{ width: '13px', height: '13px', color: '#38bdf8', flexShrink: 0 }} />
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>Ubicación:</span>
              <span style={{ color: '#f1f5f9', fontFamily: 'monospace' }}>
                {currentConcatenatedPath}
              </span>
            </div>
          )}

          {/* CHIPS DE ACCESO DIRECTO POR UT */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveEvidenceChip('CAMPANIA')}
              style={{
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeEvidenceChip === 'CAMPANIA' ? '#0284c7' : 'rgba(255,255,255,0.04)',
                color: activeEvidenceChip === 'CAMPANIA' ? '#ffffff' : 'var(--text-secondary)',
                border: activeEvidenceChip === 'CAMPANIA' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              📸 Fotos 2026 ({evidenciaData?.resumen?.total_fotos_campania ?? fotosActuales.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveEvidenceChip('PLANOS')}
              style={{
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeEvidenceChip === 'PLANOS' ? '#0891b2' : 'rgba(255,255,255,0.04)',
                color: activeEvidenceChip === 'PLANOS' ? '#ffffff' : 'var(--text-secondary)',
                border: activeEvidenceChip === 'PLANOS' ? '1px solid #22d3ee' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              📐 Planos ({evidenciaData?.resumen?.total_documentacion ?? 0})
            </button>

            <button
              type="button"
              onClick={() => setActiveEvidenceChip('HISTORICO')}
              style={{
                padding: '4px 9px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeEvidenceChip === 'HISTORICO' ? '#7e22ce' : 'rgba(255,255,255,0.04)',
                color: activeEvidenceChip === 'HISTORICO' ? '#ffffff' : 'var(--text-secondary)',
                border: activeEvidenceChip === 'HISTORICO' ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.08)'
              }}
            >
              ⏪ Histórico ({evidenciaData?.resumen?.total_historicos ?? 0})
            </button>
          </div>

          {/* SUB-SECCIONES DETECTADAS EN CAMPAÑA (Ej: Succión 431-433 / Impulsión 431-433) */}
          {activeEvidenceChip === 'CAMPANIA' && evidenciaData?.secciones_campania?.length > 1 && (
            <div style={{ 
              display: 'flex', 
              gap: '5px', 
              alignItems: 'center', 
              flexWrap: 'wrap', 
              padding: '6px 8px', 
              backgroundColor: 'rgba(15, 23, 42, 0.6)', 
              borderRadius: '6px', 
              border: '1px solid rgba(255, 255, 255, 0.06)' 
            }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Sub-sección:</span>
              <button
                type="button"
                onClick={() => setSelectedSubSeccion('todas')}
                style={{
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: selectedSubSeccion === 'todas' ? 700 : 500,
                  cursor: 'pointer',
                  backgroundColor: selectedSubSeccion === 'todas' ? '#334155' : 'transparent',
                  color: selectedSubSeccion === 'todas' ? '#ffffff' : '#94a3b8',
                  border: selectedSubSeccion === 'todas' ? '1px solid #64748b' : '1px solid transparent'
                }}
              >
                Ver Todas ({evidenciaData.fotos_campania?.length || 0})
              </button>
              {evidenciaData.secciones_campania.map(sec => {
                const isRec = sec.nombre === evidenciaData.seccion_recomendada;
                const isActive = selectedSubSeccion === sec.nombre;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedSubSeccion(sec.nombre)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: isActive 
                        ? '#059669' 
                        : isRec 
                        ? 'rgba(5, 150, 105, 0.15)' 
                        : 'transparent',
                      color: isActive 
                        ? '#ffffff' 
                        : isRec 
                        ? '#6ee7b7' 
                        : '#94a3b8',
                      border: isActive 
                        ? '1px solid #34d399' 
                        : isRec 
                        ? '1px solid rgba(16, 185, 129, 0.4)' 
                        : '1px solid transparent'
                    }}
                    title={isRec ? 'Sub-sección recomendada para este equipo' : sec.path_completo}
                  >
                    {isRec && <Sparkles style={{ width: '10px', height: '10px', color: '#f59e0b' }} />}
                    <span>{sec.nombre}</span>
                    <span style={{ 
                      fontSize: '0.65rem', 
                      padding: '1px 4px', 
                      borderRadius: '3px', 
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      color: isActive ? '#d1fae5' : '#cbd5e1'
                    }}>
                      {sec.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* VISTA 1: FOTOS CAMPAÑA 2026 */}
          {activeEvidenceChip === 'CAMPANIA' && (
            <div>
              {fotosActuales.length > 0 ? (
                <>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Selecciona las fotos para incluir en el reporte y analizar con IA:</span>
                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{selectedImages.length} seleccionada(s)</span>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', 
                    gap: '10px',
                    maxHeight: '440px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}>
                    {fotosActuales.map((img) => {
                      const isSelected = selectedImages.includes(img.id);
                      return (
                        <div 
                          key={img.id} 
                          style={{ 
                            position: 'relative',
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            border: isSelected ? '2px solid #0284c7' : '1px solid rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            aspectRatio: '1 / 1',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 0 10px rgba(14, 165, 233, 0.4)' : 'none'
                          }}
                          onClick={() => toggleImage(img.id)}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setPreviewImage(img);
                          }}
                          title="Clic para seleccionar · Doble clic para maximizar"
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={(e) => { e.stopPropagation(); toggleImage(img.id); }} 
                            style={{ 
                              position: 'absolute', 
                              top: '6px', 
                              left: '6px', 
                              width: '16px', 
                              height: '16px', 
                              cursor: 'pointer',
                              zIndex: 2 
                            }} 
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImage(img);
                            }}
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              backgroundColor: 'rgba(15, 23, 42, 0.75)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '4px',
                              padding: '2px 5px',
                              fontSize: '0.65rem',
                              color: 'white',
                              cursor: 'pointer',
                              zIndex: 2
                            }}
                            title="Maximizar foto"
                          >
                            🔍
                          </button>
                          {activeToken ? (
                            <img 
                              key={`${img.id}-${activeToken}`}
                              src={img.thumbnail || `${API_BASE_URL}/drive/imagen/${img.id}?token=${activeToken}`} 
                              alt={img.name} 
                              loading="lazy"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                          ) : null}
                          <div style={{ 
                            position: 'absolute', bottom: 0, left: 0, right: 0, 
                            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)', 
                            padding: '10px 6px 4px 6px', pointerEvents: 'none' 
                          }}>
                            {img.sub_ubicacion && (
                              <span style={{ 
                                display: 'inline-block', 
                                fontSize: '0.6rem', 
                                padding: '1px 4px', 
                                borderRadius: '3px', 
                                backgroundColor: 'rgba(2, 132, 199, 0.7)', 
                                color: '#e0f2fe',
                                marginBottom: '2px',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {img.sub_ubicacion}
                              </span>
                            )}
                            <span style={{ display: 'block', fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'white' }}>
                              {img.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <Camera style={{ width: '32px', height: '32px', margin: '0 auto 8px auto', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Aún no hay fotos cargadas en PGP 2026 para este equipo.</p>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    style={{
                      marginTop: '10px',
                      padding: '5px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#000',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Tomar primera foto
                  </button>
                </div>
              )}

              {/* Comentarios de fotos seleccionadas */}
              {selectedImages.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.8rem' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'white', marginBottom: '6px' }}>
                    📝 Leyendas para el Informe ({selectedImages.length}):
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
                    {selectedImages.map((imgId) => {
                      const img = imageRegistry[imgId] || { id: imgId, name: `Foto ID: ${imgId.slice(0, 6)}...` };
                      return (
                        <div key={imgId} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', width: '90px', truncate: 'true', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {img.name}
                          </span>
                          <input 
                            type="text" 
                            placeholder="Ej: Corrosión en brida interior..." 
                            value={imageComments[imgId] || ''} 
                            onChange={(e) => {
                              setImageComments(prev => ({ ...prev, [imgId]: e.target.value }));
                            }}
                            style={{ 
                              flex: 1, 
                              padding: '3px 8px', 
                              fontSize: '0.75rem', 
                              backgroundColor: 'rgba(0,0,0,0.3)', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              borderRadius: '4px', 
                              color: 'white' 
                            }} 
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA 2: PLANOS Y DOCUMENTACIÓN TÉCNICA */}
          {activeEvidenceChip === 'PLANOS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '440px', overflowY: 'auto' }}>
              {evidenciaData?.documentacion_tecnica?.length > 0 ? (
                evidenciaData.documentacion_tecnica.map((doc) => (
                  <div 
                    key={doc.id} 
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span style={{ fontSize: '1.2rem' }}>{doc.es_plano ? '📐' : '📄'}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {doc.name}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          {(doc.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <a
                      href={`https://drive.google.com/file/d/${doc.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        textDecoration: 'none',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Abrir Plano ↗
                    </a>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  No se registran planos cargados en la carpeta técnica de esta UT.
                </div>
              )}
            </div>
          )}

          {/* VISTA 3: HISTÓRICO DE REFERENCIA */}
          {activeEvidenceChip === 'HISTORICO' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '440px', overflowY: 'auto' }}>
              {evidenciaData?.fotos_historico && Object.keys(evidenciaData.fotos_historico).length > 0 ? (
                Object.entries(evidenciaData.fotos_historico).map(([campaniaNombre, fotos]) => (
                  <div key={campaniaNombre} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c084fc', marginBottom: '6px' }}>
                      📅 {campaniaNombre} ({fotos.length} fotos)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
                      {fotos.map(f => (
                        <div
                          key={f.id}
                          onClick={() => setPreviewImage(f)}
                          style={{
                            height: '80px',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)',
                            cursor: 'pointer'
                          }}
                          title={f.name}
                        >
                          <img
                            src={f.thumbnail || `${API_BASE_URL}/drive/imagen/${f.id}?token=${activeToken}`}
                            alt={f.name}
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                  No se registran fotos históricas de años anteriores para esta UT.
                </div>
              )}
            </div>
          )}
        </div>


        {/* ========================================================= */}
        {/* COLUMNA DERECHA: FORMULARIO 2026 CON COPILOTO IA          */}
        {/* ========================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          
          {/* Header del Formulario con el Botón de Asistente IA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'white' }}>
              Evaluación Técnica 2026
            </h4>

            {/* BOTÓN COPILOTO IA */}
            <button
              type="button"
              onClick={handleAsistirIA}
              disabled={isAnalyzingIA}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #0284c7 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s'
              }}
              title="Analiza las fotos seleccionadas con Gemini y completa el diagnóstico"
            >
              <Sparkles style={{ width: '14px', height: '14px', animation: isAnalyzingIA ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isAnalyzingIA ? 'Analizando con Gemini...' : '✨ Asistir con IA'}</span>
            </button>
          </div>
          
          {/* Estado 2026 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              ESTADO S/PGP 2026:
            </label>
            <select 
              value={estado} 
              onChange={e => setEstado(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: estado === 'CRITICO' ? '#450a0a' : estado === 'REGULAR' ? '#451a03' : '#064e3b',
                color: 'white',
                fontWeight: 700,
                outline: 'none',
                colorScheme: 'dark'
              }}
            >
              <option value="BUENO">BUENO (Apto para operar)</option>
              <option value="REGULAR">REGULAR (Bajo Observación)</option>
              <option value="CRITICO">CRITICO (Requiere Intervención)</option>
              <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            </select>
          </div>

          {/* Acciones PGP 2026 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Acciones PGP 2026:
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setAcciones(txt)}
                initialValue={acciones}
                placeholder="Dictar voz"
              />
            </div>
            <textarea
              value={acciones}
              onChange={e => setAcciones(e.target.value)}
              placeholder="Describa las acciones ejecutadas en terreno..."
              style={{
                width: '100%',
                height: '75px',
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'white',
                fontSize: '0.82rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* Diagnóstico 2026 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                DIAGNÓSTICO 2026:
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setDiagnostico(txt)}
                initialValue={diagnostico}
                placeholder="Dictar voz"
              />
            </div>
            <textarea
              value={diagnostico}
              onChange={e => setDiagnostico(e.target.value)}
              placeholder="Escriba el diagnóstico del estado actual..."
              style={{
                width: '100%',
                height: '95px',
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'white',
                fontSize: '0.82rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* Recomendaciones 2027 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                RECOMENDACIONES PGP 2027:
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setRecomendaciones(txt)}
                initialValue={recomendaciones}
                placeholder="Dictar voz"
              />
            </div>
            <textarea
              value={recomendaciones}
              onChange={e => setRecomendaciones(e.target.value)}
              placeholder="Recomendaciones para el próximo régimen..."
              style={{
                width: '100%',
                height: '80px',
                padding: '0.55rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                backgroundColor: 'rgba(0,0,0,0.25)',
                color: 'white',
                fontSize: '0.82rem',
                resize: 'vertical',
                outline: 'none'
              }}
            />
          </div>

          {/* ANTECEDENTES 2024 (BLOQUE COLAPSABLE / ACORDEÓN) */}
          <div style={{ 
            borderRadius: '8px', 
            border: '1px solid rgba(255,255,255,0.08)', 
            backgroundColor: 'rgba(255,255,255,0.02)',
            overflow: 'hidden'
          }}>
            <button
              type="button"
              onClick={() => setShowHistory2024(prev => !prev)}
              style={{
                width: '100%',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>📜 Consultar Antecedentes Históricos (2024): <strong>{history2024?.estado || 'Disponible'}</strong></span>
              {showHistory2024 ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
            </button>

            {showHistory2024 && (
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {history2024 ? (
                  <>
                    <div><strong>Estado 2024:</strong> <span style={{ color: history2024.estado === 'CRITICO' ? '#f87171' : '#fbbf24' }}>{history2024.estado}</span></div>
                    {history2024.diagnostico && <div><strong>Diagnóstico 2024:</strong> {renderVal(history2024.diagnostico)}</div>}
                    {history2024.recomendaciones && <div><strong>Recomendaciones 2024:</strong> {renderVal(history2024.recomendaciones)}</div>}
                  </>
                ) : (
                  <div>Sin registros del año 2024 para este equipo.</div>
                )}
              </div>
            )}
          </div>

          {/* BOTONES DE ACCIÓN */}
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.4rem' }}>
            <button 
              onClick={() => handleGuardar(false)} 
              disabled={isSaving || generandoReporte} 
              className="btn btn-secondary" 
              style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {isSaving ? 'Guardando en BD...' : '💾 Guardar en BD'}
            </button>
            <button 
              onClick={handleGenerarReporte} 
              disabled={isSaving || generandoReporte} 
              className="btn btn-primary" 
              style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600 }}
            >
              {generandoReporte ? 'Generando...' : '📄 Generar Reporte'}
            </button>
          </div>

          {saveStatus && (
            <div style={{ 
              padding: '0.6rem', 
              borderRadius: '6px', 
              backgroundColor: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
              border: saveStatus.type === 'success' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: saveStatus.type === 'success' ? '#4ade80' : '#f87171',
              fontSize: '0.82rem',
              fontWeight: 500,
              textAlign: 'center'
            }}>
              {saveStatus.text}
            </div>
          )}

          {reporteStatus === 'completed' && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem', 
              padding: '0.8rem', 
              borderRadius: '8px', 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              border: '1px solid rgba(34, 197, 94, 0.3)'
            }}>
              <div style={{ color: '#4ade80', fontSize: '0.82rem', fontWeight: 600 }}>
                ✅ Acta Técnica generada exitosamente.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a 
                  href={reporteUrl} 
                  download 
                  className="btn btn-secondary" 
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', flex: 1, textAlign: 'center', textDecoration: 'none' }}
                >
                  Descargar PDF
                </a>
                {reporteDriveLink && !reporteDriveLink.includes('mock-link') && (
                  <a 
                    href={reporteDriveLink} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-primary" 
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem', flex: 1, textAlign: 'center', textDecoration: 'none' }}
                  >
                    Ver en Drive ↗
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <ImageViewerModal
          image={previewImage}
          images={fotosActuales}
          token={token}
          onClose={() => setPreviewImage(null)}
          isSelected={selectedImages.includes(previewImage.id)}
          onSelectImage={(id) => toggleImage(id)}
        />
      )}
    </div>
  );
}
