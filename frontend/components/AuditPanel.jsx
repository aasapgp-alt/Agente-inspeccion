'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function AuditPanel() {
  const { token, user } = useAuth();
  
  // State for logs
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination State
  const [limit] = useState(15);
  const [page, setPage] = useState(1);
  
  // Filter States
  const [usuarios, setUsuarios] = useState([]);
  const [acciones, setAcciones] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [selectedAccion, setSelectedAccion] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  
  // Expanded log ID for details
  const [expandedLogId, setExpandedLogId] = useState(null);

  const fetchFiltersData = async () => {
    try {
      // Fetch users
      const usersRes = await fetch('http://localhost:8000/api/auth/usuarios', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsuarios(usersData);
      }
      
      // Fetch actions list
      const actionsRes = await fetch('http://localhost:8000/api/audit/acciones', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (actionsRes.ok) {
        const actionsData = await actionsRes.json();
        setAcciones(actionsData);
      }
    } catch (err) {
      console.error("Error al cargar filtros de auditoría:", err);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * limit;
      let url = `http://localhost:8000/api/audit/logs?limit=${limit}&offset=${offset}`;
      
      if (selectedUsuario) {
        url += `&usuario_id=${selectedUsuario}`;
      }
      if (selectedAccion) {
        url += `&accion=${selectedAccion}`;
      }
      if (fechaDesde) {
        url += `&fecha_desde=${fechaDesde}`;
      }
      if (fechaHasta) {
        url += `&fecha_hasta=${fechaHasta}`;
      }
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || 'Error al obtener logs de auditoría');
      }
      
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchFiltersData();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchLogs();
    }
  }, [token, page, selectedUsuario, selectedAccion, fechaDesde, fechaHasta]);

  const handleResetFilters = () => {
    setSelectedUsuario('');
    setSelectedAccion('');
    setFechaDesde('');
    setFechaHasta('');
    setPage(1);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getActionBadgeStyle = (accion) => {
    const act = accion.toUpperCase();
    let bg = 'rgba(148, 163, 184, 0.1)';
    let color = '#94a3b8';
    
    if (act.includes('LOGIN')) {
      bg = 'rgba(16, 185, 129, 0.12)';
      color = '#34d399';
    } else if (act.includes('LOGOUT')) {
      bg = 'rgba(239, 68, 68, 0.12)';
      color = '#fca5a5';
    } else if (act.includes('CREAR')) {
      bg = 'rgba(14, 165, 233, 0.12)';
      color = '#38bdf8';
    } else if (act.includes('ELIMINAR')) {
      bg = 'rgba(220, 38, 38, 0.2)';
      color = '#f87171';
    } else if (act.includes('MODIFICACION') || act.includes('ACTUALIZAR')) {
      bg = 'rgba(245, 158, 11, 0.12)';
      color = '#fbbf24';
    } else if (act.includes('GENERAR')) {
      bg = 'rgba(139, 92, 246, 0.12)';
      color = '#c084fc';
    }
    
    return {
      backgroundColor: bg,
      color: color,
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 600,
      display: 'inline-block',
      letterSpacing: '0.5px'
    };
  };

  const renderDetails = (detalles) => {
    if (!detalles) return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sin detalles adicionales</span>;
    
    try {
      const parsed = JSON.parse(detalles);
      
      // Si son diferencias estructuradas (antes vs ahora)
      if (typeof parsed === 'object' && parsed !== null) {
        // Caso de log de login
        if (parsed.resultado && parsed.ip) {
          return (
            <div style={{ fontSize: '0.85rem' }}>
              <strong>Resultado:</strong> <span style={{ color: parsed.resultado.includes('EXITOSO') ? '#34d399' : '#f87171' }}>{parsed.resultado}</span>
              <br />
              <strong>IP Origen:</strong> {parsed.ip}
            </div>
          );
        }

        // Caso genérico de modificaciones
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--accent-primary)', marginBottom: '0.2rem' }}>Campos Modificados:</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '6px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Campo</th>
                  <th style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Antes</th>
                  <th style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Ahora</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(parsed).map(([key, val]) => (
                  <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{key}</td>
                    <td style={{ padding: '6px 10px', color: '#fca5a5', whiteSpace: 'pre-wrap' }}>{String(val.antes || 'None')}</td>
                    <td style={{ padding: '6px 10px', color: '#a7f3d0', whiteSpace: 'pre-wrap' }}>{String(val.ahora || 'None')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      return <pre style={{ margin: 0, fontSize: '0.8rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{JSON.stringify(parsed, null, 2)}</pre>;
    } catch (e) {
      return <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{detalles}</span>;
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', fontFamily: 'var(--font-sans)' }}>
      {/* Cabecera */}
      <div>
        <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span>📋</span> Registro de Auditoría (Action Logs)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Consulte la traza de actividad del sistema, incluyendo inicios de sesión, cierres de sesión, modificaciones de inspecciones y cambios estructurales.
        </p>
      </div>

      {/* Filtros */}
      <div className="glass-panel" style={{ padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          🔍 Filtros de Actividad
        </h3>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Filtro Usuario */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Usuario:</label>
            <select
              value={selectedUsuario}
              onChange={(e) => { setSelectedUsuario(e.target.value); setPage(1); }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                width: '100%'
              }}
            >
              <option value="">Todos los usuarios</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>@{u.username} ({u.nombre_completo})</option>
              ))}
            </select>
          </div>

          {/* Filtro Acción */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 200px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Acción:</label>
            <select
              value={selectedAccion}
              onChange={(e) => { setSelectedAccion(e.target.value); setPage(1); }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                width: '100%'
              }}
            >
              <option value="">Todas las acciones</option>
              {acciones.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Filtro Fecha Desde */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPage(1); }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>

          {/* Filtro Fecha Hasta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPage(1); }}
              style={{
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>

          {/* Botón Reset */}
          <button
            onClick={handleResetFilters}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-secondary)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s',
              height: '37px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
          >
            Restablecer
          </button>
        </div>
      </div>

      {/* Contenido Logs */}
      <div className="glass-panel" style={{ flex: 1, padding: '1.25rem', backgroundColor: 'rgba(15, 23, 42, 0.2)', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '0.85rem 1.25rem', color: '#fca5a5', fontSize: '0.85rem' }}>
            ❌ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '40px', height: '40px', border: '3px solid rgba(14, 165, 233, 0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cargando logs de auditoría...</p>
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '3rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📭</span>
            <h3>No se encontraron registros</h3>
            <p style={{ fontSize: '0.85rem' }}>Intente cambiar las opciones de los filtros o restablecer la búsqueda.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Tabla de Logs */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)', position: 'sticky', top: 0, backgroundColor: 'rgba(15,23,42,0.95)', zIndex: 1 }}>
                    <th style={{ padding: '12px 16px' }}>Fecha y Hora</th>
                    <th style={{ padding: '12px 16px' }}>Usuario</th>
                    <th style={{ padding: '12px 16px' }}>Acción</th>
                    <th style={{ padding: '12px 16px' }}>Recurso</th>
                    <th style={{ padding: '12px 16px' }}>ID Recurso</th>
                    <th style={{ padding: '12px 16px' }}>Dirección IP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Detalles</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)', 
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => { if(!isExpanded) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'; }}
                          onMouseLeave={(e) => { if(!isExpanded) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 500 }}>{formatDate(log.created_at)}</td>
                          <td style={{ padding: '12px 16px' }}>
                            {log.username ? (
                              <div>
                                <span style={{ fontWeight: 600, color: 'white' }}>@{log.username}</span>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.usuario_nombre}</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Sistema</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={getActionBadgeStyle(log.accion)}>{log.accion}</span>
                          </td>
                          <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>{log.tabla || '-'}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.registro_id || '-'}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>{log.ip_address || '-'}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--accent-primary)' }}>
                            {isExpanded ? '▲ Ocultar' : '▼ Expandir'}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} style={{ padding: '1.5rem', backgroundColor: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                              <div style={{ borderLeft: '3px solid var(--accent-primary)', paddingLeft: '1rem' }}>
                                {renderDetails(log.detalles)}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Mostrando <strong>{logs.length}</strong> de <strong>{total}</strong> registros
              </span>
              
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  style={{
                    backgroundColor: page <= 1 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: page <= 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  ◀ Anterior
                </button>
                
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Página <strong>{page}</strong> de <strong>{totalPages}</strong>
                </span>

                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  style={{
                    backgroundColor: page >= totalPages ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: page >= totalPages ? 'rgba(255,255,255,0.1)' : 'var(--text-primary)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  Siguiente ▶
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
