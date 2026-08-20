'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { apiService, API_BASE_URL } from '../services/api';

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

  // Estados para la gestión de Aprendizajes IA
  const [aprendizajes, setAprendizajes] = useState([]);
  const [aprendizajesLoading, setAprendizajesLoading] = useState(false);

  // Estados para la gestión de Itinerarios
  const [itinerarios, setItinerarios] = useState([]);
  const [itinerariosLoading, setItinerariosLoading] = useState(false);
  const [usuariosItinerario, setUsuariosItinerario] = useState([]);
  const [equiposItinerario, setEquiposItinerario] = useState([]);
  const [selectedUsuario, setSelectedUsuario] = useState('');
  const [selectedFecha, setSelectedFecha] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEquipos, setSelectedEquipos] = useState([]);
  const [filtroEquipos, setFiltroEquipos] = useState('');

  // Estados para la gestión de Usuarios (Solo Admin)
  const [usuarios, setUsuarios] = useState([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [nuevoUsername, setNuevoUsername] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoNombreCompleto, setNuevoNombreCompleto] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState('inspector');
  const [nuevaEmpresa, setNuevaEmpresa] = useState('');

  // Estados para Revertir Inspección (Solo Admin)
  const [revertEquipos, setRevertEquipos] = useState([]);
  const [revertEquiposLoading, setRevertEquiposLoading] = useState(false);
  const [revertSelectedEquipoId, setRevertSelectedEquipoId] = useState('');
  const [revertMotivo, setRevertMotivo] = useState('');
  const [reverting, setReverting] = useState(false);
  const [revertFilterText, setRevertFilterText] = useState('');

  const isAdmin = user?.rol === 'admin';

  const categories = [
    { key: 'general', label: '⚙️ General' },
    { key: 'drive', label: '📁 Google Drive' },
    { key: 'ia', label: '🧠 Inteligencia Artificial' },
    { key: 'aprendizaje_ia', label: '🎓 Aprendizajes IA' },
    { key: 'itinerarios', label: '📅 Itinerarios' },
    ...(user?.rol === 'admin' ? [{ key: 'usuarios', label: '👥 Usuarios' }] : []),
    ...(user?.rol === 'admin' ? [{ key: 'revertir_inspeccion', label: '🔄 Revertir Inspección' }] : []),
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
      const response = await fetch(`${API_BASE_URL}/empresas`, {
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
      const response = await fetch(`${API_BASE_URL}/campanias?empresa_id=${empId}`, {
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
        const res = await fetch(`${API_BASE_URL}/campanias/tareas/${currentTaskId}`, {
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

  const fetchAprendizajes = async () => {
    setAprendizajesLoading(true);
    setError(null);
    try {
      const data = await apiService.getAprendizajes(token);
      setAprendizajes(data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las lecciones de aprendizaje de la IA.');
    } finally {
      setAprendizajesLoading(false);
    }
  };

  const handleEliminarAprendizaje = async (id) => {
    if (!confirm('¿Está seguro de que desea eliminar esta lección aprendida?')) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await apiService.deleteAprendizaje(id, token);
      setSuccess(res.message || 'Lección de aprendizaje eliminada correctamente.');
      fetchAprendizajes();
    } catch (err) {
      setError(err.message || 'Ocurrió un error al eliminar la lección.');
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    try {
      const normalizedString = isoString.includes(' ') && !isoString.includes('T') 
        ? isoString.replace(' ', 'T') 
        : isoString;
      const date = new Date(normalizedString);
      if (isNaN(date.getTime())) return isoString;
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

  useEffect(() => {
    if (token && activeSubTab === 'aprendizaje_ia') {
      fetchAprendizajes();
    }
  }, [token, activeSubTab]);

  const fetchItinerariosData = async () => {
    setItinerariosLoading(true);
    setError(null);
    try {
      const resIt = await fetch(`${API_BASE_URL}/itinerarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resIt.ok) {
        const data = await resIt.json();
        setItinerarios(data.itinerarios || []);
      }

      const resUs = await fetch(`${API_BASE_URL}/itinerarios/usuarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resUs.ok) {
        const data = await resUs.json();
        setUsuariosItinerario(data.usuarios || []);
        if (data.usuarios && data.usuarios.length > 0 && !selectedUsuario) {
          setSelectedUsuario(data.usuarios[0].username);
        }
      }

      const resEq = await fetch(`${API_BASE_URL}/itinerarios/equipos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (resEq.ok) {
        const data = await resEq.json();
        setEquiposItinerario(data.equipos || []);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los datos de los itinerarios.');
    } finally {
      setItinerariosLoading(false);
    }
  };

  useEffect(() => {
    if (token && activeSubTab === 'itinerarios') {
      fetchItinerariosData();
    }
  }, [token, activeSubTab]);

  const handleCrearItinerario = async (e) => {
    e.preventDefault();
    if (!selectedUsuario) return alert("Debe seleccionar un inspector");
    if (!selectedFecha) return alert("Debe seleccionar una fecha");
    if (selectedEquipos.length === 0) return alert("Debe seleccionar al menos un equipo para la ruta");

    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/itinerarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: selectedUsuario,
          fecha: selectedFecha,
          equipos_codigos: selectedEquipos.map(eq => eq.codigo)
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al crear itinerario");
      }
      setSuccess("¡Itinerario de ruta creado con éxito!");
      setSelectedEquipos([]);
      fetchItinerariosData();
    } catch (err) {
      setError(err.message || "Error al crear el itinerario");
    }
  };

  const handleEliminarItinerario = async (username, fecha) => {
    if (!confirm(`¿Está seguro de que desea eliminar la ruta de ${username} para el día ${fecha}?`)) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/itinerarios?username=${username}&fecha=${fecha}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al eliminar itinerario");
      }
      setSuccess("Itinerario eliminado correctamente.");
      fetchItinerariosData();
    } catch (err) {
      setError(err.message || "Error al eliminar el itinerario");
    }
  };

  const fetchUsuarios = async () => {
    setUsuariosLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/usuarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data);
      } else {
        setError('No se pudo cargar la lista de usuarios.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al obtener los usuarios.');
    } finally {
      setUsuariosLoading(false);
    }
  };

  const fetchRevertEquipos = async () => {
    setRevertEquiposLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const inspeccionados = data.filter(e => e.estado_actual && e.estado_actual.toUpperCase() !== 'PENDIENTE' && e.estado_actual.toUpperCase() !== 'SIN DATOS');
        setRevertEquipos(inspeccionados);
      }
    } catch (err) {
      console.error("Error al obtener equipos para revertir:", err);
    } finally {
      setRevertEquiposLoading(false);
    }
  };

  const handleRevertirInspeccion = async (e) => {
    e.preventDefault();
    if (!revertSelectedEquipoId) {
      return alert("Seleccione un equipo de la lista.");
    }
    if (!revertMotivo.trim()) {
      return alert("Debe especificar obligatoriamente un motivo o razón del error.");
    }

    const eqTarget = revertEquipos.find(item => String(item.id) === String(revertSelectedEquipoId));
    const eqLabel = eqTarget ? `${eqTarget.tag_codigo} - ${eqTarget.descripcion}` : `ID ${revertSelectedEquipoId}`;

    if (!confirm(`¿Está seguro de que desea cambiar el equipo '${eqLabel}' a NO INSPECCIONADO (PENDIENTE)?\n\nMotivo: ${revertMotivo.trim()}`)) {
      return;
    }

    setReverting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/equipos/${revertSelectedEquipoId}/revertir-inspeccion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          motivo: revertMotivo.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al revertir la inspección del equipo");
      }
      setSuccess(`¡El equipo '${eqLabel}' se ha cambiado exitosamente a NO INSPECCIONADO!`);
      setRevertSelectedEquipoId('');
      setRevertMotivo('');
      fetchRevertEquipos();
    } catch (err) {
      setError(err.message || "Error al procesar la reversión");
    } finally {
      setReverting(false);
    }
  };

  useEffect(() => {
    if (token && activeSubTab === 'usuarios' && user?.rol === 'admin') {
      fetchUsuarios();
    }
    if (token && activeSubTab === 'revertir_inspeccion' && user?.rol === 'admin') {
      fetchRevertEquipos();
    }
  }, [token, activeSubTab]);

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    if (!nuevoUsername.trim() || !nuevoEmail.trim() || !nuevoNombreCompleto.trim() || !nuevoPassword.trim()) {
      return alert("Debe completar todos los campos obligatorios.");
    }
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: nuevoUsername.trim(),
          email: nuevoEmail.trim(),
          password: nuevoPassword,
          nombre_completo: nuevoNombreCompleto.trim(),
          rol: nuevoRol,
          empresa: nuevaEmpresa.trim() || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al registrar el usuario");
      }
      setSuccess("¡Usuario creado exitosamente!");
      setNuevoUsername('');
      setNuevoEmail('');
      setNuevoNombreCompleto('');
      setNuevoPassword('');
      setNuevoRol('inspector');
      setNuevaEmpresa('');
      fetchUsuarios();
    } catch (err) {
      setError(err.message || "Error al registrar el usuario");
    }
  };

  const handleToggleUsuario = async (userId) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/usuarios/${userId}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al cambiar estado del usuario");
      }
      setSuccess(data.message);
      fetchUsuarios();
    } catch (err) {
      setError(err.message || "Error al cambiar estado");
    }
  };

  const handleCambiarRolUsuario = async (userId, nuevoRol) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/usuarios/${userId}/role?rol=${nuevoRol}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Error al actualizar rol del usuario");
      }
      setSuccess(data.message);
      fetchUsuarios();
    } catch (err) {
      setError(err.message || "Error al actualizar rol");
    }
  };

  // Polling del progreso de la sincronización de Drive
  useEffect(() => {
    if (!syncTaskId || !token) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/drive/sincronizar/estado/${syncTaskId}`, {
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
      const response = await fetch(`${API_BASE_URL}/drive/sincronizar`, {
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
      const response = await fetch(`${API_BASE_URL}/campanias`, {
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
      const response = await fetch(`${API_BASE_URL}/campanias/${campId}`, {
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
      const response = await fetch(`${API_BASE_URL}/campanias/${campId}`, {
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
          ) : activeSubTab === 'aprendizaje_ia' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', flex: 1 }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  Lista de correcciones y lecciones aprendidas inyectadas al sistema para el autoaprendizaje de Gemini.
                </p>
              </div>

              {aprendizajesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '30px', height: '30px', border: '3px solid rgba(14, 165, 233, 0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando lecciones...</p>
                  </div>
                </div>
              ) : aprendizajes.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '200px', padding: '2rem', color: 'var(--text-secondary)', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎓</span>
                  <p style={{ fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>No hay aprendizajes registrados en el sistema.</p>
                </div>
              ) : (
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 16px', width: '180px' }}>Fecha / Registro</th>
                        <th style={{ padding: '12px 16px', width: '200px' }}>Equipo</th>
                        <th style={{ padding: '12px 16px' }}>Detalle / Lección</th>
                        {isAdmin && <th style={{ padding: '12px 16px', width: '100px', textAlign: 'center' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {aprendizajes.map((item) => (
                        <tr 
                          key={item.id} 
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.01)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {formatDate(item.created_at || item.fecha)}
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: 'white' }}>
                            {item.equipo || 'N/A'}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                            {item.leccion}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleEliminarAprendizaje(item.id)}
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  padding: '5px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.25)';
                                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                                }}
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : activeSubTab === 'itinerarios' ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap', width: '100%', flex: 1 }}>
              
              {/* Formulario de Creación (Solo Admins y Supervisores) */}
              {(user?.rol === 'admin' || user?.rol === 'supervisor') && (
                <div className="glass-panel" style={{ flex: '1 1 350px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', height: 'fit-content' }}>
                  <h4 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', margin: 0, fontWeight: 700 }}>📅 Asignar Ruta Diaria</h4>
                  
                  <form onSubmit={handleCrearItinerario} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Inspector / Operador</label>
                      <select 
                        value={selectedUsuario} 
                        onChange={(e) => setSelectedUsuario(e.target.value)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                      >
                        <option value="">-- Seleccionar Inspector --</option>
                        {usuariosItinerario.map(u => (
                          <option key={u.id} value={u.username}>{u.nombre_completo} ({u.username}) - {u.rol}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha de la Ruta</label>
                      <input 
                        type="date" 
                        value={selectedFecha} 
                        onChange={(e) => setSelectedFecha(e.target.value)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Equipos Seleccionados en Orden ({selectedEquipos.length})</label>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '60px', padding: '0.8rem', backgroundColor: 'rgba(0,0,0,0.2)', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                        {selectedEquipos.length === 0 ? (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Haz clic en los equipos de abajo para agregarlos en orden...</span>
                        ) : (
                          selectedEquipos.map((eq, index) => (
                            <span 
                              key={eq.id} 
                              onClick={() => setSelectedEquipos(selectedEquipos.filter(e => e.id !== eq.id))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', backgroundColor: 'var(--accent-primary)', color: 'white', padding: '4px 10px', borderRadius: '20px', cursor: 'pointer', transition: 'filter 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.8)'}
                              onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                            >
                              <strong>{index + 1}.</strong> {eq.codigo}
                              <span style={{ fontWeight: 'bold', fontSize: '0.75rem', opacity: 0.8 }}>×</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Seleccionar Equipos</label>
                      <input 
                        type="text" 
                        placeholder="🔍 Filtrar equipos por código o nombre..." 
                        value={filtroEquipos}
                        onChange={(e) => setFiltroEquipos(e.target.value)}
                        style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '6px 10px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none', width: '100%' }}
                      />
                      
                      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', backgroundColor: 'rgba(0,0,0,0.15)', padding: '0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {equiposItinerario
                          .filter(eq => 
                            eq.codigo.toLowerCase().includes(filtroEquipos.toLowerCase()) || 
                            eq.nombre.toLowerCase().includes(filtroEquipos.toLowerCase())
                          )
                          .slice(0, 30)
                          .map(eq => {
                            const yaSeleccionado = selectedEquipos.some(e => e.id === eq.id);
                            return (
                              <div 
                                key={eq.id}
                                onClick={() => {
                                  if (yaSeleccionado) {
                                    setSelectedEquipos(selectedEquipos.filter(e => e.id !== eq.id));
                                  } else {
                                    setSelectedEquipos([...selectedEquipos, eq]);
                                  }
                                }}
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  padding: '6px 10px', 
                                  borderRadius: '4px', 
                                  fontSize: '0.8rem', 
                                  cursor: 'pointer',
                                  backgroundColor: yaSeleccionado ? 'rgba(14, 165, 233, 0.15)' : 'transparent',
                                  border: yaSeleccionado ? '1px solid rgba(14, 165, 233, 0.3)' : '1px solid transparent',
                                  color: yaSeleccionado ? 'var(--text-primary)' : 'var(--text-secondary)'
                                }}
                                onMouseEnter={(e) => { if(!yaSeleccionado) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
                                onMouseLeave={(e) => { if(!yaSeleccionado) e.currentTarget.style.backgroundColor = 'transparent'; }}
                              >
                                <span><strong>{eq.codigo}</strong> - {eq.nombre}</span>
                                <span style={{ fontWeight: 'bold' }}>{yaSeleccionado ? '✓' : '+'}</span>
                              </div>
                            );
                          })
                        }
                        {equiposItinerario.length === 0 && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.5rem' }}>No hay equipos disponibles.</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      style={{ marginTop: '0.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                    >
                      🚀 Crear / Sobrescribir Ruta
                  </button>
                  </form>
                </div>
              )}

              {/* Listado de Rutas Activas */}
              <div style={{ flex: (user?.rol === 'admin' || user?.rol === 'supervisor') ? '2 2 450px' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                  {user?.rol === 'inspector' ? '📅 Mis Rutas Planificadas' : '📅 Historial de Rutas Planificadas'}
                </h4>
                
                {itinerariosLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div style={{ width: '24px', height: '24px', border: '3px solid rgba(14, 165, 233, 0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : itinerarios.filter(it => (user?.rol === 'inspector' ? it.username === user.username : true)).length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic' }}>
                      {user?.rol === 'inspector' ? 'No tienes itinerarios de inspección asignados.' : 'No hay itinerarios de inspección programados.'}
                    </p>
                  </div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '12px 16px' }}>Fecha</th>
                          {user?.rol !== 'inspector' && <th style={{ padding: '12px 16px' }}>Inspector</th>}
                          <th style={{ padding: '12px 16px' }}>Ruta de Inspección (Equipos)</th>
                          {(user?.rol === 'admin' || user?.rol === 'supervisor') && <th style={{ padding: '12px 16px', width: '100px', textAlign: 'center' }}>Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(
                          itinerarios
                            .filter(it => (user?.rol === 'inspector' ? it.username === user.username : true))
                            .reduce((groups, item) => {
                              const key = `${item.fecha}_${item.username}`;
                              if (!groups[key]) groups[key] = [];
                              groups[key].push(item);
                              return groups;
                            }, {})
                        ).map(([groupKey, items]) => {
                          const sample = items[0];
                          return (
                            <tr 
                              key={groupKey} 
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                            >
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                {sample.fecha}
                              </td>
                              {user?.rol !== 'inspector' && (
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'white' }}>
                                  {sample.nombre_completo}
                                </td>
                              )}
                              <td style={{ padding: '12px 16px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                  {items.map(it => {
                                    const isDone = it.estado === 'COMPLETADO';
                                    return (
                                      <span 
                                        key={it.id} 
                                        style={{ 
                                          fontSize: '0.75rem', 
                                          backgroundColor: isDone ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                                          color: isDone ? '#4ade80' : '#f87171', 
                                          border: isDone ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                                          padding: '2px 8px', 
                                          borderRadius: '4px' 
                                        }}
                                        title={`${it.equipo_nombre} (${it.estado})`}
                                      >
                                        {it.codigo}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                              {(user?.rol === 'admin' || user?.rol === 'supervisor') && (
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleEliminarItinerario(sample.username, sample.fecha)}
                                    style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                                  >
                                    Eliminar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ) : activeSubTab === 'usuarios' ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap', width: '100%', flex: 1 }}>
              
              {/* Formulario de Creación de Usuario */}
              <div className="glass-panel" style={{ flex: '1 1 350px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', height: 'fit-content' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', margin: 0, fontWeight: 700 }}>👥 Registrar Nuevo Usuario</h4>
                
                <form onSubmit={handleCrearUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nombre de Usuario (Username) *</label>
                    <input 
                      type="text" 
                      required
                      value={nuevoUsername}
                      onChange={(e) => setNuevoUsername(e.target.value)}
                      placeholder="ej: jdoe"
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nombre Completo *</label>
                    <input 
                      type="text" 
                      required
                      value={nuevoNombreCompleto}
                      onChange={(e) => setNuevoNombreCompleto(e.target.value)}
                      placeholder="ej: John Doe"
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Correo Electrónico *</label>
                    <input 
                      type="email" 
                      required
                      value={nuevoEmail}
                      onChange={(e) => setNuevoEmail(e.target.value)}
                      placeholder="ej: jdoe@empresa.com"
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Contraseña *</label>
                    <input 
                      type="password" 
                      required
                      value={nuevoPassword}
                      onChange={(e) => setNuevoPassword(e.target.value)}
                      placeholder="••••••••"
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rol del Sistema</label>
                    <select 
                      value={nuevoRol} 
                      onChange={(e) => setNuevoRol(e.target.value)}
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    >
                      <option value="inspector">Inspector / Operador</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Empresa (Opcional)</label>
                    <input 
                      type="text" 
                      value={nuevaEmpresa}
                      onChange={(e) => setNuevaEmpresa(e.target.value)}
                      placeholder="ej: Arauco"
                      style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{ marginTop: '0.5rem', backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, width: '100%' }}
                  >
                    👥 Crear Usuario
                  </button>
                </form>
              </div>

              {/* Tabla de Usuarios */}
              <div style={{ flex: '2 2 450px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>👥 Usuarios Registrados</h4>
                
                {usuariosLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                    <div style={{ width: '24px', height: '24px', border: '3px solid rgba(14, 165, 233, 0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '12px 16px' }}>Usuario</th>
                          <th style={{ padding: '12px 16px' }}>Nombre</th>
                          <th style={{ padding: '12px 16px' }}>Email</th>
                          <th style={{ padding: '12px 16px' }}>Rol</th>
                          <th style={{ padding: '12px 16px' }}>Estado</th>
                          <th style={{ padding: '12px 16px', width: '120px', textAlign: 'center' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usuarios.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: u.activo ? 1 : 0.6 }}>
                            <td style={{ padding: '12px 16px', fontWeight: 600, color: 'white' }}>
                              @{u.username}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                              {u.nombre_completo}
                            </td>
                            <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                              {u.email}
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <select
                                value={u.rol}
                                onChange={(e) => handleCambiarRolUsuario(u.id, e.target.value)}
                                style={{
                                  backgroundColor: 'rgba(0,0,0,0.3)',
                                  border: '1px solid var(--border-color)',
                                  color: 'white',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="inspector">inspector</option>
                                <option value="supervisor">supervisor</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                padding: '2px 6px', 
                                borderRadius: '4px',
                                backgroundColor: u.activo ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                                color: u.activo ? '#4ade80' : '#f87171',
                                border: u.activo ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                              }}>
                                {u.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleUsuario(u.id)}
                                style={{ 
                                  backgroundColor: u.activo ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)', 
                                  border: u.activo ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)', 
                                  color: u.activo ? '#f87171' : '#4ade80', 
                                  padding: '5px 10px', 
                                  borderRadius: '6px', 
                                  cursor: 'pointer', 
                                  fontSize: '0.8rem', 
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {u.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          ) : activeSubTab === 'revertir_inspeccion' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', flex: 1 }}>
              <div>
                <h4 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', margin: '0 0 0.3rem 0', fontWeight: 700 }}>
                  🔄 Revertir Estado de Inspección
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                  Permite cambiar un equipo previamente inspeccionado (Bueno, Regular, Crítico, Fuera de Ruta) a estado <strong>No Inspeccionado (PENDIENTE)</strong> en caso de error, equivocación en la asignación o requerimiento administrativo. Registra una traza de auditoría obligatoria.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap', width: '100%' }}>
                {/* Formulario de Reversión */}
                <div className="glass-panel" style={{ flex: '1 1 420px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', height: 'fit-content' }}>
                  <form onSubmit={handleRevertirInspeccion} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Filtrar / Buscar Equipo Inspeccionado:
                      </label>
                      <input
                        type="text"
                        value={revertFilterText}
                        onChange={(e) => setRevertFilterText(e.target.value)}
                        placeholder="Buscar por tag, nombre o planta..."
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Seleccionar Equipo a Pasar a No Inspeccionado *
                      </label>
                      {revertEquiposLoading ? (
                        <div style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando equipos...</div>
                      ) : (
                        <select
                          value={revertSelectedEquipoId}
                          onChange={(e) => setRevertSelectedEquipoId(e.target.value)}
                          style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%' }}
                        >
                          <option value="">-- Seleccionar Equipo ({revertEquipos.length} inspeccionados) --</option>
                          {revertEquipos
                            .filter(e => {
                              if (!revertFilterText.trim()) return true;
                              const query = revertFilterText.toLowerCase();
                              return (e.tag_codigo || '').toLowerCase().includes(query) ||
                                     (e.descripcion || '').toLowerCase().includes(query) ||
                                     (e.area_nombre || '').toLowerCase().includes(query) ||
                                     (e.empresa_nombre || '').toLowerCase().includes(query);
                            })
                            .map(eq => (
                              <option key={eq.id} value={eq.id}>
                                {eq.tag_codigo} - {eq.descripcion} ({eq.area_nombre || 'N/A'}) [Estado: {eq.estado_actual}]
                              </option>
                            ))}
                        </select>
                      )}
                    </div>

                    {revertSelectedEquipoId && (() => {
                      const eqObj = revertEquipos.find(i => String(i.id) === String(revertSelectedEquipoId));
                      if (!eqObj) return null;
                      return (
                        <div style={{ padding: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '8px', fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <div><strong>Activo:</strong> {eqObj.tag_codigo} - {eqObj.descripcion}</div>
                          <div><strong>Ubicación:</strong> {eqObj.empresa_nombre || 'N/A'} / {eqObj.area_nombre || 'N/A'}</div>
                          <div><strong>Estado Actual:</strong> <span style={{ color: '#f59e0b', fontWeight: 700 }}>{eqObj.estado_actual}</span></div>
                          {eqObj.diagnostico && <div><strong>Diagnóstico:</strong> {eqObj.diagnostico}</div>}
                        </div>
                      );
                    })()}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Motivo / Razón del Error (Obligatorio para auditoría) *
                      </label>
                      <textarea
                        value={revertMotivo}
                        onChange={(e) => setRevertMotivo(e.target.value)}
                        placeholder="Ejemplo: Se cargaron fotos pertenecientes a otra bomba por error. Requiere re-inspección."
                        rows={3}
                        style={{ backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none', width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={reverting || !revertSelectedEquipoId || !revertMotivo.trim()}
                      style={{
                        marginTop: '0.5rem',
                        backgroundColor: (reverting || !revertSelectedEquipoId || !revertMotivo.trim()) ? 'rgba(239, 68, 68, 0.3)' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        cursor: (reverting || !revertSelectedEquipoId || !revertMotivo.trim()) ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        width: '100%',
                        transition: 'all 0.2s'
                      }}
                    >
                      {reverting ? '⏳ Procesando Reversión...' : '↩️ Pasar Equipo a No Inspeccionado'}
                    </button>
                  </form>
                </div>

                {/* Resumen e Instrucciones */}
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="glass-panel" style={{ padding: '1.2rem', backgroundColor: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <h5 style={{ fontSize: '0.95rem', color: 'var(--accent-primary)', margin: '0 0 0.5rem 0', fontWeight: 600 }}>ℹ️ ¿Qué ocurre al revertir?</h5>
                    <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', margin: 0, lineHeight: 1.6 }}>
                      <li>El estado del equipo cambiará inmediatamente a <strong>PENDIENTE</strong> (no inspeccionado).</li>
                      <li>Se removerá de los reportes y libros como equipo completado.</li>
                      <li>El historial de auditoría registrará el usuario admin, fecha y la justificación ingresada.</li>
                      <li>El inspector podrá volver a inspeccionar este activo en la app/PWA.</li>
                    </ul>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
              {filteredSettings.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No hay configuraciones en esta categoría.</p>
              ) : (
                filteredSettings.map((item, idx) => {
                  const inputId = `setting-${item.clave}`;
                  const isFieldEditable = isAdmin && item.editable;
                  const value = localValues[item.clave] ?? '';
                  const hasError = validationErrors[item.clave];

                  const fieldLabelMap = {
                    reporte_campania: "Nombre de la Campaña Activa",
                    empresa_inspectora_nombre: "Razón Social de la Empresa Inspectora",
                    empresa_inspectora_subtitulo: "Subtítulo Institucional",
                    reporte_contacto_pie: "Dirección y Contacto del Pie de Página",
                    reporte_criterios_normas: "Criterios Técnicos y Normativas Aplicables",
                    reporte_firmante_1_nombre: "Primer Firmante: Nombre y Apellido",
                    reporte_firmante_1_cargo: "Primer Firmante: Cargo / Rol",
                    reporte_firmante_1_matricula: "Primer Firmante: Matrícula Profesional",
                    reporte_firmante_2_nombre: "Segundo Firmante: Nombre y Apellido",
                    reporte_firmante_2_cargo: "Segundo Firmante: Cargo / Rol",
                    reporte_firmante_2_matricula: "Segundo Firmante: Matrícula Profesional",
                    reporte_max_fotos_individual: "Máximo de Fotos en Reporte Individual",
                    reporte_max_fotos_libro: "Máximo de Fotos por Equipo en Libro Consolidado",
                    libro_objetivo_plantilla: "Plantilla del Objetivo en Portada del Libro",
                    reportes_dir: "Ruta Local de Reportes Individuales",
                    libros_dir: "Ruta Local de Libros Consolidados"
                  };

                  const isMultiline = item.clave === 'system_instruction' || 
                                     item.clave === 'reglas_negocio' || 
                                     item.clave === 'reporte_criterios_normas' || 
                                     item.clave === 'libro_objetivo_plantilla' || 
                                     item.clave === 'reporte_contacto_pie';

                  return (
                    <div key={item.clave} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: activeSubTab === 'reportes' ? 'rgba(255,255,255,0.02)' : 'transparent', padding: activeSubTab === 'reportes' ? '1rem' : '0', borderRadius: activeSubTab === 'reportes' ? '8px' : '0', border: activeSubTab === 'reportes' ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label htmlFor={inputId} style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {fieldLabelMap[item.clave] || item.clave.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
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
                        ) : isMultiline ? (
                          <textarea
                            id={inputId}
                            value={value}
                            disabled={!isFieldEditable}
                            onChange={(e) => handleChange(item.clave, e.target.value, 'string')}
                            rows={item.clave === 'reporte_criterios_normas' ? 6 : item.clave === 'libro_objetivo_plantilla' ? 4 : item.clave === 'reporte_contacto_pie' ? 2 : 10}
                            style={{
                              width: '100%',
                              borderColor: hasError ? 'var(--status-critical)' : 'var(--border-color)',
                              backgroundColor: !isFieldEditable ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.2)',
                              color: !isFieldEditable ? 'var(--text-secondary)' : 'var(--text-primary)',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              fontSize: '0.9rem',
                              fontFamily: 'inherit',
                              lineHeight: '1.5',
                              resize: 'vertical',
                              outline: 'none'
                            }}
                          />
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
      {isAdmin && activeSubTab !== 'campanias' && activeSubTab !== 'aprendizaje_ia' && activeSubTab !== 'itinerarios' && activeSubTab !== 'usuarios' && (
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
