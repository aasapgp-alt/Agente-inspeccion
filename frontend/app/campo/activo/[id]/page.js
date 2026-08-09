'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Building2, MapPin, CheckCircle2, AlertTriangle, AlertCircle, Slash, History, Cpu, Lightbulb } from 'lucide-react';
import { db } from '../../../../utils/db';
import { apiService } from '../../../../services/api';
import { HistorialActivoModal } from '../../../../components/campo/shared/HistorialActivoModal';
import { vibrar } from '../../../../utils/haptics';

function FichaActivoContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = params.id;
  const fuente = searchParams.get('fuente') || 'busqueda';
  const orden = searchParams.get('orden') || '';

  const [equipo, setEquipo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showHistorialModal, setShowHistorialModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function cargarFicha() {
      try {
        const cacheItem = await db.equipos_cache.get(Number(id));
        if (cacheItem && active) {
          setEquipo(cacheItem);
          setLoading(false);
        }

        if (typeof window !== 'undefined' && navigator.onLine) {
          const remoteData = await apiService.getEquipoById(id);
          if (active && remoteData) {
            setEquipo((prev) => ({
              ...prev,
              ...remoteData,
              codigo: remoteData.codigo || remoteData.tag || prev?.codigo || `EQ-${id}`,
              nombre: remoteData.nombre || prev?.nombre || 'Equipo',
              estado_actual: remoteData.estado_actual || remoteData.estado || remoteData.estado_anterior || prev?.estado_actual || 'BUENO',
              diagnostico: remoteData.diagnostico || remoteData.diagnostico_reciente || prev?.diagnostico || '',
              recomendacion: remoteData.recomendacion || remoteData.recomendacion_preventiva || prev?.recomendacion || ''
            }));
          }
        }
      } catch (err) {
        console.warn('[FichaActivoPage] Error al cargar ficha:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    cargarFicha();

    return () => {
      active = false;
    };
  }, [id]);

  const renderBadgeEstado = (estado) => {
    const st = (estado || '').toUpperCase();
    if (st.includes('CRIT') || st.includes('ROTO')) {
      return (
        <span className="bg-red-600 text-white font-black px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 border-2 border-red-400 shadow">
          <AlertCircle className="w-4 h-4" /> CRÍTICO
        </span>
      );
    }
    if (st.includes('REGULAR') || st.includes('ALERTA')) {
      return (
        <span className="bg-amber-500 text-black font-black px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 border-2 border-amber-300 shadow">
          <AlertTriangle className="w-4 h-4" /> REGULAR
        </span>
      );
    }
    if (st.includes('BUENO')) {
      return (
        <span className="bg-emerald-600 text-white font-black px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 border-2 border-emerald-400 shadow">
          <CheckCircle2 className="w-4 h-4" /> BUENO
        </span>
      );
    }
    return (
      <span className="bg-slate-700 text-white font-black px-3 py-1.5 rounded-xl text-sm flex items-center gap-1 border-2 border-slate-500 shadow">
        <Slash className="w-4 h-4" /> {estado || 'FUERA RUTA'}
      </span>
    );
  };

  if (loading && !equipo) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 font-bold text-slate-300">Cargando ficha del activo...</p>
      </div>
    );
  }

  const estadoMostrado = equipo?.estado_actual || equipo?.estado_anterior || 'BUENO';
  const urlInspeccion = `/campo/inspeccion/${id}?fuente=${fuente}${orden ? `&orden=${orden}` : ''}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto space-y-5 flex flex-col justify-between">
      <div className="space-y-5">
        {/* Header Volver */}
        <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-3">
          <button
            type="button"
            onClick={() => {
              vibrar(20);
              router.push('/campo');
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-3 rounded-xl border border-slate-700 active:scale-95"
            aria-label="Volver"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <span className="text-xs font-black text-sky-400 uppercase tracking-widest" style={{ color: '#38bdf8' }}>Ficha Compacta</span>
            <h1 className="text-2xl font-black text-white m-0" style={{ color: '#ffffff' }}>Detalle de Activo</h1>
          </div>
        </div>

        {/* Tarjeta de Información Principal */}
        <div className="card-campo space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="bg-sky-900 text-sky-200 font-mono font-black text-lg px-3 py-1 rounded-lg border border-sky-600 inline-block" style={{ backgroundColor: '#0c4a6e', color: '#bae6fd', borderColor: '#0284c7' }}>
                {equipo?.codigo || `EQ-${id}`}
              </span>
              <h2 className="text-3xl font-black text-white mt-2 leading-tight m-0" style={{ color: '#ffffff' }}>
                {equipo?.nombre || 'Equipo Industrial'}
              </h2>
            </div>
            {renderBadgeEstado(estadoMostrado)}
          </div>

          <hr className="border-slate-800" />

          <div className="grid grid-cols-2 gap-3 text-sm font-bold text-slate-300">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400 shrink-0" style={{ color: '#38bdf8' }} />
              <span>{equipo?.empresa || 'Empresa PGP'}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amber-400 shrink-0" style={{ color: '#fbbf24' }} />
              <span>{equipo?.area || 'Planta General'}</span>
            </div>
          </div>

          {equipo?.tag && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs font-mono" style={{ backgroundColor: '#020617' }}>
              <span className="text-slate-500 font-bold block">TAG INDUSTRIAL:</span>
              <span className="text-sky-300 font-black text-base" style={{ color: '#7dd3fc' }}>{equipo.tag}</span>
            </div>
          )}
        </div>

        {/* Sección Diagnóstico Reciente Gemini */}
        {equipo?.diagnostico && (
          <div className="card-campo border-sky-600 space-y-2" style={{ backgroundColor: '#0c4a6e', borderColor: '#0284c7' }}>
            <h4 className="font-black text-base text-sky-200 flex items-center gap-2 m-0 uppercase" style={{ color: '#bae6fd' }}>
              <Cpu className="w-5 h-5 text-sky-300" />
              Diagnóstico Reciente (Gemini)
            </h4>
            <p className="text-sm font-semibold text-slate-100 leading-relaxed m-0 bg-slate-950/70 p-3 rounded-xl border border-sky-700" style={{ color: '#f8fafc', backgroundColor: '#020617' }}>
              {equipo.diagnostico}
            </p>
          </div>
        )}

        {/* Sección Recomendaciones Preventivas */}
        {equipo?.recomendacion && (
          <div className="card-campo border-amber-600 space-y-2" style={{ backgroundColor: '#451a03', borderColor: '#d97706' }}>
            <h4 className="font-black text-base text-amber-300 flex items-center gap-2 m-0 uppercase" style={{ color: '#fde68a' }}>
              <Lightbulb className="w-5 h-5 text-amber-400" />
              Recomendación Preventiva
            </h4>
            <p className="text-sm font-semibold text-slate-100 leading-relaxed m-0 bg-slate-950/70 p-3 rounded-xl border border-amber-700" style={{ color: '#f8fafc', backgroundColor: '#020617' }}>
              {equipo.recomendacion}
            </p>
          </div>
        )}

        {/* Botón para abrir Modal de Historial Completo */}
        <button
          type="button"
          onClick={() => {
            vibrar(30);
            setShowHistorialModal(true);
          }}
          className="w-full py-4 px-4 bg-slate-900 hover:bg-slate-850 text-sky-300 font-black text-lg rounded-2xl border-2 border-sky-500 flex items-center justify-center gap-2 shadow-lg active:scale-95"
          style={{ backgroundColor: '#0f172a', borderColor: '#0284c7', color: '#38bdf8' }}
        >
          <History className="w-6 h-6" />
          <span>📜 VER HISTORIAL COMPLETO</span>
        </button>
      </div>

      <div className="pt-4">
        <Link
          href={urlInspeccion}
          onClick={() => vibrar(40)}
          className="w-full min-h-[72px] py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-3 border-4 border-emerald-400 shadow-2xl active:scale-95 transition-all block"
          style={{ textDecoration: 'none', backgroundColor: '#059669', color: '#ffffff' }}
        >
          <Play className="w-9 h-9 fill-current shrink-0" />
          <span>INSPECCIONAR AHORA</span>
        </Link>
      </div>

      <HistorialActivoModal
        equipoId={id}
        codigoActivo={equipo?.codigo || `EQ-${id}`}
        nombreActivo={equipo?.nombre || 'Equipo Industrial'}
        isOpen={showHistorialModal}
        onClose={() => setShowHistorialModal(false)}
      />
    </div>
  );
}

export default function FichaActivoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center font-bold">Cargando activo...</div>}>
      <FichaActivoContent />
    </Suspense>
  );
}
