'use client';

import React from 'react';
import { User } from 'lucide-react';
import { CampoCard } from '../shared/CampoCard';

export function UserCard({ usuarioActual }) {
  const nombreCompleto = usuarioActual?.nombre_completo || usuarioActual?.username || 'Diego A Cristaldo';

  return (
    <CampoCard padding="small" className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-sky-950/80 border border-sky-800/60 flex items-center justify-center shrink-0">
        <User className="w-5 h-5 text-sky-400" />
      </div>
      <div className="flex flex-col text-left min-w-0">
        <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Inspector</span>
        <span className="text-xs font-bold text-white truncate">
          {nombreCompleto}
        </span>
      </div>
    </CampoCard>
  );
}

export default UserCard;
