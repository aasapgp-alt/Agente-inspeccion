'use client';

import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';
import { CampoSection } from '../shared/CampoSection';
import { CampoCard } from '../shared/CampoCard';
import { CampoBadge } from '../shared/CampoBadge';

export function ActivitySummary({ pendingCount = 0, completedTodayCount = 0 }) {
  return (
    <CampoSection title="Estado de actividades">
      <div className="space-y-2.5">
        {/* Pendientes */}
        <CampoCard padding="small" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-amber-400 block">Pendientes</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">En cola local</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CampoBadge status="pendiente" label={`${pendingCount ?? 0}`} showIcon={false} />
          </div>
        </CampoCard>

        {/* Completados */}
        <CampoCard padding="small" className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-bold text-emerald-400 block">Completados</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Hoy en planta</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CampoBadge status="completado" label={`${completedTodayCount ?? 0}`} showIcon={false} />
          </div>
        </CampoCard>
      </div>
    </CampoSection>
  );
}

export default ActivitySummary;
