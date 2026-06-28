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

  const isAdmin = user?.rol === 'admin';

  const categories = [
    { key: 'general', label: '⚙️ General' },
    { key: 'drive', label: '📁 Google Drive' },
    { key: 'ia', label: '🧠 Inteligencia Artificial' },
    { key: 'pdf', label: '📄 Rutas y PDF' },
    { key: 'reportes', label: '📊 Reportes' },
    { key: 'notificaciones', label: '🔔 Notificaciones' }
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
                  
                  {/* Label y etiqueta de solo lectura si aplica */}
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

                  {/* Input específico según tipo de dato */}
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

                  {/* Descripción del campo */}
                  {item.descripcion && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                      {item.descripcion}
                    </span>
                  )}

                  {/* Error de validación si existe */}
                  {hasError && (
                    <span style={{ fontSize: '0.78rem', color: 'var(--status-critical)', fontWeight: 600 }}>
                      ⚠️ {hasError}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Botones de acción en la parte inferior */}
      {isAdmin && (
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
