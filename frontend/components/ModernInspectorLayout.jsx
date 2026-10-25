'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { API_BASE_URL } from '../services/api';
import ManualPanel from './ManualPanel';
import InspectionPanel from './InspectionPanel';
import AssetHistory from './AssetHistory';
import ReportsPanel from './ReportsPanel';
import SettingsPanel from './SettingsPanel';
import AuditPanel from './AuditPanel';
import HelpModal from './HelpModal';
import GlobalDashboard from './GlobalDashboard';
import {
  Building2,
  MapPin,
  Cpu,
  Activity,
  History,
  Camera,
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  Search,
  Sliders,
  TrendingUp,
  ShieldAlert,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  Layers,
  FileCheck,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight
} from 'lucide-react';

export default function ModernInspectorLayout({ onToggleLegacyView }) {
  const { user, token, logout } = useAuth();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');

  const authFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${activeToken || token}`
      }
    });
  };

  // Modo de contraste / Tema: 'dark-soft' (Oscuro suave) | 'light' (Claro corporativo)
  const [themeMode, setThemeMode] = useState('dark-soft');
  const isLight = themeMode === 'light';

  // Sincronizar data-theme con el document.documentElement al cargar y al cambiar
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

  // 1. Estados de Navegación Jerárquica (Zona A)
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
  const [equipoId, setEquipoId] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboard_equipo_id');
      return saved ? parseInt(saved, 10) || null : null;
    }
    return null;
  });

  // Filtros de equipos
  const [busquedaEquipo, setBusquedaEquipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  // 2. Pestaña activa (Zona B)
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('inspector_modern_tab') || 'ESTADO';
    return 'ESTADO';
  });

  // Posición de KPIs: 'TOP' (encabezado) | 'BOTTOM' (como en el boceto)
  const [posicionKpis, setPosicionKpis] = useState('TOP');

  // Drawer responsive para móviles / tablets
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Métricas reales de la empresa desde /dashboard/stats
  const [metrics, setMetrics] = useState({
    critical_alerts: 0,
    under_observation: 0,
    pending_inspections: 0,
    good_condition: 0,
    campaign_progress_pct: 0,
    inspected_equipos: 0,
    total_equipos: 0
  });

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [loadingEquipos, setLoadingEquipos] = useState(false);

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') localStorage.setItem('inspector_modern_tab', tab);
  };

  // Cargar empresas
  useEffect(() => {
    if (!activeToken) return;
    authFetch(`${API_BASE_URL}/empresas`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEmpresas(data);
          if (data.length > 0 && !empresaId) {
            setEmpresaId(String(data[0].id));
          }
        }
      })
      .catch(err => console.error('Error cargando empresas:', err));
  }, [activeToken]);

  // Cargar ubicaciones cuando cambia empresa
  useEffect(() => {
    if (!activeToken || !empresaId) return;
    if (typeof window !== 'undefined') localStorage.setItem('dashboard_empresa_id', empresaId.toString());

    authFetch(`${API_BASE_URL}/ubicaciones?empresa_id=${empresaId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUbicaciones(data);
          if (data.length > 0) {
            setUbicacionId(prev => {
              const existe = data.some(u => String(u.id) === String(prev));
              return existe ? prev : String(data[0].id);
            });
          } else {
            setUbicacionId('');
          }
        }
      })
      .catch(err => console.error('Error cargando ubicaciones:', err));

    authFetch(`${API_BASE_URL}/dashboard/stats?empresa_id=${empresaId}`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') setMetrics(data);
      })
      .catch(err => console.error('Error cargando stats:', err));
  }, [empresaId, activeToken]);

  // Cargar equipos cuando cambia empresa o ubicación
  useEffect(() => {
    if (!activeToken || !empresaId) return;
    setLoadingEquipos(true);

    const queryParams = new URLSearchParams({ empresa_id: empresaId });
    if (ubicacionId) queryParams.append('ubicacion_id', ubicacionId);

    authFetch(`${API_BASE_URL}/equipos?${queryParams.toString()}`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.equipos || []);
        setEquipos(list);
        setLoadingEquipos(false);

        if (list.length > 0) {
          setEquipoId(prev => {
            if (prev && list.some(eq => eq.id === prev)) return prev;
            return list[0].id;
          });
        }
      })
      .catch(err => {
        console.error('Error cargando equipos:', err);
        setLoadingEquipos(false);
      });
  }, [empresaId, ubicacionId, activeToken]);

  const handleSelectEquipo = (id) => {
    setEquipoId(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('dashboard_equipo_id', id.toString());
      else localStorage.removeItem('dashboard_equipo_id');
    }
    // En pantallas móviles/tablets cerramos el drawer al seleccionar un equipo
    setMobileDrawerOpen(false);
  };

  const equiposFiltrados = useMemo(() => {
    let result = equipos;
    if (filtroEstado !== 'TODOS') {
      if (filtroEstado === 'PENDIENTE') {
        result = result.filter(eq => {
          const est = (eq.estado_actual || eq.estado || '').toUpperCase();
          return !est || est === 'PENDIENTE' || est === 'SIN DATOS' || est === 'NO INSPECCIONADO' || eq.has_campaign_inspection === 0;
        });
      } else if (filtroEstado === 'FUERA DE RUTA') {
        result = result.filter(eq => {
          const est = (eq.estado_actual || eq.estado || '').toUpperCase();
          return est.includes('FUERA') || est.includes('RUTA') || eq.fuera_de_ruta === true || eq.es_fuera_ruta === true;
        });
      } else if (filtroEstado === 'CRITICO') {
        result = result.filter(eq => {
          const est = (eq.estado_actual || eq.estado || '').toUpperCase();
          return est.includes('CRIT');
        });
      } else if (filtroEstado === 'REGULAR') {
        result = result.filter(eq => {
          const est = (eq.estado_actual || eq.estado || '').toUpperCase();
          return est.includes('REGULAR') || est.includes('ALERTA') || est.includes('OBSERV');
        });
      } else if (filtroEstado === 'BUENO') {
        result = result.filter(eq => {
          const est = (eq.estado_actual || eq.estado || '').toUpperCase();
          return est.includes('BUEN') || est === 'OP' || est === 'OPERATIVO';
        });
      } else {
        result = result.filter(eq => (eq.estado_actual || eq.estado) === filtroEstado);
      }
    }
    if (busquedaEquipo.trim()) {
      const q = busquedaEquipo.toLowerCase();
      result = result.filter(eq =>
        (eq.nombre && eq.nombre.toLowerCase().includes(q)) ||
        (eq.codigo && eq.codigo.toLowerCase().includes(q)) ||
        (eq.tag && eq.tag.toLowerCase().includes(q))
      );
    }
    return result;
  }, [equipos, busquedaEquipo, filtroEstado]);

  const equipoActual = useMemo(() => {
    return equipos.find(eq => eq.id === equipoId) || null;
  }, [equipos, equipoId]);

  const empresaActual = useMemo(() => {
    return empresas.find(e => String(e.id) === String(empresaId)) || null;
  }, [empresas, empresaId]);

  const ubicacionActual = useMemo(() => {
    return ubicaciones.find(u => String(u.id) === String(ubicacionId)) || null;
  }, [ubicaciones, ubicacionId]);

  // Badges con contraste suave
  const renderBadge = (estado) => {
    const estNorm = (estado || '').toUpperCase();
    if (estNorm.includes('CRIT')) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          isLight
            ? 'bg-rose-100 text-rose-800 border border-rose-300'
            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
        }`}>
          <AlertOctagon className="w-3 h-3" /> Crítico
        </span>
      );
    }
    if (estNorm.includes('REGULAR') || estNorm.includes('ALERTA') || estNorm.includes('OBSERV')) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          isLight
            ? 'bg-amber-100 text-amber-800 border border-amber-300'
            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
        }`}>
          <AlertTriangle className="w-3 h-3" /> Observado
        </span>
      );
    }
    if (estNorm.includes('FUERA') || estNorm.includes('RUTA')) {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          isLight
            ? 'bg-purple-100 text-purple-800 border border-purple-300'
            : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
        }`}>
          <HelpCircle className="w-3 h-3" /> Fuera de Ruta
        </span>
      );
    }
    if (!estNorm || estNorm === 'PENDIENTE' || estNorm === 'SIN DATOS' || estNorm === 'NO INSPECCIONADO') {
      return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
          isLight
            ? 'bg-slate-100 text-slate-700 border border-slate-300'
            : 'bg-slate-700/30 text-slate-300 border border-slate-600/40'
        }`}>
          <Clock className="w-3 h-3" /> Pendiente
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
        isLight
          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
          : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      }`}>
        <CheckCircle2 className="w-3 h-3" /> Bueno
      </span>
    );
  };

  // Bloque de KPIs
  const renderBloqueKPIs = (compact = false) => (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 ${
      compact
        ? 'py-1'
        : isLight
          ? 'p-4 bg-white border border-slate-200 rounded-2xl shadow-sm'
          : 'p-4 bg-[#141824]/90 border border-slate-800 rounded-2xl shadow-lg'
    }`}>
      {/* Alertas Críticas */}
      <div className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border ${
        isLight ? 'bg-rose-50/70 border-rose-200/80' : 'bg-rose-950/20 border-rose-900/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${isLight ? 'bg-rose-100 text-rose-700' : 'bg-rose-500/20 text-rose-400'}`}>
          <ShieldAlert className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase font-bold tracking-wider truncate ${isLight ? 'text-rose-700' : 'text-rose-400'}`}>
            Alertas Críticas
          </div>
          <div className={`text-lg sm:text-xl font-black flex items-baseline gap-1 ${isLight ? 'text-rose-900' : 'text-rose-200'}`}>
            {metrics.critical_alerts || 0}
            <span className={`text-[10px] font-normal ${isLight ? 'text-rose-600' : 'text-rose-400/80'}`}>urgentes</span>
          </div>
        </div>
      </div>

      {/* Bajo Observación */}
      <div className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border ${
        isLight ? 'bg-amber-50/70 border-amber-200/80' : 'bg-amber-950/20 border-amber-900/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}`}>
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase font-bold tracking-wider truncate ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
            Bajo Observación
          </div>
          <div className={`text-lg sm:text-xl font-black flex items-baseline gap-1 ${isLight ? 'text-amber-900' : 'text-amber-200'}`}>
            {metrics.under_observation || 0}
            <span className={`text-[10px] font-normal ${isLight ? 'text-amber-600' : 'text-amber-400/80'}`}>regular</span>
          </div>
        </div>
      </div>

      {/* Pendientes */}
      <div className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border ${
        isLight ? 'bg-purple-50/70 border-purple-200/80' : 'bg-purple-950/20 border-purple-900/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-400'}`}>
          <Clock className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase font-bold tracking-wider truncate ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
            Pendientes
          </div>
          <div className={`text-lg sm:text-xl font-black flex items-baseline gap-1 ${isLight ? 'text-purple-900' : 'text-purple-200'}`}>
            {metrics.pending_inspections || 0}
            <span className={`text-[10px] font-normal ${isLight ? 'text-purple-600' : 'text-purple-400/80'}`}>pendientes</span>
          </div>
        </div>
      </div>

      {/* Avance Campaña */}
      <div className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border ${
        isLight ? 'bg-sky-50/70 border-sky-200/80' : 'bg-sky-950/20 border-sky-900/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'}`}>
          <TrendingUp className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase font-bold tracking-wider truncate ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
            Avance Campaña
          </div>
          <div className={`text-lg sm:text-xl font-black flex items-baseline gap-1 ${isLight ? 'text-sky-900' : 'text-sky-200'}`}>
            {metrics.campaign_progress_pct || 0}%
            <span className={`text-[10px] font-normal ${isLight ? 'text-sky-600' : 'text-sky-400/80'}`}>
              {metrics.inspected_equipos || 0}/{metrics.total_equipos || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Aptos para Operar */}
      <div className={`flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl border col-span-2 sm:col-span-1 ${
        isLight ? 'bg-emerald-50/70 border-emerald-200/80' : 'bg-emerald-950/20 border-emerald-900/30'
      }`}>
        <div className={`p-2 rounded-lg shrink-0 ${isLight ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'}`}>
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className={`text-[10px] uppercase font-bold tracking-wider truncate ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
            Aptos Operar
          </div>
          <div className={`text-lg sm:text-xl font-black flex items-baseline gap-1 ${isLight ? 'text-emerald-900' : 'text-emerald-200'}`}>
            {metrics.good_condition || 0}
            <span className={`text-[10px] font-normal ${isLight ? 'text-emerald-600' : 'text-emerald-400/80'}`}>óptimos</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Render del contenido del Panel A (reutilizado tanto en desktop como en el drawer móvil)
  const renderPanelFiltrosA = () => (
    <div className="flex flex-col gap-3.5">
      <div className={`flex items-center justify-between pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center gap-2 font-bold text-xs tracking-wide">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'
          }`}>
            A
          </div>
          <span className={isLight ? 'text-slate-800' : 'text-slate-200'}>FILTROS Y ACTIVOS</span>
        </div>
        <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
          {equipos.length} equipos
        </span>
      </div>

      {/* 1. Selector Empresa */}
      <div>
        <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
          isLight ? 'text-slate-600' : 'text-slate-300'
        }`}>
          <Building2 className="w-3.5 h-3.5 text-sky-500" />
          Empresa
        </label>
        <div className="relative">
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all cursor-pointer appearance-none pr-8 border ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
                : 'bg-[#0d1017] border-slate-700/80 text-white focus:border-sky-500'
            }`}
          >
            {empresas.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
            ▼
          </div>
        </div>
      </div>

      {/* 2. Selector Área / Ubicación */}
      <div>
        <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 ${
          isLight ? 'text-slate-600' : 'text-slate-300'
        }`}>
          <MapPin className="w-3.5 h-3.5 text-sky-500" />
          Área / Ubicación
        </label>
        <div className="relative">
          <select
            value={ubicacionId}
            onChange={(e) => setUbicacionId(e.target.value)}
            className={`w-full rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none transition-all cursor-pointer appearance-none pr-8 border ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
                : 'bg-[#0d1017] border-slate-700/80 text-white focus:border-sky-500'
            }`}
          >
            <option value="">Todas las Áreas</option>
            {ubicaciones.map((ubi) => (
              <option key={ubi.id} value={ubi.id}>
                {ubi.nombre}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
            ▼
          </div>
        </div>
      </div>

      {/* 3. Selector Equipo con buscador y filtro */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
            isLight ? 'text-slate-600' : 'text-slate-300'
          }`}>
            <Cpu className="w-3.5 h-3.5 text-sky-500" />
            Equipo
          </label>
          <span className={`text-[10px] font-semibold ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
            {equiposFiltrados.length} listados
          </span>
        </div>

        {/* Buscador de equipos */}
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por código, tag o nombre..."
            value={busquedaEquipo}
            onChange={(e) => setBusquedaEquipo(e.target.value)}
            className={`w-full rounded-lg pl-7 pr-2.5 py-1.5 text-xs placeholder-slate-400 focus:outline-none border ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
                : 'bg-[#0d1017] border-slate-800 text-white focus:border-sky-500'
            }`}
          />
        </div>

        {/* Filtro por estado */}
        <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1 text-[10px] scrollbar-thin">
          {['TODOS', 'CRITICO', 'REGULAR', 'BUENO', 'PENDIENTE', 'FUERA DE RUTA'].map((est) => (
            <button
              key={est}
              onClick={() => setFiltroEstado(est)}
              className={`px-2 py-0.5 rounded-md font-bold transition-all border whitespace-nowrap shrink-0 ${
                filtroEstado === est
                  ? isLight ? 'bg-sky-600 text-white border-sky-600' : 'bg-sky-500/25 text-sky-300 border-sky-500/40'
                  : isLight ? 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900' : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {est}
            </button>
          ))}
        </div>

        {/* Lista interactiva de equipos */}
        <div className="flex flex-col gap-1.5 max-h-[300px] lg:max-h-[340px] overflow-y-auto pr-1">
          {loadingEquipos ? (
            <div className={`p-4 text-center text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Cargando equipos...
            </div>
          ) : equiposFiltrados.length === 0 ? (
            <div className={`p-4 text-center text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
              No se encontraron equipos
            </div>
          ) : (
            equiposFiltrados.map((eq) => {
              const isSelected = eq.id === equipoId;
              const estado = eq.estado_actual || eq.estado || 'BUENO';
              return (
                <button
                  key={eq.id}
                  onClick={() => handleSelectEquipo(eq.id)}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                    isSelected
                      ? isLight
                        ? 'bg-sky-50/90 border-sky-400 text-slate-900 shadow-sm'
                        : 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
                      : isLight
                        ? 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        : 'bg-[#0f131a] border-slate-800/70 text-slate-300 hover:bg-slate-800/40 hover:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono font-bold text-xs ${isLight ? 'text-sky-700' : 'text-sky-400'}`}>
                        {eq.codigo || eq.tag || `#${eq.id}`}
                      </span>
                      <span className={`text-xs font-semibold truncate ${isSelected ? (isLight ? 'text-slate-900' : 'text-white') : (isLight ? 'text-slate-700' : 'text-slate-300')}`}>
                        {eq.nombre}
                      </span>
                    </div>
                    <div className={`text-[10px] flex items-center gap-1.5 mt-0.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>{eq.area || ubicacionActual?.nombre || 'Planta'}</span>
                      {eq.material && (
                        <>
                          <span>•</span>
                          <span>{eq.material}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0">{renderBadge(estado)}</div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Ficha Resumen del Equipo Activo */}
      {equipoActual && (
        <div className={`pt-2.5 border-t p-2.5 rounded-xl border ${
          isLight ? 'border-slate-200 bg-slate-50/80' : 'border-slate-800/70 bg-[#0d1017]'
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Activo en Foco
            </span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800 text-slate-300'
            }`}>
              ID #{equipoActual.id}
            </span>
          </div>
          <div className={`text-xs font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {equipoActual.nombre}
          </div>
          <div className={`text-[11px] mt-1 flex items-center justify-between ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            <span>Código: <b className="font-mono text-sky-500">{equipoActual.codigo || equipoActual.tag || 'S/N'}</b></span>
            <span>Material: <b>{equipoActual.material || 'FRP'}</b></span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`modern-inspector-container min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isLight ? 'bg-[#f4f6f9] text-slate-800' : 'bg-[#0f131a] text-slate-200'
    }`}>
      {/* Reglas de armonización para eliminar contrastes duros y heredar el tema en subcomponentes */}
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

      {/* 1. CABECERA PRINCIPAL RESPONSIVE */}
      <header className={`border-b sticky top-0 z-40 px-3 sm:px-6 py-2.5 transition-colors duration-200 ${
        isLight ? 'bg-white/95 border-slate-200/90 shadow-sm backdrop-blur-md' : 'bg-[#151922]/95 border-slate-800/80 backdrop-blur-md'
      }`}>
        <div className="max-w-[1750px] mx-auto flex flex-wrap items-center justify-between gap-2.5">
          
          {/* Logo Sulvy & Título */}
          <div className="flex items-center gap-2.5">
            <a href="https://www.sulvy.com/es/" target="_blank" rel="noopener noreferrer" className="transition-transform hover:scale-105">
              <img src="/sulvy_logo.png" alt="Sulvy" className="h-6 sm:h-7 w-auto" />
            </a>
            <div className={`h-5 w-px ${isLight ? 'bg-slate-300' : 'bg-slate-800'}`} />
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`text-xs sm:text-sm font-extrabold tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Agente Inspector
                </span>
                <span className={`px-1.5 py-0.2 sm:px-2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold tracking-wide uppercase ${
                  isLight ? 'bg-sky-100 text-sky-800 border border-sky-200' : 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
                }`}>
                  PGP 2026
                </span>
              </div>
            </div>
          </div>

          {/* Toggle de Contraste / Tema & Posición de KPIs */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón de Modo Claro / Modo Oscuro Suave */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-semibold transition-all ${
                isLight
                  ? 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                  : 'bg-slate-800/50 text-slate-300 border-slate-700/60 hover:text-white hover:bg-slate-800'
              }`}
              title="Cambiar entre modo claro y modo oscuro suave"
            >
              {isLight ? (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Modo Oscuro Suave</span>
                  <span className="sm:hidden">Oscuro</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modo Claro</span>
                  <span className="sm:hidden">Claro</span>
                </>
              )}
            </button>

            {/* Toggle KPIs (Oculto en pantallas muy angostas) */}
            <div className={`hidden sm:flex items-center gap-1 p-0.5 rounded-xl border text-xs ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#0b0e14] border-slate-800'
            }`}>
              <span className={`px-2 text-[11px] font-medium flex items-center gap-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <Sliders className="w-3 h-3 text-sky-500" /> KPIs:
              </span>
              <button
                onClick={() => setPosicionKpis('TOP')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  posicionKpis === 'TOP'
                    ? isLight ? 'bg-white text-sky-700 shadow-sm border border-slate-200' : 'bg-slate-800 text-sky-300 border border-slate-700'
                    : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                Superior
              </button>
              <button
                onClick={() => setPosicionKpis('BOTTOM')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                  posicionKpis === 'BOTTOM'
                    ? isLight ? 'bg-white text-sky-700 shadow-sm border border-slate-200' : 'bg-slate-800 text-sky-300 border border-slate-700'
                    : isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                }`}
              >
                Inferior
              </button>
            </div>
          </div>

          {/* Acciones de usuario y herramientas */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => handleSelectTab('SETTINGS')}
              className={`p-1.5 rounded-xl border transition-all ${
                activeTab === 'SETTINGS'
                  ? isLight ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-sky-500/20 border-sky-500 text-sky-300'
                  : isLight ? 'bg-white border-slate-200 text-slate-500 hover:text-slate-800' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Configuración"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleSelectTab('AUDIT')}
              className={`p-1.5 rounded-xl border transition-all ${
                activeTab === 'AUDIT'
                  ? isLight ? 'bg-sky-100 border-sky-300 text-sky-800' : 'bg-sky-500/20 border-sky-500 text-sky-300'
                  : isLight ? 'bg-white border-slate-200 text-slate-500 hover:text-slate-800' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Auditoría"
            >
              <FileCheck className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowHelp(true)}
              className={`p-1.5 rounded-xl border transition-all ${
                isLight ? 'bg-white border-slate-200 text-slate-500 hover:text-slate-800' : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Manual (F1)"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Perfil */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className={`flex items-center gap-1.5 sm:gap-2 pl-2 py-1 pr-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    isLight ? 'bg-white border-slate-200 hover:border-slate-300 text-slate-800' : 'bg-[#181d27] border-slate-800 hover:border-slate-700 text-slate-200'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    isLight ? 'bg-sky-100 text-sky-800' : 'bg-sky-500/20 text-sky-300'
                  }`}>
                    {user.username ? user.username.substring(0, 2).toUpperCase() : 'US'}
                  </div>
                  <span className="font-bold truncate max-w-[80px] sm:max-w-[120px] hidden sm:inline">
                    {user.nombre_completo || user.username}
                  </span>
                </button>

                {showUserMenu && (
                  <div className={`absolute right-0 mt-2 w-52 rounded-xl border shadow-xl p-2.5 z-50 animate-fadeIn ${
                    isLight ? 'bg-white border-slate-200' : 'bg-[#181d27] border-slate-800'
                  }`}>
                    <div className={`pb-2 border-b text-xs ${isLight ? 'border-slate-100 text-slate-600' : 'border-slate-800 text-slate-400'}`}>
                      <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{user.nombre_completo}</div>
                      <div className="text-[11px] truncate">@{user.username}</div>
                    </div>
                    {onToggleLegacyView && (
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          onToggleLegacyView();
                        }}
                        className={`mt-1.5 w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                          isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5 text-sky-500" />
                        Vista Clásica
                      </button>
                    )}
                    <button
                      onClick={logout}
                      className="mt-1 w-full text-left px-2 py-1.5 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* KPIs SUPERIOR */}
        {posicionKpis === 'TOP' && (
          <div className={`max-w-[1750px] mx-auto mt-2.5 pt-2.5 border-t ${isLight ? 'border-slate-200' : 'border-slate-800/60'}`}>
            {renderBloqueKPIs(true)}
          </div>
        )}
      </header>

      {/* BARRA RESPONSIVE DE ACTIVO PARA PANTALLAS PEQUEÑAS / TABLETS (< lg) */}
      <div className="lg:hidden px-3 pt-3">
        <div className={`flex items-center justify-between p-2.5 rounded-xl border shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#151922] border-slate-800'
        }`}>
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <div className={`p-1.5 rounded-lg shrink-0 ${isLight ? 'bg-sky-50 text-sky-700' : 'bg-sky-500/20 text-sky-400'}`}>
              <Cpu className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className={`text-[10px] uppercase font-bold truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {empresaActual?.nombre || 'Empresa'} · {ubicacionActual?.nombre || 'Todas'}
              </div>
              <div className={`text-xs font-black truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {equipoActual ? `${equipoActual.codigo || ''} ${equipoActual.nombre}` : 'Sin equipo seleccionado'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-sm transition-all"
          >
            <Menu className="w-3.5 h-3.5" />
            <span>Activos</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20">
              {equiposFiltrados.length}
            </span>
          </button>
        </div>
      </div>

      {/* DRAWER MÓVIL / TABLET (< lg) */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop con blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          {/* Panel deslizante */}
          <div className={`relative w-full max-w-sm sm:max-w-md h-full shadow-2xl p-4 flex flex-col overflow-y-auto z-10 animate-slideRight ${
            isLight ? 'bg-white text-slate-800' : 'bg-[#151922] text-slate-200'
          }`}>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span className="p-1 rounded-lg bg-sky-500/20 text-sky-400">
                  <Filter className="w-4 h-4" />
                </span>
                <span>Selección de Activos</span>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:text-black dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderPanelFiltrosA()}
          </div>
        </div>
      )}

      {/* 2. CUERPO PRINCIPAL */}
      <div className="flex-1 max-w-[1750px] w-full mx-auto p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ======================================================== */}
        {/* ZONA A: FILTROS JERÁRQUICOS (DESKTOP: STICKY SIDEBAR)    */}
        {/* ======================================================== */}
        <aside className={`hidden lg:flex lg:col-span-4 xl:col-span-3.5 flex-col rounded-2xl p-4 sm:p-5 border transition-colors duration-200 sticky top-20 shadow-sm ${
          isLight ? 'bg-white border-slate-200/90' : 'bg-[#151922]/90 border-slate-800/80 backdrop-blur-xl'
        }`}>
          {renderPanelFiltrosA()}
        </aside>

        {/* ======================================================== */}
        {/* ZONA B: PESTAÑAS DE TRABAJO (ESTADO | HISTORIA | FOTOS...) */}
        {/* ======================================================== */}
        <main className="lg:col-span-8 xl:col-span-8.5 flex flex-col gap-3.5 w-full min-w-0">
          
          {/* BARRA DE PESTAÑAS */}
          <div className={`rounded-2xl p-1.5 border shadow-sm flex items-center justify-between flex-wrap gap-2 transition-colors duration-200 ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#151922] border-slate-800'
          }`}>
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
              <div className={`px-2 font-bold text-xs flex items-center gap-1.5 mr-1 shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                  isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'
                }`}>
                  B
                </div>
                <span className="hidden sm:inline">PESTAÑAS:</span>
              </div>

              {/* 1. Estado */}
              <button
                onClick={() => handleSelectTab('ESTADO')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border shrink-0 ${
                  activeTab === 'ESTADO'
                    ? isLight ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-sm' : 'bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-sm'
                    : isLight ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />
                Estado
              </button>

              {/* 2. Historia */}
              <button
                onClick={() => handleSelectTab('HISTORIA')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border shrink-0 ${
                  activeTab === 'HISTORIA'
                    ? isLight ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-sm' : 'bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-sm'
                    : isLight ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />
                Historia
              </button>

              {/* 3. Fotos */}
              <button
                onClick={() => handleSelectTab('FOTOS')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border shrink-0 ${
                  activeTab === 'FOTOS'
                    ? isLight ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-sm' : 'bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-sm'
                    : isLight ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />
                Fotos
              </button>

              {/* 4. Análisis IA */}
              <button
                onClick={() => handleSelectTab('ANALISIS_IA')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border shrink-0 ${
                  activeTab === 'ANALISIS_IA'
                    ? isLight ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-sm' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200 shadow-sm'
                    : isLight ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                Análisis IA
              </button>

              {/* 5. Reporte */}
              <button
                onClick={() => handleSelectTab('REPORTE')}
                className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-1.5 border shrink-0 ${
                  activeTab === 'REPORTE'
                    ? isLight ? 'bg-sky-50 border-sky-300 text-sky-800 shadow-sm' : 'bg-sky-500/20 border-sky-500/40 text-sky-200 shadow-sm'
                    : isLight ? 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500" />
                Reporte
              </button>
            </div>

            {equipoActual && (
              <div className={`hidden xl:flex items-center gap-2 pr-2 text-xs font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                Tag: <strong className={isLight ? 'text-sky-700' : 'text-sky-300'}>{equipoActual.codigo || equipoActual.nombre}</strong>
              </div>
            )}
          </div>

          {/* SUPERFICIE DE CONTENIDO DE LA PESTAÑA */}
          <div className={`rounded-2xl p-3 sm:p-5 border shadow-sm min-h-[560px] transition-colors duration-200 ${
            isLight ? 'bg-white border-slate-200/90' : 'bg-[#151922]/90 border-slate-800/80 backdrop-blur-xl'
          }`}>
            
            {/* PESTAÑA 1: ESTADO (Persistente en memoria para no recargar fotos ni perder texto) */}
            <div style={{ display: activeTab === 'ESTADO' ? 'block' : 'none' }}>
              {equipoId ? (
                <div>
                  <div className={`mb-3 pb-2.5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                    <div>
                      <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        Evaluación de Estado y Parámetros Operativos
                      </h2>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        Activo ID #{equipoId} · {equipoActual?.nombre}
                      </p>
                    </div>
                  </div>
                  <ManualPanel
                    equipoId={equipoId}
                    onChangeTab={(t) => {
                      if (t === 'FACTORY') handleSelectTab('ANALISIS_IA');
                      else if (t === 'HISTORY') handleSelectTab('HISTORIA');
                      else handleSelectTab(t);
                    }}
                  />
                </div>
              ) : (
                <GlobalDashboard
                  empresaId={empresaId}
                  onSelectEquipo={handleSelectEquipo}
                  onSelectUbicacion={setUbicacionId}
                  onChangeTab={(t) => {
                    if (t === 'FACTORY') handleSelectTab('ANALISIS_IA');
                    else if (t === 'HISTORY') handleSelectTab('HISTORIA');
                    else handleSelectTab(t);
                  }}
                  onOpenHelp={() => setShowHelp(true)}
                />
              )}
            </div>

            {/* PESTAÑA 2: HISTORIA (Persistente) */}
            <div style={{ display: activeTab === 'HISTORIA' ? 'block' : 'none' }}>
              <div>
                <div className={`mb-3 pb-2.5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div>
                    <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Historial de Intervenciones y Activos
                    </h2>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Trazabilidad de inspecciones realizadas en {empresaActual?.nombre || 'la empresa'}
                    </p>
                  </div>
                </div>
                <AssetHistory empresaId={empresaId} selectedEquipoId={equipoId} />
              </div>
            </div>

            {/* PESTAÑA 3 & 4: FOTOS Y ANÁLISIS IA (Persistente, instancia única) */}
            <div style={{ display: (activeTab === 'FOTOS' || activeTab === 'ANALISIS_IA') ? 'block' : 'none' }}>
              <div>
                <div className={`mb-3 pb-2.5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div>
                    <h2 className={`text-base font-black flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {activeTab === 'ANALISIS_IA' ? (
                        <>
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          Diagnóstico Multimodal Asistido por IA
                        </>
                      ) : (
                        'Evidencia Fotográfica y Registros de Drive'
                      )}
                    </h2>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      {equipoActual ? `Activo ID #${equipoId} · ${equipoActual.nombre} (Carpeta Drive: ${equipoActual.drive_folder_nombre || 'Asignada'})` : 'Selecciona un equipo'}
                    </p>
                  </div>
                </div>

                {equipoId ? (
                  <InspectionPanel
                    equipoId={equipoId}
                    onChangeTab={(t) => {
                      if (t === 'MANUAL') handleSelectTab('ESTADO');
                      else if (t === 'HISTORY') handleSelectTab('HISTORIA');
                      else handleSelectTab(t);
                    }}
                  />
                ) : (
                  <div className={`p-12 text-center ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Camera className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <h3 className={`font-bold text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>Selecciona un Activo</h3>
                    <p className="text-xs mt-1">Elige un equipo en el panel lateral para explorar sus fotos o análisis IA.</p>
                  </div>
                )}
              </div>
            </div>

            {/* PESTAÑA 5: REPORTE */}
            {activeTab === 'REPORTE' && (
              <div>
                <div className={`mb-3 pb-2.5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <div>
                    <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Generación y Consulta de Reportes PGP
                    </h2>
                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Informes técnicos descargables para {empresaActual?.nombre}
                    </p>
                  </div>
                </div>
                <ReportsPanel />
              </div>
            )}

            {/* VISTAS AUXILIARES */}
            {activeTab === 'SETTINGS' && (
              <div>
                <div className={`mb-3 pb-2.5 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Configuración del Sistema</h2>
                </div>
                <SettingsPanel />
              </div>
            )}

            {activeTab === 'AUDIT' && (
              <div>
                <div className={`mb-3 pb-2.5 border-b ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                  <h2 className={`text-base font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>Registro de Auditoría</h2>
                </div>
                <AuditPanel />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* KPIS INFERIOR (DISPOSICIÓN BOCETO) */}
      {posicionKpis === 'BOTTOM' && (
        <section className={`border-t py-3.5 px-3 sm:px-6 mt-auto ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#0f131a] border-slate-800'
        }`}>
          <div className="max-w-[1750px] mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${
                  isLight ? 'bg-sky-100 text-sky-700' : 'bg-sky-500/20 text-sky-400'
                }`}>
                  C
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  KPI de la Empresa: {empresaActual?.nombre || 'Arauco'}
                </span>
              </div>
              <span className={`text-[11px] font-mono ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                * Disposición inferior del boceto
              </span>
            </div>
            {renderBloqueKPIs(false)}
          </div>
        </section>
      )}

      {/* Modal de Ayuda */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  );
}
