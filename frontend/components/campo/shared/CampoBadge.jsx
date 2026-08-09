'use client';

import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle, Wifi, WifiOff, Clock } from 'lucide-react';

/**
 * CampoBadge Component - Canonical Mobile Status Indicator
 * Renders badges for equipment status (Bueno, Regular, Crítico, Fuera de Ruta)
 * and system/sync status (Online, Offline, Pendiente, Completado).
 */
export function CampoBadge({
  status = 'pendiente', // bueno | regular | critico | fuera_de_ruta | online | offline | pendiente | completado
  label,
  showIcon = true,
  className = ''
}) {
  const normalizedStatus = (status || '').toLowerCase().replace(/\s+/g, '_');

  const statusConfigs = {
    bueno: {
      badgeClass: 'campo-badge-bueno',
      dotClass: 'bg-emerald-400',
      icon: CheckCircle2,
      defaultLabel: 'Bueno'
    },
    regular: {
      badgeClass: 'campo-badge-regular',
      dotClass: 'bg-amber-400',
      icon: AlertTriangle,
      defaultLabel: 'Regular'
    },
    critico: {
      badgeClass: 'campo-badge-critico',
      dotClass: 'bg-red-400',
      icon: AlertOctagon,
      defaultLabel: 'Crítico'
    },
    fuera_de_ruta: {
      badgeClass: 'campo-badge-fuera-ruta',
      dotClass: 'bg-purple-400',
      icon: HelpCircle,
      defaultLabel: 'Fuera de Ruta'
    },
    online: {
      badgeClass: 'campo-badge-online',
      dotClass: 'bg-emerald-400',
      icon: Wifi,
      defaultLabel: 'Online'
    },
    offline: {
      badgeClass: 'campo-badge-offline',
      dotClass: 'bg-amber-400',
      icon: WifiOff,
      defaultLabel: 'Offline'
    },
    pendiente: {
      badgeClass: 'campo-badge-pendiente',
      dotClass: 'bg-slate-400',
      icon: Clock,
      defaultLabel: 'Pendiente'
    },
    completado: {
      badgeClass: 'campo-badge-completado',
      dotClass: 'bg-emerald-400',
      icon: CheckCircle2,
      defaultLabel: 'Completado'
    }
  };

  const config = statusConfigs[normalizedStatus] || statusConfigs.pendiente;
  const Icon = config.icon;
  const textLabel = label || config.defaultLabel;

  return (
    <span className={`campo-badge ${config.badgeClass} ${className}`}>
      {showIcon && Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>{textLabel}</span>
    </span>
  );
}

export default CampoBadge;
