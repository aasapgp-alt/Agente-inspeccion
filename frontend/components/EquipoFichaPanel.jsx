'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { API_BASE_URL, apiService, getCachedEvidencia, setCachedEvidencia } from '../services/api';
import ImageViewerModal from './ImageViewerModal';
import {
  Cpu,
  Sparkles,
  FileDown,
  Calendar,
  MapPin,
  FolderOpen,
  FileText,
  Camera,
  Edit3,
  Check,
  X,
  AlertCircle,
  ZoomIn,
  Layers
} from 'lucide-react';

function renderFormattedField(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return renderFormattedField(parsed);
      } catch {
        return <p className="whitespace-pre-line text-xs leading-relaxed">{val}</p>;
      }
    }
    return <p className="whitespace-pre-line text-xs leading-relaxed">{val}</p>;
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return (
        <ul className="list-disc pl-4 space-y-1 text-xs">
          {val.map((item, idx) => (
            <li key={idx}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-1.5 text-xs">
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="rounded-lg p-2 bg-slate-800/30 border border-slate-700/30">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400 mb-0.5">{k}</div>
            <div className="leading-relaxed opacity-90">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <p className="text-xs">{String(val)}</p>;
}

function getEstadoBadge(estadoRaw) {
  const est = (estadoRaw || 'PENDIENTE').toUpperCase();
  if (est.includes('CRIT')) return { label: 'CRÍTICO', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  if (est.includes('REGULAR')) return { label: 'OBSERVADO', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (est.includes('BUEN')) return { label: 'BUENO', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (est.includes('FUERA')) return { label: 'FUERA DE RUTA', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  return { label: 'PENDIENTE', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' };
}

export default function EquipoFichaPanel({
  equipoId,
  isLight,
  onOpenPicker,
  onGoToAnalysis,
  onEquipoUpdated
}) {
  const { user, token } = useAuth();
  const toast = useToast();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');

  const [loading, setLoading] = useState(false);
  const [ficha, setFicha] = useState(null);
  const [selectedAnio, setSelectedAnio] = useState(null);
  const [evidencia, setEvidencia] = useState(null);
  const [loadingEvidencia, setLoadingEvidencia] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Edición rápida de ficha técnica (solo supervisor/admin)
  const canEditTech = user?.rol === 'admin' || user?.rol === 'supervisor';
  const [editingTech, setEditingTech] = useState(false);
  const [techForm, setTechForm] = useState({
    material: '',
    fluido: '',
    presion_diseno: '',
    temperatura_diseno: ''
  });
  const [savingTech, setSavingTech] = useState(false);

  // Cargar ficha consolidada + evidencia de Drive
  useEffect(() => {
    if (!equipoId || !activeToken) {
      setFicha(null);
      setEvidencia(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setEditingTech(false);

    apiService.getEquipoFicha(equipoId, activeToken).then((data) => {
      if (cancelled) return;
      setFicha(data);
      if (data?.equipo) {
        setTechForm({
          material: data.equipo.material || '',
          fluido: data.equipo.fluido || '',
          presion_diseno: data.equipo.presion_diseno ?? '',
          temperatura_diseno: data.equipo.temperatura_diseno ?? ''
        });
      }
      if (data?.ultima_inspeccion?.anio) {
        setSelectedAnio(data.ultima_inspeccion.anio);
      } else if (data?.anios_disponibles?.length > 0) {
        setSelectedAnio(data.anios_disponibles[0]);
      } else {
        setSelectedAnio(null);
      }
      setLoading(false);
    });

    // Evidencia con caché
    const cached = getCachedEvidencia(equipoId);
    if (cached) {
      setEvidencia(cached);
    } else {
      setLoadingEvidencia(true);
      fetch(`${API_BASE_URL}/drive/equipo/${equipoId}/evidencia?campania=PGP%202026`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((ev) => {
          if (cancelled || !ev) return;
          setEvidencia(ev);
          setCachedEvidencia(equipoId, ev);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoadingEvidencia(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [equipoId, activeToken]);

  const inspeccionActiva = useMemo(() => {
    if (!ficha?.inspecciones || ficha.inspecciones.length === 0) return null;
    if (selectedAnio) {
      return ficha.inspecciones.find((i) => Number(i.anio) === Number(selectedAnio)) || ficha.inspecciones[0];
    }
    return ficha.ultima_inspeccion || ficha.inspecciones[0];
  }, [ficha, selectedAnio]);

  // Fotos asociadas a la inspección mostrada o disponibles en Drive
  const fotosAMostrar = useMemo(() => {
    if (!evidencia) return [];
    const anio = inspeccionActiva?.anio;
    // Si tiene IDs guardados en esa inspección y coinciden con fotos de Drive
    const savedIds = Array.isArray(inspeccionActiva?.image_drive_ids)
      ? inspeccionActiva.image_drive_ids
      : [];

    const allCampania = evidencia.fotos_campania || [];
    const allHistorico = evidencia.fotos_historico ? Object.values(evidencia.fotos_historico).flat() : [];
    const allMap = new Map();
    [...allCampania, ...allHistorico].forEach((f) => {
      if (f?.id) allMap.set(f.id, f);
    });

    if (savedIds.length > 0) {
      const matched = savedIds.map((id) => allMap.get(id) || { id, name: `Foto ${id.slice(0, 6)}` });
      if (matched.length > 0) return matched;
    }

    if (anio && evidencia.fotos_historico && evidencia.fotos_historico[String(anio)]?.length > 0) {
      return evidencia.fotos_historico[String(anio)];
    }

    if (allCampania.length > 0) return allCampania;
    return allHistorico;
  }, [evidencia, inspeccionActiva]);

  const documentosTecnicos = useMemo(() => {
    return evidencia?.documentacion_tecnica || evidencia?.planos || [];
  }, [evidencia]);

  const driveFolderId = eq?.drive_folder_id || evidencia?.equipo?.drive_folder_id;

  const handleSaveTech = async () => {
    if (!equipoId) return;
    setSavingTech(true);
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/${equipoId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          material: techForm.material,
          fluido: techForm.fluido,
          presion_diseno: parseFloat(techForm.presion_diseno) || 0,
          temperatura_diseno: parseFloat(techForm.temperatura_diseno) || 0
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setFicha((prev) => (prev ? { ...prev, equipo: { ...prev.equipo, ...updated } } : prev));
        setEditingTech(false);
        toast.success('Datos técnicos del equipo actualizados.');
        if (onEquipoUpdated) onEquipoUpdated();
      } else {
        toast.error('No se pudieron actualizar los datos técnicos.');
      }
    } catch {
      toast.error('Error de red al guardar los datos técnicos.');
    } finally {
      setSavingTech(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!equipoId) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reportes/equipo/${equipoId}/pdf`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!res.ok) {
        toast.warning('Este equipo aún no tiene un PDF generado. Podés generarlo desde Análisis y Revisión.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Informe_${ficha?.equipo?.codigo || equipoId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error descargando el PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (!equipoId) {
    return (
      <div
        className={`rounded-2xl border p-12 text-center ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800'
        }`}
      >
        <Cpu className="w-12 h-12 mx-auto mb-3 text-sky-500 opacity-80" />
        <h2 className="text-lg font-extrabold mb-1">Elegí un equipo para ver su Ficha</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
          Acá vas a ver en una sola pantalla los datos técnicos, la última inspección registrada (de cualquier año) y las fotos de Drive.
        </p>
        <button
          onClick={onOpenPicker}
          className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
        >
          Seleccionar Equipo
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-pulse">
        <div className="lg:col-span-12 h-24 rounded-2xl bg-slate-800/40" />
        <div className="lg:col-span-4 h-96 rounded-2xl bg-slate-800/40" />
        <div className="lg:col-span-4 h-96 rounded-2xl bg-slate-800/40" />
        <div className="lg:col-span-4 h-96 rounded-2xl bg-slate-800/40" />
      </div>
    );
  }

  const eq = ficha?.equipo;
  if (!eq) {
    return (
      <div className="rounded-2xl border border-rose-500/30 p-8 text-center text-xs text-rose-400">
        No se pudo cargar la ficha del equipo #{equipoId}.
      </div>
    );
  }

  const badge = getEstadoBadge(inspeccionActiva?.estado || eq.estado_actual);
  const aniosDisponibles = ficha?.anios_disponibles || [];
  const cardCls = isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800/90';

  return (
    <div className="space-y-4">
      {/* ================================================================ */}
      {/* CABECERA COMPACTA DEL EQUIPO                                     */}
      {/* ================================================================ */}
      <div className={`rounded-2xl border p-4 flex flex-wrap items-center justify-between gap-3 ${cardCls}`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono text-xs font-extrabold">
              TAG: {eq.codigo || eq.numero || `#${eq.id}`}
            </span>
            <span className={`px-2 py-0.5 rounded-md border text-[11px] font-extrabold ${badge.cls}`}>
              {badge.label}
            </span>
            {inspeccionActiva ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-300 text-[11px] font-semibold">
                <Calendar className="w-3 h-3 text-sky-400" />
                Registro Año {inspeccionActiva.anio}
                {inspeccionActiva.numero_acta ? ` · Acta ${inspeccionActiva.numero_acta}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[11px] font-semibold">
                Sin inspecciones registradas
              </span>
            )}
          </div>

          <h2 className={`text-lg sm:text-xl font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {eq.nombre}
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-500" />
              {eq.empresa || 'Planta'} · {eq.area || 'Sin área'}
            </span>
            {eq.drive_folder_nombre && (
              <span className="inline-flex items-center gap-1">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                {eq.drive_folder_nombre}
              </span>
            )}
            {driveFolderId && (
              <a
                href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sky-400 hover:underline font-semibold"
              >
                Abrir carpeta Drive
              </a>
            )}
          </div>
        </div>

        {/* Controles: selector de año histórico + acciones */}
        <div className="flex items-center gap-2 flex-wrap">
          {aniosDisponibles.length > 1 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Año:</span>
              <select
                value={selectedAnio || ''}
                onChange={(e) => setSelectedAnio(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-xl border text-xs font-bold"
              >
                {aniosDisponibles.map((anio, idx) => (
                  <option key={anio} value={anio}>
                    {anio} {idx === 0 ? '(Última)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${
              isLight
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileDown className="w-3.5 h-3.5 text-sky-400" />
            {downloadingPdf ? 'Descargando...' : 'Último PDF'}
          </button>

          <button
            onClick={onGoToAnalysis}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Analizar / Nueva Revisión IA
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* GRID DE UNA SOLA PANTALLA (12 COLUMNAS: 4 + 4 + 4)               */}
      {/* ================================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* COLUMNA 1: DATOS TÉCNICOS Y PLANOS (4 cols) */}
        <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-4 ${cardCls}`}>
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-500" />
              Ficha Técnica del Equipo
            </h3>
            {canEditTech && !editingTech && (
              <button
                onClick={() => setEditingTech(true)}
                className="text-[11px] font-bold text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> Editar
              </button>
            )}
          </div>

          {editingTech ? (
            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Material</label>
                <input
                  type="text"
                  value={techForm.material}
                  onChange={(e) => setTechForm((p) => ({ ...p, material: e.target.value }))}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg border"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400">Fluido</label>
                <input
                  type="text"
                  value={techForm.fluido}
                  onChange={(e) => setTechForm((p) => ({ ...p, fluido: e.target.value }))}
                  className="w-full mt-1 px-2.5 py-1.5 rounded-lg border"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Presión Diseño</label>
                  <input
                    type="number"
                    step="0.1"
                    value={techForm.presion_diseno}
                    onChange={(e) => setTechForm((p) => ({ ...p, presion_diseno: e.target.value }))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-400">Temp. Diseño (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={techForm.temperatura_diseno}
                    onChange={(e) => setTechForm((p) => ({ ...p, temperatura_diseno: e.target.value }))}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-lg border"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditingTech(false)}
                  className="px-2.5 py-1 rounded-lg border border-slate-600 text-xs font-semibold inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Cancelar
                </button>
                <button
                  onClick={handleSaveTech}
                  disabled={savingTech}
                  className="px-3 py-1 rounded-lg bg-sky-600 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> {savingTech ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Material</div>
                <div className="font-bold mt-0.5">{eq.material || 'No especificado'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Fluido</div>
                <div className="font-bold mt-0.5">{eq.fluido || 'No especificado'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Presión Diseño</div>
                <div className="font-bold mt-0.5">{eq.presion_diseno ? `${eq.presion_diseno} bar` : '0 bar'}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="text-[10px] uppercase text-slate-400 font-bold">Temp. Diseño</div>
                <div className="font-bold mt-0.5">{eq.temperatura_diseno ? `${eq.temperatura_diseno} °C` : '0 °C'}</div>
              </div>
            </div>
          )}

          {/* Documentación Técnica / Planos de Drive */}
          <div className="pt-2 border-t border-slate-700/40">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Planos y Doc. Técnica ({documentosTecnicos.length})
              </h4>
              {driveFolderId && (
                <a
                  href={`https://drive.google.com/drive/folders/${driveFolderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-sky-400 hover:underline"
                >
                  Carpeta Drive
                </a>
              )}
            </div>
            {loadingEvidencia ? (
              <p className="text-xs text-slate-400">Cargando documentos de Drive...</p>
            ) : documentosTecnicos.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No hay planos o documentos técnicos en la carpeta Drive de esta UT.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {documentosTecnicos.map((doc) => {
                  const isImageDoc = (doc.mimeType || '').startsWith('image/');
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-700/40 hover:border-sky-500/50 text-xs transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {doc.es_plano && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 text-[9px] font-extrabold uppercase shrink-0">
                              Plano
                            </span>
                          )}
                          <span className="truncate font-medium" title={doc.name}>{doc.name}</span>
                        </div>
                        {doc.sub_ubicacion && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5">{doc.sub_ubicacion}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isImageDoc && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                ...doc,
                                url: `${API_BASE_URL}/drive/imagen/${doc.id}?token=${activeToken}`
                              })
                            }
                            className="text-[10px] font-bold text-emerald-400 hover:underline"
                          >
                            Ver
                          </button>
                        )}
                        <a
                          href={doc.webViewLink || `https://drive.google.com/file/d/${doc.id}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-sky-400 font-bold hover:underline"
                        >
                          Drive
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUMNA 2: ÚLTIMA INSPECCIÓN REGISTRADA (4 cols) */}
        <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-3.5 ${cardCls}`}>
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-500" />
              {inspeccionActiva ? `Inspección ${inspeccionActiva.anio}` : 'Última Inspección'}
            </h3>
            {inspeccionActiva?.updated_at && (
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(inspeccionActiva.updated_at).toLocaleDateString('es-AR')}
              </span>
            )}
          </div>

          {!inspeccionActiva ? (
            <div className="py-10 text-center space-y-3">
              <AlertCircle className="w-9 h-9 mx-auto text-amber-400 opacity-80" />
              <div className="text-sm font-bold">Sin registros históricos</div>
              <p className="text-xs text-slate-400">
                Este equipo todavía no tiene ninguna inspección guardada en ningún año.
              </p>
              <button
                onClick={onGoToAnalysis}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Realizar Primera Inspección
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[490px] overflow-y-auto pr-1">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 mb-1">
                  Acciones Realizadas
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  {renderFormattedField(inspeccionActiva.acciones) || (
                    <span className="text-xs text-slate-500 italic">Sin acciones registradas.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 mb-1">
                  Diagnóstico Técnico
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  {renderFormattedField(inspeccionActiva.diagnostico) || (
                    <span className="text-xs text-slate-500 italic">Sin diagnóstico registrado.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-sky-400 mb-1">
                  Recomendaciones
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800/30 border border-slate-700/30">
                  {renderFormattedField(inspeccionActiva.recomendaciones) || (
                    <span className="text-xs text-slate-500 italic">Sin recomendaciones registradas.</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA 3: EVIDENCIA FOTOGRÁFICA (4 cols) */}
        <div className={`lg:col-span-4 rounded-2xl border p-4 space-y-3 ${cardCls}`}>
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-sky-500" />
              Evidencia Fotográfica ({fotosAMostrar.length})
            </h3>
            {ficha?.anotaciones_count > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 font-bold">
                {ficha.anotaciones_count} anotación(es)
              </span>
            )}
          </div>

          {loadingEvidencia ? (
            <div className="py-12 text-center text-xs text-slate-400">Cargando fotos desde Drive...</div>
          ) : fotosAMostrar.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Camera className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
              <p className="text-xs text-slate-400">No hay fotos registradas para esta inspección.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2.5 max-h-[490px] overflow-y-auto pr-1">
              {fotosAMostrar.map((img) => {
                const fallbackUrl = `${API_BASE_URL}/drive/imagen/${img.id}?token=${encodeURIComponent(activeToken || '')}`;
                const thumbUrl = img.thumbnail || fallbackUrl;
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setPreviewImage({ ...img, url: fallbackUrl })}
                    className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-700/50 bg-slate-900 text-left"
                  >
                    <img
                      src={thumbUrl}
                      alt={img.name || 'Evidencia'}
                      loading="lazy"
                      onError={(e) => {
                        if (e.currentTarget.src !== fallbackUrl) {
                          e.currentTarget.src = fallbackUrl;
                        }
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5">
                      <div className="text-[10px] text-white truncate font-medium">{img.name}</div>
                    </div>
                    <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Vista Ampliada */}
      {previewImage && (
        <ImageViewerModal
          image={previewImage}
          images={fotosAMostrar}
          token={activeToken}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
