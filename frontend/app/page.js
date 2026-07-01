'use client';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import InspectionPanel from '../components/InspectionPanel';
import ManualPanel from '../components/ManualPanel';
import AssetHistory from '../components/AssetHistory';
import { AuthProvider, useAuth } from '../components/AuthProvider';
import Login from '../components/Login';
import ReportsPanel from '../components/ReportsPanel';
import SettingsPanel from '../components/SettingsPanel';
import AuditPanel from '../components/AuditPanel';

export default function Home() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}

function DashboardContent() {
  const { user, loading, logout } = useAuth();
  const [equipoSeleccionado, setEquipoSeleccionado] = useState(null);
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState(null);
  const [activeTab, setActiveTab] = useState('MANUAL'); // MANUAL, FACTORY, HISTORY, REPORTS, SETTINGS
  const [showUserMenu, setShowUserMenu] = useState(false);

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
  ];

  return (
    <main className="container">
      <Sidebar
        onSelectEquipo={(id) => {
          setEquipoSeleccionado(id);
          if (id) setActiveTab('FACTORY');
        }}
        onSelectEmpresa={setEmpresaSeleccionada}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
      />

      <div className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Cabecera global: campaña, pestañas y perfil */}
        <header className="app-header">
          <div>
            <div className="eyebrow">Campaña PGP 2026 · En curso</div>
            <nav className="tab-nav">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="header-right">
            <span className="header-clock" suppressHydrationWarning>{fecha}</span>

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
                <ManualPanel equipoId={equipoSeleccionado} />
              </div>
            ) : (
              <div className="empty-state">
                <span className="empty-state__icon">📝</span>
                <h2>Carga manual</h2>
                <p>Selecciona un activo en el panel lateral para comenzar el registro manual.</p>
              </div>
            )
          )}

          {activeTab === 'FACTORY' && (
            equipoSeleccionado ? (
              <div style={{ height: '100%' }}>
                <h2 className="panel-heading panel-heading--accent">Panel de inspección · IA</h2>
                <p className="panel-sub">Activo · ID {equipoSeleccionado}</p>
                <InspectionPanel equipoId={equipoSeleccionado} />
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
    </main>
  );
}
