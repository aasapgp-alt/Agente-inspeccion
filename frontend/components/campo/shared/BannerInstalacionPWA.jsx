'use client';

import React, { useState, useEffect } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { vibrar } from '../../../utils/haptics';

export function BannerInstalacionPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    vibrar(40);
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (!deferredPrompt || isInstalled) return null;

  return (
    <div className="w-full bg-gradient-to-r from-sky-900 to-indigo-900 border-2 border-sky-400 p-4 rounded-2xl shadow-2xl my-4 text-white flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Smartphone className="w-8 h-8 text-sky-300 shrink-0" />
        <div>
          <h4 className="font-black text-lg leading-tight">Instalar App Móvil</h4>
          <p className="text-xs text-sky-200">Acceso directo sin barra de navegador en planta</p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleInstallClick}
        className="bg-sky-500 hover:bg-sky-400 text-black font-black px-4 py-3 rounded-xl border-2 border-white text-sm shrink-0 shadow-lg active:scale-95 flex items-center gap-2"
      >
        <Download className="w-5 h-5" />
        INSTALAR
      </button>
    </div>
  );
}
