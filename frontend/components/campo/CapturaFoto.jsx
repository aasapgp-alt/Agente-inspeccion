'use client';

import React, { useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { vibrar, vibrarError } from '../../utils/haptics';

export function CapturaFoto({ fotos, onAddFoto, onDeleteFoto, isOnline, categoriaSeleccionada, onSelectCategoria }) {
  const fileInputRef = useRef(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const maxFotos = isOnline ? 20 : 5;
  const fotosAlcanzadas = fotos.length >= maxFotos;

  const handleCameraClick = () => {
    vibrar(30);
    setErrorMessage('');
    if (fotosAlcanzadas) {
      vibrarError();
      setErrorMessage(`Límite alcanzado (${maxFotos} fotos ${isOnline ? 'online' : 'offline'}).`);
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
      console.error('[CapturaFoto] Error al comprimir imagen:', err);
      vibrarError();
      setErrorMessage('No se pudo procesar la foto. Intente de nuevo.');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-3 my-4 bg-slate-800/80 p-4 rounded-2xl border-2 border-slate-700">
      <div className="flex items-center justify-between">
        <label className="text-xl font-black text-slate-100 uppercase flex items-center gap-2">
          <Camera className="w-6 h-6 text-sky-400" />
          Evidencia Fotográfica
        </label>
        <span className={`text-sm font-bold px-3 py-1 rounded-full ${fotosAlcanzadas ? 'bg-red-500/20 text-red-400 border border-red-500' : 'bg-slate-700 text-slate-300'}`}>
          {fotos.length} / {maxFotos} {isOnline ? '(Online)' : '(Offline)'}
        </span>
      </div>

      {/* Selector de Categoría de Foto */}
      <div className="flex items-center gap-2 my-2">
        <span className="text-sm font-bold text-slate-300">Categoría:</span>
        {['Succión', 'Impulsión', 'General'].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => {
              vibrar(20);
              onSelectCategoria(cat);
            }}
            className={`px-3 py-2 text-sm font-black rounded-lg border-2 transition-all ${
              categoriaSeleccionada === cat
                ? 'bg-sky-600 text-white border-sky-400 shadow-md'
                : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
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

      {/* Botón Gigante de Tomar Foto */}
      <button
        type="button"
        onClick={handleCameraClick}
        disabled={isCompressing || fotosAlcanzadas}
        className={`
          w-full min-h-[64px] py-4 px-6 rounded-2xl font-black text-2xl flex items-center justify-center gap-3 transition-all duration-150 active:scale-95 shadow-xl border-4
          ${
            fotosAlcanzadas
              ? 'bg-slate-700 text-slate-500 border-slate-600 cursor-not-allowed'
              : 'bg-sky-600 hover:bg-sky-500 text-white border-sky-400 active:bg-sky-700'
          }
        `}
      >
        <Camera className="w-9 h-9 shrink-0" />
        <span>{isCompressing ? 'COMPRIMIENDO...' : '📷 TOMAR FOTO'}</span>
      </button>

      {errorMessage && (
        <div className="bg-red-900/40 border-2 border-red-500 text-red-200 text-sm font-bold p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Galería de Miniaturas */}
      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 pt-2">
          {fotos.map((item, index) => {
            const previewUrl = URL.createObjectURL(item.blob);
            return (
              <div key={index} className="relative aspect-square rounded-xl overflow-hidden border-2 border-slate-600 bg-slate-900 group">
                <img src={previewUrl} alt={`Foto ${index + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 bg-black/75 text-white text-[10px] font-black px-1.5 py-0.5 rounded">
                  {item.categoria || 'General'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    vibrar(40);
                    onDeleteFoto(index);
                  }}
                  className="absolute bottom-1 right-1 bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg shadow-lg border border-red-400 active:scale-90"
                  aria-label="Eliminar foto"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
