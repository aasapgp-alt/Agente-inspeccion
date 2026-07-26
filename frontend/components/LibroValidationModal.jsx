import React from 'react';

export default function LibroValidationModal({ alertas, kpis, onConfirm, onConfirmAprobados, onClose }) {
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
        
        {kpis && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px'
          }}>
            {/* KPI Card 1: ICA */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ef4444', fontWeight: 600 }}>
                Índice Criticidad (ICA)
              </span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', margin: '0.2rem 0' }}>
                {kpis.ica}%
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {kpis.criticos} de {kpis.total_equipos} equipos
              </span>
            </div>

            {/* KPI Card 2: ICD */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: kpis.icd > 80 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
              border: kpis.icd > 80 ? '1px solid rgba(16, 185, 129, 0.15)' : '1px solid rgba(245, 158, 11, 0.15)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: kpis.icd > 80 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                Calidad Evidencia (ICD)
              </span>
              <span style={{ fontSize: '1.8rem', fontWeight: 800, color: kpis.icd > 80 ? '#10b981' : '#f59e0b', margin: '0.2rem 0' }}>
                {kpis.icd}%
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Cumplimiento fotos y recs.
              </span>
            </div>

            {/* Mini State Distribution Bar */}
            <div style={{
              gridColumn: 'span 2',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              marginTop: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>Distribución de Estados en el Área:</span>
                <span>Cobertura: {kpis.inspeccionados} / {kpis.total_equipos}</span>
              </div>
              <div className="progress-container" style={{ height: '22px', borderRadius: '6px', overflow: 'hidden', display: 'flex', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                {kpis.buenos > 0 && (
                  <div style={{ 
                    backgroundColor: '#10b981', 
                    width: `${(kpis.buenos / kpis.total_equipos) * 100}%`, 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }} title={`Buenos: ${kpis.buenos}`}>
                    ✅ {kpis.buenos}
                  </div>
                )}
                {kpis.regulares > 0 && (
                  <div style={{ 
                    backgroundColor: '#f59e0b', 
                    width: `${(kpis.regulares / kpis.total_equipos) * 100}%`, 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }} title={`Regulares: ${kpis.regulares}`}>
                    ⚠️ {kpis.regulares}
                  </div>
                )}
                {kpis.criticos > 0 && (
                  <div style={{ 
                    backgroundColor: '#ef4444', 
                    width: `${(kpis.criticos / kpis.total_equipos) * 100}%`, 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }} title={`Críticos: ${kpis.criticos}`}>
                    🚨 {kpis.criticos}
                  </div>
                )}
                {kpis.fuera_ruta > 0 && (
                  <div style={{ 
                    backgroundColor: '#a855f7', 
                    width: `${(kpis.fuera_ruta / kpis.total_equipos) * 100}%`, 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }} title={`Fuera de Ruta: ${kpis.fuera_ruta}`}>
                    ⚙️ {kpis.fuera_ruta}
                  </div>
                )}
                {(kpis.total_equipos - kpis.inspeccionados) > 0 && (
                  <div style={{ 
                    backgroundColor: '#475569', 
                    width: `${((kpis.total_equipos - kpis.inspeccionados) / kpis.total_equipos) * 100}%`, 
                    color: 'white', 
                    fontSize: '0.7rem', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }} title={`Sin Inspección: ${kpis.total_equipos - kpis.inspeccionados}`}>
                    ⏳ {kpis.total_equipos - kpis.inspeccionados}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
