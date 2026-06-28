'use client';
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthProvider';

export default function Sidebar({ onSelectEquipo, onSelectEmpresa, activeTab, onChangeTab }) {
  const { user, token } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState('');

  const [equipos, setEquipos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');

  const [generandoLibro, setGenerandoLibro] = useState(false);
  const [libroProgress, setLibroProgress] = useState(null);
  const [libroResult, setLibroResult] = useState(null);

  useEffect(() => {
    setLibroProgress(null);
    setLibroResult(null);
    setGenerandoLibro(false);
  }, [ubicacionSeleccionada]);

  const handleGenerarLibro = async () => {
    if (!ubicacionSeleccionada) return;
    setGenerandoLibro(true);
    setLibroResult(null);
    setLibroProgress("Generando...");

    // Start progress polling
    let intervalId = setInterval(async () => {
      try {
        const pRes = await fetch(`http://localhost:8000/api/libro/progreso/${ubicacionSeleccionada}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.status && pData.status !== "No iniciado") {
            setLibroProgress(pData.status);
          }
        }
      } catch (err) {
        console.error("Error polling progress:", err);
      }
    }, 1000);

    try {
      const res = await fetch(`http://localhost:8000/api/libro/generar/${ubicacionSeleccionada}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      clearInterval(intervalId);

      if (res.ok) {
        const data = await res.json();
        setLibroResult(data);
        setLibroProgress(null);
        alert("¡Libro por área generado con éxito!");
      } else {
        const errData = await res.json();
        setLibroProgress(`Error: ${errData.detail || 'Error al generar'}`);
        alert("Error al generar el libro por área: " + (errData.detail || JSON.stringify(errData)));
      }
    } catch (e) {
      clearInterval(intervalId);
      console.error(e);
      setLibroProgress("Error de conexión");
      alert("Error de conexión al generar el libro por área.");
    } finally {
      setGenerandoLibro(false);
    }
  };

  // 1. Cargar Empresas al inicio
  const fetchEmpresas = () => {
    if (!token) return;
    fetch('http://localhost:8000/api/empresas', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setEmpresas(data);
        if (data.length > 0 && !empresaSeleccionada) {
          setEmpresaSeleccionada(data[0].id); // Seleccionar Arauco por defecto
          if (onSelectEmpresa) onSelectEmpresa(data[0].id);
        }
      })
      .catch(err => console.error("Error fetching empresas:", err));
  };

  useEffect(() => {
    fetchEmpresas();
  }, [token]);

  // 2. Cargar Ubicaciones cuando cambia la empresa
  const fetchUbicaciones = () => {
    if (empresaSeleccionada && token) {
      fetch(`http://localhost:8000/api/ubicaciones?empresa_id=${empresaSeleccionada}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          setUbicaciones(data);
          if (data.length > 0) setUbicacionSeleccionada(data[0].id);
        })
        .catch(err => console.error("Error fetching ubicaciones:", err));
    } else {
      setUbicaciones([]);
      setUbicacionSeleccionada('');
    }
  };

  useEffect(() => {
    fetchUbicaciones();
  }, [empresaSeleccionada]);

  // 3. Cargar Equipos cuando cambia la ubicación
  const fetchEquipos = () => {
    if (ubicacionSeleccionada && token) {
      fetch(`http://localhost:8000/api/equipos?ubicacion_id=${ubicacionSeleccionada}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data && data.equipos) {
            setEquipos(data.equipos);
          }
        })
        .catch(err => console.error("Error fetching equipos:", err));
    } else {
      setEquipos([]);
    }
  };

  useEffect(() => {
    fetchEquipos();
  }, [ubicacionSeleccionada]);

  const handleAddEmpresa = async () => {
    const nombre = prompt("Nombre de la nueva empresa:");
    if (!nombre) return;
    const res = await fetch('http://localhost:8000/api/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nombre })
    });
    if (res.ok) fetchEmpresas();
    else alert("Error al agregar empresa");
  };

  const handleAddUbicacion = async () => {
    if (!empresaSeleccionada) return alert("Selecciona una empresa primero");
    const nombre = prompt("Nombre de la nueva ubicación técnica:");
    if (!nombre) return;
    const res = await fetch('http://localhost:8000/api/ubicaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nombre, empresa_id: parseInt(empresaSeleccionada) })
    });
    if (res.ok) fetchUbicaciones();
    else alert("Error al agregar ubicación");
  };

  const handleAddEquipo = async () => {
    if (!ubicacionSeleccionada) return alert("Selecciona una ubicación primero");
    const nombre = prompt("Nombre del equipo:");
    if (!nombre) return;
    const codigo = prompt("Código/Número del equipo:");
    if (!codigo) return;
    const res = await fetch('http://localhost:8000/api/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nombre, codigo, ubicacion_id: parseInt(ubicacionSeleccionada) })
    });
    if (res.ok) fetchEquipos();
    else alert("Error al agregar equipo");
  };

  const normalizeText = (text) => {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  };

  const equiposFiltrados = equipos.filter(e => {
    const estadoNorm = normalizeText(e.estado_actual);
    const isPending = estadoNorm === '' || estadoNorm === 'SIN DATOS' || estadoNorm === 'PENDIENTE';
    
    if (filtro === 'TODOS') return true;
    if (filtro === 'PENDIENTE') return isPending;
    
    // Comparar otros estados (Bueno, Regular, Critico) con normalización
    return estadoNorm === normalizeText(filtro);
  });

  return (
    <div className="sidebar glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '2px' }}>ASISTENTE DE INSPECCIÓN</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>ASSET MANAGEMENT · v1.0</div>
        </div>

        {/* Navigation Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
          <button 
            onClick={() => {
              if (onChangeTab) onChangeTab('MANUAL');
              onSelectEquipo(null);
            }} 
            style={{ 
              textAlign: 'left', 
              background: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS') ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS') ? 'white' : 'var(--text-secondary)', 
              borderLeft: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS') ? '4px solid var(--accent-primary)' : 'none', 
              borderRadius: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS') ? '4px 8px 8px 4px' : 'none', 
              padding: '12px' 
            }}>
            🌍 Global Map
          </button>
          <button 
            onClick={() => {
              if (onChangeTab) onChangeTab('REPORTS');
            }}
            style={{ 
              textAlign: 'left', 
              background: activeTab === 'REPORTS' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'REPORTS' ? 'white' : 'var(--text-secondary)', 
              borderLeft: activeTab === 'REPORTS' ? '4px solid var(--accent-primary)' : 'none', 
              borderRadius: activeTab === 'REPORTS' ? '4px 8px 8px 4px' : 'none', 
              padding: '12px' 
            }}>
            📄 Reports
          </button>
          <button 
            onClick={() => {
              if (onChangeTab) onChangeTab('SETTINGS');
            }}
            style={{ 
              textAlign: 'left', 
              background: activeTab === 'SETTINGS' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'SETTINGS' ? 'white' : 'var(--text-secondary)', 
              borderLeft: activeTab === 'SETTINGS' ? '4px solid var(--accent-primary)' : 'none', 
              borderRadius: activeTab === 'SETTINGS' ? '4px 8px 8px 4px' : 'none', 
              padding: '12px',
              cursor: 'pointer'
            }}>
            ⚙️ Settings
          </button>
        </div>
        
        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '1px' }}>
          🏢 Seleccionar Instancia
        </h4>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Empresa:</label>
            {user?.rol === 'admin' && (
              <button onClick={handleAddEmpresa} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>+</button>
            )}
          </div>
          <select value={empresaSeleccionada} onChange={(e) => {
            setEmpresaSeleccionada(e.target.value);
            if (onSelectEmpresa) onSelectEmpresa(e.target.value);
          }}>
            <option value="">-- Seleccionar Empresa --</option>
            {empresas.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ubicación Técnica:</label>
            {user?.rol === 'admin' && (
              <button onClick={handleAddUbicacion} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>+</button>
            )}
          </div>
          <select value={ubicacionSeleccionada} onChange={(e) => setUbicacionSeleccionada(e.target.value)}>
            <option value="">-- Seleccionar Ubicación --</option>
            {ubicaciones.map(ubi => (
              <option key={ubi.id} value={ubi.id}>{ubi.nombre}</option>
            ))}
          </select>
        </div>

        <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '1rem', letterSpacing: '1px' }}>
          🎯 Filtrar Activos
        </h4>

        
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Estado:</label>
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODOS">TODOS</option>
            <option value="BUENO">BUENOS</option>
            <option value="REGULAR">REGULARES</option>
            <option value="CRÍTICO">CRÍTICOS</option>
            <option value="FUERA DE RUTA">FUERA DE RUTA</option>
            <option value="PENDIENTE">PENDIENTES</option>
          </select>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equipo a inspeccionar:</label>
            {user?.rol === 'admin' && (
              <button onClick={handleAddEquipo} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>+</button>
            )}
          </div>
          <select onChange={(e) => onSelectEquipo(e.target.value)}>
            <option value="">-- Seleccionar --</option>
            {equiposFiltrados.map(e => (
              <option key={e.id} value={e.id}>{e.nombre} ({e.codigo})</option>
            ))}
          </select>
        </div>

        {ubicacionSeleccionada && (
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            borderRadius: '8px', 
            backgroundColor: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid rgba(255, 255, 255, 0.05)' 
          }}>
            <button 
              onClick={handleGenerarLibro} 
              disabled={generandoLibro}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '0.85rem', fontWeight: 'bold' }}
            >
              {generandoLibro ? 'Generando...' : '📖 Generar Libro por Área'}
            </button>
            
            {libroProgress && (
              <div style={{ 
                marginTop: '0.8rem', 
                fontSize: '0.8rem', 
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <span className="spinner" style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderTopColor: 'var(--accent-primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                {libroProgress}
              </div>
            )}
            
            {libroResult && (
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 'bold' }}>¡Libro generado con éxito!</span>
                <a 
                  href={`http://localhost:8000/api/libro/descargar/${libroResult.libro_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ 
                    padding: '8px', 
                    fontSize: '0.8rem', 
                    textDecoration: 'none', 
                    textAlign: 'center',
                    display: 'block',
                    fontWeight: 'bold'
                  }}
                >
                  Descargar PDF
                </a>
                {libroResult.drive_link && !libroResult.drive_link.includes('mock-link') && (
                  <a 
                    href={libroResult.drive_link}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ 
                      padding: '8px', 
                      fontSize: '0.8rem', 
                      textDecoration: 'none', 
                      textAlign: 'center',
                      display: 'block',
                      fontWeight: 'bold'
                    }}
                  >
                    Ver en Google Drive
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom section: Theme Toggles */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>🌙 Dark Mode</span>
          <input type="checkbox" defaultChecked style={{ width: 'auto' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>☀️ Light Mode</span>
          <input type="checkbox" style={{ width: 'auto' }} />
        </div>
      </div>
    </div>
  );
}
