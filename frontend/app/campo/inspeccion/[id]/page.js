'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, CheckCircle2, ArrowRight, Search, FileText, AlertTriangle, User, History } from 'lucide-react';
import { db } from '../../../../utils/db';
import { apiService } from '../../../../services/api';
import { useOnlineStatus } from '../../../../hooks/useOnlineStatus';
import { SelectorEstadoHealth } from '../../../../components/campo/BotonEstado';
import { CapturaFoto } from '../../../../components/campo/CapturaFoto';
import { GrabadoraAudio } from '../../../../components/campo/GrabadoraAudio';
import { BadgeEstadoSync } from '../../../../components/campo/BadgeEstadoSync';
import { HistorialActivoModal } from '../../../../components/campo/HistorialActivoModal';
import { vibrar, vibrarExito, vibrarError } from '../../../../utils/haptics';

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

  useEffect(() => {
    let active = true;

    async function initInspeccionBorrador() {
      try {
        const user = apiService.getCurrentUser();
        if (user && active) setUsuarioActual(user);

        const eqData = await db.equipos_cache.get(idActivo);
        if (eqData && active) {
          setCodigoActivo(eqData.codigo || `EQ-${idActivo}`);
          setNombreActivo(eqData.nombre || 'Equipo Industrial');
        }

        let borrador = await db.inspecciones_pendientes
          .where({ id_activo: idActivo, estado_sync: 'borrador' })
          .first();

        if (!borrador) {
          const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `uuid-${Date.now()}-${Math.random()}`;
          const newId = await db.inspecciones_pendientes.add({
            client_uuid: uuid,
            id_activo: idActivo,
            codigo_activo: eqData?.codigo || `EQ-${idActivo}`,
            usuario_inspector: user?.username || user?.nombre_completo || 'Inspector',
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
      if (inspeccionId) {
        await db.inspecciones_pendientes.update(inspeccionId, {
          estado: estadoSalud,
          categoria_foto: categoriaFoto,
          notas: notasTexto,
          usuario_inspector: usuarioActual?.username || usuarioActual?.nombre_completo || 'Inspector',
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
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 flex flex-col justify-between">
      <div>
        <BadgeEstadoSync
          isOnline={isOnline}
          pendingCount={pendingCount}
          errorCount={errorCount}
          draftCount={draftCount}
          forceSync={forceSync}
          retryErrors={retryErrors}
        />

        <main className="max-w-md w-full mx-auto p-4 space-y-5">
          {/* Header con Botón de Historial Anterior */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3">
            <button
              type="button"
              onClick={() => {
                vibrar(20);
                router.push('/campo');
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-2.5 rounded-xl border border-slate-700 active:scale-95 flex items-center gap-1.5 font-bold text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Home
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  vibrar(30);
                  setShowHistorialModal(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-sky-300 px-3 py-2 rounded-xl border-2 border-sky-500 font-black text-xs flex items-center gap-1.5 active:scale-95 shadow"
                style={{ backgroundColor: '#0f172a', borderColor: '#0284c7', color: '#38bdf8' }}
              >
                <History className="w-4 h-4" />
                <span>📜 HISTORIAL</span>
              </button>

              <div className="text-right">
                <span className="font-mono font-black text-sky-400 text-sm block" style={{ color: '#38bdf8' }}>{codigoActivo}</span>
                <span className="text-[10px] text-slate-400 font-semibold block">{nombreActivo}</span>
              </div>
            </div>
          </div>

          {errorValidacion && (
            <div className="bg-red-950 border-2 border-red-500 text-red-200 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorValidacion}</span>
            </div>
          )}

          <SelectorEstadoHealth
            estadoSeleccionado={estadoSalud}
            onSelectEstado={handleSelectEstado}
          />

          <CapturaFoto
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

          <GrabadoraAudio
            audios={audios}
            onAddAudio={handleAddAudio}
            onDeleteAudio={handleDeleteAudio}
            isOnline={isOnline}
          />

          <div className="space-y-2 bg-slate-900 p-4 rounded-2xl border-2 border-slate-800">
            <label htmlFor="notas-campo" className="text-xl font-black text-slate-100 uppercase flex items-center gap-2" style={{ color: '#ffffff' }}>
              <FileText className="w-6 h-6 text-sky-400" style={{ color: '#38bdf8' }} />
              Observaciones / Notas
            </label>
            <textarea
              id="notas-campo"
              rows={3}
              value={notasTexto}
              onChange={handleNotasChange}
              placeholder="Escriba o use el dictado de voz del teclado..."
              className="input-campo text-lg"
            />
            {notasTexto && (
              <button
                type="button"
                onClick={() => handleNotasChange({ target: { value: '' } })}
                className="text-xs text-slate-400 font-bold uppercase underline hover:text-white"
              >
                Limpiar notas
              </button>
            )}
          </div>
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 border-t-3 border-slate-800 backdrop-blur-md z-40" style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)' }}>
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleGuardarYContinuar}
            disabled={isGuardando}
            className={`
              w-full min-h-[72px] py-4 px-6 rounded-2xl font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-3 transition-all duration-150 active:scale-95 shadow-2xl border-4
              ${
                isGuardando
                  ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 active:bg-emerald-700'
              }
            `}
            style={{ backgroundColor: isGuardando ? '#334155' : '#059669', color: '#ffffff' }}
          >
            <Save className="w-9 h-9 shrink-0" />
            <span>{isGuardando ? 'GUARDANDO...' : '💾 GUARDAR Y SIGUIENTE'}</span>
          </button>
        </div>
      </div>

      {mostrarModalConfirmacion && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="bg-slate-900 border-4 border-emerald-500 max-w-sm w-full p-6 rounded-3xl space-y-5 text-center shadow-2xl animate-in fade-in zoom-in duration-200" style={{ backgroundColor: '#0f172a', borderColor: '#10b981' }}>
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" style={{ color: '#34d399' }} />
            <div>
              <h3 className="text-3xl font-black text-white m-0" style={{ color: '#ffffff' }}>✅ ¡Guardado!</h3>
              <p className="text-sm font-bold mt-1" style={{ color: '#cbd5e1' }}>
                {isOnline
                  ? '🔄 Sincronizando con el servidor...'
                  : '⏳ Guardado localmente en el celular (pendiente de subir).'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleNavegarSiguiente}
                className="w-full min-h-[60px] bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xl py-3 px-4 rounded-2xl border-2 border-emerald-400 flex items-center justify-center gap-2 shadow-lg active:scale-95"
                style={{ backgroundColor: '#059669', color: '#ffffff' }}
              >
                <span>➡️ SIGUIENTE EQUIPO</span>
                <ArrowRight className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => {
                  vibrar(20);
                  router.push('/campo');
                }}
                className="w-full min-h-[56px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-black text-lg py-3 px-4 rounded-2xl border-2 border-slate-600 flex items-center justify-center gap-2 active:scale-95"
              >
                <Search className="w-5 h-5" />
                <span>🔍 BUSCAR OTRO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Desplegable de Historial */}
      <HistorialActivoModal
        equipoId={idActivo}
        codigoActivo={codigoActivo}
        nombreActivo={nombreActivo}
        isOpen={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
      />
    </div>
  );
}

export default function ModoCapturaInspeccionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center font-bold">Cargando inspección...</div>}>
      <ModoCapturaInspeccionContent />
    </Suspense>
  );
}
