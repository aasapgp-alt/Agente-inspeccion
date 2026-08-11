'use client';

import React, { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Trash2, AlertCircle } from 'lucide-react';
import { vibrar, vibrarError } from '../../../utils/haptics';

export function EvidenciaFotos({
  fotos = [],
  onAddFoto,
  onDeleteFoto,
  isOnline,
  categoriaSeleccionada,
  onSelectCategoria
}) {
  const fileInputRef = useRef(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const maxFotos = 20;
  const fotosAlcanzadas = fotos.length >= maxFotos;

  const handleCameraClick = () => {
    vibrar(30);
    setErrorMessage('');
    if (fotosAlcanzadas) {
      vibrarError();
      setErrorMessage(`Límite de ${maxFotos} fotos alcanzado.`);
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (fotos.length >= maxFotos) {
      setErrorMessage(`Límite de ${maxFotos} fotos alcanzado.`);
      return;
    }

    setIsCompressing(true);
    setErrorMessage('');

    try {
      const options = {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        initialQuality: 0.65,
        fileType: 'image/jpeg'
      };

      const compressedBlob = await imageCompression(file, options);
      vibrar(40);
      onAddFoto(compressedBlob, categoriaSeleccionada);
    } catch (err) {
      console.error('[EvidenciaFotos] Error al comprimir imagen:', err);
      vibrarError();
      setErrorMessage('No se pudo procesar la foto. Intente de nuevo.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-2.5 my-2">
      {/* Header Encabezado y Conteo 0/20 */}
      <div className="flex items-center justify-between px-0.5">
        <label className="text-xs font-bold text-slate-300">
          Evidencia Fotográfica
        </label>
        <span className="text-[11px] font-black text-sky-400 bg-sky-950/60 border border-sky-800/80 px-2 py-0.5 rounded-md font-mono">
          {fotos.length}/{maxFotos}
        </span>
      </div>

      {/* Input Oculto de Cámara Trasera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Botón Principal: TOMAR FOTO */}
      <button
        type="button"
        onClick={handleCameraClick}
        disabled={isCompressing || fotosAlcanzadas}
        className={`
          w-full py-4 px-4 rounded-xl font-black flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-[0.98] border-2 border-dashed shadow-md
          ${
            fotosAlcanzadas
              ? 'bg-[#131c2e]/40 text-slate-600 border-slate-800 cursor-not-allowed'
              : 'bg-[#131c2e] hover:bg-[#1a263d] text-slate-200 border-sky-500/40 hover:border-sky-400'
          }
        `}
      >
        <Camera className="w-6 h-6 text-sky-400" />
        <span className="font-black text-sm text-white tracking-wider uppercase">
          {isCompressing ? 'PROCESANDO...' : 'TOMAR FOTO'}
        </span>
        <span className="text-[11px] text-slate-400 font-normal">
          Cámara trasera con compresión automática
        </span>
      </button>

      {errorMessage && (
        <div className="bg-red-950/80 border border-red-500 text-red-200 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Galería de Miniaturas */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 pt-1">
          {fotos.map((item, index) => {
            const previewUrl = URL.createObjectURL(item.blob);
            return (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950 group shadow">
                <img src={previewUrl} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                {item.categoria && item.categoria !== 'General' && (
                  <span className="absolute top-1 left-1 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-700">
                    {item.categoria}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    vibrar(40);
                    onDeleteFoto(index);
                  }}
                  className="absolute bottom-1 right-1 bg-red-600/90 hover:bg-red-600 text-white p-1.5 rounded-lg shadow border border-red-400 active:scale-90"
                  aria-label="Eliminar foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

