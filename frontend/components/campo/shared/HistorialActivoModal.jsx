'use client';

import React, { useState, useEffect } from 'react';
import { History, X, CheckCircle2, AlertTriangle, AlertCircle, Slash, Calendar, User, FileText, ArrowLeft, RefreshCw } from 'lucide-react';
import { db } from '../../../utils/db';
import { apiService } from '../../../services/api';
import { vibrar } from '../../../utils/haptics';

export function HistorialActivoModal({ equipoId, codigoActivo, nombreActivo, isOpen, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !equipoId) return;

    let active = true;

    async function cargarHistorialCombinado() {
      setLoading(true);
      try {
        const idNum = Number(equipoId);

        // 1. Obtener inspecciones locales de hoy guardadas en IndexedDB
        const inspeccionesLocales = await db.inspecciones_pendientes
          .where('id_activo')
          .equals(idNum)
          .reverse()
          .toArray();

        const listaFormateadaLocales = inspeccionesLocales
          .filter((item) => item.estado_sync !== 'borrador')
          .map((item) => ({
            id: `local-${item.id}`,
            fecha: item.timestamp ? new Date(item.timestamp).toISOString() : new Date().toISOString(),
            estado: item.estado || 'BUENO',
            inspector: item.usuario_inspector || 'Inspector Local',
            observaciones: item.notas || 'Sin observaciones',
            hallazgos: item.estado_sync === 'pendiente' ? '⏳ Pendiente de subir al servidor' : '✅ Sincronizado'
          }));

        // 2. Obtener datos del equipo en caché local IndexedDB
        const eqCache = await db.equipos_cache.get(idNum);
        const listaEquipoCache = [];
        if (eqCache && (eqCache.diagnostico_reciente || eqCache.diagnostico || eqCache.estado_anterior)) {
          listaEquipoCache.push({
            id: `cache-eq-${eqCache.id}`,
            fecha: eqCache.fecha_ultima_inspeccion || eqCache.fecha || new Date().toISOString(),
            estado: eqCache.estado || eqCache.estado_anterior || eqCache.ultimo_estado || 'BUENO',
            inspector: eqCache.inspector || 'Campaña Anterior PGP',
            observaciones: eqCache.observaciones || eqCache.notas || 'Diagnóstico de la campaña anterior en planta.',
            hallazgos: eqCache.diagnostico_reciente || eqCache.diagnostico || eqCache.diagnostico_ia || ''
          });
        }

        // 3. Obtener historial previo guardado en IndexedDB
        const enCacheHist = await db.historial_cache
          .where('equipo_id')
          .equals(idNum)
          .reverse()
          .toArray();

        // Combinar datos locales iniciales
        let combinados = [...listaFormateadaLocales, ...listaEquipoCache, ...enCacheHist];
        
        // Eliminar duplicados por ID o fecha aproximada
        const unicosMap = new Map();
        combinados.forEach(item => unicosMap.set(item.id || item.fecha, item));
        let unicosList = Array.from(unicosMap.values());

        if (active) {
          setHistorial(unicosList);
          setLoading(false);
        }

        // 4. Si hay red, consultar el backend para obtener ficha completa del equipo e historial
        if (typeof window !== 'undefined' && navigator.onLine) {
          const eqRemote = await apiService.getEquipoById(idNum);
          const resRemote = await apiService.getHistorial(idNum);

          const remotosFormateados = [];

          // Extraer diagnóstico reciente del equipo remoto
          if (eqRemote && (eqRemote.diagnostico_reciente || eqRemote.diagnostico || eqRemote.ultimo_estado || eqRemote.estado)) {
            remotosFormateados.push({
              id: `remote-eq-${eqRemote.id}`,
              equipo_id: idNum,
              fecha: eqRemote.fecha_ultima_inspeccion || eqRemote.updated_at || eqRemote.fecha || new Date().toISOString(),
              estado: eqRemote.estado || eqRemote.ultimo_estado || eqRemote.estado_anterior || 'BUENO',
              inspector: eqRemote.inspector || 'Diagnóstico Oficial PGP',
              observaciones: eqRemote.observaciones || eqRemote.notas || 'Diagnóstico registrado en sistema.',
              hallazgos: eqRemote.diagnostico_reciente || eqRemote.diagnostico || eqRemote.diagnostico_ia || ''
            });
          }

          // Extraer lista de inspecciones históricas remotas
          if (Array.isArray(resRemote) && resRemote.length > 0) {
            resRemote.forEach((item, idx) => {
              remotosFormateados.push({
                id: item.id || `remote-${idx}`,
                equipo_id: idNum,
                fecha: item.created_at || item.fecha || item.timestamp || new Date().toISOString(),
                estado: item.estado || item.estado_salud || 'BUENO',
                inspector: item.inspector || item.usuario || item.usuario_inspector || 'Inspector PGP',
                observaciones: item.observaciones || item.notas || '',
                hallazgos: item.diagnostico || item.hallazgos || item.diagnostico_ia || '',
                acciones: item.acciones || '',
                recomendaciones: item.recomendaciones || '',
                numero_acta: item.numero_acta || '',
                anio: item.anio || ''
              });
            });
          }

          if (active && remotosFormateados.length > 0) {
            // Guardar remotos en IndexedDB
            await db.transaction('rw', db.historial_cache, async () => {
              await db.historial_cache.where('equipo_id').equals(idNum).delete();
              await db.historial_cache.bulkPut(remotosFormateados);
            });

            // Combinar inspecciones locales de hoy + remotas sin duplicados
            const finalMap = new Map();
            [...listaFormateadaLocales, ...remotosFormateados].forEach(item => finalMap.set(item.id || item.fecha, item));
            setHistorial(Array.from(finalMap.values()));
          }
        }
      } catch (e) {
        console.warn('[HistorialActivoModal] Error al combinar historial:', e);
      } finally {
        if (active) setLoading(false);
      }
    }

    cargarHistorialCombinado();

    return () => {
      active = false;
    };
  }, [isOpen, equipoId]);

  if (!isOpen) return null;

  const renderBadgeEstado = (estado) => {
    const st = (estado || '').toUpperCase();
    if (st.includes('CRIT') || st.includes('ROTO')) {
      return (
        <span className="bg-red-950 text-red-300 font-black px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> CRÍTICO
        </span>
      );
    }
    if (st.includes('REGULAR') || st.includes('ALERTA')) {
      return (
        <span className="bg-amber-950 text-amber-300 font-black px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-amber-600">
          <AlertTriangle className="w-3.5 h-3.5" /> REGULAR
        </span>
      );
    }
    if (st.includes('BUENO')) {
      return (
        <span className="bg-emerald-950 text-emerald-300 font-black px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" /> BUENO
        </span>
      );
    }
    return (
      <span className="bg-slate-800 text-slate-300 font-black px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 border border-slate-600">
        <Slash className="w-3.5 h-3.5" /> {estado || 'FUERA RUTA'}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md p-0 md:p-4 flex items-center justify-center animate-in fade-in duration-150">
      <div className="bg-[#090d16] border-0 md:border-2 md:border-sky-500 w-full h-[100dvh] md:h-auto md:max-w-4xl md:max-h-[92vh] md:rounded-3xl p-4 md:p-6 flex flex-col justify-between shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-950 border border-sky-700 flex items-center justify-center shrink-0">
              <History className="w-6 h-6 text-sky-400" />
            </div>
            <div>
              <span className="font-mono font-black text-sky-400 text-xs block">{codigoActivo} - {nombreActivo || 'Equipo'}</span>
              <h3 className="font-black text-lg md:text-xl text-white m-0 leading-tight">Historial Completo del Activo</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              vibrar(20);
              onClose();
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl border border-slate-700 active:scale-95 transition-all"
            aria-label="Cerrar modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Content - Lista de Inspecciones Anteriores con Scroll Desplazable */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
          {loading && historial.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <RefreshCw className="w-9 h-9 text-sky-400 mx-auto animate-spin" />
              <p className="text-sm font-bold text-slate-400 m-0">Cargando historial completo del equipo...</p>
            </div>
          ) : historial.length > 0 ? (
            historial.map((item, index) => (
              <div
                key={item.id || index}
                className="bg-slate-950/90 border border-slate-800 p-4 md:p-5 rounded-2xl space-y-3 shadow-md"
              >
                {/* Header de Ficha: Fecha, Acta y Badge Estado */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <Calendar className="w-4 h-4 text-sky-400" />
                      {new Date(item.fecha).toLocaleDateString()} {new Date(item.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.numero_acta && (
                      <span className="bg-slate-800 text-slate-300 font-mono text-[11px] px-2.5 py-0.5 rounded-md border border-slate-700">
                        Acta: {item.numero_acta}
                      </span>
                    )}
                  </div>
                  {renderBadgeEstado(item.estado)}
                </div>

                {/* Inspector */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                  <User className="w-4 h-4 text-amber-400" />
                  <span>Inspector: {item.inspector || 'Registrado en Planta'}</span>
                </div>

                {/* Observaciones de campo */}
                {item.observaciones && (
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 text-xs">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">Notas de Campo / Observación:</span>
                    <p className="text-slate-200 font-medium m-0 leading-relaxed">"{item.observaciones}"</p>
                  </div>
                )}

                {/* Diagnóstico */}
                {item.hallazgos && (
                  <div className="bg-sky-950/40 p-3.5 rounded-xl border border-sky-800/70 text-xs space-y-1.5">
                    <span className="font-extrabold text-sky-300 text-xs uppercase tracking-wide block border-b border-sky-800/60 pb-1 flex items-center gap-1.5">
                      🩺 Diagnóstico:
                    </span>
                    <p className="whitespace-pre-line text-xs sm:text-sm font-medium leading-relaxed text-sky-100 m-0">
                      {item.hallazgos}
                    </p>
                  </div>
                )}

                {/* Acciones Realizadas / Sugeridas */}
                {item.acciones && (
                  <div className="bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-800/60 text-xs space-y-1">
                    <span className="font-extrabold text-emerald-400 text-xs uppercase tracking-wide block border-b border-emerald-900/60 pb-1">
                      🛠️ Acciones Realizadas / Sugeridas:
                    </span>
                    <p className="whitespace-pre-line text-xs sm:text-sm font-medium leading-relaxed text-emerald-100 m-0">
                      {item.acciones}
                    </p>
                  </div>
                )}

                {/* Recomendaciones */}
                {item.recomendaciones && (
                  <div className="bg-amber-950/30 p-3.5 rounded-xl border border-amber-800/60 text-xs space-y-1">
                    <span className="font-extrabold text-amber-400 text-xs uppercase tracking-wide block border-b border-amber-900/60 pb-1">
                      💡 Recomendaciones:
                    </span>
                    <p className="whitespace-pre-line text-xs sm:text-sm font-medium leading-relaxed text-amber-100 m-0">
                      {item.recomendaciones}
                    </p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-slate-950 border-2 border-dashed border-slate-800 p-8 rounded-2xl text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="font-bold text-slate-300 m-0">Sin historial previo registrado</p>
              <p className="text-xs text-slate-400 m-0">Las inspecciones que realices en la app aparecerán aquí inmediatamente.</p>
            </div>
          )}
        </div>

        {/* Modal Footer - Botón Volver a la Inspección */}
        <div className="pt-2 border-t-2 border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => {
              vibrar(30);
              onClose();
            }}
            className="w-full min-h-[52px] bg-sky-600 hover:bg-sky-500 text-white font-black text-base py-3 px-4 rounded-2xl border-2 border-sky-400 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>VOLVER A LA INSPECCIÓN</span>
          </button>
        </div>
      </div>
    </div>
  );
}
