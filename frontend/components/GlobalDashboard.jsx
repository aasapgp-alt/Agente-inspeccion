import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function GlobalDashboard({ empresaId, onSelectEquipo, onSelectUbicacion, onChangeTab }) {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState({
    critical_alerts: 0,
    under_observation: 0,
    plants_up_to_date: 0,
    inspections_today: 0,
    pending_inspections: 0
  });
  
  const [factories, setFactories] = useState([]);
  const [equipments, setEquipments] = useState([]);
  
  // Selected views
  const [selectedCondition, setSelectedCondition] = useState(null); // 'CRITICO', 'REGULAR', 'PENDIENTE'
  const [selectedPlant, setSelectedPlant] = useState(null); // { id: X, name: Y }

  useEffect(() => {
    const urlParams = empresaId ? `?empresa_id=${empresaId}` : '';
    
    // Fetch stats
    fetch(`http://localhost:8000/api/dashboard/stats${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));

    // Fetch factory distribution list
    fetch(`http://localhost:8000/api/dashboard/factories${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setFactories(data))
      .catch(err => console.error(err));

    // Fetch all equipments with states for details filtering
    fetch(`http://localhost:8000/api/dashboard/history${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setEquipments(data))
      .catch(err => console.error(err));
  }, [empresaId, token]);

  const topMetrics = [
    { 
      id: 'CRITICO', 
      title: 'Alertas Críticas', 
      count: metrics.critical_alerts, 
      subtitle: 'Equipos en estado crítico - Reparación Urgente', 
      colorClass: 'glow-red',
      clickable: true
    },
    { 
      id: 'REGULAR', 
      title: 'Bajo Observación', 
      count: metrics.under_observation, 
      subtitle: 'Equipos en estado regular - Mantenimiento Programado', 
      colorClass: 'glow-yellow',
      clickable: true
    },
    { 
      id: 'PENDIENTE', 
      title: 'Pendientes', 
      count: metrics.pending_inspections, 
      subtitle: 'Activos sin inspección en campaña activa', 
      colorClass: 'glow-purple',
      clickable: true
    },
    { 
      id: 'AL_DIA', 
      title: 'Plantas al Día', 
      count: metrics.plants_up_to_date, 
      subtitle: 'Áreas con inspección completa en campaña activa', 
      colorClass: 'glow-green',
      clickable: false
    },
    { 
      id: 'HOY', 
      title: 'Inspecciones de Hoy', 
      count: metrics.inspections_today, 
      subtitle: 'Instancias de inspección del día', 
      colorClass: 'glow-blue',
      clickable: false
    },
  ];

  // Helper to handle equipment click
  const handleAnalyzeEquipment = (eqId) => {
    if (onSelectEquipo) onSelectEquipo(eqId.toString());
    if (onChangeTab) onChangeTab('FACTORY');
  };

  // 1. Detailed plant view
  if (selectedPlant) {
    const plantEquips = equipments.filter(eq => eq.ubicacion_id === selectedPlant.id);
    const plantTotal = plantEquips.length;
    const plantCriticos = plantEquips.filter(eq => eq.estado_actual === 'CRITICO').length;
    const plantRegulares = plantEquips.filter(eq => eq.estado_actual === 'REGULAR').length;
    const plantPendientes = plantEquips.filter(eq => eq.estado_actual === 'PENDIENTE').length;
    const plantBuenos = plantEquips.filter(eq => eq.estado_actual === 'BUENO' || eq.estado_actual === 'BUENOS').length;
    const plantICA = plantTotal > 0 ? round((plantCriticos / plantTotal) * 100, 1) : 0.0;

    function round(value, decimals) {
      return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
    }

    const plantMetrics = [
      { title: 'Alertas Críticas', count: plantCriticos, subtitle: 'Reparación Urgente Requerida', colorClass: 'glow-red' },
      { title: 'Bajo Observación', count: plantRegulares, subtitle: 'Mantenimiento Programado', colorClass: 'glow-yellow' },
      { title: 'Pendientes', count: plantPendientes, subtitle: 'Sin inspección en campaña', colorClass: 'glow-purple' },
      { title: 'Índice Criticidad (ICA)', count: `${plantICA}%`, subtitle: 'Porcentaje de activos críticos', colorClass: 'glow-orange' }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>VISTA DETALLADA DE PLANTA</div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginTop: '0.2rem' }}>Planta: {selectedPlant.name}</h1>
          </div>
          <button 
            onClick={() => {
              setSelectedPlant(null);
              if (onSelectUbicacion) onSelectUbicacion(''); // Clear sidebar select
            }}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            ← Volver al Dashboard Global
          </button>
        </div>

        {/* Local Plant Metrics Row */}
        <div className="dashboard-plant-metrics-grid">
          {plantMetrics.map((m, i) => (
            <div key={i} className={`glow-card ${m.colorClass}`}>
              <h3>{m.title}</h3>
              <div className="number-big">{m.count}</div>
              <p className="card-subtitle">{m.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Mini progress bar of distribution */}
        <div className="glass-panel" style={{ padding: '1.2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '0.8rem', color: 'var(--text-primary)' }}>Distribución Física del Área</h3>
          <div className="progress-container" style={{ height: '26px', borderRadius: '6px', overflow: 'hidden', display: 'flex', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            {plantBuenos > 0 && (
              <div style={{ 
                backgroundColor: '#10b981', 
                width: `${(plantBuenos / plantTotal) * 100}%`, 
                color: 'white', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} title={`Buenos: ${plantBuenos}`}>
                Bueno: {plantBuenos}
              </div>
            )}
            {plantRegulares > 0 && (
              <div style={{ 
                backgroundColor: '#f59e0b', 
                width: `${(plantRegulares / plantTotal) * 100}%`, 
                color: 'white', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} title={`Regulares: ${plantRegulares}`}>
                Regular: {plantRegulares}
              </div>
            )}
            {plantCriticos > 0 && (
              <div style={{ 
                backgroundColor: '#ef4444', 
                width: `${(plantCriticos / plantTotal) * 100}%`, 
                color: 'white', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} title={`Críticos: ${plantCriticos}`}>
                Crítico: {plantCriticos}
              </div>
            )}
            {plantPendientes > 0 && (
              <div style={{ 
                backgroundColor: '#a855f7', 
                width: `${(plantPendientes / plantTotal) * 100}%`, 
                color: 'white', 
                fontSize: '0.75rem', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }} title={`Pendientes: ${plantPendientes}`}>
                Pendiente: {plantPendientes}
              </div>
            )}
          </div>
        </div>

        {/* Equipments Table */}
        <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Equipos en esta Área / Planta ({plantTotal})</h2>
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Código / Tag</th>
                <th style={{ padding: '0.75rem 1rem' }}>Nombre / Descripción</th>
                <th style={{ padding: '0.75rem 1rem' }}>Estado Actual</th>
                <th style={{ padding: '0.75rem 1rem' }}>Último Diagnóstico</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {plantEquips.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No hay equipos registrados en esta planta.
                  </td>
                </tr>
              ) : (
                plantEquips.map((eq) => {
                  let stateColor = '#3fa86b';
                  if (eq.estado_actual === 'CRITICO') stateColor = '#e0533d';
                  else if (eq.estado_actual === 'REGULAR') stateColor = '#e0a32e';
                  else if (eq.estado_actual === 'PENDIENTE') stateColor = '#a855f7';

                  return (
                    <tr 
                      key={eq.id} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{eq.tag_codigo}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>{eq.descripcion}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: `${stateColor}1a`,
                          color: stateColor,
                          border: `1px solid ${stateColor}33`,
                        }}>
                          {eq.estado_actual}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={eq.diagnostico}>
                        {eq.diagnostico || 'Sin diagnóstico registrado.'}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleAnalyzeEquipment(eq.id)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
                        >
                          🔍 Analizar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 2. Clicked card detailed filter view
  if (selectedCondition) {
    const filteredEquips = equipments.filter(eq => {
      if (selectedCondition === 'CRITICO') return eq.estado_actual === 'CRITICO';
      if (selectedCondition === 'REGULAR') return eq.estado_actual === 'REGULAR';
      if (selectedCondition === 'PENDIENTE') return eq.estado_actual === 'PENDIENTE';
      return false;
    });

    const conditionTitle = selectedCondition === 'CRITICO' ? 'Alertas Críticas' :
                           selectedCondition === 'REGULAR' ? 'Bajo Observación' : 'Pendientes de Inspección';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Equipos en Estado: {conditionTitle}</h1>
          <button 
            onClick={() => setSelectedCondition(null)}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            ← Volver al Panel de Control
          </button>
        </div>

        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Código / Tag</th>
                <th style={{ padding: '0.75rem 1rem' }}>Descripción / Nombre</th>
                <th style={{ padding: '0.75rem 1rem' }}>Área / Ubicación</th>
                <th style={{ padding: '0.75rem 1rem' }}>Estado Actual</th>
                <th style={{ padding: '0.75rem 1rem' }}>Último Diagnóstico</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquips.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No hay equipos en esta condición.
                  </td>
                </tr>
              ) : (
                filteredEquips.map((eq) => {
                  let stateColor = '#3fa86b';
                  if (eq.estado_actual === 'CRITICO') stateColor = '#e0533d';
                  else if (eq.estado_actual === 'REGULAR') stateColor = '#e0a32e';
                  else if (eq.estado_actual === 'PENDIENTE') stateColor = '#a855f7';

                  return (
                    <tr 
                      key={eq.id} 
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '0.9rem 1rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{eq.tag_codigo}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>{eq.descripcion}</td>
                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)' }}>{eq.area_nombre}</td>
                      <td style={{ padding: '0.9rem 1rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: `${stateColor}1a`,
                          color: stateColor,
                          border: `1px solid ${stateColor}33`,
                        }}>
                          {eq.estado_actual}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={eq.diagnostico}>
                        {eq.diagnostico || 'Sin diagnóstico registrado.'}
                      </td>
                      <td style={{ padding: '0.9rem 1rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleAnalyzeEquipment(eq.id)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            backgroundColor: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-primary)'}
                        >
                          🔍 Analizar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '2rem' }}>
      
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Panel de Control Global</h1>

      {/* Metrics Row */}
      <div className="dashboard-metrics-grid">
        {topMetrics.map((metric, i) => (
          <div 
            key={i} 
            className={`glow-card ${metric.colorClass}`}
            onClick={() => metric.clickable && setSelectedCondition(metric.id)}
            style={{
              cursor: metric.clickable ? 'pointer' : 'default',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => metric.clickable && (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => metric.clickable && (e.currentTarget.style.transform = 'translateY(0px)')}
            title={metric.clickable ? "Haga clic para ver los equipos en esta condición" : ""}
          >
            <h3>{metric.title}</h3>
            <div className="number-big">{metric.count}</div>
            <p className="card-subtitle">{metric.subtitle}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '1rem' }}>Vista por Área / Planta</h2>

      {/* Factories Grid Row */}
      <div className="dashboard-factories-grid">
        {factories.map((factory, i) => (
          <div key={i} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>{factory.name}</h3>
            
            <div className="progress-container">
              <div className="progress-segment progress-green" style={{ width: `${factory.good}%` }} title={`Buenos: ${factory.good}%`}>{factory.good}%</div>
              <div className="progress-segment progress-yellow" style={{ width: `${factory.alert}%` }} title={`Regulares: ${factory.alert}%`}>{factory.alert}%</div>
              <div className="progress-segment progress-red" style={{ width: `${factory.broken}%` }} title={`Críticos: ${factory.broken}%`}>{factory.broken}%</div>
            </div>

            <div className="legend" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div className="dot green" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-good)' }}></div> Bueno</div>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div className="dot yellow" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-regular)' }}></div> Regular</div>
              <div className="legend-item" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><div className="dot red" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-critical)' }}></div> Crítico</div>
            </div>

            <button 
              onClick={() => {
                setSelectedPlant(factory);
                if (onSelectUbicacion) onSelectUbicacion(factory.id.toString());
              }}
              style={{ 
                width: '100%', 
                marginTop: '1.2rem', 
                background: 'rgba(255,255,255,0.05)', 
                color: 'var(--text-primary)', 
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '8px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem',
                transition: 'background 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
            >
              👉 INGRESAR A LA PLANTA
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
