'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { FolderOpen, AlertTriangle, Folder, Edit3 } from 'lucide-react';
import { db } from '../../../../utils/db';
import { apiService } from '../../../../services/api';
import { useOnlineStatus } from '../../../../hooks/useOnlineStatus';
import { vibrar, vibrarExito, vibrarError } from '../../../../utils/haptics';
import { autoVincularCarpetaDrive } from '../../../../utils/driveAutoSelect';
import { DriveMobile } from '../../../../components/campo/drive/DriveMobile';

import { CampoShell } from '../../../../components/campo/layout/CampoShell';
import { CampoStatusBar } from '../../../../components/campo/layout/CampoStatusBar';
import { EquipoHeader } from '../../../../components/campo/inspeccion/EquipoHeader';
import { EstadoEquipo } from '../../../../components/campo/inspeccion/EstadoEquipo';
import { EvidenciaFotos } from '../../../../components/campo/inspeccion/EvidenciaFotos';
import { EvidenciaAudio } from '../../../../components/campo/inspeccion/EvidenciaAudio';
import { Observaciones } from '../../../../components/campo/inspeccion/Observaciones';
import { GuardarSiguiente } from '../../../../components/campo/inspeccion/GuardarSiguiente';
import { CampoBottomNav } from '../../../../components/campo/navegacion/CampoBottomNav';
import { HistorialActivoModal } from '../../../../components/campo/shared/HistorialActivoModal';

function ModoCapturaInspeccionContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const idActivo = Number(params.id);
  const fuente = searchParams.get('fuente') || 'busqueda';
  const ordenActual = searchParams.get('orden') ? Number(searchParams.get('orden')) : null;

  const { isOnline, pendingCount, errorCount, draftCount, forceSync, retryErrors } = useOnlineStatus();

  const [inspeccionId, setInspeccionId] = useState(null);
  const [clientUuid, setClientUuid] = useState(null);
  const [codigoActivo, setCodigoActivo] = useState(`EQ-${idActivo}`);
  const [nombreActivo, setNombreActivo] = useState('Cargando...');
  const [usuarioActual, setUsuarioActual] = useState(null);

  const [driveFolder, setDriveFolder] = useState({ id: '', title: '' });
  const [isAutoMatchingDrive, setIsAutoMatchingDrive] = useState(false);
  const [showDriveDrawer, setShowDriveDrawer] = useState(false);

  const [activeTab, setActiveTab] = useState('INSPECCION'); // INSPECCION | HISTORIAL | ARCHIVOS
  const [estadoSalud, setEstadoSalud] = useState('BUENO');
  const [categoriaFoto, setCategoriaFoto] = useState('General');
  const [notasTexto, setNotasTexto] = useState('');
  const [fotos, setFotos] = useState([]);
  const [audios, setAudios] = useState([]);

  const [isGuardando, setIsGuardando] = useState(false);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [siguienteEquipoId, setSiguienteEquipoId] = useState(null);
  const [errorValidacion, setErrorValidacion] = useState('');
  const [isEscuchandoDictado, setIsEscuchandoDictado] = useState(false);

  useEffect(() => {
    let active = true;

    async function initInspeccionBorrador() {
      try {
        const user = apiService.getCurrentUser();
        if (user && active) setUsuarioActual(user);

        const eqData = await db.equipos_cache.get(idActivo);
        let currentCodigo = `EQ-${idActivo}`;
        let currentNombre = 'Equipo Industrial';

        if (eqData && active) {
          currentCodigo = eqData.codigo || `EQ-${idActivo}`;
          currentNombre = eqData.nombre || 'Equipo Industrial';
          setCodigoActivo(currentCodigo);
          setNombreActivo(currentNombre);
        } else if (active && idActivo === 107) {
          currentCodigo = '107';
          currentNombre = 'VENTILADOR 431-506';
          setCodigoActivo(currentCodigo);
          setNombreActivo(currentNombre);
        }

        // Auto-vincular carpeta de Drive para el equipo seleccionado
        setIsAutoMatchingDrive(true);
        const equipoObj = eqData || { id: idActivo, codigo: currentCodigo, nombre: currentNombre };
        const matchedFolder = await autoVincularCarpetaDrive(equipoObj, apiService.getToken());

        if (matchedFolder && active) {
          setDriveFolder({ id: matchedFolder.id, title: matchedFolder.title });
        } else if (active) {
          const fId = localStorage.getItem('campo_drive_folder_id') || '';
          const fTitle = localStorage.getItem('campo_drive_folder_title') || 'Raíz de Drive';
          setDriveFolder({ id: fId, title: fTitle });
        }
        if (active) setIsAutoMatchingDrive(false);

        let borrador = await db.inspecciones_pendientes
          .where({ id_activo: idActivo, estado_sync: 'borrador' })
          .first();

        if (!borrador) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;
          const newId = await db.inspecciones_pendientes.add({
            client_uuid: uuid,
            id_activo: idActivo,
            codigo_activo: currentCodigo,
            usuario_inspector: user?.username || user?.nombre_completo || 'Diego A Cristaldo',
            estado: 'BUENO',
            categoria_foto: 'General',
            notas: '',
            timestamp: Date.now(),
            sincronizado: false,
            estado_sync: 'borrador'
          });

          if (active) {
            setInspeccionId(newId);
            setClientUuid(uuid);
          }
        } else if (active) {
          setInspeccionId(borrador.id);
          setClientUuid(borrador.client_uuid);
          setEstadoSalud(borrador.estado || 'BUENO');
          setCategoriaFoto(borrador.categoria_foto || 'General');
          setNotasTexto(borrador.notas || '');

          const archivosBorrador = await db.archivos_pendientes
            .where('inspeccion_id')
            .equals(borrador.id)
            .toArray();

          const fotosCargadas = archivosBorrador
            .filter((a) => a.tipo === 'foto')
            .map((a) => ({ id: a.id, blob: a.blob, categoria: a.categoria || 'General' }));

          const audiosCargados = archivosBorrador
            .filter((a) => a.tipo === 'audio')
            .map((a) => ({ id: a.id, blob: a.blob, timestamp: a.timestamp }));

          setFotos(fotosCargadas);
          setAudios(audiosCargados);
        }

        if (fuente === 'itinerario' && ordenActual) {
          const nextItem = await db.itinerario_cache.where('orden').equals(ordenActual + 1).first();
          if (nextItem && active) {
            setSiguienteEquipoId(nextItem.activo_id);
          }
        }
      } catch (err) {
        console.error('[ModoCaptura] Error inicializando borrador:', err);
      }
    }

    initInspeccionBorrador();

    return () => {
      active = false;
    };
  }, [idActivo, fuente, ordenActual]);

  const handleSelectEstado = async (nuevoEstado) => {
    setEstadoSalud(nuevoEstado);
    setErrorValidacion('');
    if (inspeccionId) {
      await db.inspecciones_pendientes.update(inspeccionId, { estado: nuevoEstado });
    }
  };

  const handleNotasChange = async (e) => {
    const texto = e.target.value;
    setNotasTexto(texto);
    if (inspeccionId) {
      await db.inspecciones_pendientes.update(inspeccionId, { notas: texto });
    }
  };

  const handleToggleDictadoVoz = () => {
    vibrar(25);
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Dictado por voz no soportado en este navegador.');
      return;
    }

    if (isEscuchandoDictado) {
      setIsEscuchandoDictado(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsEscuchandoDictado(true);
      recognition.onend = () => setIsEscuchandoDictado(false);
      recognition.onerror = () => setIsEscuchandoDictado(false);

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const nuevoTexto = notasTexto ? `${notasTexto} ${transcript}` : transcript;
          setNotasTexto(nuevoTexto);
          if (inspeccionId) {
            db.inspecciones_pendientes.update(inspeccionId, { notas: nuevoTexto });
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.error('Error starting dictation:', err);
      setIsEscuchandoDictado(false);
    }
  };

  const handleAddFoto = async (blob, categoria) => {
    if (!inspeccionId) return;
    const archId = await db.archivos_pendientes.add({
      inspeccion_id: inspeccionId,
      tipo: 'foto',
      blob,
      categoria: categoria || 'General',
      timestamp: Date.now()
    });
    setFotos((prev) => [...prev, { id: archId, blob, categoria: categoria || 'General' }]);
  };

  const handleDeleteFoto = async (index) => {
    const fotoItem = fotos[index];
    if (fotoItem && fotoItem.id) {
      await db.archivos_pendientes.delete(fotoItem.id);
    }
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAudio = async (blob) => {
    if (!inspeccionId) return;
    const archId = await db.archivos_pendientes.add({
      inspeccion_id: inspeccionId,
      tipo: 'audio',
      blob,
      timestamp: Date.now()
    });
    setAudios((prev) => [...prev, { id: archId, blob, timestamp: Date.now() }]);
  };

  const handleDeleteAudio = async (index) => {
    const audioItem = audios[index];
    if (audioItem && audioItem.id) {
      await db.archivos_pendientes.delete(audioItem.id);
    }
    setAudios((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGuardarYContinuar = async () => {
    vibrar(50);
    setErrorValidacion('');

    if (!estadoSalud) {
      vibrarError();
      setErrorValidacion('Debe seleccionar el estado de salud del equipo.');
      return;
    }

    setIsGuardando(true);

    try {
      const activeDriveFolderId = typeof window !== 'undefined' ? localStorage.getItem('campo_drive_folder_id') : null;

      if (inspeccionId) {
        await db.inspecciones_pendientes.update(inspeccionId, {
          estado: estadoSalud,
          categoria_foto: categoriaFoto,
          notas: notasTexto,
          drive_folder_id: activeDriveFolderId,
          usuario_inspector: usuarioActual?.username || usuarioActual?.nombre_completo || 'Diego A Cristaldo',
          timestamp: Date.now(),
          estado_sync: 'pendiente'
        });
      }

      vibrarExito();

      if (isOnline) {
        forceSync();
      }

      setMostrarModalConfirmacion(true);
    } catch (err) {
      console.error('[ModoCaptura] Error al guardar:', err);
      vibrarError();
      setErrorValidacion('Error al guardar inspección localmente.');
      setIsGuardando(false);
    }
  };

  const handleNavegarSiguiente = () => {
    vibrar(30);
    if (fuente === 'itinerario' && siguienteEquipoId) {
      router.push(`/campo/inspeccion/${siguienteEquipoId}?fuente=itinerario&orden=${(ordenActual || 1) + 1}`);
    } else {
      router.push('/campo');
    }
  };

  return (
    <CampoShell className="justify-between">
      <div>
        <CampoStatusBar
          isOnline={isOnline}
          pendingCount={pendingCount}
          errorCount={errorCount}
          draftCount={draftCount}
          forceSync={forceSync}
          retryErrors={retryErrors}
        />

        <main className="max-w-md w-full mx-auto px-3.5 py-2.5 space-y-3 pb-24">
          {/* Header de Inspección */}
          <EquipoHeader
            codigoActivo={codigoActivo}
            nombreActivo={nombreActivo}
            onVolver={() => router.push('/campo')}
            onOpenOptions={() => setShowHistorialModal(true)}
          />

          {/* Indicador de Carpeta Drive Vinculada con Botón Cambiar */}
          <div className="bg-[#131c2e] border border-slate-800/80 p-2.5 px-3 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <Folder className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Carpeta Drive:</span>
                  {isAutoMatchingDrive ? (
                    <span className="text-[10px] font-bold text-sky-400 animate-pulse">Buscando...</span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">Auto-ajustada</span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-100 truncate block">
                  {driveFolder.title || 'Raíz de Drive'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                vibrar(20);
                setShowDriveDrawer(true);
              }}
              className="px-2.5 py-1.5 bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-300 hover:text-white text-xs font-bold rounded-lg transition-all active:scale-95 shrink-0 flex items-center gap-1 ml-2"
              title="Seleccionar carpeta manualmente"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Cambiar</span>
            </button>
          </div>

          {/* Control Segmentado de Pestañas: INSPECCIÓN | HISTORIAL | ARCHIVOS */}
          <div className="bg-[#131c2e] p-1 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-black shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('INSPECCION')}
              className={`flex-1 py-2 px-2 text-center rounded-lg transition-all tracking-wider uppercase ${
                activeTab === 'INSPECCION'
                  ? 'bg-[#0284c7] text-white shadow-md shadow-sky-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              INSPECCIÓN
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('HISTORIAL');
                setShowHistorialModal(true);
              }}
              className={`flex-1 py-2 px-2 text-center rounded-lg transition-all tracking-wider uppercase ${
                activeTab === 'HISTORIAL'
                  ? 'bg-[#0284c7] text-white shadow-md shadow-sky-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              HISTORIAL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ARCHIVOS')}
              className={`flex-1 py-2 px-2 text-center rounded-lg transition-all tracking-wider uppercase ${
                activeTab === 'ARCHIVOS'
                  ? 'bg-[#0284c7] text-white shadow-md shadow-sky-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ARCHIVOS ({fotos.length + audios.length})
            </button>
          </div>

          {errorValidacion && (
            <div className="bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold p-3 rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorValidacion}</span>
            </div>
          )}

          {activeTab === 'INSPECCION' && (
            <div className="space-y-3 pt-0.5">
              {/* Opciones de Estado */}
              <EstadoEquipo
                estadoSeleccionado={estadoSalud}
                onSelectEstado={handleSelectEstado}
              />

              {/* Evidencia Fotográfica y Categoría */}
              <EvidenciaFotos
                fotos={fotos}
                onAddFoto={handleAddFoto}
                onDeleteFoto={handleDeleteFoto}
                isOnline={isOnline}
                categoriaSeleccionada={categoriaFoto}
                onSelectCategoria={(cat) => {
                  setCategoriaFoto(cat);
                  if (inspeccionId) {
                    db.inspecciones_pendientes.update(inspeccionId, { categoria_foto: cat });
                  }
                }}
              />

              {/* Nota de Voz / Audio */}
              <EvidenciaAudio
                audios={audios}
                onAddAudio={handleAddAudio}
                onDeleteAudio={handleDeleteAudio}
                isOnline={isOnline}
              />

              {/* Observaciones / Notas */}
              <Observaciones
                notasTexto={notasTexto}
                onNotasChange={handleNotasChange}
                isEscuchandoDictado={isEscuchandoDictado}
                onToggleDictadoVoz={handleToggleDictadoVoz}
                onClearNotas={() => handleNotasChange({ target: { value: '' } })}
              />

              {/* Botón Principal Guardar y Siguiente */}
              <GuardarSiguiente
                onGuardar={handleGuardarYContinuar}
                isGuardando={isGuardando}
                mostrarModalConfirmacion={mostrarModalConfirmacion}
                isOnline={isOnline}
                onNavegarSiguiente={handleNavegarSiguiente}
                onNavegarInicio={() => router.push('/campo')}
              />
            </div>
          )}

          {activeTab === 'ARCHIVOS' && (
            <div className="space-y-3 pt-2">
              <div className="bg-[#131c2e] border border-slate-800 p-4 rounded-2xl space-y-2 text-center shadow-md">
                <FolderOpen className="w-8 h-8 text-sky-400 mx-auto" />
                <h4 className="font-black text-xs text-white uppercase tracking-wide m-0">Archivos adjuntos ({fotos.length + audios.length})</h4>
                <p className="text-[11px] text-slate-400 m-0">
                  {fotos.length} fotos y {audios.length} audios vinculados a esta inspección.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Floating Bottom Navigation */}
      <CampoBottomNav
        onOpenMenu={() => router.push('/campo')}
        onOpenNuevo={() => router.push('/campo/buscar')}
      />

      {/* Modal Desplegable de Historial */}
      <HistorialActivoModal
        equipoId={idActivo}
        codigoActivo={codigoActivo}
        nombreActivo={nombreActivo}
        isOpen={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
      />

      {/* Drawer / Modal de Drive para Selección Manual */}
      {showDriveDrawer && (
        <div className="fixed inset-0 z-50 bg-[#090d16] md:bg-black/85 md:backdrop-blur-sm md:p-4 flex items-center justify-center">
          <div className="bg-[#090d16] border-0 md:border md:border-slate-800 w-full h-[100dvh] md:h-auto md:max-w-lg md:max-h-[90vh] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <DriveMobile
              token={apiService.getToken()}
              onSelectFolder={(id, title) => {
                setDriveFolder({ id, title });
                if (typeof window !== 'undefined') {
                  localStorage.setItem('campo_drive_folder_id', id);
                  localStorage.setItem('campo_drive_folder_title', title);
                }
              }}
              initialFolderId={driveFolder?.id || ''}
              onClose={() => setShowDriveDrawer(false)}
            />
          </div>
        </div>
      )}
    </CampoShell>
  );
}

export default function ModoCapturaInspeccionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center font-bold">Cargando inspección...</div>}>
      <ModoCapturaInspeccionContent />
    </Suspense>
  );
}
