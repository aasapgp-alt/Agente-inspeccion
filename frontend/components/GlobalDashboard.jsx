'use client';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthProvider';
import { API_BASE_URL } from '../services/api';
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  TrendingUp,
  CheckCircle2,
  Building2,
  MapPin,
  Search,
  ClipboardList,
  Sparkles,
  Filter,
  X
} from 'lucide-react';

function getEstadoBadge(estadoRaw) {
  const est = (estadoRaw || 'PENDIENTE').toUpperCase();
  if (est.includes('CRIT')) {
    return {
      key: 'CRITICO',
      label: 'Crítico',
      cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    };
  }
  if (est.includes('REGULAR')) {
    return {
      key: 'REGULAR',
      label: 'Observado',
      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    };
  }
  if (est.includes('BUEN')) {
    return {
      key: 'BUENO',
      label: 'Bueno',
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
    };
  }
  if (est.includes('FUERA')) {
    return {
      key: 'FUERA',
      label: 'Fuera de ruta',
      cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30'
    };
  }
  return {
    key: 'PENDIENTE',
    label: 'Pendiente',
    cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30'
  };
}

export default function GlobalDashboard({
  empresaId,
  empresas = [],
  onChangeEmpresa,
  onSelectEquipo,
  onAnalyzeEquipo,
  onSelectUbicacion,
  refreshKey = 0
}) {
  const { token } = useAuth();
  const activeToken = token || (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '');

  const [metrics, setMetrics] = useState({
    critical_alerts: 0,
    under_observation: 0,
    pending_inspections: 0,
    good_condition: 0,
    campaign_progress_pct: 0,
    inspected_equipos: 0,
    total_equipos: 0,
    inspections_today: 0
  });
  const [factories, setFactories] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros de la vista general
  const [selectedAreaId, setSelectedAreaId] = useState('ALL');
  const [selectedCondition, setSelectedCondition] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    if (!activeToken) return;
    setLoading(true);
    const urlParams = empresaId ? `?empresa_id=${empresaId}` : '';
    const headers = { Authorization: `Bearer ${activeToken}` };

    Promise.all([
      fetch(`${API_BASE_URL}/dashboard/stats${urlParams}`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API_BASE_URL}/dashboard/factories${urlParams}`, { headers }).then((r) => (r.ok ? r.json() : [])),
      fetch(`${API_BASE_URL}/dashboard/history${urlParams}`, { headers }).then((r) => (r.ok ? r.json() : []))
    ])
      .then(([statsData, factoriesData, historyData]) => {
        if (statsData) setMetrics(statsData);
        if (Array.isArray(factoriesData)) setFactories(factoriesData);
        if (Array.isArray(historyData)) setEquipments(historyData);
      })
      .catch((err) => console.error('Error cargando vista general:', err))
      .finally(() => setLoading(false));
  }, [empresaId, activeToken, refreshKey]);

  // Resetear área seleccionada al cambiar empresa
  useEffect(() => {
    setSelectedAreaId('ALL');
  }, [empresaId]);

  const filteredEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      if (selectedAreaId !== 'ALL' && String(eq.ubicacion_id) !== String(selectedAreaId)) {
        return false;
      }
      if (selectedCondition !== 'ALL') {
        const key = getEstadoBadge(eq.estado_actual).key;
        if (key !== selectedCondition) return false;
      }
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchTag = (eq.tag_codigo || '').toLowerCase().includes(q);
        const matchDesc = (eq.descripcion || '').toLowerCase().includes(q);
        const matchArea = (eq.area_nombre || '').toLowerCase().includes(q);
        const matchMat = (eq.material || '').toLowerCase().includes(q);
        if (!matchTag && !matchDesc && !matchArea && !matchMat) return false;
      }
      return true;
    });
  }, [equipments, selectedAreaId, selectedCondition, searchText]);

  const kpiCards = [
    {
      id: 'CRITICO',
      title: 'Alertas Críticas',
      value: metrics.critical_alerts || 0,
      sub: 'Reparación urgente',
      icon: AlertOctagon,
      accent: 'border-rose-500/30 hover:border-rose-500/60',
      iconCls: 'text-rose-400 bg-rose-500/15',
      valueCls: 'text-rose-400',
      clickable: true
    },
    {
      id: 'REGULAR',
      title: 'Bajo Observación',
      value: metrics.under_observation || 0,
      sub: 'Mantenimiento programado',
      icon: AlertTriangle,
      accent: 'border-amber-500/30 hover:border-amber-500/60',
      iconCls: 'text-amber-400 bg-amber-500/15',
      valueCls: 'text-amber-400',
      clickable: true
    },
    {
      id: 'PENDIENTE',
      title: 'Pendientes',
      value: metrics.pending_inspections || 0,
      sub: 'Sin inspección en campaña',
      icon: Clock,
      accent: 'border-violet-500/30 hover:border-violet-500/60',
      iconCls: 'text-violet-400 bg-violet-500/15',
      valueCls: 'text-violet-400',
      clickable: true
    },
    {
      id: 'BUENO',
      title: 'Aptos para Operar',
      value: metrics.good_condition || 0,
      sub: 'Condición óptima',
      icon: CheckCircle2,
      accent: 'border-emerald-500/30 hover:border-emerald-500/60',
      iconCls: 'text-emerald-400 bg-emerald-500/15',
      valueCls: 'text-emerald-400',
      clickable: true
    },
    {
      id: 'AVANCE',
      title: 'Avance Campaña',
      value: `${metrics.campaign_progress_pct || 0}%`,
      sub: `${metrics.inspected_equipos || 0} de ${metrics.total_equipos || 0} activos`,
      icon: TrendingUp,
      accent: 'border-sky-500/30',
      iconCls: 'text-sky-400 bg-sky-500/15',
      valueCls: 'text-sky-400',
      clickable: false
    }
  ];

  const handleSelectArea = (areaId) => {
    const next = String(selectedAreaId) === String(areaId) ? 'ALL' : String(areaId);
    setSelectedAreaId(next);
    if (onSelectUbicacion) onSelectUbicacion(next === 'ALL' ? '' : next);
  };

  return (
    <div className="space-y-5">
      {/* Barra de Contexto de Planta */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-700/40 bg-slate-900/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Planta / Empresa:</span>
          </div>
          {empresas.length > 0 ? (
            <select
              value={empresaId || ''}
              onChange={(e) => onChangeEmpresa && onChangeEmpresa(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs font-bold min-w-[180px]"
            >
              {empresas.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-bold">Planta #{empresaId}</span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>
            Total activos: <strong className="text-sky-400">{metrics.total_equipos || equipments.length}</strong>
          </span>
          <span>·</span>
          <span>
            Inspecciones hoy: <strong className="text-emerald-400">{metrics.inspections_today || 0}</strong>
          </span>
        </div>
      </div>

      {/* KPIs Ejecutivos (Clicables para filtrar la tabla) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedCondition === card.id;
          return (
            <button
              key={card.id}
              type="button"
              disabled={!card.clickable}
              onClick={() => {
                if (!card.clickable) return;
                setSelectedCondition((prev) => (prev === card.id ? 'ALL' : card.id));
              }}
              className={`text-left p-3.5 rounded-2xl border transition-all ${card.accent} ${
                isSelected ? 'ring-2 ring-sky-500 bg-sky-500/10' : 'bg-slate-900/25'
              } ${card.clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg ${card.iconCls}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className={`text-2xl font-black tracking-tight ${card.valueCls}`}>{card.value}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 truncate">{card.sub}</div>
            </button>
          );
        })}
      </div>

      {/* Distribución por Área / Ubicación */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-sky-500" />
            Estado por Área ({factories.length})
          </h2>
          {selectedAreaId !== 'ALL' && (
            <button
              onClick={() => handleSelectArea('ALL')}
              className="text-xs font-semibold text-sky-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Ver todas las áreas
            </button>
          )}
        </div>

        {factories.length === 0 && !loading ? (
          <div className="p-6 rounded-2xl border border-slate-700/40 text-center text-xs text-slate-400">
            No hay áreas con equipos activos registradas para esta planta.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {factories.map((area) => {
              const isSelected = String(selectedAreaId) === String(area.id);
              const total = area.total || equipments.filter((e) => e.ubicacion_id === area.id).length;
              return (
                <button
                  key={area.id}
                  onClick={() => handleSelectArea(area.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-slate-700/40 bg-slate-900/20 hover:border-slate-500/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold truncate">{area.name}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800/60 text-slate-300 shrink-0">
                      {total} eq.
                    </span>
                  </div>

                  {/* Barra proporcional */}
                  <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-800/60 mb-2">
                    {area.good > 0 && (
                      <div style={{ width: `${area.good}%` }} className="bg-emerald-500" title={`Bueno: ${area.good}%`} />
                    )}
                    {area.alert > 0 && (
                      <div style={{ width: `${area.alert}%` }} className="bg-amber-500" title={`Observado: ${area.alert}%`} />
                    )}
                    {area.broken > 0 && (
                      <div style={{ width: `${area.broken}%` }} className="bg-rose-500" title={`Crítico: ${area.broken}%`} />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="text-emerald-400 font-semibold">{area.good}% Bueno</span>
                    <span className="text-amber-400 font-semibold">{area.alert}% Obs.</span>
                    <span className="text-rose-400 font-semibold">{area.broken}% Crít.</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabla de Equipos de la Planta / Área */}
      <div className="rounded-2xl border border-slate-700/40 bg-slate-900/20 overflow-hidden">
        {/* Barra de Filtros de Tabla */}
        <div className="p-3.5 border-b border-slate-700/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-extrabold">
              Equipos ({filteredEquipments.length})
            </h3>
            {(selectedAreaId !== 'ALL' || selectedCondition !== 'ALL' || searchText) && (
              <button
                onClick={() => {
                  setSelectedAreaId('ALL');
                  setSelectedCondition('ALL');
                  setSearchText('');
                }}
                className="text-[11px] text-sky-400 hover:underline ml-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Buscar TAG, nombre, material..."
                className="pl-8 pr-3 py-1.5 rounded-xl border text-xs w-56 sm:w-64"
              />
            </div>

            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
            >
              <option value="ALL">Todos los estados</option>
              <option value="CRITICO">Crítico</option>
              <option value="REGULAR">Bajo Observación</option>
              <option value="BUENO">Bueno</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50 text-[11px] uppercase text-slate-400">
              <tr>
                <th className="py-2.5 px-3.5">TAG</th>
                <th className="py-2.5 px-3.5">Equipo</th>
                <th className="py-2.5 px-3.5">Área</th>
                <th className="py-2.5 px-3.5">Material</th>
                <th className="py-2.5 px-3.5">Estado</th>
                <th className="py-2.5 px-3.5">Últ. Inspección</th>
                <th className="py-2.5 px-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    Cargando equipos de la planta...
                  </td>
                </tr>
              ) : filteredEquipments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    No se encontraron equipos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredEquipments.map((eq) => {
                  const badge = getEstadoBadge(eq.estado_actual);
                  return (
                    <tr key={eq.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-sky-400 whitespace-nowrap">
                        {eq.tag_codigo || `#${eq.id}`}
                      </td>
                      <td className="py-2.5 px-3.5 font-semibold max-w-[260px] truncate" title={eq.descripcion}>
                        {eq.descripcion}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap">
                        {eq.area_nombre || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap">
                        {eq.material || '-'}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-400 whitespace-nowrap">
                        {eq.ultima_inspeccion_anio ? (
                          <span className="font-mono font-semibold text-slate-300">
                            {eq.ultima_inspeccion_anio}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Sin registro</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onSelectEquipo && onSelectEquipo(eq.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-600/50 hover:border-sky-500 text-[11px] font-bold transition-colors"
                            title="Ver Ficha de Última Inspección"
                          >
                            <ClipboardList className="w-3 h-3 text-sky-400" />
                            Ficha
                          </button>
                          <button
                            onClick={() => onAnalyzeEquipo && onAnalyzeEquipo(eq.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-colors"
                            title="Ir a Análisis y Revisión con Gemini IA"
                          >
                            <Sparkles className="w-3 h-3" />
                            Analizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
