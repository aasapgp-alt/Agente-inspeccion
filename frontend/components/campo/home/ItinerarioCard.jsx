'use client';

import React from 'react';
import Link from 'next/link';
import { vibrar } from '../../../utils/haptics';
import { CampoCard } from '../shared/CampoCard';
import { CampoButton } from '../shared/CampoButton';

export function ItinerarioCard({ item, index = 0 }) {
  if (!item) return null;

  const codigo = item.codigo || item.tag || `EQ-${item.id || item.activo_id}`;
  const nombre = item.nombre || item.descripcion || item.equipo_nombre || 'Equipo Asignado';
  const activoId = item.activo_id || item.equipo_id || item.id;
  const orden = item.orden || index + 1;
  const estado = item.estado_anterior || item.estado_actual || 'BUENO';

  return (
    <CampoCard padding="medium" className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-sky-400 block tracking-wide uppercase">
            Equipo asignado #{orden}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            {estado}
          </span>
        </div>
        <span className="font-black text-3xl text-white block leading-tight tracking-tight">
          {codigo}
        </span>
        <h3 className="font-bold text-xs text-slate-300 m-0 uppercase tracking-wide">
          {nombre}
        </h3>
      </div>

      <Link
        href={`/campo/inspeccion/${activoId}?fuente=itinerario&orden=${orden}`}
        onClick={() => vibrar(30)}
        style={{ textDecoration: 'none' }}
        className="block"
      >
        <CampoButton variant="primary" size="medium" fullWidth>
          INSPECCIONAR
        </CampoButton>
      </Link>
    </CampoCard>
  );
}

export default ItinerarioCard;

