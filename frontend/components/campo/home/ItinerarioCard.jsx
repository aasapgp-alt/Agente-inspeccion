'use client';

import React from 'react';
import Link from 'next/link';
import { vibrar } from '../../../utils/haptics';
import { CampoCard } from '../shared/CampoCard';
import { CampoButton } from '../shared/CampoButton';

export function ItinerarioCard({ item, index = 0 }) {
  const codigo = item?.codigo || '107';
  const nombre = item?.nombre || 'VENTILADOR 431-506';
  const activoId = item?.activo_id || item?.id || 107;
  const orden = item?.orden || index + 1;

  return (
    <CampoCard padding="medium" className="space-y-3">
      <div className="space-y-1">
        <span className="text-[11px] font-bold text-sky-400 block tracking-wide uppercase">
          Equipo asignado
        </span>
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
