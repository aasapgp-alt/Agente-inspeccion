'use client';

import React from 'react';

export function CampoShell({ children, className = '' }) {
  return (
    <div className={`campo-wrapper min-h-screen bg-[#090d16] text-slate-100 pb-28 flex flex-col font-sans ${className}`}>
      {children}
    </div>
  );
}
