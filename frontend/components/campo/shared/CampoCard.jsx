'use client';

import React from 'react';

/**
 * CampoCard Component - Canonical Mobile Card Container
 * Centralizes background, border, radius, shadow, padding, and interactive state.
 */
export function CampoCard({
  children,
  interactive = false,
  variant = 'default', // default (#131c2e) | secondary (#1e293d) | outline (transparent with border)
  padding = 'medium',  // none | small | medium | large
  className = '',
  onClick,
  style = {}
}) {
  const paddingClasses = {
    none: 'p-0',
    small: 'p-2.5',
    medium: 'p-3.5',
    large: 'p-5'
  };

  const variantClasses = {
    default: 'campo-card',
    secondary: 'bg-[#1e293d] border border-slate-700/60 rounded-2xl shadow-md',
    outline: 'bg-transparent border border-slate-700/60 rounded-2xl'
  };

  const baseVariantClass = variantClasses[variant] || variantClasses.default;
  const cardClass = `${baseVariantClass} ${interactive ? 'campo-card-interactive' : ''}`;

  return (
    <div
      onClick={onClick}
      style={style}
      className={`${cardClass} ${paddingClasses[padding] || paddingClasses.medium} shadow-md ${className}`}
    >
      {children}
    </div>
  );
}

export default CampoCard;
