'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthProvider';
import { API_BASE_URL } from '../services/api';
import { ToastProvider } from './ToastProvider';
import GlobalDashboard from './GlobalDashboard';
import EquipoFichaPanel from './EquipoFichaPanel';
import AnalisisRevisionPanel from './AnalisisRevisionPanel';
import ReportsPanel from './ReportsPanel';
import SettingsPanel from './SettingsPanel';
import AuditPanel from './AuditPanel';
import HelpModal from './HelpModal';
import {
  LayoutDashboard,
  ClipboardList,
  Sparkles,
  FileText,
  Settings,
  Sun,
  Moon,
  HelpCircle,
  LogOut,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  MapPin,
  Cpu,
  ShieldCheck,
  X,
  Menu
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    id: 'GENERAL',
    label: 'Vista General',
    shortLabel: 'Planta',
    icon: LayoutDashboard,
    description: 'Estado por planta, áreas y avance de campaña'
  },
  {
    id: 'FICHA',
    label: 'Ficha de Equipo',
    shortLabel: 'Ficha',
    icon: ClipboardList,
    description: 'Última inspección y ficha técnica en 1 pantalla'
  },
  {
    id: 'ANALISIS',
    label: 'Análisis y Revisión IA',
    shortLabel: 'Análisis IA',
    icon: Sparkles,
    description: 'Fotos, anotaciones, evaluación Gemini y guardado'
  },
  {
    id: 'REPORTES',
    label: 'Reportes',
    shortLabel: 'Reportes',
    icon: FileText,
    description: 'Actas individuales y libros consolidados PDF'
  },
  {
    id: 'CONFIG',
    label: 'Configuración',
    shortLabel: 'Config',
    icon: Settings,
    description: 'Parámetros, Drive, Gemini IA, usuarios y auditoría'
  }
];

function getStatusBadgeStyle(estadoRaw, isLight) {
  const est = (estadoRaw || 'PENDIENTE').toUpperCase();
  if (est.includes('CRIT')) {
    return {
      label: 'Crítico',
      cls: isLight
        ? 'bg-rose-100 text-rose-800 border-rose-200'
        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    };
  }
  if (est.includes('REGULAR')) {
    return {
      label: 'Observado',
      cls: isLight
        ? 'bg-amber-100 text-amber-800 border-amber-200'
        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    };
  }
  if (est.includes('BUEN')) {
    return {
      label: 'Bueno',
      cls: isLight
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    };
  }
  if (est.includes('FUERA')) {
    return {
      label: 'Fuera de ruta',
      cls: isLight
        ? 'bg-slate-200 text-slate-700 border-slate-300'
        : 'bg-slate-700/40 text-slate-300 border-slate-600/40'
    };
  }
  return {
    label: 'Pendiente',
    cls: isLight
      ? 'bg-violet-100 text-violet-800 border-violet-200'
      : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
  };
}

export default function AppShell() {
  return (
    <ToastProvider>
      <AppShellInner />
    </ToastProvider>
  );
}

function AppShellInner() {
  const { user, token, logout } = useAuth();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');

  const authFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${activeToken || token}`
      }
    });
  };

  // Tema Claro / Oscuro
  const [themeMode, setThemeMode] = useState('dark-soft');
  const isLight = themeMode === 'light';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('inspector_theme_mode') || 'dark-soft';
      setThemeMode(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const next = isLight ? 'dark-soft' : 'light';
    setThemeMode(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('inspector_theme_mode', next);
      if (next === 'light') {
        document.documentElement.removeAttribute('data-theme');
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
    }
  };

  // Navegación principal de 5 secciones (por defecto Vista General)
  const [activeSection, setActiveSection] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inspector_active_section');
      if (saved && NAV_SECTIONS.some((s) => s.id === saved)) return saved;
    }
    return 'GENERAL';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [configSubTab, setConfigSubTab] = useState('sistema'); // 'sistema' | 'auditoria'

  // Contexto jerárquico compartido: Empresa -> Área -> Equipos -> Equipo Seleccionado
  const [empresas, setEmpresas] = useState([]);
  const [empresaId, setEmpresaId] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('dashboard_empresa_id') || '1';
    return '1';
  });

  const [ubicaciones, setUbicaciones] = useState([]);
  const [ubicacionId, setUbicacionId] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('dashboard_ubicacion_id') || '';
    return '';
  });

  const [equipos, setEquipos] = useState([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [equipoId, setEquipoId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_equipo_id');
      return saved ? parseInt(saved, 10) || null : null;
    }
    return null;
  });

  // Refresh key para forzar recarga de equipos/dashboard tras guardar inspección
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  // Selector rápido de equipo (popover buscable en cabecera de FICHA / ANALISIS)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerStatusFilter, setPickerStatusFilter] = useState('TODOS');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    if (pickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  // Atajo F1 para Manual
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSelectSection = (sectionId) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('inspector_active_section', sectionId);
    }
  };

  const handleSelectEquipo = (id) => {
    const numericId = id ? parseInt(id, 10) : null;
    setEquipoId(numericId);
    if (typeof window !== 'undefined') {
      if (numericId) localStorage.setItem('dashboard_equipo_id', String(numericId));
      else localStorage.removeItem('dashboard_equipo_id');
    }
  };

  const handleNavigateToEquipo = (id, targetSection = 'FICHA', optionalUbicacionId = null) => {
    handleSelectEquipo(id);
    if (optionalUbicacionId !== null && optionalUbicacionId !== undefined) {
      setUbicacionId(String(optionalUbicacionId));
      if (typeof window !== 'undefined') {
        localStorage.setItem('dashboard_ubicacion_id', String(optionalUbicacionId));
      }
    }
    handleSelectSection(targetSection);
  };

  const handleInspectionSaved = () => {
    setDataRefreshKey((k) => k + 1);
  };

  // Cargar empresas
  useEffect(() => {
    if (!activeToken) return;
    authFetch(`${API_BASE_URL}/empresas`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmpresas(data);
          if (data.length > 0 && !empresaId) {
            setEmpresaId(String(data[0].id));
          }
        }
      })
      .catch((err) => console.error('Error cargando empresas:', err));
  }, [activeToken]);

  // Cargar ubicaciones cuando cambia empresa
  useEffect(() => {
    if (!activeToken || !empresaId) return;
    if (typeof window !== 'undefined') localStorage.setItem('dashboard_empresa_id', String(empresaId));

    authFetch(`${API_BASE_URL}/ubicaciones?empresa_id=${empresaId}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setUbicaciones(data);
        }
      })
      .catch((err) => console.error('Error cargando ubicaciones:', err));
  }, [empresaId, activeToken]);

  // Cargar equipos cuando cambia empresa, ubicación o se guarda una inspección
  useEffect(() => {
    if (!activeToken || !empresaId) return;
    setLoadingEquipos(true);
    const params = new URLSearchParams({ empresa_id: empresaId });
    if (ubicacionId) params.append('ubicacion_id', ubicacionId);

    authFetch(`${API_BASE_URL}/equipos?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.equipos || [];
        setEquipos(list);
        setLoadingEquipos(false);
      })
      .catch((err) => {
        console.error('Error cargando equipos:', err);
        setLoadingEquipos(false);
      });
  }, [empresaId, ubicacionId, activeToken, dataRefreshKey]);

  const empresaActual = useMemo(
    () => empresas.find((e) => String(e.id) === String(empresaId)),
    [empresas, empresaId]
  );

  const equipoActual = useMemo(
    () => equipos.find((eq) => Number(eq.id) === Number(equipoId)) || null,
    [equipos, equipoId]
  );

  const equiposFiltradosPicker = useMemo(() => {
    let list = equipos;
    if (pickerStatusFilter !== 'TODOS') {
      list = list.filter((eq) => {
        const est = (eq.estado_actual || eq.estado || 'PENDIENTE').toUpperCase();
        if (pickerStatusFilter === 'PENDIENTE') {
          return !est || est === 'PENDIENTE' || est === 'SIN DATOS' || eq.has_campaign_inspection === 0;
        }
        return est.includes(pickerStatusFilter);
      });
    }
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase();
      list = list.filter(
        (eq) =>
          (eq.nombre || '').toLowerCase().includes(q) ||
          (eq.codigo || '').toLowerCase().includes(q) ||
          (eq.tag || '').toLowerCase().includes(q) ||
          (eq.area || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [equipos, pickerSearch, pickerStatusFilter]);

  const currentEquipoIndex = useMemo(
    () => equipos.findIndex((eq) => Number(eq.id) === Number(equipoId)),
    [equipos, equipoId]
  );

  const handlePrevEquipo = () => {
    if (equipos.length === 0) return;
    const prevIdx = currentEquipoIndex > 0 ? currentEquipoIndex - 1 : equipos.length - 1;
    handleSelectEquipo(equipos[prevIdx].id);
  };

  const handleNextEquipo = () => {
    if (equipos.length === 0) return;
    const nextIdx = currentEquipoIndex >= 0 && currentEquipoIndex < equipos.length - 1 ? currentEquipoIndex + 1 : 0;
    handleSelectEquipo(equipos[nextIdx].id);
  };

  const currentSectionMeta = NAV_SECTIONS.find((s) => s.id === activeSection) || NAV_SECTIONS[0];
  const showEquipmentSelector = activeSection === 'FICHA' || activeSection === 'ANALISIS';

  return (
    <div
      className={`modern-inspector-container min-h-screen flex flex-col lg:flex-row font-sans transition-colors duration-200 ${
        isLight ? 'bg-[#f3f5f8] text-slate-800' : 'bg-[#0d1117] text-slate-200'
      }`}
    >
      {/* Armonización de estilos heredados en paneles */}
      <style jsx global>{`
        [data-theme="dark"] .modern-inspector-container .glass-panel {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #f3f4f6 !important;
        }
        :root:not([data-theme="dark"]) .modern-inspector-container .glass-panel {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #1f2937 !important;
        }
        [data-theme="dark"] .modern-inspector-container select,
        [data-theme="dark"] .modern-inspector-container textarea,
        [data-theme="dark"] .modern-inspector-container input {
          background-color: #0b0e14 !important;
          color: #ffffff !important;
          border-color: #262c38 !important;
        }
        :root:not([data-theme="dark"]) .modern-inspector-container select,
        :root:not([data-theme="dark"]) .modern-inspector-container textarea,
        :root:not([data-theme="dark"]) .modern-inspector-container input {
          background-color: #f8fafc !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
        }
      `}</style>

      {/* ================================================================ */}
      {/* BARRA LATERAL PRINCIPAL (DESKTOP)                                */}
      {/* ================================================================ */}
      <aside
        className={`hidden lg:flex flex-col border-r shrink-0 sticky top-0 h-screen transition-all duration-200 z-40 ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[240px]'
        } ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800/80'
        }`}
      >
        {/* Marca */}
        <div
          className={`h-14 px-3.5 border-b flex items-center justify-between ${
            isLight ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/sulvy_logo.png" alt="Sulvy" className="h-6 w-auto shrink-0" />
              <div className="min-w-0">
                <div className={`text-xs font-extrabold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Agente Inspector
                </div>
                <div className="text-[10px] font-bold text-sky-500 uppercase tracking-wider">
                  PGP 2026
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed((c) => !c)}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            } ${sidebarCollapsed ? 'mx-auto' : ''}`}
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Navegación 5 Secciones */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {NAV_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => handleSelectSection(sec.id)}
                title={sidebarCollapsed ? `${sec.label}: ${sec.description}` : sec.description}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                  isActive
                    ? isLight
                      ? 'bg-sky-50 border-sky-200 text-sky-900 shadow-sm'
                      : 'bg-sky-500/15 border-sky-500/30 text-white shadow-sm'
                    : isLight
                      ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? sec.id === 'ANALISIS'
                        ? 'text-indigo-400'
                        : 'text-sky-500'
                      : 'opacity-80'
                  }`}
                />
                {!sidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{sec.label}</div>
                    <div className={`text-[10px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {sec.description}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pie del sidebar: Tema, Ayuda, Usuario */}
        <div className={`p-2.5 border-t space-y-2 ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            <button
              onClick={toggleTheme}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white'
              }`}
              title="Cambiar tema Claro / Oscuro"
            >
              {isLight ? <Moon className="w-3.5 h-3.5 text-indigo-600" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
              {!sidebarCollapsed && <span>{isLight ? 'Oscuro' : 'Claro'}</span>}
            </button>
            <button
              onClick={() => setShowHelp(true)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:text-white'
              }`}
              title="Manual de Uso (F1)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>

          {user && (
            <div
              className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#0d1117] border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0 ${
                    isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  {user.username ? user.username.substring(0, 2).toUpperCase() : 'US'}
                </div>
                {!sidebarCollapsed && (
                  <div className="min-w-0">
                    <div className={`text-xs font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {user.nombre_completo || user.username}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase">{user.rol || 'inspector'}</div>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ================================================================ */}
      {/* CONTENIDO PRINCIPAL                                              */}
      {/* ================================================================ */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        {/* Cabecera Contextual Superior */}
        <header
          className={`sticky top-0 z-30 border-b px-3 sm:px-6 h-14 flex items-center justify-between gap-3 backdrop-blur-md ${
            isLight ? 'bg-white/95 border-slate-200' : 'bg-[#12161f]/95 border-slate-800/80'
          }`}
        >
          {/* Título de Sección + Botón móvil */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`lg:hidden p-1.5 rounded-lg border ${
                isLight ? 'border-slate-200 text-slate-700' : 'border-slate-800 text-slate-300'
              }`}
              aria-label="Menú"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className={`text-sm sm:text-base font-extrabold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {currentSectionMeta.label}
              </h1>
              <p className="hidden sm:block text-[11px] text-slate-400 truncate">
                {currentSectionMeta.description}
              </p>
            </div>
          </div>

          {/* Selector Rápido de Equipo (Solo en FICHA y ANALISIS) */}
          {showEquipmentSelector && (
            <div className="flex items-center gap-2 relative" ref={pickerRef}>
              <button
                onClick={handlePrevEquipo}
                disabled={equipos.length === 0}
                className={`hidden sm:flex p-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    : 'bg-[#0d1117] border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
                title="Equipo anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => setPickerOpen((o) => !o)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-left transition-all max-w-[240px] sm:max-w-[360px] ${
                  isLight
                    ? 'bg-slate-50 border-slate-300 hover:border-sky-400 text-slate-900'
                    : 'bg-[#0d1117] border-slate-700 hover:border-sky-500 text-white'
                }`}
              >
                <Cpu className="w-4 h-4 text-sky-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">
                    {equipoActual
                      ? `${equipoActual.codigo || equipoActual.tag || `#${equipoActual.id}`} · ${equipoActual.nombre}`
                      : 'Seleccionar equipo...'}
                  </div>
                </div>
                {equipoActual && (
                  <span
                    className={`hidden md:inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                      getStatusBadgeStyle(equipoActual.estado_actual, isLight).cls
                    }`}
                  >
                    {getStatusBadgeStyle(equipoActual.estado_actual, isLight).label}
                  </span>
                )}
                <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
              </button>

              <button
                onClick={handleNextEquipo}
                disabled={equipos.length === 0}
                className={`hidden sm:flex p-1.5 rounded-lg border transition-colors ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    : 'bg-[#0d1117] border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
                title="Siguiente equipo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Popover Buscador de Equipo */}
              {pickerOpen && (
                <div
                  className={`absolute right-0 top-12 w-[320px] sm:w-[440px] rounded-2xl border shadow-2xl p-3 z-50 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-[#151a24] border-slate-700'
                  }`}
                >
                  {/* Filtros Empresa y Área */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                        <Building2 className="w-3 h-3" /> Planta
                      </label>
                      <select
                        value={empresaId}
                        onChange={(e) => {
                          setEmpresaId(e.target.value);
                          setUbicacionId('');
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs font-semibold"
                      >
                        {empresas.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1">
                        <MapPin className="w-3 h-3" /> Área
                      </label>
                      <select
                        value={ubicacionId}
                        onChange={(e) => setUbicacionId(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border text-xs font-semibold"
                      >
                        <option value="">Todas las áreas</option>
                        {ubicaciones.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Buscador */}
                  <div className="relative mb-2">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Buscar por TAG, código o nombre..."
                      autoFocus
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs"
                    />
                  </div>

                  {/* Filtro rápido estado */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['TODOS', 'CRITICO', 'REGULAR', 'BUENO', 'PENDIENTE'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setPickerStatusFilter(st)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors ${
                          pickerStatusFilter === st
                            ? 'bg-sky-500/20 border-sky-500 text-sky-400'
                            : isLight
                              ? 'border-slate-200 text-slate-600 hover:bg-slate-100'
                              : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>

                  {/* Lista */}
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                    {loadingEquipos ? (
                      <div className="py-6 text-center text-xs text-slate-400">Cargando equipos...</div>
                    ) : equiposFiltradosPicker.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">Sin coincidencias</div>
                    ) : (
                      equiposFiltradosPicker.map((eq) => {
                        const selected = Number(eq.id) === Number(equipoId);
                        const badge = getStatusBadgeStyle(eq.estado_actual, isLight);
                        return (
                          <button
                            key={eq.id}
                            onClick={() => {
                              handleSelectEquipo(eq.id);
                              setPickerOpen(false);
                            }}
                            className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left border transition-colors ${
                              selected
                                ? 'bg-sky-500/15 border-sky-500/50'
                                : isLight
                                  ? 'border-transparent hover:bg-slate-100'
                                  : 'border-transparent hover:bg-slate-800/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate">
                                <span className="font-mono text-sky-500 mr-1.5">
                                  {eq.codigo || eq.tag || `#${eq.id}`}
                                </span>
                                {eq.nombre}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {eq.area || 'Planta'} {eq.material ? `· ${eq.material}` : ''}
                              </div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* En Config: sub-switch Sistema / Auditoría */}
          {activeSection === 'CONFIG' && (
            <div className="flex items-center gap-1 p-1 rounded-xl border border-slate-700/40">
              <button
                onClick={() => setConfigSubTab('sistema')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  configSubTab === 'sistema'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Parámetros y Sistema
              </button>
              <button
                onClick={() => setConfigSubTab('auditoria')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  configSubTab === 'auditoria'
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Auditoría
              </button>
            </div>
          )}
        </header>

        {/* Área de Trabajo Principal (100% del ancho útil) */}
        <main className="flex-1 p-3 sm:p-5 max-w-[1760px] w-full mx-auto">
          {activeSection === 'GENERAL' && (
            <GlobalDashboard
              empresaId={empresaId}
              empresas={empresas}
              onChangeEmpresa={(id) => {
                setEmpresaId(String(id));
                setUbicacionId('');
              }}
              onSelectUbicacion={(id) => setUbicacionId(String(id || ''))}
              onSelectEquipo={(eqId) => handleNavigateToEquipo(eqId, 'FICHA')}
              onAnalyzeEquipo={(eqId) => handleNavigateToEquipo(eqId, 'ANALISIS')}
              onChangeTab={(t) => {
                if (t === 'FACTORY' || t === 'ANALISIS') handleSelectSection('ANALISIS');
                else if (t === 'FICHA') handleSelectSection('FICHA');
                else if (t === 'REPORTS' || t === 'REPORTES') handleSelectSection('REPORTES');
              }}
              onOpenHelp={() => setShowHelp(true)}
              refreshKey={dataRefreshKey}
            />
          )}

          {activeSection === 'FICHA' && (
            <EquipoFichaPanel
              equipoId={equipoId}
              isLight={isLight}
              onOpenPicker={() => setPickerOpen(true)}
              onGoToAnalysis={() => handleSelectSection('ANALISIS')}
              onEquipoUpdated={handleInspectionSaved}
            />
          )}

          {activeSection === 'ANALISIS' && (
            <AnalisisRevisionPanel
              equipoId={equipoId}
              isLight={isLight}
              onOpenPicker={() => setPickerOpen(true)}
              onGoToFicha={() => handleSelectSection('FICHA')}
              onGoToReportes={() => handleSelectSection('REPORTES')}
              onInspectionSaved={handleInspectionSaved}
            />
          )}

          {activeSection === 'REPORTES' && (
            <div
              className={`rounded-2xl border p-4 sm:p-5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800'
              }`}
            >
              <ReportsPanel />
            </div>
          )}

          {activeSection === 'CONFIG' && (
            <div
              className={`rounded-2xl border p-4 sm:p-5 ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#12161f] border-slate-800'
              }`}
            >
              {configSubTab === 'sistema' ? <SettingsPanel /> : <AuditPanel />}
            </div>
          )}
        </main>
      </div>

      {/* ================================================================ */}
      {/* NAVEGACIÓN INFERIOR MÓVIL (< lg)                                 */}
      {/* ================================================================ */}
      <nav
        className={`lg:hidden fixed bottom-0 inset-x-0 z-40 border-t flex items-center justify-around px-1 py-1.5 backdrop-blur-md ${
          isLight ? 'bg-white/95 border-slate-200' : 'bg-[#12161f]/95 border-slate-800'
        }`}
      >
        {NAV_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => handleSelectSection(sec.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                isActive ? 'text-sky-500' : 'text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sec.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Drawer móvil extra (Tema, Ayuda, Logout) */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div
            className={`relative w-72 max-w-[85vw] h-full p-4 flex flex-col z-10 ${
              isLight ? 'bg-white text-slate-900' : 'bg-[#12161f] text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/40">
              <div className="flex items-center gap-2">
                <img src="/sulvy_logo.png" alt="Sulvy" className="h-6 w-auto" />
                <span className="font-extrabold text-sm">Agente Inspector</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 space-y-1">
              {NAV_SECTIONS.map((sec) => {
                const Icon = sec.icon;
                return (
                  <button
                    key={sec.id}
                    onClick={() => handleSelectSection(sec.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold ${
                      activeSection === sec.id ? 'bg-sky-500/15 text-sky-400' : 'opacity-80'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-700/40 space-y-2">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/40 text-xs font-semibold"
              >
                {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                <span>{isLight ? 'Cambiar a Modo Oscuro' : 'Cambiar a Modo Claro'}</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setShowHelp(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/40 text-xs font-semibold"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Manual de Uso</span>
              </button>
              {user && (
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión ({user.username})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}

