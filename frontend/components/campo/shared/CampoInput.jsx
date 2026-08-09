'use client';

import React from 'react';
import { X } from 'lucide-react';

/**
 * CampoInput Component - Canonical Mobile Input & Textarea
 * Enforces touch target area >= 44px, custom icon leading, clear button, and error state.
 */
export function CampoInput({
  type = 'text',
  value,
  onChange,
  placeholder = '',
  disabled = false,
  readOnly = false,
  multiline = false,
  rows = 3,
  icon: Icon = null,
  onClear = null,
  error = null,
  className = '',
  inputClassName = '',
  ...props
}) {
  const isInput = !multiline;

  return (
    <div className={`w-full space-y-1 ${className}`}>
      <div className="relative flex items-center w-full">
        {Icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10 flex items-center justify-center">
            <Icon className="w-4 h-4 shrink-0" />
          </div>
        )}

        {isInput ? (
          <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            className={`campo-input w-full ${Icon ? 'pl-10' : 'pl-3.5'} ${onClear && value ? 'pr-10' : 'pr-3.5'} py-2.5 text-sm font-medium text-slate-100 placeholder-slate-500 bg-[#131c2e] border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500' : ''} ${inputClassName}`}
            {...props}
          />
        ) : (
          <textarea
            value={value}
            onChange={onChange}
            rows={rows}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            className={`w-full min-h-[80px] ${Icon ? 'pl-10' : 'pl-3.5'} ${onClear && value ? 'pr-10' : 'pr-3.5'} py-2.5 text-sm font-medium text-slate-100 placeholder-slate-500 bg-[#131c2e] border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${error ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500' : ''} ${inputClassName}`}
            {...props}
          />
        )}

        {onClear && value && !disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200 touch-target w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800/60 transition-colors"
            title="Limpiar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {error && (
        <span className="text-xs font-semibold text-red-400 block px-1">
          {error}
        </span>
      )}
    </div>
  );
}

export default CampoInput;
