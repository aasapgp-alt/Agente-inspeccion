'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Calendar, CheckCircle2, Clock, LogOut, ArrowRight, FileEdit, Trash2, HardDrive, RefreshCw, User } from 'lucide-react';
import { db, limpiarBaseDatosLocal } from '../../utils/db';
import { apiService } from '../../services/api';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePreCargaInicial } from '../../hooks/usePreCargaInicial';
import { BadgeEstadoSync } from '../../components/campo/BadgeEstadoSync';
import { BannerInstalacionPWA } from '../../components/campo/BannerInstalacionPWA';
import { vibrar } from '../../utils/haptics';

export default function CampoHomePage() {
  const router = useRouter();
  const { isOnline, pendingCount, errorCount, draftCount, completedTodayCount, forceSync, retryErrors } = useOnlineStatus();
  const { isPreCargando } = usePreCargaInicial();

  const [searchTerm, setSearchTerm] = useState('');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [usuarioActual, setUsuarioActual] = useState(null);

  useEffect(() => {
    const user = apiService.getCurrentUser();
    if (user) {
      setUsuarioActual(user);
    }
  }, []);

  const equiposResultado = useLiveQuery(
    async () => {
      if (!searchTerm || searchTerm.trim().length === 0) return [];
      const term = searchTerm.trim().toLowerCase();
      const list = await db.equipos_cache.toArray();
      return list
        .filter((eq) =>
          (eq.codigo && eq.codigo.toLowerCase().includes(term)) ||
          (eq.nombre && eq.nombre.toLowerCase().includes(term)) ||
          (eq.tag && eq.tag.toLowerCase().includes(term))
        )
        .slice(0, 5);
    },
    [searchTerm],
    []
  );

  const itinerarioHoy = useLiveQuery(
    async () => {
      return await db.itinerario_cache.orderBy('orden').toArray();
    },
    [],
    []
  );

  const borradores = useLiveQuery(
    async () => {
      return await db.inspecciones_pendientes.where('estado_sync').equals('borrador').toArray();
    },
    [],
    []
  );

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    vibrar(30);
    if (searchTerm.trim()) {
      router.push(`/campo/buscar?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  const handleDescartarBorrador = async (id) => {
    vibrar(40);
    await db.transaction('rw', db.inspecciones_pendientes, db.archivos_pendientes, async () => {
      await db.inspecciones_pendientes.delete(id);
      await db.archivos_pendientes.where('inspeccion_id').equals(id).delete();
    });
  };

  const handleLogout = async () => {
    vibrar(50);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
    }
    await limpiarBaseDatosLocal();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-12 flex flex-col">
      <BadgeEstadoSync
        isOnline={isOnline}
        pendingCount={pendingCount}
        errorCount={errorCount}
        draftCount={draftCount}
        forceSync={forceSync}
        retryErrors={retryErrors}
      />

      <main className="flex-1 max-w-md w-full mx-auto p-4 space-y-6">
        {/* Encabezado Modo Campo con Chip del Inspector Logueado */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
          <div className="space-y-0.5">
            <span className="text-xs font-black tracking-widest text-sky-400 uppercase block" style={{ color: '#38bdf8' }}>
              Modo Campo
            </span>
            <h1 className="text-3xl font-black tracking-tight text-white m-0" style={{ color: '#ffffff' }}>
              Inspector PGP
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="user-chip-campo flex items-center gap-2">
              <User className="w-5 h-5 text-sky-400 shrink-0" style={{ color: '#38bdf8' }} />
              <div className="flex flex-col text-left">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400" style={{ color: '#94a3b8' }}>
                  INSPECTOR
                </span>
                <span className="text-xs font-black text-white leading-tight" style={{ color: '#ffffff' }}>
                  {usuarioActual?.nombre_completo || usuarioActual?.username || 'En Planta'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                vibrar(30);
                setShowLogoutModal(true);
              }}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 p-2.5 rounded-xl border border-slate-700 active:scale-90"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-5 h-5 text-red-400" style={{ color: '#f87171' }} />
            </button>
          </div>
        </div>

        <BannerInstalacionPWA />

        {/* Buscador Grande con Autocompletado */}
        <div className="space-y-2">
          <form onSubmit={handleSearchSubmit} className="relative">
            <label htmlFor="equipo-search" className="block text-sm font-black text-slate-200 uppercase mb-1" style={{ color: '#e2e8f0' }}>
              🔍 Buscar Activo / Equipo
            </label>
            <div className="relative">
              <input
                id="equipo-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Código, Tag o Nombre..."
                className="input-campo"
              />
              <Search className="w-7 h-7 text-sky-400 absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#38bdf8' }} />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl p-1"
                  style={{ color: '#94a3b8' }}
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Autocompletado en vivo */}
          {equiposResultado && equiposResultado.length > 0 && (
            <div className="bg-slate-900 border-2 border-sky-500 rounded-2xl overflow-hidden shadow-2xl divide-y-2 divide-slate-800" style={{ backgroundColor: '#0f172a', borderColor: '#0284c7' }}>
              {equiposResultado.map((eq) => (
                <Link
                  key={eq.id}
                  href={`/campo/activo/${eq.id}?fuente=busqueda`}
                  onClick={() => vibrar(20)}
                  className="p-4 flex items-center justify-between hover:bg-slate-800 active:bg-slate-700 transition-colors block"
                  style={{ textDecoration: 'none' }}
                >
                  <div>
                    <span className="bg-sky-900/80 text-sky-300 font-mono font-black text-sm px-2.5 py-1 rounded border border-sky-600 inline-block mb-1" style={{ color: '#7dd3fc', backgroundColor: '#0c4a6e', borderColor: '#0284c7' }}>
                      {eq.codigo}
                    </span>
                    <h4 className="font-black text-lg text-white m-0" style={{ color: '#ffffff' }}>{eq.nombre}</h4>
                  </div>
                  <ArrowRight className="w-6 h-6 text-sky-400 shrink-0" style={{ color: '#38bdf8' }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tarjetas de Resumen y Contadores */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card-campo flex flex-col justify-between">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1" style={{ color: '#fbbf24' }}>
              <Clock className="w-4 h-4 text-amber-400" />
              Pendientes
            </span>
            <span className="text-4xl font-black my-1" style={{ color: '#fbbf24' }}>{pendingCount}</span>
            <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>En cola local</span>
          </div>

          <div className="card-campo flex flex-col justify-between">
            <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1" style={{ color: '#34d399' }}>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Completados
            </span>
            <span className="text-4xl font-black my-1" style={{ color: '#34d399' }}>{completedTodayCount}</span>
            <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Hoy en planta</span>
          </div>
        </div>

        {/* Borradores en Curso */}
        {borradores && borradores.length > 0 && (
          <div className="card-campo border-sky-500 space-y-3" style={{ borderColor: '#0284c7' }}>
            <h3 className="font-black text-lg flex items-center gap-2 uppercase" style={{ color: '#38bdf8' }}>
              <FileEdit className="w-5 h-5 text-sky-400" />
              Borradores Pendientes ({borradores.length})
            </h3>
            <div className="space-y-2">
              {borradores.map((b) => (
                <div key={b.id} className="bg-slate-900 p-3 rounded-xl border border-sky-600 flex items-center justify-between" style={{ backgroundColor: '#0f172a', borderColor: '#0284c7' }}>
                  <div>
                    <span className="font-mono font-bold text-sm" style={{ color: '#7dd3fc' }}>{b.codigo_activo}</span>
                    <p className="text-xs m-0" style={{ color: '#94a3b8' }}>{new Date(b.timestamp).toLocaleTimeString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDescartarBorrador(b.id)}
                      className="bg-red-950 hover:bg-red-900 text-red-300 p-2 rounded-lg border border-red-700 text-xs font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/campo/inspeccion/${b.id_activo}?fuente=busqueda`}
                      onClick={() => vibrar(20)}
                      className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-2 rounded-lg text-sm font-black border border-sky-400 inline-block"
                      style={{ color: '#ffffff', textDecoration: 'none' }}
                    >
                      Continuar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mi Itinerario de Hoy */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black uppercase flex items-center gap-2" style={{ color: '#ffffff' }}>
              <Calendar className="w-6 h-6 text-sky-400" style={{ color: '#38bdf8' }} />
              Mi Itinerario de Hoy
            </h2>
            {isPreCargando && (
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1 animate-pulse-fast" style={{ color: '#38bdf8' }}>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sincronizando...
              </span>
            )}
          </div>

          {itinerarioHoy && itinerarioHoy.length > 0 ? (
            <div className="space-y-3">
              {itinerarioHoy.map((item, index) => (
                <Link
                  key={item.id || index}
                  href={`/campo/inspeccion/${item.activo_id}?fuente=itinerario&orden=${item.orden || index + 1}`}
                  onClick={() => vibrar(30)}
                  className="card-campo hover:border-sky-500 transition-all block"
                  style={{ textDecoration: 'none' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl bg-sky-900 text-sky-300 font-black text-lg flex items-center justify-center border border-sky-600 shrink-0" style={{ backgroundColor: '#0c4a6e', color: '#7dd3fc', borderColor: '#0284c7' }}>
                        #{item.orden || index + 1}
                      </span>
                      <div>
                        <span className="font-mono font-bold text-sm block" style={{ color: '#38bdf8' }}>{item.codigo}</span>
                        <h3 className="font-black text-xl text-white leading-tight m-0" style={{ color: '#ffffff' }}>{item.nombre}</h3>
                      </div>
                    </div>
                    <div className="bg-sky-600 text-white font-black text-sm px-3 py-2 rounded-xl flex items-center gap-1 shrink-0 border border-sky-400 shadow" style={{ backgroundColor: '#0284c7', color: '#ffffff' }}>
                      INSPECCIONAR
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card-campo border-dashed text-center space-y-2 py-8" style={{ borderStyle: 'dashed' }}>
              <HardDrive className="w-12 h-12 mx-auto" style={{ color: '#64748b' }} />
              <p className="font-black text-lg m-0" style={{ color: '#ffffff' }}>No hay equipos asignados en tu itinerario de hoy</p>
              <p className="text-xs m-0" style={{ color: '#94a3b8' }}>Usa el buscador superior para encontrar y registrar cualquier activo de la planta.</p>
            </div>
          )}
        </div>
      </main>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-slate-900 border-3 border-red-500 max-w-sm w-full p-6 rounded-3xl space-y-4 text-center shadow-2xl" style={{ backgroundColor: '#0f172a', borderColor: '#ef4444' }}>
            <LogOut className="w-12 h-12 text-red-500 mx-auto" style={{ color: '#ef4444' }} />
            <h3 className="text-2xl font-black text-white m-0" style={{ color: '#ffffff' }}>¿Cerrar Sesión?</h3>
            <p className="text-sm font-semibold" style={{ color: '#cbd5e1' }}>
              {usuarioActual?.nombre_completo || usuarioActual?.username
                ? `Inspector: ${usuarioActual.nombre_completo || usuarioActual.username}. `
                : ''}
              {pendingCount > 0
                ? `⚠️ Tienes ${pendingCount} inspecciones pendientes de subir. Al salir se borrará la cola local.`
                : 'Se cerrará la sesión en este dispositivo.'}
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl border border-slate-600 text-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl border border-red-400 text-lg shadow-lg active:scale-95"
              >
                Si, Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
