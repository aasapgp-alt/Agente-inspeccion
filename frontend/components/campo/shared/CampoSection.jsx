'use client';

import React from 'react';

/**
 * CampoSection Component - Canonical Mobile Section Divider & Header
 */
export function CampoSection({ title, subtitle, action, children, className = '' }) {
  return (
    <div className={`space-y-2 pt-1 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <div>
            {title && (
              <span className="text-xs font-extrabold text-slate-300 block tracking-wider uppercase">
                {title}
              </span>
            )}
            {subtitle && (
              <span className="text-[11px] text-slate-400 block font-medium mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export default CampoSection;
