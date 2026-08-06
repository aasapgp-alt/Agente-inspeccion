import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function ItineraryProgressBar({ compact = false }) {
  const { token } = useAuth();
  const [progreso, setProgreso] = useState(null);

  const fetchProgreso = async () => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
    if (!activeToken) return;

    try {
      const res = await fetch('http://localhost:8000/api/itinerarios/progreso', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProgreso(data);
      }
    } catch (err) {
      console.error('Error cargando progreso de itinerario:', err);
    }
  };

  useEffect(() => {
    fetchProgreso();
    const interval = setInterval(fetchProgreso, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (!progreso || progreso.total === 0) {
    return (
      <div style={{
        fontSize: '0.8rem',
        color: 'var(--text-tertiary)',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span>📅</span>
        <span>Sin ruta activa hoy</span>
      </div>
    );
  }

  const { completados, total, porcentaje } = progreso;

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem' }}>
        <span style={{ fontWeight: 700, color: '#38bdf8' }}>📊 Avance: {completados}/{total}</span>
        <div style={{
          width: '60px',
          height: '6px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${porcentaje}%`,
            height: '100%',
            backgroundColor: porcentaje === 100 ? '#10b981' : '#38bdf8',
            transition: 'width 0.4s ease'
          }} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{porcentaje}%</span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(56, 189, 248, 0.25)',
      padding: '8px 14px',
      borderRadius: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: '200px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          📍 Ruta del Día
        </span>
        <span style={{ fontWeight: 800, color: porcentaje === 100 ? '#10b981' : '#38bdf8' }}>
          {completados} / {total} ({porcentaje}%)
        </span>
      </div>
      <div style={{
        width: '100%',
        height: '7px',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '6px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${porcentaje}%`,
          height: '100%',
          backgroundColor: porcentaje === 100 ? '#10b981' : '#38bdf8',
          boxShadow: '0 0 8px rgba(56, 189, 248, 0.5)',
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>
    </div>
  );
}
