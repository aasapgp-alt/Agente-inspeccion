import React, { useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, X, ChevronLeft, ChevronRight, CheckCircle2, Circle, Edit3 } from 'lucide-react';
import { API_BASE_URL } from '../services/api';

export default function ImageViewerModal({
  image,
  images = [],
  token,
  onClose,
  onSelectImage,
  isSelected = false,
  onOpenAnnotator
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Sincronizar índice inicial si se pasa una lista de imágenes
  useEffect(() => {
    if (images.length > 0 && image) {
      const idx = images.findIndex(img => (img.id || img) === (image.id || image));
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [image, images]);

  // Imagen activa actual
  const currentImg = images.length > 0 ? images[currentIndex] : image;
  const currentImgId = currentImg?.id || currentImg;
  const currentImgName = currentImg?.name || currentImg?.title || `Imagen ${currentIndex + 1}`;
  const currentImgSize = currentImg?.size ? `${(currentImg.size / 1024).toFixed(1)} KB` : '';

  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
  const imageUrl = currentImgId 
    ? (currentImg?.data || `${API_BASE_URL}/drive/imagen/${currentImgId}?token=${activeToken}`) 
    : '';

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.3, 4));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.3, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  const handlePrev = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      handleReset();
    }
  }, [images.length]);

  const handleNext = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      handleReset();
    }
  }, [images.length]);

  // Soporte de atajos de teclado (Escape, Flechas, +, -)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  // Soporte de arrastre (Pan) cuando hay zoom activo
  const handleMouseDown = (e) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Doble clic sobre la imagen para alternar zoom rápido (1x <-> 2x)
  const handleImageDoubleClick = (e) => {
    e.stopPropagation();
    if (zoom > 1) {
      handleReset();
    } else {
      setZoom(2);
    }
  };

  // Zoom con rueda del mouse
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  if (!currentImg) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.92)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1200,
        userSelect: 'none',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      {/* Barra superior de herramientas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.8rem 1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🔍</span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 600 }}>
              {currentImgName}
            </h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.8rem', marginTop: '2px' }}>
              {currentImgSize && <span>{currentImgSize}</span>}
              {images.length > 1 && (
                <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  Foto {currentIndex + 1} de {images.length}
                </span>
              )}
              <span>· Doble clic o rueda del mouse para Zoom</span>
            </div>
          </div>
        </div>

        {/* Botones de control de zoom y vista */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={handleZoomOut}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Alejar (-)"
          >
            <ZoomOut size={16} />
          </button>
          
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '45px', textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Acercar (+)"
          >
            <ZoomIn size={16} />
          </button>

          <button
            type="button"
            onClick={handleRotate}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            title="Rotar 90° (R)"
          >
            <RotateCw size={16} />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Restaurar tamaño original"
          >
            Restaurar
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />

          <button
            type="button"
            onClick={toggleFullscreen}
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}
            title={isFullscreen ? "Restaurar marco" : "Pantalla completa"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              marginLeft: '6px'
            }}
            title="Cerrar (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Área central con la imagen y flechas de navegación */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onClick={(e) => {
          // Si hace clic en el fondo vacío, cerrar
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* Flecha Anterior */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            style={{
              position: 'absolute',
              left: '1.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 20,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Foto Anterior (Flecha Izquierda)"
          >
            <ChevronLeft size={28} />
          </button>
        )}

        {/* Contenedor transformable de la imagen */}
        <div
          style={{
            maxWidth: isFullscreen ? '98vw' : '88vw',
            maxHeight: isFullscreen ? '92vh' : '78vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
          onDoubleClick={handleImageDoubleClick}
        >
          <img
            src={imageUrl}
            alt={currentImgName}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              borderRadius: isFullscreen ? '0px' : '8px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              pointerEvents: 'auto',
              cursor: zoom > 1 ? 'inherit' : 'zoom-in'
            }}
            draggable={false}
          />
        </div>

        {/* Flecha Siguiente */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            style={{
              position: 'absolute',
              right: '1.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#fff',
              borderRadius: '50%',
              width: '48px',
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 20,
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.75)';
              e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
            }}
            title="Foto Siguiente (Flecha Derecha)"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      {/* Barra inferior de acciones rápidas */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.8rem 1.5rem',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tira de miniaturas de acceso rápido */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto', maxWidth: '60vw', padding: '2px 0' }}>
          {images.map((img, idx) => {
            const imgId = img?.id || img;
            const isCurrent = idx === currentIndex;
            const thumbUrl = img?.data || `${API_BASE_URL}/drive/imagen/${imgId}?token=${activeToken}`;
            return (
              <div
                key={imgId || idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  handleReset();
                }}
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isCurrent ? '2px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.2)',
                  opacity: isCurrent ? 1 : 0.6,
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
              >
                <img
                  src={thumbUrl}
                  alt={`Min ${idx + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            );
          })}
        </div>

        {/* Acciones para el reporte / anotación */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          {onSelectImage && (
            <button
              type="button"
              onClick={() => onSelectImage(currentImgId)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 0.8rem',
                fontSize: '0.85rem',
                borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                color: isSelected ? 'var(--accent-primary)' : undefined
              }}
            >
              {isSelected ? <CheckCircle2 size={16} color="var(--accent-primary)" /> : <Circle size={16} />}
              <span>{isSelected ? 'Seleccionada para Reporte' : 'Seleccionar Foto'}</span>
            </button>
          )}

          {onOpenAnnotator && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAnnotator(currentImg);
              }}
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.4rem 1rem',
                fontSize: '0.85rem'
              }}
            >
              <Edit3 size={16} />
              <span>Abrir Editor / Anotar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
