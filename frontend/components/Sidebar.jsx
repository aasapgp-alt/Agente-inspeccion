'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiService, API_BASE_URL } from '../services/api';
import { useAuth } from './AuthProvider';
import LibroValidationModal from './LibroValidationModal';
import DriveFolderSelector from './DriveFolderSelector';

export default function Sidebar({ onSelectEquipo, equipoSeleccionado, onSelectEmpresa, empresaSeleccionada: propEmpresaId, activeTab, onChangeTab, selectedUbicacionId, onSelectUbicacion }) {
  const { user, token } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [ubicaciones, setUbicaciones] = useState([]);
  
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(propEmpresaId ? propEmpresaId.toString() : '');
  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState('');

  const [equipos, setEquipos] = useState([]);
  const [filtro, setFiltro] = useState('TODOS');
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    if (propEmpresaId !== undefined && propEmpresaId !== null && propEmpresaId !== '') {
      setEmpresaSeleccionada(propEmpresaId.toString());
    }
  }, [propEmpresaId]);

  useEffect(() => {
    if (selectedUbicacionId !== undefined && selectedUbicacionId !== null) {
      setUbicacionSeleccionada(selectedUbicacionId.toString());
    } else if (selectedUbicacionId === null || selectedUbicacionId === '') {
      setUbicacionSeleccionada('');
    }
  }, [selectedUbicacionId]);

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
  const [validationKpis, setValidationKpis] = useState(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  // Estados para Modal de Agregar Equipo con Drive
  const [showAddEquipoModal, setShowAddEquipoModal] = useState(false);
  const [nuevoEquipoNombre, setNuevoEquipoNombre] = useState('');
  const [nuevoEquipoCodigo, setNuevoEquipoCodigo] = useState('');
  const [crearCarpetaDrive, setCrearCarpetaDrive] = useState(true);
  const [parentFolderId, setParentFolderId] = useState('');
  const [creandoEquipo, setCreandoEquipo] = useState(false);

  // Estados para Modal de Agregar Ubicación con Drive
  const [showAddUbiModal, setShowAddUbiModal] = useState(false);
  const [nuevaUbiNombre, setNuevaUbiNombre] = useState('');
  const [nuevaUbiCodigo, setNuevaUbiCodigo] = useState('');
  const [nuevaUbiDescripcion, setNuevaUbiDescripcion] = useState('');
  const [crearUbiCarpetaDrive, setCrearUbiCarpetaDrive] = useState(true);
  const [ubiParentFolderId, setUbiParentFolderId] = useState('');
  const [creandoUbi, setCreandoUbi] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLibroProgress(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLibroResult(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGenerandoLibro(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusquedaEquipo('');
  }, [ubicacionSeleccionada]);

  const handleCancelarLibro = async () => {
    if (!ubicacionSeleccionada) return;
    if (confirm("¿Está seguro de que desea detener la generación del libro por área?")) {
      try {
        await fetch(`${API_BASE_URL}/libro/cancelar/${ubicacionSeleccionada}`, {
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
        const valRes = await fetch(`${API_BASE_URL}/libro/validar/${ubicacionSeleccionada}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setGenerandoLibro(false);
        setLibroProgress(null);
        if (valRes.ok) {
          const valData = await valRes.json();
          setValidationKpis(valData.kpis || null);
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
    setValidationKpis(null);
    setGenerandoLibro(true);
    setLibroResult(null);
    setLibroProgress("Generando...");

    // Start progress polling
    let intervalId = setInterval(async () => {
      try {
        const pRes = await fetch(`${API_BASE_URL}/libro/progreso/${ubicacionSeleccionada}`, {
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
      const res = await fetch(`${API_BASE_URL}/libro/generar/${ubicacionSeleccionada}?solo_aprobados=${overrideSoloAprobados}`, {
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
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
    if (!activeToken) return;
    fetch(`${API_BASE_URL}/empresas`, { headers: { 'Authorization': `Bearer ${activeToken}` } })
      .then(res => {
        if (!res.ok) throw new Error("Error fetching empresas");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setEmpresas(data);
          if (data.length > 0 && !empresaSeleccionada) {
            setEmpresaSeleccionada(data[0].id.toString());
            if (onSelectEmpresa) onSelectEmpresa(data[0].id.toString());
          }
        } else {
          setEmpresas([]);
        }
      })
      .catch(err => {
        console.error("Error fetching empresas:", err);
        setEmpresas([]);
      });
  }, [token, empresaSeleccionada, onSelectEmpresa]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  // 2. Cargar Ubicaciones cuando cambia la empresa
  const fetchUbicaciones = useCallback(() => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
    if (empresaSeleccionada && activeToken) {
      fetch(`${API_BASE_URL}/ubicaciones?empresa_id=${empresaSeleccionada}`, { headers: { 'Authorization': `Bearer ${activeToken}` } })
        .then(res => {
          if (!res.ok) throw new Error("Error fetching ubicaciones");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setUbicaciones(data);
            if (data.length > 0) {
              setUbicacionSeleccionada(prev => {
                const exists = data.some(u => u.id.toString() === prev?.toString());
                const nextVal = exists ? prev : data[0].id.toString();
                if (onSelectUbicacion && nextVal !== prev) onSelectUbicacion(nextVal);
                return nextVal;
              });
            } else {
              setUbicacionSeleccionada('');
              if (onSelectUbicacion) onSelectUbicacion('');
            }
          } else {
            setUbicaciones([]);
          }
        })
        .catch(err => {
          console.error("Error fetching ubicaciones:", err);
          setUbicaciones([]);
        });
    } else {
      setUbicaciones([]);
      setUbicacionSeleccionada('');
      if (onSelectUbicacion) onSelectUbicacion('');
    }
  }, [empresaSeleccionada, token, onSelectUbicacion]);

  useEffect(() => {
    fetchUbicaciones();
  }, [fetchUbicaciones]);

  // 3. Cargar Equipos cuando cambia la ubicación
  const fetchEquipos = useCallback(() => {
    const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');
    if (ubicacionSeleccionada && activeToken) {
      fetch(`${API_BASE_URL}/equipos?ubicacion_id=${ubicacionSeleccionada}`, { headers: { 'Authorization': `Bearer ${activeToken}` } })
        .then(res => res.json())
        .then(data => {
          if (data && data.equipos) {
            setEquipos(data.equipos);
          } else if (Array.isArray(data)) {
            setEquipos(data);
          } else {
            setEquipos([]);
          }
        })
        .catch(err => {
          console.error("Error fetching equipos:", err);
          setEquipos([]);
        });
    } else {
      setEquipos([]);
    }
  }, [ubicacionSeleccionada, token]);

  useEffect(() => {
    fetchEquipos();
    
    // Polling cada 20 segundos para mantener el sidebar sincronizado
    const intervalId = setInterval(() => {
      fetchEquipos();
    }, 20000);
    
    return () => clearInterval(intervalId);
  }, [fetchEquipos]);

  const handleAddEmpresa = async () => {
    const nombre = prompt("Nombre de la nueva empresa:");
    if (!nombre) return;
    const res = await fetch(`${API_BASE_URL}/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nombre })
    });
    if (res.ok) fetchEmpresas();
    else alert("Error al agregar empresa");
  };

  const handleOpenAddUbiModal = () => {
    if (!empresaSeleccionada) return alert("Selecciona una empresa primero");
    setNuevaUbiNombre('');
    setNuevaUbiCodigo('');
    setNuevaUbiDescripcion('');
    setCrearUbiCarpetaDrive(true);
    setUbiParentFolderId('');
    setShowAddUbiModal(true);
  };

  const handleSaveUbicacion = async (e) => {
    e.preventDefault();
    if (!nuevaUbiNombre.trim()) return alert("Debe ingresar el nombre de la ubicación técnica");
    
    setCreandoUbi(true);
    try {
      let finalFolderId = null;
      if (crearUbiCarpetaDrive) {
        const parentId = ubiParentFolderId || 'root';
        const folderName = nuevaUbiNombre.trim();
        
        const folderRes = await fetch(`${API_BASE_URL}/drive/crear_carpeta`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            nombre: folderName,
            parent_id: parentId
          })
        });
        
        if (folderRes.ok) {
          const folderData = await folderRes.json();
          finalFolderId = folderData.id;
        } else {
          const errData = await folderRes.json();
          console.error("Error al crear carpeta en Drive para ubicación:", errData);
          if (!confirm("No se pudo crear la carpeta en Google Drive. ¿Desea crear la ubicación técnica de todas formas sin carpeta de Drive?")) {
            setCreandoUbi(false);
            return;
          }
        }
      }
      
      const res = await fetch(`${API_BASE_URL}/ubicaciones`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          nombre: nuevaUbiNombre.trim(), 
          empresa_id: parseInt(empresaSeleccionada),
          codigo: nuevaUbiCodigo.trim() || null,
          descripcion: nuevaUbiDescripcion.trim() || null,
          drive_folder_id: finalFolderId
        })
      });
      
      if (res.ok) {
        setShowAddUbiModal(false);
        fetchUbicaciones();
      } else {
        const errData = await res.json();
        alert("Error al agregar ubicación: " + (errData.detail || "Desconocido"));
      }
    } catch (err) {
      console.error("Error saving ubicación:", err);
      alert("Error de red al agregar ubicación");
    } finally {
      setCreandoUbi(false);
    }
  };

  const handleDeleteUbicacion = async () => {
    if (!ubicacionSeleccionada) return;
    const ubiObj = ubicaciones.find(u => u.id.toString() === ubicacionSeleccionada.toString());
    if (!ubiObj) return;
    
    if (confirm(`¿Está seguro de que desea eliminar el área / ubicación técnica "${ubiObj.nombre}"?`)) {
      try {
        const res = await fetch(`${API_BASE_URL}/ubicaciones/${ubicacionSeleccionada}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          alert("Área / ubicación técnica eliminada correctamente");
          setUbicacionSeleccionada('');
          fetchUbicaciones();
        } else {
          const errData = await res.json();
          alert("Error al eliminar: " + (errData.detail || "Desconocido"));
        }
      } catch (err) {
        console.error("Error deleting ubicación:", err);
        alert("Error de conexión al eliminar el área / ubicación");
      }
    }
  };

  const handleOpenAddEquipoModal = () => {
    if (!ubicacionSeleccionada) return alert("Selecciona una ubicación primero");
    setNuevoEquipoNombre('');
    setNuevoEquipoCodigo('');
    setCrearCarpetaDrive(true);
    setParentFolderId('');
    setShowAddEquipoModal(true);
  };

  const handleSaveEquipo = async (e) => {
    e.preventDefault();
    if (!nuevoEquipoNombre.trim()) return alert("Debe ingresar el nombre del equipo");
    if (!nuevoEquipoCodigo.trim()) return alert("Debe ingresar el código del equipo");
    if (crearCarpetaDrive && !parentFolderId) return alert("Debe seleccionar una carpeta de destino en Google Drive");
    
    setCreandoEquipo(true);
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/`, {
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

  const getDriveFolderInfo = (equipo) => {
    if (!equipo) return { order: 999999, prefix: '' };
    if (equipo.drive_folder_nombre) {
      const match = equipo.drive_folder_nombre.match(/^(\d+[a-zA-Z]*)[-\s]/);
      if (match) {
        const numPart = parseInt(match[1], 10);
        return {
          order: isNaN(numPart) ? 999999 : numPart,
          prefix: `[${match[1]}] `
        };
      }
    }
    const codeNum = parseInt(equipo.codigo, 10);
    return {
      order: isNaN(codeNum) ? 999999 : codeNum,
      prefix: ''
    };
  };

  const equiposFiltrados = equipos
    .filter(e => {
      const estadoNorm = normalizeText(e.estado_actual);
      const isPending = estadoNorm === '' || estadoNorm === 'SIN DATOS' || estadoNorm === 'PENDIENTE';
      
      // 1. Filtro por Estado
      let coincideEstado = true;
      if (filtro === 'PENDIENTE') coincideEstado = isPending;
      else if (filtro !== 'TODOS') coincideEstado = (estadoNorm === normalizeText(filtro));
      
      if (!coincideEstado) return false;

      // 2. Filtro por Búsqueda de Texto (Nombre, Código, Tag, Material, Carpeta Drive)
      if (busquedaEquipo.trim()) {
        const q = normalizeText(busquedaEquipo);
        const nombre = normalizeText(e.nombre);
        const codigo = normalizeText(e.codigo);
        const tag = normalizeText(e.tag);
        const material = normalizeText(e.material);
        const driveFolder = normalizeText(e.drive_folder_nombre);
        return nombre.includes(q) || codigo.includes(q) || tag.includes(q) || material.includes(q) || driveFolder.includes(q);
      }

      return true;
    })
    .sort((a, b) => {
      const infoA = getDriveFolderInfo(a);
      const infoB = getDriveFolderInfo(b);
      if (infoA.order !== infoB.order) {
        return infoA.order - infoB.order;
      }
      return (a.nombre || '').localeCompare(b.nombre || '');
    });

  return (
    <div className="sidebar glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <a 
            href="https://www.sulvy.com/es/" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ 
              display: 'block', 
              width: '120px', 
              transition: 'transform 0.2s',
              cursor: 'pointer'
            }} 
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'} 
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <img 
              src="/sulvy_logo.png" 
              alt="Sulvy Logo" 
              style={{ 
                width: '100%', 
                height: 'auto', 
                filter: theme === 'dark' ? 'brightness(0) invert(1)' : 'none' 
              }} 
            />
          </a>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '1px', marginTop: '0.5rem' }}>ASISTENTE DE INSPECCIÓN</div>
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
            📊 Dashboard Global
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
              if (onChangeTab) onChangeTab('MINUTA');
            }}
            style={{ 
              textAlign: 'left', 
              background: activeTab === 'MINUTA' ? 'rgba(255,255,255,0.1)' : 'transparent', 
              color: activeTab === 'MINUTA' ? 'white' : 'var(--text-secondary)', 
              borderLeft: activeTab === 'MINUTA' ? '4px solid var(--accent-primary)' : 'none', 
              borderRadius: activeTab === 'MINUTA' ? '4px 8px 8px 4px' : 'none', 
              padding: '12px',
              cursor: 'pointer'
            }}>
            📋 Minuta Resumen
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
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Área / Ubicación Técnica:</label>
            {user?.rol === 'admin' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={handleOpenAddUbiModal} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }} title="Añadir área">+</button>
                {ubicacionSeleccionada && (
                  <button onClick={handleDeleteUbicacion} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: 0 }} title="Eliminar área seleccionada">🗑️</button>
                )}
              </div>
            )}
          </div>
          <select value={ubicacionSeleccionada} onChange={(e) => {
            const val = e.target.value;
            setUbicacionSeleccionada(val);
            if (onSelectUbicacion) onSelectUbicacion(val);
          }}>
            <option value="">-- Seleccionar Área --</option>
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

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>🔍 Buscar equipo:</label>
            {busquedaEquipo.trim() && (
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                {equiposFiltrados.length} {equiposFiltrados.length === 1 ? 'resultado' : 'resultados'}
              </span>
            )}
          </div>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem', pointerEvents: 'none', opacity: 0.7 }}>
              🔎
            </span>
            <input 
              type="text"
              placeholder="Ej: TK-611, 184..."
              value={busquedaEquipo}
              onChange={(e) => setBusquedaEquipo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setBusquedaEquipo('');
              }}
              style={{
                width: '100%',
                paddingLeft: '32px',
                paddingRight: busquedaEquipo ? '30px' : '10px',
                paddingTop: '8px',
                paddingBottom: '8px',
                fontSize: '0.85rem',
                borderRadius: '6px'
              }}
            />
            {busquedaEquipo && (
              <button
                type="button"
                onClick={() => setBusquedaEquipo('')}
                title="Limpiar búsqueda"
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  lineHeight: 1,
                  padding: 0
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equipo a inspeccionar:</label>
            {user?.rol === 'admin' && (
              <button onClick={handleOpenAddEquipoModal} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0 }}>+</button>
            )}
          </div>
          <select 
            value={equipoSeleccionado || ''} 
            onChange={(e) => onSelectEquipo(e.target.value)}
          >
            <option value="">-- Seleccionar --</option>
            {equiposFiltrados.length === 0 && busquedaEquipo.trim() && (
              <option value="" disabled>-- Sin resultados coincidentes --</option>
            )}
            {equiposFiltrados.map(e => {
              const { prefix } = getDriveFolderInfo(e);
              return (
                <option key={e.id} value={e.id}>
                  {prefix}{e.nombre} ({e.codigo})
                </option>
              );
            })}
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
                kpis={validationKpis}
                onConfirm={() => handleGenerarLibro(null, false)}
                onConfirmAprobados={() => handleGenerarLibro(null, true)}
                onClose={() => {
                  setShowValidationModal(false);
                  setValidationAlerts([]);
                  setValidationKpis(null);
                }}
              />
            )}
            
            {libroResult && (
              <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ color: '#22c55e', fontSize: '0.8rem', fontWeight: 'bold' }}>¡Libro generado con éxito!</span>
                <a 
                  href={`${API_BASE_URL}/libro/descargar/${libroResult.libro_id}`}
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
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seleccionar Carpeta Destino (Área/Línea)</label>
                    <DriveFolderSelector 
                      token={token} 
                      onSelectFolder={(folderId, folderTitle) => setParentFolderId(folderId)}
                      initialFolderId=""
                    />
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

      {/* Modal para Agregar Ubicación Técnica */}
      {showAddUbiModal && (
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
              Añadir Nueva Ubicación Técnica
            </h3>

            <form onSubmit={handleSaveUbicacion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nombre de la Ubicación</label>
                <input
                  type="text"
                  value={nuevaUbiNombre}
                  onChange={(e) => setNuevaUbiNombre(e.target.value)}
                  placeholder="PLANTA DE SALMUERA"
                  required
                  disabled={creandoUbi}
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
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Código / Prefijo (Opcional)</label>
                <input
                  type="text"
                  value={nuevaUbiCodigo}
                  onChange={(e) => setNuevaUbiCodigo(e.target.value)}
                  placeholder="30-"
                  disabled={creandoUbi}
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
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Descripción (Opcional)</label>
                <textarea
                  value={nuevaUbiDescripcion}
                  onChange={(e) => setNuevaUbiDescripcion(e.target.value)}
                  placeholder="Ubicación técnica correspondiente al área de salmueras..."
                  disabled={creandoUbi}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '60px'
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
                    id="crearUbiCarpetaCheck"
                    checked={crearUbiCarpetaDrive}
                    onChange={(e) => setCrearUbiCarpetaDrive(e.target.checked)}
                    disabled={creandoUbi}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="crearUbiCarpetaCheck" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                    Crear carpeta en Google Drive
                  </label>
                </div>

                {crearUbiCarpetaDrive && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Seleccionar Carpeta Padre en Drive (Opcional)</label>
                    <DriveFolderSelector 
                      token={token} 
                      onSelectFolder={(folderId, folderTitle) => setUbiParentFolderId(folderId)}
                      initialFolderId=""
                    />
                  </div>
                )}
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddUbiModal(false)}
                  disabled={creandoUbi}
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
                  disabled={creandoUbi}
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
                  {creandoUbi ? 'Guardando...' : 'Guardar Ubicación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
