'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthProvider';
import LibroValidationModal from './LibroValidationModal';

export default function Sidebar({ onSelectEquipo, onSelectEmpresa, activeTab, onChangeTab }) {
  const { user, token } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState('');

  const [equipos, setEquipos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');
  
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  }, []);

  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme);
      if (newTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  };

  const [generandoLibro, setGenerandoLibro] = useState(false);
  const [libroProgress, setLibroProgress] = useState(null);
  const [libroResult, setLibroResult] = useState(null);
  const [validationAlerts, setValidationAlerts] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Estados para Modal de Agregar Equipo con Drive
  const [showAddEquipoModal, setShowAddEquipoModal] = useState(false);
  const [nuevoEquipoNombre, setNuevoEquipoNombre] = useState('');
  const [nuevoEquipoCodigo, setNuevoEquipoCodigo] = useState('');
  const [crearCarpetaDrive, setCrearCarpetaDrive] = useState(true);
  const [parentFolderId, setParentFolderId] = useState('');
  const [driveAreas, setDriveAreas] = useState([]);
  const [driveAreasLoading, setDriveAreasLoading] = useState(false);
  const [creandoEquipo, setCreandoEquipo] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLibroProgress(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLibroResult(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGenerandoLibro(false);
  }, [ubicacionSeleccionada]);

  const handleCancelarLibro = async () => {
    if (!ubicacionSeleccionada) return;
    if (confirm("¿Está seguro de que desea detener la generación del libro por área?")) {
      try {
        await fetch(`http://localhost:8000/api/libro/cancelar/${ubicacionSeleccionada}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error("Error al cancelar la generación del libro:", err);
      }
    }
  };

  const handleGenerarLibro = async (e, overrideSoloAprobados = false) => {
    if (!ubicacionSeleccionada) return;
    
    // Si no es confirmación desde el modal (e !== null), validar primero
    if (e !== null && validationAlerts.length === 0 && !showValidationModal) {
      try {
        setLibroProgress("Validando criterios...");
        setGenerandoLibro(true);
        const valRes = await fetch(`http://localhost:8000/api/libro/validar/${ubicacionSeleccionada}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setGenerandoLibro(false);
        setLibroProgress(null);
        if (valRes.ok) {
          const valData = await valRes.json();
          if (valData.alertas && valData.alertas.length > 0) {
            setValidationAlerts(valData.alertas);
            setShowValidationModal(true);
            return;
          }
        }
      } catch (valErr) {
        console.error("Error al validar libro:", valErr);
        setGenerandoLibro(false);
        setLibroProgress(null);
      }
    }

    setShowValidationModal(false);
    setValidationAlerts([]);
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
      const res = await fetch(`http://localhost:8000/api/libro/generar/${ubicacionSeleccionada}?solo_aprobados=${overrideSoloAprobados}`, {
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
        if (errData.detail === "Generación cancelada por el usuario") {
          setLibroProgress("Cancelado por el usuario");
          alert("Generación cancelada por el usuario.");
        } else {
          setLibroProgress(`Error: ${errData.detail || 'Error al generar'}`);
          alert("Error al generar el libro por área: " + (errData.detail || JSON.stringify(errData)));
        }
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
  const fetchEmpresas = useCallback(() => {
    if (!token) return;
    fetch('http://localhost:8000/api/empresas', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        if (!res.ok) throw new Error("Error fetching empresas");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setEmpresas(data);
          if (data.length > 0 && !empresaSeleccionada) {
            setEmpresaSeleccionada(data[0].id); // Seleccionar Arauco por defecto
            if (onSelectEmpresa) onSelectEmpresa(data[0].id);
          }
        } else {
          setEmpresas([]);
        }
      })
      .catch(err => {
        console.error("Error fetching empresas:", err);
        setEmpresas([]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // 2. Cargar Ubicaciones cuando cambia la empresa
  const fetchUbicaciones = useCallback(() => {
    if (empresaSeleccionada && token) {
      fetch(`http://localhost:8000/api/ubicaciones?empresa_id=${empresaSeleccionada}`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => {
          if (!res.ok) throw new Error("Error fetching ubicaciones");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setUbicaciones(data);
            if (data.length > 0) setUbicacionSeleccionada(data[0].id);
          } else {
            setUbicaciones([]);
          }
        })
        .catch(err => {
          console.error("Error fetching ubicaciones:", err);
          setUbicaciones([]);
        });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUbicaciones([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUbicacionSeleccionada('');
    }
  }, [empresaSeleccionada, token]);

  useEffect(() => {
    fetchUbicaciones();
  }, [fetchUbicaciones]);

  // 3. Cargar Equipos cuando cambia la ubicación
  const fetchEquipos = useCallback(() => {
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEquipos([]);
    }
  }, [ubicacionSeleccionada, token]);

  useEffect(() => {
    fetchEquipos();
  }, [fetchEquipos]);

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

  const handleOpenAddEquipoModal = async () => {
    if (!ubicacionSeleccionada) return alert("Selecciona una ubicación primero");
    
    setNuevoEquipoNombre('');
    setNuevoEquipoCodigo('');
    setCrearCarpetaDrive(true);
    setParentFolderId('');
    setDriveAreas([]);
    setShowAddEquipoModal(true);
    
    setDriveAreasLoading(true);
    try {
      const rootRes = await fetch('http://localhost:8000/api/drive/root', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rootRes.ok) {
        const rootData = await rootRes.json();
        const rootId = rootData.root_id;
        
        const carpetasRes = await fetch(`http://localhost:8000/api/drive/carpetas?parent_id=${rootId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (carpetasRes.ok) {
          const carpetasData = await carpetasRes.json();
          const list = Object.entries(carpetasData.carpetas).map(([title, id]) => ({ id, title }));
          setDriveAreas(list);
          
          // Mapeo automático sugerido
          const ubiObj = ubicaciones.find(u => u.id.toString() === ubicacionSeleccionada);
          if (ubiObj) {
            const ubiNombreNorm = ubiObj.nombre.toLowerCase();
            const matchingArea = list.find(area => {
              const areaTitle = area.title.toLowerCase();
              return areaTitle.includes(ubiNombreNorm) || ubiNombreNorm.includes(areaTitle.replace(/^\d+-/, '').trim());
            });
            if (matchingArea) {
              setParentFolderId(matchingArea.id);
            } else if (list.length > 0) {
              setParentFolderId(list[0].id);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading drive areas:", err);
    } finally {
      setDriveAreasLoading(false);
    }
  };

  const handleSaveEquipo = async (e) => {
    e.preventDefault();
    if (!nuevoEquipoNombre.trim()) return alert("Debe ingresar el nombre del equipo");
    if (!nuevoEquipoCodigo.trim()) return alert("Debe ingresar el código del equipo");
    if (crearCarpetaDrive && !parentFolderId) return alert("Debe seleccionar una carpeta área de destino en Google Drive");
    
    setCreandoEquipo(true);
    try {
      const res = await fetch('http://localhost:8000/api/equipos/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ubicacion_id: parseInt(ubicacionSeleccionada),
          codigo: nuevoEquipoCodigo.trim(),
          nombre: nuevoEquipoNombre.trim(),
          crear_carpeta_drive: crearCarpetaDrive,
          parent_folder_id: parentFolderId,
          subcarpetas: ["Succion", "Impulsión"]
        })
      });
      
      if (res.ok) {
        setShowAddEquipoModal(false);
        fetchEquipos();
      } else {
        const errData = await res.json();
        alert("Error al agregar equipo: " + (errData.detail || "Desconocido"));
      }
    } catch (err) {
      console.error("Error saving equipo:", err);
      alert("Error de red al agregar equipo");
    } finally {
      setCreandoEquipo(false);
    }
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
              background: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS' && activeTab !== 'AUDIT') ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS' && activeTab !== 'AUDIT') ? 'white' : 'var(--text-secondary)', 
              borderLeft: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS' && activeTab !== 'AUDIT') ? '4px solid var(--accent-primary)' : 'none', 
              borderRadius: (activeTab !== 'REPORTS' && activeTab !== 'SETTINGS' && activeTab !== 'AUDIT') ? '4px 8px 8px 4px' : 'none', 
              padding: '12px' 
            }}>
            Global Map
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
          {(user?.rol === 'admin' || user?.rol === 'supervisor') && (
            <button 
              onClick={() => {
                if (onChangeTab) onChangeTab('AUDIT');
              }}
              style={{ 
                textAlign: 'left', 
                background: activeTab === 'AUDIT' ? 'rgba(255,255,255,0.1)' : 'transparent', 
                color: activeTab === 'AUDIT' ? 'white' : 'var(--text-secondary)', 
                borderLeft: activeTab === 'AUDIT' ? '4px solid var(--accent-primary)' : 'none', 
                borderRadius: activeTab === 'AUDIT' ? '4px 8px 8px 4px' : 'none', 
                padding: '12px',
                cursor: 'pointer'
              }}>
              📋 Auditoría
            </button>
          )}
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
              <button onClick={handleOpenAddEquipoModal} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>+</button>
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
                justifyContent: 'space-between',
                width: '100%',
                gap: '0.4rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                {generandoLibro && !libroProgress.includes("Error") && !libroProgress.includes("Completado") && !libroProgress.includes("Validando") && (
                  <button
                    onClick={handleCancelarLibro}
                    className="btn"
                    style={{
                      padding: '2px 8px',
                      fontSize: '0.75rem',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Detener
                  </button>
                )}
              </div>
            )}
            
            {showValidationModal && (
              <LibroValidationModal 
                alertas={validationAlerts}
                onConfirm={() => handleGenerarLibro(null, false)}
                onConfirmAprobados={() => handleGenerarLibro(null, true)}
                onClose={() => {
                  setShowValidationModal(false);
                  setValidationAlerts([]);
                }}
              />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1', fontSize: '0.9rem' }}>
          <span>Modo Oscuro 🌙</span>
          <input 
            type="checkbox" 
            checked={theme === 'dark'} 
            onChange={(e) => toggleTheme(e.target.checked ? 'dark' : 'light')} 
            style={{ width: 'auto', cursor: 'pointer' }} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#cbd5e1', fontSize: '0.9rem' }}>
          <span>Modo Sulvy (Claro) ☀️</span>
          <input 
            type="checkbox" 
            checked={theme === 'light'} 
            onChange={(e) => toggleTheme(e.target.checked ? 'light' : 'dark')} 
            style={{ width: 'auto', cursor: 'pointer' }} 
          />
        </div>
      </div>
      {/* Modal para Agregar Equipo con Destino en Drive */}
      {showAddEquipoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '2rem',
            backgroundColor: 'rgba(30, 41, 59, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', fontWeight: 700, margin: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              Añadir Nuevo Equipo
            </h3>

            <form onSubmit={handleSaveEquipo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nombre del Equipo</label>
                <input
                  type="text"
                  value={nuevoEquipoNombre}
                  onChange={(e) => setNuevoEquipoNombre(e.target.value)}
                  placeholder="BOMBA DE IMPULSIÓN 431"
                  required
                  disabled={creandoEquipo}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Código / Prefijo Técnico</label>
                <input
                  type="text"
                  value={nuevoEquipoCodigo}
                  onChange={(e) => setNuevoEquipoCodigo(e.target.value)}
                  placeholder="36-"
                  required
                  disabled={creandoEquipo}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                backgroundColor: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.05)',
                padding: '1rem',
                borderRadius: '8px',
                marginTop: '0.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="crearCarpetaCheck"
                    checked={crearCarpetaDrive}
                    onChange={(e) => setCrearCarpetaDrive(e.target.checked)}
                    disabled={creandoEquipo}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="crearCarpetaCheck" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    Crear estructura de carpetas en Google Drive
                  </label>
                </div>

                {crearCarpetaDrive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seleccionar Carpeta Área Destino</label>
                    {driveAreasLoading ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Cargando carpetas de Drive...</span>
                    ) : (
                      <select
                        value={parentFolderId}
                        onChange={(e) => setParentFolderId(e.target.value)}
                        disabled={creandoEquipo}
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                          outline: 'none',
                          width: '100%'
                        }}
                      >
                        <option value="">-- Seleccionar Carpeta Área --</option>
                        {driveAreas.map(area => (
                          <option key={area.id} value={area.id}>{area.title}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEquipoModal(false)}
                  disabled={creandoEquipo}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-secondary)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creandoEquipo}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: 'white',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {creandoEquipo ? (
                    <>
                      <span className="spinner" style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        border: '2px solid rgba(255,255,255,0.2)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      Creando en Drive...
                    </>
                  ) : (
                    'Guardar Equipo'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
