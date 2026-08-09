'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardList, Plus, Clock, Menu } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

export function CampoBottomNav({ onOpenMenu, onOpenNuevo }) {
  const pathname = usePathname();

  const isInicio = pathname === '/campo';
  const isBuscar = pathname === '/campo/buscar';
  const isHistorial = pathname.includes('/historial');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-2 flex items-center justify-between max-w-md mx-auto shadow-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <Link
        href="/campo"
        onClick={() => vibrar(20)}
        className={`flex flex-col items-center justify-center gap-1 min-w-[50px] min-h-[44px] py-1 text-[10px] font-bold tracking-wider transition-colors ${
          isInicio ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
        }`}
        style={{ textDecoration: 'none' }}
      >
        <Home className={`w-5 h-5 ${isInicio ? 'text-sky-400' : 'text-slate-400'}`} />
        <span>Inicio</span>
      </Link>

      <Link
        href="/campo/buscar"
        onClick={() => vibrar(20)}
        className={`flex flex-col items-center justify-center gap-1 min-w-[50px] min-h-[44px] py-1 text-[10px] font-bold tracking-wider transition-colors ${
          isBuscar ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
        }`}
        style={{ textDecoration: 'none' }}
      >
        <ClipboardList className={`w-5 h-5 ${isBuscar ? 'text-sky-400' : 'text-slate-400'}`} />
        <span>Equipos</span>
      </Link>

      {/* Floating Center Plus Action Button */}
      <button
        type="button"
        onClick={() => {
          vibrar(35);
          if (onOpenNuevo) onOpenNuevo();
        }}
        className="w-14 h-14 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center -mt-6 shadow-lg shadow-sky-500/30 border-4 border-[#090d16] active:scale-90 transition-transform shrink-0 outline-none border-0"
        aria-label="Nuevo registro"
      >
        <Plus className="w-7 h-7 stroke-[3] text-white" />
      </button>

      <Link
        href="/campo"
        onClick={() => vibrar(20)}
        className={`flex flex-col items-center justify-center gap-1 min-w-[50px] min-h-[44px] py-1 text-[10px] font-bold tracking-wider transition-colors ${
          isHistorial ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
        }`}
        style={{ textDecoration: 'none' }}
      >
        <Clock className={`w-5 h-5 ${isHistorial ? 'text-sky-400' : 'text-slate-400'}`} />
        <span>Historial</span>
      </Link>

      <button
        type="button"
        onClick={() => {
          vibrar(20);
          if (onOpenMenu) onOpenMenu();
        }}
        className="flex flex-col items-center justify-center gap-1 min-w-[50px] min-h-[44px] py-1 text-[10px] font-bold tracking-wider text-slate-400 hover:text-slate-200 transition-colors bg-transparent border-0 shadow-none outline-none cursor-pointer"
      >
        <Menu className="w-5 h-5 text-slate-400" />
        <span>Menú</span>
      </button>
    </nav>
  );
}

export default CampoBottomNav;
