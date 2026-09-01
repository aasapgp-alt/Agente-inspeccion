'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import InspectionPanel from '../components/InspectionPanel';
import ManualPanel from '../components/ManualPanel';
import AssetHistory from '../components/AssetHistory';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import Login from '../components/Login';
import ReportsPanel from '../components/ReportsPanel';
import SettingsPanel from '../components/SettingsPanel';
import AuditPanel from '../components/AuditPanel';
import HelpModal from '../components/HelpModal';
import GlobalDashboard from '../components/GlobalDashboard';
import MinutaResumenPanel from '../components/MinutaResumenPanel';
import OfflineBanner from '../components/OfflineBanner';
import ItineraryProgressBar from '../components/ItineraryProgressBar';
import MobileNav from '../components/MobileNav';
import { API_BASE_URL } from '../services/api';

export default function Home() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}

function DashboardContent() {
  const { user, token, loading, logout } = useAuth();
  
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_equipo_id');
      return saved ? parseInt(saved, 10) || null : null;
    }
    return null;
  });

  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_empresa_id') || null;
    }
    return null;
  });

  const [empresas, setEmpresas] = useState([]);

  const [ubicacionSeleccionada, setUbicacionSeleccionada] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_ubicacion_id') || '';
    }
    return '';
  });

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dashboard_active_tab') || 'MANUAL';
    }
    return 'MANUAL';
  });

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboard_active_tab', tabId);
    }
  };

  const handleSelectEquipo = (id) => {
    setEquipoSeleccionado(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('dashboard_equipo_id', id.toString());
      else localStorage.removeItem('dashboard_equipo_id');
    }
  };

  const handleSelectEmpresa = (empId) => {
    setEmpresaSeleccionada(empId);
    if (typeof window !== 'undefined') {
      if (empId) localStorage.setItem('dashboard_empresa_id', empId.toString());
      else localStorage.removeItem('dashboard_empresa_id');
    }
  };

  const handleSelectUbicacion = (ubiId) => {
    setUbicacionSeleccionada(ubiId);
    if (typeof window !== 'undefined') {
      if (ubiId) localStorage.setItem('dashboard_ubicacion_id', ubiId.toString());
      else localStorage.removeItem('dashboard_ubicacion_id');
    }
  };

  // Cargar lista de empresas para resolver el nombre completo
  useEffect(() => {
    async function loadEmpresas() {
      const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);
      if (!activeToken) return;
      try {
        const res = await fetch(`${API_BASE_URL}/empresas`, {
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        if (res.ok) {
          const list = await res.json();
          setEmpresas(list);
          if (Array.isArray(list) && list.length > 0) {
            setEmpresaSeleccionada(prev => {
              if (prev) return prev;
              const defaultId = list[0].id;
              if (typeof window !== 'undefined') localStorage.setItem('dashboard_empresa_id', defaultId.toString());
              return defaultId;
            });
          }
        }
      } catch (err) {
        console.error('Error cargando empresas:', err);
      }
    }
    loadEmpresas();
  }, [token]);

  // Registro de Service Worker para PWA (Desactivado en DEV para no interferir con Turbopack HMR)
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        navigator.serviceWorker.register('/sw.js').catch(err => {
          console.warn('Registro de Service Worker omitido:', err);
        });
      } else {
        // En modo desarrollo (npm run dev), desregistrar Service Worker activo para evitar bucles HMR
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
        }).catch(() => {});
      }
    }
  }, []);

  // Atajo de teclado F1 para abrir el Centro de Ayuda
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const empresaActivaObj = empresas.find(e => String(e.id) === String(empresaSeleccionada));
  const nombreEmpresaActiva = empresaActivaObj ? empresaActivaObj.nombre : null;

  // Inicialización diferida: la fecha puede diferir entre servidor y cliente,
  // por eso se marca con suppressHydrationWarning en el render.
  const [fecha] = useState(() =>
    new Intl.DateTimeFormat('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
  );

  if (loading) {
    return (
      <div className="session-loader">
        <div className="spinner" />
        <p style={{ fontSize: '0.95rem' }}>Cargando sesión...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const tabs = [
    { id: 'MANUAL', label: 'Carga manual' },
    { id: 'FACTORY', label: 'Inspección IA' },
    { id: 'HISTORY', label: 'Historial de activos' },
    { id: 'MINUTA', label: 'Minuta Resumen PGP' },
  ];

  return (
    <main className="app-container" style={{ position: 'relative' }}>
      <OfflineBanner />
      <Sidebar
        onSelectEquipo={(id) => {
          handleSelectEquipo(id);
          if (id) handleSelectTab('FACTORY');
        }}
        equipoSeleccionado={equipoSeleccionado}
        onSelectEmpresa={handleSelectEmpresa}
        empresaSeleccionada={empresaSeleccionada}
        selectedUbicacionId={ubicacionSeleccionada}
        onSelectUbicacion={handleSelectUbicacion}
        activeTab={activeTab}
        onChangeTab={handleSelectTab}
      />

      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Cabecera global: campaña, pestañas, empresa seleccionada y perfil */}
        <header className="app-header">
          <div>
            <div className="eyebrow">Campaña PGP 2026 · En curso</div>
            <nav className="tab-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => handleSelectTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Componente de Avance de Ruta en Vivo */}
          <ItineraryProgressBar />

          {/* Badge central destacado de la Empresa Seleccionada */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            backgroundColor: nombreEmpresaActiva ? 'rgba(56, 189, 248, 0.14)' : 'rgba(255, 255, 255, 0.04)',
            border: nombreEmpresaActiva ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
            padding: '7px 18px',
            borderRadius: '24px',
            boxShadow: nombreEmpresaActiva ? '0 0 15px rgba(56, 189, 248, 0.25)' : 'none',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <span style={{ fontSize: '1.1rem' }}>🏢</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.5px' }}>
                Empresa Activa
              </span>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: nombreEmpresaActiva ? '#38bdf8' : 'var(--text-secondary)' }}>
                {nombreEmpresaActiva || 'Todas las Empresas'}
              </span>
            </div>
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center' }}>
            {/* Sulvy header logo */}
            <a 
              href="https://www.sulvy.com/es/" 
              target="_blank" 
              rel="noopener noreferrer" 
              style={{ 
                display: 'block', 
                width: '60px', 
                marginRight: '1rem',
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
                  filter: 'brightness(0.95)'
                }} 
              />
            </a>

            <span className="header-clock" suppressHydrationWarning>{fecha}</span>

            <button className="btn-help" onClick={() => setShowHelp(true)} title="Manual de Uso / Ayuda (F1)" aria-label="Manual de Uso">
              ❓
            </button>

            {/* Chip de perfil con menú desplegable */}
            <div className="user-chip" onClick={() => setShowUserMenu(!showUserMenu)}>
              <span className="user-chip__name">{user.nombre_completo}</span>
              <span className={`role-badge role-badge--${user.rol}`}>{user.rol}</span>
              <span className="user-chip__caret">⌄</span>

              {showUserMenu && (
                <div className="user-menu" onClick={(e) => e.stopPropagation()}>
                  <div className="user-menu__head">
                    <span className="user-menu__user">@{user.username}</span>
                    <span className="user-menu__meta">{user.email}</span>
                    {user.empresa && (
                      <span className="user-menu__company">{user.empresa}</span>
                    )}
                  </div>
                  <button className="btn-danger" onClick={logout}>
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Área de contenido */}
        <div className="glass-panel content-surface">

          {activeTab === 'MANUAL' && (
            equipoSeleccionado ? (
              <div style={{ height: '100%' }}>
                <h2 className="panel-heading panel-heading--accent">Carga manual</h2>
                <p className="panel-sub">Activo · ID {equipoSeleccionado} · sin IA</p>
                <ManualPanel 
                  equipoId={equipoSeleccionado} 
                  onChangeTab={setActiveTab}
                />
              </div>
            ) : (
              <GlobalDashboard 
                empresaId={empresaSeleccionada} 
                onSelectEquipo={setEquipoSeleccionado} 
                onSelectUbicacion={setUbicacionSeleccionada}
                onChangeTab={setActiveTab} 
                onOpenHelp={() => setShowHelp(true)}
              />
            )
          )}

          {activeTab === 'FACTORY' && (
            equipoSeleccionado ? (
              <div style={{ height: '100%' }}>
                <h2 className="panel-heading panel-heading--accent">Panel de inspección · IA</h2>
                <p className="panel-sub">Activo · ID {equipoSeleccionado}</p>
                <InspectionPanel 
                  equipoId={equipoSeleccionado} 
                  onChangeTab={setActiveTab}
                />
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon">🔍</span>
                <h2>Inspección con IA</h2>
                <p>Selecciona un activo en el panel lateral para comenzar el análisis multimodal.</p>
              </div>
            )
          )}

          {activeTab === 'HISTORY' && (
            <AssetHistory empresaId={empresaSeleccionada} />
          )}

          {activeTab === 'MINUTA' && (
            <MinutaResumenPanel
              empresaIdInicial={empresaSeleccionada}
              onSelectEquipoAndTab={(eqId, targetTab) => {
                setEquipoSeleccionado(eqId);
                setActiveTab(targetTab || 'MANUAL');
              }}
            />
          )}


          {activeTab === 'REPORTS' && (
            <ReportsPanel />
          )}


          {activeTab === 'SETTINGS' && (
            <SettingsPanel />
          )}

          {activeTab === 'AUDIT' && (
            <AuditPanel />
          )}

        </div>
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <MobileNav activeTab={activeTab} onChangeTab={setActiveTab} />
    </main>
  );
}
