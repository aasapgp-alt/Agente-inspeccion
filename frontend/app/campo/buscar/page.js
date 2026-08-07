'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, ArrowLeft, ArrowRight, HardDrive } from 'lucide-react';
import { db } from '../../../utils/db';
import { apiService } from '../../../services/api';
import { vibrar } from '../../../utils/haptics';

function BuscarEquiposContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryInicial = searchParams.get('q') || '';

  const [query, setQuery] = useState(queryInicial);
  const [resultados, setResultados] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let active = true;

    async function buscar() {
      if (!query || query.trim().length === 0) {
        setResultados([]);
        return;
      }

      setIsSearching(true);
      const term = query.trim().toLowerCase();

      try {
        const enCache = await db.equipos_cache.toArray();
        const filtradosLocal = enCache.filter(
          (eq) =>
            (eq.codigo && eq.codigo.toLowerCase().includes(term)) ||
            (eq.nombre && eq.nombre.toLowerCase().includes(term)) ||
            (eq.tag && eq.tag.toLowerCase().includes(term)) ||
            (eq.empresa && eq.empresa.toLowerCase().includes(term)) ||
            (eq.area && eq.area.toLowerCase().includes(term))
        );

        if (active && filtradosLocal.length > 0) {
          setResultados(filtradosLocal);
          setIsSearching(false);
          return;
        }

        if (typeof window !== 'undefined' && navigator.onLine) {
          const apiRes = await apiService.getEquipos(term);
          if (active && Array.isArray(apiRes)) {
            setResultados(apiRes);
          }
        } else if (active) {
          setResultados(filtradosLocal);
        }
      } catch (e) {
        console.error('[BuscarEquiposPage] Error:', e);
      } finally {
        if (active) setIsSearching(false);
      }
    }

    buscar();

    return () => {
      active = false;
    };
  }, [query]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-3 border-b-2 border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => {
            vibrar(20);
            router.push('/campo');
          }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 p-3 rounded-xl border border-slate-700 active:scale-95"
          aria-label="Volver al Home"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <span className="text-xs font-black text-sky-400 uppercase tracking-widest">Búsqueda</span>
          <h1 className="text-2xl font-black text-white">Buscar Equipos</h1>
        </div>
      </div>

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escriba Código, Tag o Nombre..."
          className="w-full h-16 pl-14 pr-12 text-xl font-bold bg-slate-900 border-3 border-sky-500 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-sky-400/50"
          autoFocus
        />
        <Search className="w-7 h-7 text-sky-400 absolute left-4 top-1/2 -translate-y-1/2" />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl p-1"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
        <span>Resultados encontrados: {resultados.length}</span>
        {isSearching && <span className="text-sky-400 animate-pulse">Buscando...</span>}
      </div>

      {resultados.length > 0 ? (
        <div className="space-y-3">
          {resultados.map((eq) => (
            <Link
              key={eq.id}
              href={`/campo/activo/${eq.id}?fuente=busqueda`}
              onClick={() => vibrar(30)}
              className="block bg-slate-900 hover:bg-slate-850 active:bg-slate-800 border-2 border-slate-700 hover:border-sky-500 p-4 rounded-2xl shadow-lg transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-sky-950 text-sky-300 font-mono font-black text-sm px-2.5 py-0.5 rounded border border-sky-700">
                      {eq.codigo || eq.tag || `EQ-${eq.id}`}
                    </span>
                    {eq.area && <span className="text-xs text-slate-400 font-bold">{eq.area}</span>}
                  </div>
                  <h3 className="font-black text-xl text-white mt-1 leading-tight">{eq.nombre}</h3>
                  {eq.empresa && <span className="text-xs text-slate-500 font-semibold">{eq.empresa}</span>}
                </div>
                <ArrowRight className="w-7 h-7 text-sky-400 shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      ) : query.trim() ? (
        <div className="bg-slate-900 border-2 border-dashed border-slate-700 p-8 rounded-2xl text-center space-y-2">
          <HardDrive className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-300 font-bold text-lg">No se encontraron equipos para "{query}"</p>
          <p className="text-xs text-slate-400">Verifique el código o tag e intente nuevamente.</p>
        </div>
      ) : null}
    </div>
  );
}

export default function BuscarEquiposPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center font-bold">Cargando buscador...</div>}>
      <BuscarEquiposContent />
    </Suspense>
  );
}
