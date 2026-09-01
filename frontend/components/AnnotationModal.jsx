import React, { useState, useEffect } from 'react';
import ImageAnnotator from './ImageAnnotator';
import { API_BASE_URL } from '../services/api';

export default function AnnotationModal({ image, token, equipoId, onClose, onSave }) {
  const [annotations, setAnnotations] = useState([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  // Atajo de teclado para cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Cargar anotaciones y comentarios desde localStorage y el backend
  useEffect(() => {
    const loadAnnotations = async () => {
      if (!image || !image.id) return;
      setLoading(true);
      
      // 1. Cargar desde localStorage
      let loadedAnnotations = [];
      const saved = localStorage.getItem(`annotations_${image.id}`);
      if (saved) {
        try {
          loadedAnnotations = JSON.parse(saved);
        } catch (e) {
          console.error("Error al cargar anotaciones de localStorage:", e);
        }
      }
      let loadedComment = localStorage.getItem(`comment_${image.id}`) || "";

      // 2. Cargar desde el backend
      try {
        const res = await fetch(`${API_BASE_URL}/anotaciones/${equipoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const backendAnns = data.anotaciones?.[image.id];
          const backendComment = data.comentarios?.[image.id] || "";
          
          if (backendAnns && backendAnns.length > 0) {
            // Sincronizar backend con local: si en local no hay nada, usamos backend
            if (loadedAnnotations.length === 0) {
              loadedAnnotations = backendAnns;
              localStorage.setItem(`annotations_${image.id}`, JSON.stringify(backendAnns));
            }
          }
          if (backendComment) {
            if (!loadedComment) {
              loadedComment = backendComment;
              localStorage.setItem(`comment_${image.id}`, backendComment);
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar anotaciones del backend:", err);
      }

      setAnnotations(loadedAnnotations);
      setComment(loadedComment);
      setLoading(false);
    };

    loadAnnotations();
  }, [image, equipoId, token]);

  const handleSave = async (updatedAnnotations, updatedComment) => {
    if (!image || !image.id) return;

    // 1. Guardar en localStorage
    if (updatedAnnotations.length > 0) {
      localStorage.setItem(`annotations_${image.id}`, JSON.stringify(updatedAnnotations));
    } else {
      localStorage.removeItem(`annotations_${image.id}`);
    }

    if (updatedComment) {
      localStorage.setItem(`comment_${image.id}`, updatedComment);
    } else {
      localStorage.removeItem(`comment_${image.id}`);
    }

    // 2. Guardar en backend
    try {
      await fetch(`${API_BASE_URL}/anotaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoId,
          image_id: image.id,
          annotations: updatedAnnotations,
          comentario: updatedComment
        })
      });
    } catch (err) {
      console.error("Error al guardar anotaciones en el backend:", err);
    }

    // 3. Callback y cierre
    if (onSave) {
      onSave(image.id, updatedAnnotations);
    }
    onClose();
  };

  // URL de la imagen en el backend con token de autorización
  const imageUrl = image ? `${API_BASE_URL}/drive/imagen/${image.id}?token=${token}` : '';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: isMaximized ? '0' : '1rem'
    }}>
      <div className="glass-panel" style={{
        width: isMaximized ? '100vw' : '95%',
        maxWidth: isMaximized ? '100vw' : '1240px',
        height: isMaximized ? '100vh' : '92vh',
        maxHeight: isMaximized ? '100vh' : '92vh',
        borderRadius: isMaximized ? '0px' : '12px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: isMaximized ? '0.75rem 1rem' : '1.25rem',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        border: isMaximized ? 'none' : '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.7)',
        overflow: 'hidden',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {/* Cabecera con controles */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🎨 Anotación de Imagen: <span style={{ color: 'var(--accent-primary)', fontSize: '1.05rem', fontWeight: '500' }}>{image?.name}</span>
            </h3>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '3px 9px',
              borderRadius: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }} title="Esta capa contiene las marcas espaciales que guían a Gemini para enfocar su análisis técnico">
              🤖 Capa de Guía para Gemini IA
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {/* Botón Maximizar / Restaurar */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: 'white',
                cursor: 'pointer',
                padding: '5px 10px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.borderColor = '#38bdf8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              title={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa"}
            >
              {isMaximized ? '🗗 Restaurar' : '🗖 Maximizar'}
            </button>

            {/* Botón Cerrar */}
            <button 
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '2px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              title="Cerrar ventana (Esc)"
            >
              &times;
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent-primary)' }}></div>
          </div>
        ) : (
          <ImageAnnotator
            key={`${image.id}_${comment}`}
            imageUrl={imageUrl}
            initialAnnotations={annotations}
            initialComment={comment}
            imageId={image.id}
            onSave={handleSave}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
