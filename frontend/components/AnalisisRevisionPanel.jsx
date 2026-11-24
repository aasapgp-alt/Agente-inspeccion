'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import imageCompression from 'browser-image-compression';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import {
  API_BASE_URL,
  apiService,
  getCachedEvidencia,
  setCachedEvidencia,
  clearCachedEvidencia
} from '../services/api';
import AnnotationModal from './AnnotationModal';
import ImageViewerModal from './ImageViewerModal';
import VoiceDictationButton from './VoiceDictationButton';
import EquipoCopilotDrawer from './EquipoCopilotDrawer';
import { guardarInspeccionOffline } from '../utils/offlineStore';
import {
  Sparkles,
  Camera,
  RefreshCw,
  Edit3,
  MessageSquare,
  Save,
  FileText,
  Check,
  ZoomIn,
  Bot,
  Send,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink
} from 'lucide-react';

const renderVal = (val) => {
  if (!val) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item))).join('\n');
    }
    return Object.entries(val)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join('\n');
  }
  return String(val);
};

export default function AnalisisRevisionPanel({
  equipoId,
  isLight,
  onOpenPicker,
  onGoToFicha,
  onGoToReportes,
  onInspectionSaved
}) {
  const { token } = useAuth();
  const toast = useToast();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');

  const authFetch = (url, options = {}) =>
    fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${activeToken}`
      }
    });

  const [equipo, setEquipo] = useState(null);
  const [loading, setLoading] = useState(false);

  // Evidencia de Drive
  const [evidencia, setEvidencia] = useState(null);
  const [selectedSubSeccion, setSelectedSubSeccion] = useState('todas');
  const [refreshingDrive, setRefreshingDrive] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const cameraInputRef = useRef(null);

  // Selección, anotaciones y comentarios por foto
  const [selectedImages, setSelectedImages] = useState([]);
  const [annotationsMap, setAnnotationsMap] = useState({});
  const [commentsMap, setCommentsMap] = useState({});
  const [annotatingImage, setAnnotatingImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Contexto e IA Gemini
  const [indicacionesPrevias, setIndicacionesPrevias] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [iaDraftLoaded, setIaDraftLoaded] = useState(false);
  const [refineMsg, setRefineMsg] = useState('');
  const [refining, setRefining] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);

  // Formulario editable del inspector
  const [existingInspeccion, setExistingInspeccion] = useState(null);
  const [estado, setEstado] = useState('BUENO');
  const [acciones, setAcciones] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [recomendaciones, setRecomendaciones] = useState('');
  const [leccionAprendida, setLeccionAprendida] = useState('');
  const [generarPdf, setGenerarPdf] = useState(true);

  // Guardado y estado del reporte
  const [isSaving, setIsSaving] = useState(false);
  const [savedInspeccionId, setSavedInspeccionId] = useState(null);
  const [reportStatus, setReportStatus] = useState(null); // null | 'generando' | 'completado' | 'error'
  const [reportData, setReportData] = useState(null);

  const cargarEvidencia = async (eqId, forceRefresh = false) => {
    if (!eqId || !activeToken) return;
    if (!forceRefresh) {
      const cached = getCachedEvidencia(eqId);
      if (cached) {
        setEvidencia(cached);
        if (cached.seccion_recomendada) setSelectedSubSeccion(cached.seccion_recomendada);
        return;
      }
    }
    setRefreshingDrive(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/drive/equipo/${eqId}/evidencia?campania=PGP%202026`);
      if (res.ok) {
        const data = await res.json();
        setEvidencia(data);
        setCachedEvidencia(eqId, data);
        if (data.seccion_recomendada) setSelectedSubSeccion(data.seccion_recomendada);
      }
    } catch (err) {
      console.error('Error cargando evidencia:', err);
    } finally {
      setRefreshingDrive(false);
    }
  };

  // Cargar datos del equipo, revisión 2026 existente, anotaciones y evidencia
  useEffect(() => {
    if (!equipoId || !activeToken) {
      setEquipo(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSessionId(null);
    setIaDraftLoaded(false);
    setSavedInspeccionId(null);
    setReportStatus(null);
    setReportData(null);
    setIndicacionesPrevias('');
    setLeccionAprendida('');

    Promise.all([
      apiService.getEquipoFicha(equipoId, activeToken),
      authFetch(`${API_BASE_URL}/anotaciones/${equipoId}`).then((r) => (r.ok ? r.json() : null))
    ])
      .then(([fichaData, anotData]) => {
        if (cancelled) return;
        const eq = fichaData?.equipo || null;
        setEquipo(eq);

        // Si ya tiene inspección 2026, precargarla para edición/revisión
        const insp2026 = (fichaData?.inspecciones || []).find((i) => Number(i.anio) === 2026) || null;
        setExistingInspeccion(insp2026);
        if (insp2026) {
          setEstado(insp2026.estado || 'BUENO');
          setAcciones(renderVal(insp2026.acciones));
          setDiagnostico(renderVal(insp2026.diagnostico));
          setRecomendaciones(renderVal(insp2026.recomendaciones));
          setSavedInspeccionId(insp2026.id);
          if (Array.isArray(insp2026.image_drive_ids) && insp2026.image_drive_ids.length > 0) {
            setSelectedImages(insp2026.image_drive_ids);
          } else {
            setSelectedImages([]);
          }
        } else {
          setEstado('BUENO');
          setAcciones('');
          setDiagnostico('');
          setRecomendaciones('');
          setSelectedImages([]);
        }

        if (anotData) {
          setAnnotationsMap(anotData.anotaciones || {});
          setCommentsMap(anotData.comentarios || {});
        } else {
          setAnnotationsMap({});
          setCommentsMap({});
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    cargarEvidencia(equipoId, false);

    return () => {
      cancelled = true;
    };
  }, [equipoId, activeToken]);

  const fotosCampania = useMemo(() => {
    const list = evidencia?.fotos_campania || [];
    if (!selectedSubSeccion || selectedSubSeccion === 'todas') return list;
    const filtered = list.filter((f) => f.sub_ubicacion === selectedSubSeccion);
    return filtered.length > 0 ? filtered : list;
  }, [evidencia, selectedSubSeccion]);

  // Preseleccionar la primera foto si no hay ninguna seleccionada y hay fotos disponibles
  useEffect(() => {
    if (fotosCampania.length > 0 && selectedImages.length === 0 && !existingInspeccion) {
      setSelectedImages([fotosCampania[0].id]);
    }
  }, [fotosCampania, existingInspeccion]);

  const subSecciones = useMemo(() => {
    const list = evidencia?.fotos_campania || [];
    const counts = {};
    list.forEach((f) => {
      const sub = f.sub_ubicacion || 'General';
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return Object.entries(counts);
  }, [evidencia]);

  const fotosMap = useMemo(() => {
    const m = new Map();
    (evidencia?.fotos_campania || []).forEach((f) => m.set(f.id, f));
    return m;
  }, [evidencia]);

  const toggleSelectImage = (id) => {
    setSelectedImages((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Subir o capturar foto con cámara
  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !equipoId) return;

    setUploadingPhoto(true);
    let fileToUpload = file;
    try {
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1600,
        useWebWorker: true,
        initialQuality: 0.75,
        fileType: 'image/jpeg'
      });
    } catch {
      // continuar con original si falla compresión
    }

    const formData = new FormData();
    formData.append('file', fileToUpload, file.name || 'foto_inspeccion.jpg');
    formData.append('equipo_id', String(equipoId));
    if (evidencia?.carpeta_campania_id) {
      formData.append('carpeta_id', evidencia.carpeta_campania_id);
    }

    try {
      const res = await authFetch(`${API_BASE_URL}/drive/subir`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.id) {
        const newImg = {
          id: data.id,
          name: data.title || file.name,
          size: fileToUpload.size || file.size,
          sub_ubicacion: selectedSubSeccion !== 'todas' ? selectedSubSeccion : 'General'
        };
        setEvidencia((prev) => {
          const next = {
            ...(prev || {}),
            fotos_campania: [newImg, ...(prev?.fotos_campania || [])]
          };
          setCachedEvidencia(equipoId, next);
          return next;
        });
        setSelectedImages((prev) => [data.id, ...prev]);
        toast.success('Foto optimizada y subida a Google Drive.');
      } else {
        toast.error(data.detail || 'Error al subir la foto a Drive.');
      }
    } catch {
      toast.error('Error de red al subir la foto.');
    } finally {
      setUploadingPhoto(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  // Guardar comentario de una foto en backend
  const handleCommentBlur = async (imgId) => {
    const comentario = commentsMap[imgId] || '';
    const anns = annotationsMap[imgId] || [];
    try {
      await authFetch(`${API_BASE_URL}/anotaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: Number(equipoId),
          image_id: imgId,
          annotations: anns,
          comentario
        })
      });
    } catch {
      // silencioso; también se envía en analizar/guardar
    }
  };

  // Ejecutar análisis con Gemini API
  const handleAnalyzeWithGemini = async () => {
    if (selectedImages.length === 0) {
      toast.warning('Seleccioná al menos una foto para que Gemini pueda analizar el equipo.');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Construir contexto unificado con indicaciones + comentarios por imagen
      const comentariosTexto = selectedImages
        .map((id, idx) => {
          const c = (commentsMap[id] || '').trim();
          const imgName = fotosMap.get(id)?.name || `Foto ${idx + 1}`;
          return c ? `- ${imgName}: ${c}` : null;
        })
        .filter(Boolean)
        .join('\n');

      const indicacionesCompletas = [
        indicacionesPrevias.trim(),
        comentariosTexto ? `Comentarios del inspector sobre las fotos:\n${comentariosTexto}` : ''
      ]
        .filter(Boolean)
        .join('\n\n');

      const anotacionesSeleccionadas = {};
      selectedImages.forEach((id) => {
        if (annotationsMap[id]?.length > 0) {
          anotacionesSeleccionadas[id] = annotationsMap[id];
        }
      });

      const res = await authFetch(`${API_BASE_URL}/ia/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipo_id: Number(equipoId),
          image_drive_ids: selectedImages,
          indicaciones_previas: indicacionesCompletas || null,
          anotaciones: Object.keys(anotacionesSeleccionadas).length > 0 ? anotacionesSeleccionadas : null
        })
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Error al analizar con Gemini IA.');
        return;
      }

      if (data.session_id) setSessionId(data.session_id);
      if (data.analisis) {
        setEstado(data.analisis.estado || 'BUENO');
        setAcciones(renderVal(data.analisis.acciones));
        setDiagnostico(renderVal(data.analisis.diagnostico));
        setRecomendaciones(renderVal(data.analisis.recomendaciones));
        setIaDraftLoaded(true);
        toast.success('Análisis de Gemini cargado. Revisá los campos y dale Guardado Final.');
      }
    } catch {
      toast.error('No se pudo conectar con el servidor para analizar con Gemini.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Refinar borrador con Gemini (/api/ia/chat)
  const handleRefineDraft = async (e) => {
    e.preventDefault();
    if (!refineMsg.trim() || !sessionId) return;
    setRefining(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/ia/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          mensaje: refineMsg.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.analisis) {
        setEstado(data.analisis.estado || estado);
        setAcciones(renderVal(data.analisis.acciones) || acciones);
        setDiagnostico(renderVal(data.analisis.diagnostico) || diagnostico);
        setRecomendaciones(renderVal(data.analisis.recomendaciones) || recomendaciones);
        setRefineMsg('');
        toast.success('Borrador actualizado según tu indicación.');
      } else {
        toast.error(data.detail || 'No se pudo refinar el análisis.');
      }
    } catch {
      toast.error('Error al comunicarse con Gemini.');
    } finally {
      setRefining(false);
    }
  };

  // Guardado final oficial del inspector
  const handleSaveFinal = async () => {
    if (!diagnostico.trim()) {
      toast.warning('El diagnóstico técnico no puede estar vacío.');
      return;
    }
    setIsSaving(true);

    const payload = {
      equipo_id: Number(equipoId),
      session_id: sessionId,
      estado,
      acciones,
      diagnostico,
      recomendaciones,
      leccion_aprendida: leccionAprendida.trim() || null,
      image_drive_ids: selectedImages,
      generar_pdf: generarPdf,
      anotaciones: annotationsMap,
      comentarios: commentsMap
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await guardarInspeccionOffline(payload);
        toast.warning('Sin conexión: inspección guardada en modo offline para sincronizar luego.');
        return;
      }

      const res = await authFetch(`${API_BASE_URL}/ia/guardar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Error al guardar la inspección.');
        return;
      }

      setIaDraftLoaded(false);
      setSavedInspeccionId(data.inspeccion_id);
      toast.success('Inspección guardada oficialmente en la base de datos.');
      if (onInspectionSaved) onInspectionSaved();

      if (generarPdf && data.inspeccion_id) {
        setReportStatus('generando');
        pollReportStatus(data.inspeccion_id);
      }
    } catch {
      toast.error('Error de red al guardar la inspección.');
    } finally {
      setIsSaving(false);
    }
  };

  const pollReportStatus = (inspId) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await authFetch(`${API_BASE_URL}/reportes/estado/${inspId}`);
        if (res.ok) {
          const st = await res.json();
          if (st.estado === 'completado') {
            clearInterval(interval);
            setReportStatus('completado');
            setReportData(st);
            toast.success('Acta PDF generada y vinculada.');
          } else if (st.estado === 'error') {
            clearInterval(interval);
            setReportStatus('error');
          }
        }
      } catch {
        // seguir intentando
      }
      if (attempts >= 20) clearInterval(interval);
    }, 2500);
  };

  if (!equipoId) {
    return (
      <div
        className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800'
        }`}
      >
        <Sparkles className="w-12 h-12 mx-auto mb-3 text-indigo-400 opacity-80" />
        <h2 className="text-lg font-extrabold mb-1">Estación de Análisis y Revisión con Gemini IA</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
          Elegí un equipo para seleccionar sus fotos, agregar anotaciones y comentarios, ejecutar la evaluación de Gemini y dar el guardado final.
        </p>
        <button
          onClick={onOpenPicker}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors"
        >
          Seleccionar Equipo
        </button>
      </div>
    );
  }

  const cardCls = isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800/90';

  return (
    <div className="space-y-4">
      {/* Cabecera compacta del equipo en análisis */}
      <div className={`rounded-2xl border p-3.5 flex flex-wrap items-center justify-between gap-3 ${cardCls}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-extrabold text-sky-400">
                {equipo?.codigo || `#${equipoId}`}
              </span>
              <span className="text-sm font-black truncate">{equipo?.nombre || 'Cargando...'}</span>
              {existingInspeccion && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                  Editando revisión {existingInspeccion.anio}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {equipo?.area || 'Planta'} · Material: {equipo?.material || 'Estándar'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onGoToFicha}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/60 hover:border-sky-500 text-xs font-bold transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5 text-sky-400" />
            Ver Ficha
          </button>
          <button
            onClick={() => setShowCopilot(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-bold transition-colors"
          >
            <Bot className="w-3.5 h-3.5" />
            Copiloto IA
          </button>
        </div>
      </div>

      {/* Dos columnas sincronizadas: Izquierda (Evidencia + Input Gemini) | Derecha (Revisión + Guardado) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ============================================================== */}
        {/* COLUMNA IZQUIERDA (6 cols): FOTOS, ANOTACIONES Y COMENTARIOS   */}
        {/* ============================================================== */}
        <div className={`lg:col-span-6 rounded-2xl border p-4 space-y-4 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 pb-3">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                1. Evidencia y Comentarios para Gemini
              </h3>
              <p className="text-[11px] text-slate-400">
                Seleccioná fotos, agregá anotaciones o comentarios y ejecutá la evaluación.
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {uploadingPhoto ? 'Subiendo...' : 'Subir / Cámara'}
              </button>
              <button
                type="button"
                onClick={() => {
                  clearCachedEvidencia(equipoId);
                  cargarEvidencia(equipoId, true);
                }}
                disabled={refreshingDrive}
                className="p-1.5 rounded-xl border border-slate-700/60 hover:border-sky-500 text-slate-300"
                title="Actualizar fotos desde Google Drive"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingDrive ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Sub-secciones si existen */}
          {subSecciones.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedSubSeccion('todas')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  selectedSubSeccion === 'todas'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                    : 'border-slate-700/50 text-slate-400'
                }`}
              >
                Todas ({evidencia?.fotos_campania?.length || 0})
              </button>
              {subSecciones.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setSelectedSubSeccion(name)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                    selectedSubSeccion === name
                      ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                      : 'border-slate-700/50 text-slate-400'
                  }`}
                >
                  {name} ({count})
                </button>
              ))}
            </div>
          )}

          {/* Grilla de fotos seleccionables */}
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Cargando evidencia...</div>
          ) : fotosCampania.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-slate-700/60 text-xs text-slate-400">
              No hay fotos en la carpeta de campaña. Subí una foto con el botón superior.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
              {fotosCampania.map((img) => {
                const isSel = selectedImages.includes(img.id);
                const hasAnns = (annotationsMap[img.id]?.length || 0) > 0;
                const hasComment = !!(commentsMap[img.id] || '').trim();
                const fallbackUrl = `${API_BASE_URL}/drive/imagen/${img.id}?token=${encodeURIComponent(activeToken || '')}`;
                const thumbUrl = img.thumbnail || fallbackUrl;

                return (
                  <div
                    key={img.id}
                    onClick={() => toggleSelectImage(img.id)}
                    className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      isSel ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-slate-700/50 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt={img.name}
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== fallbackUrl) {
                          e.currentTarget.src = fallbackUrl;
                        }
                      }}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold ${
                        isSel ? 'bg-indigo-600' : 'bg-black/60 border border-white/40'
                      }`}
                    >
                      {isSel && <Check className="w-3 h-3" />}
                    </div>
                    {(hasAnns || hasComment) && (
                      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-black text-[9px] font-black">
                        {hasAnns ? 'Anot.' : 'Com.'}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewImage({ ...img, url: `${API_BASE_URL}/drive/imagen/${img.id}` });
                      }}
                      className="absolute bottom-1 right-1 p-1 rounded bg-black/60 text-white hover:bg-black/80"
                      title="Ampliar"
                    >
                      <ZoomIn className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Lista de fotos seleccionadas para Anotar y Comentar */}
          {selectedImages.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-700/40">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Fotos seleccionadas ({selectedImages.length}) — Anotaciones y Comentarios
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedImages.map((imgId, idx) => {
                  const img = fotosMap.get(imgId) || { id: imgId, name: `Foto ${idx + 1}` };
                  const fallbackUrl = `${API_BASE_URL}/drive/imagen/${imgId}?token=${encodeURIComponent(activeToken || '')}`;
                  const thumbUrl = img.thumbnail || fallbackUrl;
                  const annsCount = annotationsMap[imgId]?.length || 0;

                  return (
                    <div
                      key={imgId}
                      className="flex items-start gap-2.5 p-2 rounded-xl border border-slate-700/40 bg-slate-900/30"
                    >
                      <img
                        src={thumbUrl}
                        alt={img.name}
                        onError={(e) => {
                          if (e.currentTarget.src !== fallbackUrl) {
                            e.currentTarget.src = fallbackUrl;
                          }
                        }}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold truncate">{img.name}</span>
                          <button
                            type="button"
                            onClick={() => setAnnotatingImage(img)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 text-[10px] font-bold shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                            Anotar {annsCount > 0 ? `(${annsCount})` : ''}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={commentsMap[imgId] || ''}
                            onChange={(e) => setCommentsMap((prev) => ({ ...prev, [imgId]: e.target.value }))}
                            onBlur={() => handleCommentBlur(imgId)}
                            placeholder="Comentario sobre esta foto para Gemini..."
                            className="w-full px-2 py-1 rounded-lg border text-xs"
                          />
                          <VoiceDictationButton
                            onTranscript={(txt) =>
                              setCommentsMap((prev) => ({
                                ...prev,
                                [imgId]: prev[imgId] ? `${prev[imgId]} ${txt}` : txt
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Indicaciones adicionales de campo */}
          <div className="pt-2 border-t border-slate-700/40 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Notas e Indicaciones de Campo para Gemini
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setIndicacionesPrevias((p) => (p ? `${p} ${txt}` : txt))}
              />
            </div>
            <textarea
              rows={2}
              value={indicacionesPrevias}
              onChange={(e) => setIndicacionesPrevias(e.target.value)}
              placeholder="Ej: Se observó vibración en brida de succión, comparar corrosión respecto a 2024..."
              className="w-full px-3 py-2 rounded-xl border text-xs resize-none"
            />
          </div>

          <button
            type="button"
            onClick={handleAnalyzeWithGemini}
            disabled={isAnalyzing || selectedImages.length === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Sparkles className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            {isAnalyzing
              ? 'Analizando fotos y contexto con Gemini...'
              : `Ejecutar Evaluación con Gemini IA (${selectedImages.length} fotos)`}
          </button>
        </div>

        {/* ============================================================== */}
        {/* COLUMNA DERECHA (6 cols): REVISIÓN DEL INSPECTOR Y GUARDADO     */}
        {/* ============================================================== */}
        <div className={`lg:col-span-6 rounded-2xl border p-4 space-y-4 ${cardCls}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/40 pb-3">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                2. Revisión del Inspector y Guardado Final
              </h3>
              <p className="text-[11px] text-slate-400">
                Editá o validá los campos cargados por Gemini antes de guardar.
              </p>
            </div>
            {iaDraftLoaded && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-bold inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Borrador IA cargado
              </span>
            )}
          </div>

          {/* Estado */}
          <div>
            <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Estado del Equipo
            </label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border text-xs font-bold"
            >
              <option value="BUENO">BUENO (Apto para operar)</option>
              <option value="REGULAR">REGULAR (Bajo Observación)</option>
              <option value="CRITICO">CRÍTICO (Reparación Urgente)</option>
              <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            </select>
          </div>

          {/* Acciones */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Acciones Realizadas
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setAcciones((p) => (p ? `${p} ${txt}` : txt))}
              />
            </div>
            <textarea
              rows={2}
              value={acciones}
              onChange={(e) => setAcciones(e.target.value)}
              placeholder="Ej: Se realizó inspección visual externa e interna del equipo..."
              className="w-full px-3 py-2 rounded-xl border text-xs"
            />
          </div>

          {/* Diagnóstico */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Diagnóstico Técnico
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setDiagnostico((p) => (p ? `${p} ${txt}` : txt))}
              />
            </div>
            <textarea
              rows={5}
              value={diagnostico}
              onChange={(e) => setDiagnostico(e.target.value)}
              placeholder="Diagnóstico técnico de la condición del equipo..."
              className="w-full px-3 py-2 rounded-xl border text-xs"
            />
          </div>

          {/* Recomendaciones */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Recomendaciones
              </label>
              <VoiceDictationButton
                onTranscript={(txt) => setRecomendaciones((p) => (p ? `${p} ${txt}` : txt))}
              />
            </div>
            <textarea
              rows={5}
              value={recomendaciones}
              onChange={(e) => setRecomendaciones(e.target.value)}
              placeholder="Recomendaciones técnicas y plazos..."
              className="w-full px-3 py-2 rounded-xl border text-xs"
            />
          </div>

          {/* Refinamiento rápido con Gemini si hay sesión activa */}
          {sessionId && (
            <form onSubmit={handleRefineDraft} className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={refineMsg}
                onChange={(e) => setRefineMsg(e.target.value)}
                placeholder="Pedile a Gemini un ajuste (ej: 'Agregá reemplazo de bulones en 6 meses')..."
                className="flex-1 px-3 py-1.5 rounded-xl border text-xs"
              />
              <button
                type="submit"
                disabled={refining || !refineMsg.trim()}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-bold inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                {refining ? 'Ajustando...' : 'Ajustar IA'}
              </button>
            </form>
          )}

          {/* Lección aprendida opcional */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Criterio / Lección Aprendida (opcional, para futuros análisis)
            </label>
            <input
              type="text"
              value={leccionAprendida}
              onChange={(e) => setLeccionAprendida(e.target.value)}
              placeholder="Ej: En tanques FRP de ácido, priorizar revisión de brida de fondo..."
              className="w-full px-3 py-1.5 rounded-xl border text-xs"
            />
          </div>

          {/* Guardado Final */}
          <div className="pt-2 border-t border-slate-700/40 space-y-3">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={generarPdf}
                onChange={(e) => setGenerarPdf(e.target.checked)}
                className="rounded"
              />
              <span>Generar Acta PDF y subir a Drive al guardar</span>
            </label>

            <button
              type="button"
              onClick={handleSaveFinal}
              disabled={isSaving}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Guardando inspección...' : 'Guardar Inspección Final'}
            </button>

            {/* Estado post-guardado del PDF */}
            {reportStatus === 'generando' && (
              <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-300 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Generando Acta PDF en segundo plano...
              </div>
            )}
            {reportStatus === 'completado' && (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Acta PDF lista {reportData?.numero_acta ? `(${reportData.numero_acta})` : ''}
                </span>
                <div className="flex items-center gap-2">
                  {reportData?.drive_url && (
                    <a
                      href={reportData.drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline font-bold"
                    >
                      Drive <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    onClick={onGoToReportes}
                    className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold inline-flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" /> Ver en Reportes
                  </button>
                </div>
              </div>
            )}
            {reportStatus === 'error' && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                La inspección se guardó, pero hubo un problema al generar el PDF. Podés reintentarlo desde Reportes.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Anotaciones sobre imagen */}
      {annotatingImage && (
        <AnnotationModal
          image={annotatingImage}
          token={activeToken}
          equipoId={equipoId}
          onClose={() => setAnnotatingImage(null)}
          onSave={(savedAnns, savedComment) => {
            setAnnotationsMap((prev) => ({ ...prev, [annotatingImage.id]: savedAnns || [] }));
            if (savedComment !== undefined) {
              setCommentsMap((prev) => ({ ...prev, [annotatingImage.id]: savedComment }));
            }
            setAnnotatingImage(null);
            toast.success('Anotaciones guardadas en la imagen.');
          }}
        />
      )}

      {/* Modal de Vista Ampliada */}
      {previewImage && (
        <ImageViewerModal
          image={previewImage}
          images={fotosCampania}
          token={activeToken}
          onClose={() => setPreviewImage(null)}
          isSelected={selectedImages.includes(previewImage.id)}
          onSelectImage={(img) => toggleSelectImage(img.id || img)}
          onOpenAnnotator={(img) => {
            setPreviewImage(null);
            setAnnotatingImage(img);
          }}
        />
      )}

      {/* Copiloto Técnico del Equipo */}
      {showCopilot && equipo && (
        <EquipoCopilotDrawer
          isOpen={showCopilot}
          onClose={() => setShowCopilot(false)}
          equipo={equipo}
          onApplyDiagnostico={(txt) => setDiagnostico(txt)}
          onApplyRecomendaciones={(txt) => setRecomendaciones(txt)}
        />
      )}
    </div>
  );
}

