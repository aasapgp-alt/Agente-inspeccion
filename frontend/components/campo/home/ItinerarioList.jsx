'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { ItinerarioCard } from './ItinerarioCard';
import { CampoSection } from '../shared/CampoSection';

export function ItinerarioList({ itinerarioHoy = [], isPreCargando = false }) {
  const syncAction = isPreCargando ? (
    <span className="text-[11px] font-bold text-sky-400 flex items-center gap-1 animate-pulse">
      <RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...
    </span>
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
        <ItinerarioCard item={null} index={0} />
      )}
    </CampoSection>
  );
}

export default ItinerarioList;
