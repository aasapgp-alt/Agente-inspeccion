'use client';

import React from 'react';

/**
 * CampoButton Component - Canonical Mobile Button
 * Supports primary, secondary, success, warning, danger, ghost, outline variants
 * and small, medium, large sizes with guaranteed touch target >= 44px.
 */
export function CampoButton({
  children,
  onClick,
  type = 'button',
  variant = 'primary', // primary | secondary | success | warning | danger | ghost | outline (or legacy blue|green|red|slate)
  size = 'medium',     // small | medium | large
  disabled = false,
  fullWidth = true,
  icon: Icon = null,
  className = '',
  style = {}
}) {
  // Normalize legacy variants
  const normalizedVariant = {
    blue: 'primary',
    green: 'success',
    red: 'danger',
    slate: 'secondary'
  }[variant] || variant;

  const variantClasses = {
    primary: 'campo-btn-primary',
    secondary: 'campo-btn-secondary',
    success: 'campo-btn-success',
    warning: 'campo-btn-warning',
    danger: 'campo-btn-danger',
    ghost: 'campo-btn-ghost',
    outline: 'campo-btn-outline'
  };

  const sizeClasses = {
    small: 'min-h-[44px] py-1.5 px-3 text-xs gap-1.5',
    medium: 'min-h-[44px] py-2.5 px-4 text-xs tracking-wider gap-2',
    large: 'min-h-[52px] py-3 px-6 text-sm tracking-wider gap-2.5'
  };

  const baseClass = `font-extrabold uppercase flex items-center justify-center rounded-xl shadow-sm transition-all active:scale-[0.98] select-none ${fullWidth ? 'w-full' : ''}`;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`${baseClass} ${sizeClasses[size] || sizeClasses.medium} ${variantClasses[normalizedVariant] || variantClasses.primary} ${disabled ? 'opacity-50 cursor-not-allowed active:scale-100' : ''} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children && <span>{children}</span>}
    </button>
  );
}

export default CampoButton;
