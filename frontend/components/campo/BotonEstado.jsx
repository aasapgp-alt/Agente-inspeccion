'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Slash } from 'lucide-react';
import { vibrar } from '../../utils/haptics';

const ESTADOS = [
  {
    id: 'BUENO',
    label: '✅ BUENO',
    subtext: 'Sin Anomalías',
    className: 'btn-salud-bueno',
    icon: CheckCircle2
  },
  {
    id: 'REGULAR',
    label: '⚠️ REGULAR',
    subtext: 'Atención Requerida',
    className: 'btn-salud-regular',
    icon: AlertTriangle
  },
  {
    id: 'CRITICO',
    label: '🔴 CRITICO',
    subtext: 'Falla Severa / Parar',
    className: 'btn-salud-critico',
    icon: AlertCircle
  },
  {
    id: 'FUERA_DE_RUTA',
    label: '🚫 FUERA RUTA',
    subtext: 'Inaccesible',
    className: 'btn-salud-fuera',
    icon: Slash
  }
];

export function SelectorEstadoHealth({ estadoSeleccionado, onSelectEstado }) {
  const handleClick = (id) => {
    vibrar(25);
    onSelectEstado(id);
  };

  return (
    <div className="w-full space-y-3 my-4">
      <label className="block text-xl font-black uppercase tracking-wide" style={{ color: '#ffffff' }}>
        Estado del Equipo <span style={{ color: '#f87171' }}>*</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
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
                ${est.className}
                min-h-[68px] p-3.5 rounded-2xl font-black text-left flex flex-col justify-between transition-all duration-150 active:scale-95 shadow-xl border-4
                ${isSelected ? 'ring-4 ring-white scale-[1.03] shadow-2xl opacity-100' : 'opacity-85 hover:opacity-100'}
              `}
              style={{
                outline: isSelected ? '3px solid #ffffff' : 'none'
              }}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xl tracking-tight leading-tight font-black">{est.label}</span>
                <Icon className="w-7 h-7 shrink-0 ml-1" />
              </div>
              <span className="text-xs font-bold block mt-1 opacity-90">{est.subtext}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
