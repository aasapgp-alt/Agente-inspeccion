import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

export default function GlobalDashboard({ empresaId }) {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState({
    critical_alerts: 12,
    under_observation: 28,
    plants_up_to_date: 15,
    inspections_today: 8
  });
  
  const [factories, setFactories] = useState([
    { name: 'Planta Química Norte', good: 65, alert: 20, broken: 10 },
    { name: 'Refinería Sur', good: 60, alert: 25, broken: 10 },
    { name: 'Planta de Gas Este', good: 65, alert: 20, broken: 10 }
  ]);

  useEffect(() => {
    const urlParams = empresaId ? `?empresa_id=${empresaId}` : '';
    
    fetch(`http://localhost:8000/api/dashboard/stats${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setMetrics(data))
      .catch(err => console.error(err));

    fetch(`http://localhost:8000/api/dashboard/factories${urlParams}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setFactories(data))
      .catch(err => console.error(err));
  }, [empresaId]);

  const topMetrics = [
    { title: 'Critical Alerts', count: metrics.critical_alerts, subtitle: 'Items Rejected - Urgent Repair Required', colorClass: 'glow-red' },
    { title: 'Under Observation', count: metrics.under_observation, subtitle: 'Piping with Minor Flaws (e.g., Small Bubbles)', colorClass: 'glow-yellow' },
    { title: 'Plants Up to Date', count: metrics.plants_up_to_date, subtitle: 'Factories with Inspections Complete', colorClass: 'glow-green' },
    { title: 'Inspections Today', count: metrics.inspections_today, subtitle: 'Evaluation Instances (from Telegram)', colorClass: 'glow-blue' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '2rem' }}>
      
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Global Control Panel</h1>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        {topMetrics.map((metric, i) => (
          <div key={i} className={`glow-card ${metric.colorClass}`}>
            <h3>{metric.title}</h3>
            <div className="number-big">{metric.count}</div>
            <p className="card-subtitle">{metric.subtitle}</p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '1rem' }}>FACTORY VIEW</h2>

      {/* Factories Grid Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', paddingBottom: '2rem' }}>
        {factories.map((factory, i) => (
          <div key={i} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>{factory.name}</h3>
            
            <div className="progress-container">
              <div className="progress-segment progress-green" style={{ width: `${factory.good}%` }}>{factory.good}%</div>
              <div className="progress-segment progress-yellow" style={{ width: `${factory.alert}%` }}>{factory.alert}%</div>
              <div className="progress-segment progress-red" style={{ width: `${factory.broken}%` }}>{factory.broken}%</div>
            </div>

            <div className="legend">
              <div className="legend-item"><div className="dot green"></div> Good</div>
              <div className="legend-item"><div className="dot yellow"></div> Alert</div>
              <div className="legend-item"><div className="dot red"></div> Broken</div>
            </div>

            <button style={{ width: '100%', marginTop: '1rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.2)' }}>
              👉 ENTER PLANT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
