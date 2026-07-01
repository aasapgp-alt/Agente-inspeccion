'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { apiService } from '../services/api';

export default function SettingsPanel() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Para valores locales editados
  const [localValues, setLocalValues] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const [activeSubTab, setActiveSubTab] = useState('general');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Estados para la gestión de Campañas
  const [empresas, setEmpresas] = useState([]);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('');
  const [campanias, setCampanias] = useState([]);
  const [campaniasLoading, setCampaniasLoading] = useState(false);
  const [nuevaCampaniaNombre, setNuevaCampaniaNombre] = useState('');
  const [nuevaCampaniaDesc, setNuevaCampaniaDesc] = useState('');
  const [preReplicarDrive, setPreReplicarDrive] = useState(false);
  const [subcarpetasDrive, setSubcarpetasDrive] = useState('Succion, Impulsión');
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [taskProgress, setTaskProgress] = useState(null);
  
  // Estados para la sincronización de caché de Google Drive
  const [syncTaskId, setSyncTaskId] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);

  const isAdmin = user?.rol === 'admin';

  const categories = [
    { key: 'general', label: '⚙️ General' },
    { key: 'drive', label: '📁 Google Drive' },
    { key: 'ia', label: '🧠 Inteligencia Artificial' },
    { key: 'pdf', label: '📄 Rutas y PDF' },
    { key: 'reportes', label: '📊 Reportes' },
    { key: 'notificaciones', label: '🔔 Notificaciones' },
    { key: 'campanias', label: '📅 Campañas' }
  ];

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getSettings(token);
      setSettings(data);
      // Inicializar valores locales
      const vals = {};
      data.forEach(item => {
        if (item.tipo === 'boolean') {
          vals[item.clave] = item.valor === 'true';
        } else if (item.tipo === 'number') {
          vals[item.clave] = Number(item.valor);
        } else {
          vals[item.clave] = item.valor;
        }
      });
      setLocalValues(vals);
      setValidationErrors({});
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las configuraciones del sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSettings();
    }
  }, [token]);

  // APIs para la gestión de Campañas
  const fetchEmpresas = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/empresas', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setEmpresas(data);
        if (data.length > 0 && !empresaSeleccionada) {
          setEmpresaSeleccionada(data[0].id.toString());
        }
      }
    } catch (err) {
      console.error("Error fetching empresas:", err);
    }
  };

  const fetchCampanias = async (empId) => {
    if (!empId) return;
    setCampaniasLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/campanias?empresa_id=${empId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCampanias(data);
      }
    } catch (err) {
      console.error("Error fetching campanias:", err);
    } finally {
      setCampaniasLoading(false);
    }
  };

  useEffect(() => {
    if (token && activeSubTab === 'campanias') {
      fetchEmpresas();
    }
  }, [token, activeSubTab]);

  useEffect(() => {
    if (token && empresaSeleccionada && activeSubTab === 'campanias') {
      fetchCampanias(empresaSeleccionada);
    }
  }, [token, empresaSeleccionada, activeSubTab]);

  // Polling del progreso de la tarea
  useEffect(() => {
    if (!currentTaskId || !token) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/campanias/tareas/${currentTaskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setTaskProgress(data);
          if (data.status === 'completed' || data.status === 'failed') {
            setCurrentTaskId(null);
            if (empresaSeleccionada) {
              fetchCampanias(empresaSeleccionada);
              fetchSettings(); // Refrescar las configuraciones globales
            }
          }
        }
      } catch (err) {
        console.error("Error polling task progress:", err);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [currentTaskId, token, empresaSeleccionada]);

  // Polling del progreso de la sincronización de Drive
  useEffect(() => {
    if (!syncTaskId || !token) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/drive/sincronizar/estado/${syncTaskId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSyncProgress(data);
          if (data.status === 'completed' || data.status === 'failed') {
            setSyncTaskId(null);
            fetchSettings(); // Refrescar las configuraciones globales
          }
        }
      } catch (err) {
        console.error("Error polling sync progress:", err);
      }
    }, 1500);
    
    return () => clearInterval(interval);
  }, [syncTaskId, token]);

  const handleIniciarSincronizacion = async () => {
    setError(null);
    setSuccess(null);
    setSyncProgress(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/drive/sincronizar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error al iniciar sincronización");
      }
      
      setSyncTaskId(data.task_id);
      setSyncProgress({ status: 'pending', progress: 0, mensaje: "Iniciando indexación..." });
    } catch (err) {
      setError(err.message || "Error al iniciar la sincronización");
    }
  };

  const handleCrearCampania = async (e) => {
    e.preventDefault();
    if (!nuevaCampaniaNombre.trim()) return alert("Debe ingresar un nombre para la campaña");
    if (!empresaSeleccionada) return alert("Debe seleccionar una empresa");
    
    setError(null);
    setSuccess(null);
    setTaskProgress(null);
    
    const subList = subcarpetasDrive.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    try {
      const response = await fetch('http://localhost:8000/api/campanias', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          empresa_id: parseInt(empresaSeleccionada),
          nombre: nuevaCampaniaNombre.trim(),
          descripcion: nuevaCampaniaDesc.trim(),
          pre_replicar: preReplicarDrive,
          subcarpetas: subList
        })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error al crear la campaña");
      }
      
      setSuccess("Campaña creada exitosamente.");
      setNuevaCampaniaNombre('');
      setNuevaCampaniaDesc('');
      
      if (data.task_id) {
        setCurrentTaskId(data.task_id);
        setTaskProgress({ status: 'pending', progress: 0, mensaje: "Iniciando sincronización..." });
      } else {
        fetchCampanias(empresaSeleccionada);
        fetchSettings();
      }
    } catch (err) {
      setError(err.message || "Error al crear la campaña");
    }
  };

  const handleActivarCampania = async (campId) => {
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`http://localhost:8000/api/campanias/${campId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activa: true })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error al activar la campaña");
      }
      
      setSuccess("Campaña activada correctamente.");
      fetchCampanias(empresaSeleccionada);
      fetchSettings();
    } catch (err) {
      setError(err.message || "Error al activar la campaña");
    }
  };

  const handleEliminarCampania = async (campId) => {
    if (!confirm("¿Está seguro de que desea eliminar esta campaña? Esta acción no afectará las carpetas de Google Drive, pero removerá el registro de la base de datos.")) return;
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`http://localhost:8000/api/campanias/${campId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Error al eliminar la campaña");
      }
      
      setSuccess("Campaña eliminada correctamente.");
      fetchCampanias(empresaSeleccionada);
    } catch (err) {
      setError(err.message || "Error al eliminar la campaña");
    }
  };

  // Manejar cambios en los inputs
  const handleChange = (clave, valor, tipo) => {
    setLocalValues(prev => ({
      ...prev,
      [clave]: valor
    }));
    
    // Validar tipo en tiempo real
    validateField(clave, valor, tipo);
  };

  const validateField = (clave, valor, tipo) => {
    let err = null;
    if (tipo === 'number') {
      if (valor === '' || isNaN(Number(valor))) {
        err = 'Debe ser un número válido';
      }
    } else if (tipo === 'json') {
      try {
        if (typeof valor === 'string') {
          JSON.parse(valor);
        } else {
          JSON.stringify(valor);
        }
      } catch (e) {
        err = 'JSON inválido';
      }
    }
    
    setValidationErrors(prev => {
      const next = { ...prev };
      if (err) {
        next[clave] = err;
      } else {
        delete next[clave];
      }
      return next;
    });
  };

  const handleDiscard = () => {
    // Reestablecer a los valores actuales de settings
    const vals = {};
    settings.forEach(item => {
      if (item.tipo === 'boolean') {
        vals[item.clave] = item.valor === 'true';
      } else if (item.tipo === 'number') {
        vals[item.clave] = Number(item.valor);
      } else {
        vals[item.clave] = item.valor;
      }
    });
    setLocalValues(vals);
    setValidationErrors({});
    setSuccess(null);
    setError(null);
  };

  const handleSave = async () => {
    // Validar todo antes de enviar
    const currentErrors = {};
    settings.forEach(item => {
      const val = localValues[item.clave];
      if (item.tipo === 'number' && (val === '' || isNaN(Number(val)))) {
        currentErrors[item.clave] = 'Debe ser un número válido';
      } else if (item.tipo === 'json') {
        try {
          JSON.parse(val);
        } catch (e) {
          currentErrors[item.clave] = 'JSON inválido';
        }
      }
    });

    if (Object.keys(currentErrors).length > 0) {
      setValidationErrors(currentErrors);
      setError('Por favor corrige los errores de validación antes de guardar.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    // Preparar payload enviando valores como string (o tipos correspondientes a la API)
    const payload = {};
    settings.forEach(item => {
      if (item.editable) {
        const localVal = localValues[item.clave];
        if (item.tipo === 'boolean') {
          payload[item.clave] = localVal ? 'true' : 'false';
        } else {
          payload[item.clave] = String(localVal);
        }
      }
    });

    try {
      const res = await apiService.saveSettings(payload, token);
      setSuccess(res.message || 'Configuraciones guardadas exitosamente.');
      // Refrescar settings de la BD para tener los valores reales formateados
      await fetchSettings();
    } catch (err) {
      setError(err.message || 'Ocurrió un error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  // Filtrar settings según la pestaña activa
  const filteredSettings = settings.filter(item => item.categoria === activeSubTab);

  // Comprobar si hay cambios locales comparados con settings cargados de BD
  const hasChanges = () => {
    return settings.some(item => {
      if (!item.editable) return false;
      const localVal = localValues[item.clave];
      if (item.tipo === 'boolean') {
        const origBool = item.valor === 'true';
        return localVal !== origBool;
      }
      if (item.tipo === 'number') {
        const origNum = Number(item.valor);
        return Number(localVal) !== origNum;
      }
      return localVal !== item.valor;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', flex: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(14, 165, 233, 0.1)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Cargando configuraciones globales...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem', fontFamily: 'var(--font-sans)' }}>
      {/* Cabecera */}
      <div>
        <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <span>⚙️</span> Configuración Global
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Administre parámetros generales, integraciones con Google Drive, parámetros de IA (Gemini), notificaciones del sistema y rutas de reportes.
        </p>
      </div>

      {/* Banner de Solo Lectura para usuarios no admin */}
      {!isAdmin && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          color: '#fcd34d',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          lineHeight: 1.5
        }}>
          <span style={{ fontSize: '1.2rem' }}>🔒</span>
          <div>
            <strong>Modo de Solo Lectura:</strong> Tu cuenta no dispone de permisos de Administrador. Puedes ver los parámetros actuales, pero no editarlos.
          </div>
        </div>
      )}

      {/* Alertas de Éxito o Error */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span>❌</span>
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '8px',
          padding: '0.85rem 1.25rem',
          color: '#a7f3d0',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <span>✅</span>
          <div>{success}</div>
        </div>
      )}

      {/* Contenedor Tabs e Inputs */}
      <div style={{ display: 'flex', flex: 1, gap: '2rem', minHeight: '350px' }}>
        
        {/* Sub-tabs laterales de categorías */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '220px' }}>
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveSubTab(cat.key)}
              style={{
                textAlign: 'left',
                background: activeSubTab === cat.key ? 'var(--accent-primary)' : 'rgba(255,255,255,0.02)',
                color: activeSubTab === cat.key ? 'white' : 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                transform: 'none'
              }}
              onMouseEnter={(e) => {
                if (activeSubTab !== cat.key) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeSubTab !== cat.key) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Inputs correspondientes a la categoría seleccionada */}
        <div className="glass-panel" style={{ flex: 1, padding: '1.75rem', backgroundColor: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
          
          <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '0.5rem', fontSize: '1.1rem', color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Configuración {categories.find(c => c.key === activeSubTab)?.label.split(' ').slice(1).join(' ')}
          </h3>

          {activeSubTab === 'campanias' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              
              {/* Selector de Empresa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Empresa / Cliente</label>
                <select
                  value={empresaSeleccionada}
                  onChange={(e) => setEmpresaSeleccionada(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    width: '100%',
                    maxWidth: '400px',
                    outline: 'none'
                  }}
                >
                  <option value="">Seleccione una empresa...</option>
                  {empresas.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Lista de Campañas */}
              <div>
                <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 600 }}>Campañas Registradas</h4>
                {campaniasLoading ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando campañas...</p>
                ) : campanias.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No hay campañas registradas para esta empresa.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {campanias.map(camp => (
                      <div
                        key={camp.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          backgroundColor: camp.activa ? 'rgba(14, 165, 233, 0.08)' : 'rgba(255,255,255,0.02)',
                          border: camp.activa ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{camp.nombre}</span>
                            {camp.activa ? (
                              <span style={{ fontSize: '0.7rem', backgroundColor: 'var(--accent-primary)', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>ACTIVA</span>
                            ) : null}
                          </div>
                          {camp.descripcion && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{camp.descripcion}</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {!camp.activa && isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleActivarCampania(camp.id)}
                              style={{
                                backgroundColor: 'rgba(14, 165, 233, 0.2)',
                                border: '1px solid rgba(14, 165, 233, 0.4)',
                                color: '#38bdf8',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.3)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.2)'}
                            >
                              Activar
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleEliminarCampania(camp.id)}
                              style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#fca5a5',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulario Nueva Campaña */}
              {isAdmin && (
                <form onSubmit={handleCrearCampania} style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Generar Nueva Campaña</h4>
                  
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nombre de Campaña (Ej: PGP 2027)</label>
                      <input
                        type="text"
                        value={nuevaCampaniaNombre}
                        onChange={(e) => setNuevaCampaniaNombre(e.target.value)}
                        placeholder="PGP 2027"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Descripción</label>
                      <input
                        type="text"
                        value={nuevaCampaniaDesc}
                        onChange={(e) => setNuevaCampaniaDesc(e.target.value)}
                        placeholder="Campaña de Parada General PGP 2027 Arauco"
                        style={{
                          backgroundColor: 'rgba(0,0,0,0.2)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="checkbox"
                        id="preReplicarCheck"
                        checked={preReplicarDrive}
                        onChange={(e) => setPreReplicarDrive(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <label htmlFor="preReplicarCheck" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
                        Pre-replicar estructura de carpetas en Google Drive
                      </label>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '1.55rem', margin: 0 }}>
                      Si se activa, el sistema buscará la carpeta de cada equipo de esta empresa en Google Drive y creará la carpeta de la campaña e inicializará las subcarpetas indicadas abajo.
                    </p>
                    
                    {preReplicarDrive && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', marginLeft: '1.55rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Subcarpetas a generar (separadas por coma)</label>
                        <input
                          type="text"
                          value={subcarpetasDrive}
                          onChange={(e) => setSubcarpetasDrive(e.target.value)}
                          placeholder="Succion, Impulsión"
                          style={{
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            maxWidth: '300px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                  >
                    Generar Campaña
                  </button>
                </form>
              )}

              {/* Progreso de la Tarea en Segundo Plano */}
              {taskProgress && (
                <div style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginTop: '1rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Progreso de la Sincronización en Drive</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{taskProgress.progress}%</span>
                  </div>
                  
                  {/* Barra de progreso */}
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${taskProgress.progress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                  </div>
                  
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {taskProgress.mensaje}
                  </div>
                  
                  {taskProgress.status === 'completed' && taskProgress.resultados && (
                    <div style={{ fontSize: '0.75rem', color: '#a7f3d0', marginTop: '0.25rem', backgroundColor: 'rgba(16, 185, 129, 0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <strong>Resultados:</strong> Sincronizados: {taskProgress.resultados.sincronizados} | No encontrados: {taskProgress.resultados.no_encontrados} | Errores: {taskProgress.resultados.errores}
                      {taskProgress.resultados.detalle && taskProgress.resultados.detalle.length > 0 && (
                        <details style={{ marginTop: '0.25rem' }}>
                          <summary style={{ cursor: 'pointer', outline: 'none' }}>Ver detalles</summary>
                          <ul style={{ maxHeight: '120px', overflowY: 'auto', paddingLeft: '1.25rem', margin: '0.25rem 0' }}>
                            {taskProgress.resultados.detalle.map((d, i) => (
                              <li key={i} style={{ color: '#fca5a5' }}>{d}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              {filteredSettings.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay configuraciones en esta categoría.</p>
              ) : (
                filteredSettings.map(item => {
                  const inputId = `setting-${item.clave}`;
                  const isFieldEditable = isAdmin && item.editable;
                  const value = localValues[item.clave] ?? '';
                  const hasError = validationErrors[item.clave];

                  return (
                    <div key={item.clave} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label htmlFor={inputId} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {item.clave.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </label>
                        {!item.editable && (
                          <span style={{ fontSize: '0.7rem', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase', fontWeight: 600 }}>
                            No editable
                          </span>
                        )}
                      </div>

                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                        
                        {item.tipo === 'boolean' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.3rem 0' }}>
                            <input
                              id={inputId}
                              type="checkbox"
                              checked={!!value}
                              disabled={!isFieldEditable}
                              onChange={(e) => handleChange(item.clave, e.target.checked, 'boolean')}
                              style={{
                                width: '20px',
                                height: '20px',
                                cursor: isFieldEditable ? 'pointer' : 'default',
                                accentColor: 'var(--accent-primary)'
                              }}
                            />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              {value ? 'Habilitado (Sí)' : 'Deshabilitado (No)'}
                            </span>
                          </div>
                        ) : item.tipo === 'json' ? (
                          <textarea
                            id={inputId}
                            value={typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
                            disabled={!isFieldEditable}
                            onChange={(e) => handleChange(item.clave, e.target.value, 'json')}
                            rows={5}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.85rem',
                              borderColor: hasError ? 'var(--status-critical)' : 'var(--border-color)',
                              backgroundColor: !isFieldEditable ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.2)',
                              color: !isFieldEditable ? 'var(--text-secondary)' : 'var(--text-primary)',
                              resize: 'vertical'
                            }}
                          />
                        ) : item.clave === 'google_api_key' ? (
                          <div style={{ display: 'flex', width: '100%', gap: '0.5rem' }}>
                            <input
                              id={inputId}
                              type={showApiKey ? 'text' : 'password'}
                              value={value}
                              disabled={!isFieldEditable}
                              placeholder={!isFieldEditable && !value ? '(No configurado)' : 'Introduce la clave de API...'}
                              onChange={(e) => handleChange(item.clave, e.target.value, 'string')}
                              style={{
                                flex: 1,
                                backgroundColor: !isFieldEditable ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.2)',
                                color: !isFieldEditable ? 'var(--text-secondary)' : 'var(--text-primary)',
                                paddingRight: '10px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border-color)',
                                color: 'var(--text-secondary)',
                                borderRadius: '8px',
                                padding: '0 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                transform: 'none',
                                whiteSpace: 'nowrap'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            >
                              {showApiKey ? '👁️ Ocultar' : '👁️ Mostrar'}
                            </button>
                          </div>
                        ) : (
                          <input
                            id={inputId}
                            type={item.tipo === 'number' ? 'number' : 'text'}
                            value={value}
                            disabled={!isFieldEditable}
                            onChange={(e) => handleChange(item.clave, item.tipo === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value, item.tipo)}
                            style={{
                              borderColor: hasError ? 'var(--status-critical)' : 'var(--border-color)',
                              backgroundColor: !isFieldEditable ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.2)',
                              color: !isFieldEditable ? 'var(--text-secondary)' : 'var(--text-primary)',
                              fontFamily: item.tipo === 'number' ? 'var(--font-mono)' : 'inherit'
                            }}
                          />
                        )}
                      </div>

                      {item.descripcion && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                          {item.descripcion}
                        </span>
                      )}

                      {hasError && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--status-critical)', fontWeight: 600 }}>
                          ⚠️ {hasError}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
              
              {activeSubTab === 'drive' && (
                <div style={{
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                  paddingTop: '1.5rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 600 }}>Sincronización de Estructura de Drive</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Indexa todas las carpetas dentro de la carpeta raíz de Google Drive configurada arriba. Esto permite que la sugerencia de carpetas de equipos en los análisis sea instantánea sin requerir consultas en tiempo real a la API.
                  </p>
                  
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleIniciarSincronizacion}
                      disabled={!!syncTaskId}
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: 'var(--accent-primary)',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: !!syncTaskId ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        opacity: !!syncTaskId ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { if(!syncTaskId) e.currentTarget.style.filter = 'brightness(1.1)'; }}
                      onMouseLeave={(e) => { if(!syncTaskId) e.currentTarget.style.filter = 'none'; }}
                    >
                      {syncTaskId ? '🔄 Sincronizando...' : '🔄 Sincronizar Carpetas de Drive'}
                    </button>
                  )}
                  
                  {syncProgress && (
                    <div style={{
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      marginTop: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Progreso de la Indexación</span>
                        <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{syncProgress.progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${syncProgress.progress}%`, height: '100%', backgroundColor: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {syncProgress.mensaje}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botones de acción en la parte inferior */}
      {isAdmin && activeSubTab !== 'campanias' && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '1rem',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '1.25rem',
          marginTop: '0.5rem'
        }}>
          <button
            onClick={handleDiscard}
            disabled={!hasChanges() || saving}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: hasChanges() ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: hasChanges() ? 'pointer' : 'not-allowed',
              opacity: hasChanges() ? 1 : 0.5,
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (hasChanges()) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (hasChanges()) {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }
            }}
          >
            Descartar Cambios
          </button>
          
          <button
            onClick={handleSave}
            disabled={!hasChanges() || saving || Object.keys(validationErrors).length > 0}
            style={{
              backgroundColor: hasChanges() && Object.keys(validationErrors).length === 0 ? 'var(--accent-primary)' : 'rgba(14, 165, 233, 0.2)',
              color: hasChanges() && Object.keys(validationErrors).length === 0 ? 'white' : 'var(--text-secondary)',
              cursor: hasChanges() && Object.keys(validationErrors).length === 0 && !saving ? 'pointer' : 'not-allowed',
              opacity: hasChanges() && !saving ? 1 : 0.5,
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            {saving ? (
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
                Guardando...
              </>
            ) : (
              'Guardar Cambios'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
