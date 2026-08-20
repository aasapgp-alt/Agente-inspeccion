'use client';

import React from 'react';
import { RefreshCw, CalendarCheck } from 'lucide-react';
import { ItinerarioCard } from './ItinerarioCard';
import { CampoSection } from '../shared/CampoSection';
import { CampoCard } from '../shared/CampoCard';
import { vibrar } from '../../../utils/haptics';

export function ItinerarioList({ itinerarioHoy = [], isPreCargando = false, onRecargarItinerario }) {
  const handleRefresh = (e) => {
    e.stopPropagation();
    vibrar(25);
    if (onRecargarItinerario) {
      onRecargarItinerario();
    }
  };

  const syncAction = isPreCargando ? (
    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1 animate-pulse">
      <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando...
    </span>
  ) : onRecargarItinerario ? (
    <button
      type="button"
      onClick={handleRefresh}
      className="text-[11px] font-semibold text-slate-400 hover:text-sky-400 flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-slate-800 transition-colors active:scale-95"
      title="Recargar itinerario desde el servidor"
    >
      <RefreshCw className="w-3 h-3" />
      <span>Refrescar</span>
    </button>
  ) : null;

  return (
    <CampoSection title="Mi Itinerario de Hoy" action={syncAction}>
      {itinerarioHoy && itinerarioHoy.length > 0 ? (
        <div className="space-y-3">
          {itinerarioHoy.map((item, index) => (
            <ItinerarioCard key={item.id || index} item={item} index={index} />
          ))}
        </div>
      ) : (
        <CampoCard padding="medium" className="text-center py-6 space-y-2 border-dashed border-slate-700/80 bg-slate-900/40">
          <div className="w-10 h-10 mx-auto rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
            <CalendarCheck className="w-5 h-5 text-sky-400" />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-slate-200">Sin ruta programada para hoy</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              No tienes equipos asignados en tu itinerario de hoy. Puedes buscar un equipo arriba para inspeccionarlo libremente.
            </p>
          </div>
        </CampoCard>
      )}
    </CampoSection>
  );
}

export default ItinerarioList;


