'use client';

import React, { useState } from 'react';
import { User, HardDrive, ArrowRight, LogOut, X } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

export function CampoMenuDrawer({
  isOpen = false,
  onClose,
  usuarioActual,
  onOpenDrive,
  onLogout,
  pendingCount = 0
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  if (!isOpen && !showLogoutModal) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex justify-end">
          <div className="bg-[#090d16] border-l border-slate-800 w-72 h-full p-4 space-y-4 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <h3 className="font-bold text-base text-white m-0">Menú Inspector</h3>
                <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-[#131c2e] rounded-xl border border-slate-800 flex items-center gap-2.5">
                  <User className="w-5 h-5 text-sky-400 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Usuario Inspector</span>
                    <span className="text-xs font-bold text-white truncate block">
                      {usuarioActual?.nombre_completo || usuarioActual?.username || 'Diego A Cristaldo'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onClose) onClose();
                    if (onOpenDrive) onOpenDrive();
                  }}
                  className="w-full p-3 bg-[#131c2e] hover:bg-slate-800 rounded-xl border border-slate-800 text-left font-bold text-xs text-sky-300 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-sky-400" /> Navegador Drive
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                setShowLogoutModal(true);
              }}
              className="w-full py-3 bg-red-950/80 hover:bg-red-900 border border-red-700 text-red-300 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Confirmación Logout */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-[#090d16] border border-red-500 max-w-sm w-full p-5 rounded-2xl space-y-3 text-center shadow-2xl">
            <LogOut className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="text-lg font-black text-white m-0">¿Cerrar Sesión?</h3>
            <p className="text-xs font-semibold text-slate-300">
              {pendingCount > 0
                ? `⚠️ Tienes ${pendingCount} inspecciones pendientes de subir.`
                : 'Se cerrará la sesión en este dispositivo.'}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="bg-slate-800 text-white font-bold py-2.5 rounded-xl border border-slate-600 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  vibrar(50);
                  setShowLogoutModal(false);
                  if (onLogout) onLogout();
                }}
                className="bg-red-600 text-white font-black py-2.5 rounded-xl border border-red-400 text-xs shadow active:scale-95"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
