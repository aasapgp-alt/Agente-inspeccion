import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function VersionHistoryModal({ reporteId, tipo = 'individual', inspeccionId, onClose }) {
  const { token } = useAuth();
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersiones = async () => {
      try {
        let url;
        if (inspeccionId) {
          // Retrocompatibilidad
          url = `http://localhost:8000/api/reportes/versiones/${inspeccionId}`;
        } else if (tipo === 'libro') {
          url = `http://localhost:8000/api/libros/${reporteId}/versiones`;
        } else {
          url = `http://localhost:8000/api/reportes/${reporteId}/versiones`;
        }

        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Error al obtener el historial de versiones');
        const data = await response.json();
        setVersiones(data || []);
      } catch (err) {
        console.error("Error cargando versiones:", err);
      } finally {
        setLoading(false);
      }
    };
    if (token) {
      fetchVersiones();
    }
  }, [reporteId, tipo, inspeccionId, token]);

  const formatFecha = (fechaStr) => {
    if (!fechaStr) return '';
    try {
      const date = new Date(fechaStr.replace(' ', 'T'));
      return date.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return fechaStr;
    }
  };

  const getDriveUrl = (v) => {
    if (!v.ruta_pdf_drive) return null;
    if (v.ruta_pdf_drive.startsWith('http')) {
      return v.ruta_pdf_drive;
    }
    return `https://drive.google.com/file/d/${v.ruta_pdf_drive}/view`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="glass-panel" style={{
        width: '90%',
        maxWidth: '750px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        padding: '2rem',
        backgroundColor: 'rgba(15, 23, 42, 0.95)'
      }}>
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
            cursor: 'pointer'
          }}
        >
          &times;
        </button>

        <h3 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: '1.4rem' }}>
          📜 Historial de Versiones
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Registro de todas las regeneraciones del documento ({tipo === 'libro' ? 'Libro por Área' : 'Reporte Individual'}).
        </p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <div className="spinner" style={{ width: '30px', height: '30px', borderTopColor: 'var(--accent-primary)' }}></div>
          </div>
        ) : versiones.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            No se encontraron versiones de este documento.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Versión</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Fecha Generación</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Usuario</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Notas</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {versiones.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                      v{v.version}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {formatFecha(v.fecha_generacion)}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      👤 {v.nombre_usuario || 'Sistema'}
                    </td>
                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                      {v.notas || v.descripcion || '-'}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                        {getDriveUrl(v) ? (
                          <a 
                            href={getDriveUrl(v)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.35rem 0.65rem',
                              backgroundColor: 'rgba(14, 165, 233, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(14, 165, 233, 0.3)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                          >
                            ☁️ Drive
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Solo Local</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
