'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Slash, Check } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

const ESTADOS = [
  {
    id: 'BUENO',
    label: 'BUENO',
    subtext: 'Sin anomalías',
    icon: CheckCircle2,
    activeBg: 'bg-[#0f271f] border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/20',
    inactiveBg: 'bg-[#131c2e] border-slate-800 text-slate-300 hover:border-emerald-800/60',
    iconColor: '#22c55e',
    accentBorder: '#10b981',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  },
  {
    id: 'REGULAR',
    label: 'REGULAR',
    subtext: 'Requiere atención',
    icon: AlertTriangle,
    activeBg: 'bg-[#291f0d] border-amber-500 text-amber-300 shadow-md shadow-amber-950/20',
    inactiveBg: 'bg-[#131c2e] border-slate-800 text-slate-300 hover:border-amber-800/60',
    iconColor: '#eab308',
    accentBorder: '#f59e0b',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  },
  {
    id: 'CRITICO',
    label: 'CRÍTICO',
    subtext: 'Falla severa',
    icon: AlertCircle,
    activeBg: 'bg-[#2b1014] border-red-500 text-red-300 shadow-md shadow-red-950/20',
    inactiveBg: 'bg-[#131c2e] border-slate-800 text-slate-300 hover:border-red-800/60',
    iconColor: '#ef4444',
    accentBorder: '#ef4444',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/30'
  },
  {
    id: 'FUERA_DE_RUTA',
    label: 'FUERA DE RUTA',
    subtext: 'Inaccesible',
    icon: Slash,
    activeBg: 'bg-[#1e293b] border-slate-500 text-slate-200 shadow-md',
    inactiveBg: 'bg-[#131c2e] border-slate-800 text-slate-400 hover:border-slate-700',
    iconColor: '#94a3b8',
    accentBorder: '#64748b',
    badgeColor: 'bg-slate-700/30 text-slate-400 border-slate-600/30'
  }
];

export function EstadoEquipo({ estadoSeleccionado, onSelectEstado }) {
  const handleClick = (id) => {
    vibrar(20);
    if (onSelectEstado) onSelectEstado(id);
  };

  return (
    <div className="w-full space-y-1.5 my-1">
      <div className="flex items-center justify-between px-0.5">
        <label className="block text-xs font-bold text-slate-300">
          Estado del Equipo <span className="text-red-400">*</span>
        </label>
        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
          Selección obligatoria
        </span>
      </div>

      <div className="flex flex-col gap-[5px]">
        {ESTADOS.map((est) => {
          const isSelected = estadoSeleccionado === est.id;
          const Icon = est.icon;

          return (
            <button
              key={est.id}
              type="button"
              onClick={() => handleClick(est.id)}
              aria-pressed={isSelected}
              className={`
                w-full h-[52px] px-3.5 rounded-xl text-left flex items-center justify-between transition-all duration-150 active:scale-[0.99] border shadow-sm
                ${isSelected ? est.activeBg : est.inactiveBg}
              `}
              style={{
                borderColor: isSelected ? est.accentBorder : undefined
              }}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 shrink-0" style={{ color: est.iconColor }} />
                <div className="flex flex-col leading-none">
                  <span className="text-xs font-black tracking-wide uppercase">{est.label}</span>
                  <span className="text-[11px] font-medium opacity-80 mt-1">{est.subtext}</span>
                </div>
              </div>

              <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                isSelected ? 'border-current bg-current/25 text-white' : 'border-slate-700/80'
              }`}>
                {isSelected ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

