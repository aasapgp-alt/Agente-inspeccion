'use client';

import React from 'react';
import Link from 'next/link';
import { Search, ArrowRight } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';
import { CampoInput } from '../shared/CampoInput';
import { CampoCard } from '../shared/CampoCard';

export function EquipoSearch({
  searchTerm,
  onSearchChange,
  onSubmit,
  resultados = [],
  idInput = 'equipo-search'
}) {
  const handleFormSubmit = (e) => {
    e.preventDefault();
    vibrar(30);
    if (onSubmit) onSubmit(searchTerm);
  };

  return (
    <div className="space-y-2 pt-1">
      <label htmlFor={idInput} className="block text-xs font-bold text-slate-300">
        Buscar Equipo
      </label>
      <form onSubmit={handleFormSubmit} className="relative">
        <CampoInput
          id={idInput}
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Código, Tag o Nombre..."
          onClear={searchTerm ? () => onSearchChange('') : null}
          inputClassName="pr-10"
        />
        {!searchTerm && (
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-sky-400 active:scale-95 p-1 bg-transparent border-0 shadow-none outline-none cursor-pointer transition-colors"
            aria-label="Buscar"
          >
            <Search className="w-5 h-5" />
          </button>
        )}
      </form>

      {/* Autocompletado */}
      {resultados && resultados.length > 0 && (
        <CampoCard padding="none" className="overflow-hidden shadow-2xl divide-y divide-slate-800/80 mt-1">
          {resultados.map((eq) => (
            <Link
              key={eq.id}
              href={`/campo/inspeccion/${eq.id}?fuente=busqueda`}
              onClick={() => vibrar(20)}
              className="p-3.5 flex items-center justify-between hover:bg-slate-800/80 active:bg-slate-800 transition-colors block"
              style={{ textDecoration: 'none' }}
            >
              <div>
                <span className="bg-sky-950 text-sky-300 font-mono font-bold text-[11px] px-2 py-0.5 rounded border border-sky-700 inline-block mb-0.5">
                  {eq.codigo}
                </span>
                <h4 className="font-bold text-xs text-white m-0 leading-tight">{eq.nombre}</h4>
              </div>
              <ArrowRight className="w-4 h-4 text-sky-400 shrink-0" />
            </Link>
          ))}
        </CampoCard>
      )}
    </div>
  );
}

export default EquipoSearch;
