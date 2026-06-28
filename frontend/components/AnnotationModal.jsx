import React, { useState, useEffect } from 'react';
import ImageAnnotator from './ImageAnnotator';

export default function AnnotationModal({ image, token, equipoId, onClose, onSave }) {
  const [annotations, setAnnotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar anotaciones desde localStorage y el backend
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

      // 2. Cargar desde el backend
      try {
        const res = await fetch(`http://localhost:8000/api/anotaciones/${equipoId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const backendAnns = data.anotaciones?.[image.id];
          if (backendAnns && backendAnns.length > 0) {
            // Sincronizar backend con local: si en local no hay nada, usamos backend
            if (loadedAnnotations.length === 0) {
              loadedAnnotations = backendAnns;
              localStorage.setItem(`annotations_${image.id}`, JSON.stringify(backendAnns));
            }
          }
        }
      } catch (err) {
        console.error("Error al cargar anotaciones del backend:", err);
      }

      setAnnotations(loadedAnnotations);
      setLoading(false);
    };

    loadAnnotations();
  }, [image, equipoId, token]);

  const handleSave = async (updatedAnnotations) => {
    if (!image || !image.id) return;

    // 1. Guardar en localStorage
    if (updatedAnnotations.length > 0) {
      localStorage.setItem(`annotations_${image.id}`, JSON.stringify(updatedAnnotations));
    } else {
      localStorage.removeItem(`annotations_${image.id}`);
    }

    // 2. Guardar en backend
    try {
      await fetch('http://localhost:8000/api/anotaciones', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          equipo_id: equipoId,
          image_id: image.id,
          annotations: updatedAnnotations
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
  const imageUrl = image ? `http://localhost:8000/api/drive/imagen/${image.id}?token=${token}` : '';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div className="glass-panel" style={{
        width: '95%',
        maxWidth: '1100px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '1.5rem',
        backgroundColor: 'rgba(15, 23, 42, 0.98)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5)',
        overflow: 'hidden'
      }}>
        {/* Botón de cierre */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            zIndex: 1200
          }}
        >
          &times;
        </button>

        {/* Cabecera */}
        <div style={{ marginBottom: '1rem', paddingRight: '2rem' }}>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🎨 Anotación de Imagen: <span style={{ color: 'var(--accent-primary)', fontSize: '1.1rem', fontWeight: 'normal' }}>{image?.name}</span>
          </h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent-primary)' }}></div>
          </div>
        ) : (
          <ImageAnnotator
            imageUrl={imageUrl}
            initialAnnotations={annotations}
            imageId={image.id}
            onSave={handleSave}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
