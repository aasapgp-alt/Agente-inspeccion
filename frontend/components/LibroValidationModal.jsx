import React from 'react';

export default function LibroValidationModal({ alertas, onConfirm, onConfirmAprobados, onClose }) {
  if (!alertas || alertas.length === 0) return null;

  const hasCritico = alertas.some(a => a.tipo === 'critico');

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100
    }}>
      <div className="glass-panel" style={{
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '2rem',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
      }}>
        <h3 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚠️ Control de Calidad y Criterios
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.2rem' }}>
          Se han detectado las siguientes observaciones sobre los reportes antes de generar el libro consolidado por área:
        </p>

        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: '0.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.8rem'
        }}>
          {alertas.map((alert, index) => {
            let color = '#f59e0b'; // warning
            let bg = 'rgba(245, 158, 11, 0.05)';
            let border = '1px solid rgba(245, 158, 11, 0.2)';
            
            if (alert.tipo === 'critico') {
              color = '#ef4444'; // critical
              bg = 'rgba(239, 68, 68, 0.05)';
              border = '1px solid rgba(239, 68, 68, 0.2)';
            }
            
            return (
              <div key={index} style={{
                padding: '0.8rem',
                backgroundColor: bg,
                border: border,
                borderRadius: '6px',
                fontSize: '0.8rem'
              }}>
                <div style={{ fontWeight: 'bold', color: color, marginBottom: '0.2rem' }}>
                  {alert.mensaje}
                </div>
                {alert.detalles && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    {alert.detalles}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={onClose}
            className="btn btn-secondary"
            style={{ 
              padding: '0.55rem 1rem', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Cancelar y corregir
          </button>
          
          {!hasCritico && (
            <>
              {/* Option to generate ONLY approved ones (omitting warnings) */}
              <button 
                onClick={onConfirmAprobados}
                className="btn btn-primary"
                style={{ 
                  padding: '0.55rem 1rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold',
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Generar solo aprobados
              </button>

              {/* Option to generate ALL (ignoring warnings) */}
              <button 
                onClick={onConfirm}
                className="btn btn-primary"
                style={{ 
                  padding: '0.55rem 1rem', 
                  fontSize: '0.8rem', 
                  fontWeight: 'bold',
                  backgroundColor: '#10b981',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Generar todo de todos modos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
