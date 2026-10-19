'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
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
  Clock,
  Download,
  Share2,
  Search,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Sliders,
  Layers,
  ArrowUpRight,
  RefreshCw,
  Eye,
  Maximize2,
  Check,
  Flame,
  Volume2,
  Mic,
  PlusCircle,
  FileCheck
} from 'lucide-react';

// Datos de demostración estructurados
const EMPRESAS_DEMO = [
  {
    id: 'emp-1',
    nombre: 'Minera Centinela · PGP',
    industria: 'Minería de Cobre',
    totalEquipos: 38,
    cumplimiento: 92,
    criticos: 3,
    observados: 6,
    alDia: 29,
    areas: [
      {
        id: 'area-1',
        nombre: 'Área Chancado Primario',
        codigo: 'CHP-01',
        equipos: [
          {
            id: 'eq-101',
            tag: 'CH-01',
            nombre: 'Chancador Giratorio 60x89',
            criticidad: 'ALTA',
            estado: 'CRITICO',
            saludScore: 58,
            ubicacion: 'Nivel +2400 · Nave Principal',
            fabricante: 'Metso Outotec',
            modelo: 'Superior MK-III',
            horasOperacion: 14250,
            ultimaInspeccion: '14/10/2026',
            inspector: 'Carlos M. Vera',
            resumenCondicion: 'Alta vibración armónica en muñón superior y temperatura fuera de rango en circuito hidráulico.',
            subsistemas: [
              { nombre: 'Cóncavas y Manto', estado: 'REGULAR', detalle: 'Desgaste 68%, estimado 3 semanas restantes' },
              { nombre: 'Cojinete Inferior (Spider Bushing)', estado: 'CRITICO', detalle: 'Juego radial excesivo 4.2mm' },
              { nombre: 'Circuito Lubricación', estado: 'CRITICO', detalle: 'Presión 1.8 bar (normal 3.5 bar), fuga en flexible' },
              { nombre: 'Motor Eléctrico 600kW', estado: 'BUENO', detalle: 'Temperatura 62°C, aislación óptima' },
            ],
            historial: [
              { fecha: '14/10/2026', tipo: 'Inspección Rutinaria', inspector: 'Carlos Vera', hallazgo: 'Alerta roja por caída de presión de aceite', estado: 'CRITICO' },
              { fecha: '28/09/2026', tipo: 'Mantenimiento Predictivo', inspector: 'Roberto Díaz', hallazgo: 'Vibraciones RMS 5.8 mm/s en descanso', estado: 'REGULAR' },
              { fecha: '15/09/2026', tipo: 'Reemplazo de sellos', inspector: 'Cuadrilla Mecánica A', hallazgo: 'Cambio de O-rings y flushing de aceite', estado: 'BUENO' },
              { fecha: '02/08/2026', tipo: 'Inspección Mayor', inspector: 'Superintendencia Mantenimiento', hallazgo: 'Certificación estructural sin novedades', estado: 'BUENO' },
            ],
            fotos: [
              { id: 'f-1', titulo: 'Fuga en flexible retorno aceite', fecha: '14/10/2026', tag: 'Lubricación', criticidad: 'CRITICO', src: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80' },
              { id: 'f-2', titulo: 'Desgaste manto zona de carga', fecha: '14/10/2026', tag: 'Cóncavas', criticidad: 'REGULAR', src: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80' },
              { id: 'f-3', titulo: 'Vista general boca de alimentación', fecha: '14/10/2026', tag: 'Estructura', criticidad: 'BUENO', src: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80' },
            ],
            analisisIA: {
              diagnostico: 'Disfunción hidráulica severa asociada a fallo progresivo en bomba o válvula de alivio del circuito primario de lubricación. Coeficiente de riesgo de detención no programada: 84% en las próximas 48 horas de operación continua.',
              severidadRecomendada: 'CRITICO',
              acciones: [
                { prioridad: 'INMEDIATA (0-12h)', accion: 'Detener y aislar circuito de lubricación para inspección de manguera flexible y manómetro diferencial.' },
                { prioridad: '24-48 HORAS', accion: 'Toma de muestra de aceite para análisis ferrográfico y detección de partículas de bronce del spider bushing.' },
                { prioridad: 'PROGRAMADA', accion: 'Calibración de sensor de presión PT-104 y revisión de torque en pernos de anclaje.' },
              ],
              audioTranscrito: '"Inspector Carlos Vera: Se evidencia goteo constante de ISO VG 320 en la unión del flexible de entrada al spider. La temperatura del cojinete subió a 78 grados en menos de una hora. Sugiero intervención urgente."',
            }
          },
          {
            id: 'eq-102',
            tag: 'FE-01',
            nombre: 'Alimentador de Placas (Apron Feeder)',
            criticidad: 'MEDIA',
            estado: 'REGULAR',
            saludScore: 78,
            ubicacion: 'Nivel +2390 · Tolva de Descarga',
            fabricante: 'FLSmidth',
            modelo: 'AF-1800',
            horasOperacion: 9800,
            ultimaInspeccion: '12/10/2026',
            inspector: 'Roberto Díaz',
            resumenCondicion: 'Cadena con elongación moderada pero dentro de tolerancia. Rodillos inferiores requieren lubricación.',
            subsistemas: [
              { nombre: 'Placas de desgaste', estado: 'BUENO', detalle: 'Espesor remanente 85%' },
              { nombre: 'Cadena de tracción', estado: 'REGULAR', detalle: 'Tensión baja lado izquierdo' },
              { nombre: 'Motorreductor Sew', estado: 'BUENO', detalle: 'Sin ruidos extraños, nivel aceite OK' },
            ],
            historial: [
              { fecha: '12/10/2026', tipo: 'Inspección Rutinaria', inspector: 'Roberto Díaz', hallazgo: 'Tensión floja en cadena', estado: 'REGULAR' },
            ],
            fotos: [
              { id: 'f-4', titulo: 'Detalle placas de desgaste', fecha: '12/10/2026', tag: 'Placas', criticidad: 'BUENO', src: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80' },
            ],
            analisisIA: {
              diagnostico: 'Operación estable con necesidad de mantenimiento preventivo menor. Vida útil proyectada de placas: 6 meses.',
              severidadRecomendada: 'REGULAR',
              acciones: [
                { prioridad: '7 DÍAS', accion: 'Tensado de cadena mediante cilindros hidráulicos tensores.' },
                { prioridad: '15 DÍAS', accion: 'Engrase de chumaceras de eje motriz.' }
              ],
              audioTranscrito: '"Roberto Díaz: Alimentador operando normal, cadena levemente destensada pero no golpea."',
            }
          },
          {
            id: 'eq-103',
            tag: 'CV-01',
            nombre: 'Correa Transportadora Over-land 01',
            criticidad: 'ALTA',
            estado: 'BUENO',
            saludScore: 94,
            ubicacion: 'Túnel de Transporte Km 0.8',
            fabricante: 'Continental',
            modelo: 'Steelcord ST-3500',
            horasOperacion: 22100,
            ultimaInspeccion: '10/10/2026',
            inspector: 'Carlos M. Vera',
            resumenCondicion: 'Cinta en óptimo alineamiento, raspadores primarios y secundarios renovados recientemente.',
            subsistemas: [
              { nombre: 'Cinta transportadora', estado: 'BUENO', detalle: 'Sin cortes longitudinales ni desgarros' },
              { nombre: 'Polines de carga', estado: 'BUENO', detalle: 'Giro suave y silencioso' },
              { nombre: 'Sistema de frenado', estado: 'BUENO', detalle: 'Pastillas al 80%' },
            ],
            historial: [
              { fecha: '10/10/2026', tipo: 'Inspección Predictiva', inspector: 'Carlos Vera', hallazgo: 'Todo conforme', estado: 'BUENO' },
            ],
            fotos: [
              { id: 'f-5', titulo: 'Tramo de retorno y raspadores', fecha: '10/10/2026', tag: 'Cinta', criticidad: 'BUENO', src: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80' },
            ],
            analisisIA: {
              diagnostico: 'Excelente condición electromecánica. Cumplimiento de estándar de seguridad clase A.',
              severidadRecomendada: 'BUENO',
              acciones: [
                { prioridad: 'RUTINARIA', accion: 'Mantener frecuencia mensual de inspección termográfica.' }
              ],
              audioTranscrito: '"Inspección rápida túnel CV-01, equipo impecable tras la última parada."',
            }
          }
        ]
      },
      {
        id: 'area-2',
        nombre: 'Área Molienda SAG y Bolas',
        codigo: 'MOL-02',
        equipos: [
          {
            id: 'eq-201',
            tag: 'SAG-01',
            nombre: 'Molino SAG 40ft x 25ft',
            criticidad: 'ALTA',
            estado: 'REGULAR',
            saludScore: 71,
            ubicacion: 'Edificio de Molienda · Nivel 0',
            fabricante: 'Metso Minerals',
            modelo: 'Dual Pinion 28MW',
            horasOperacion: 31000,
            ultimaInspeccion: '13/10/2026',
            inspector: 'Lorena Silva',
            resumenCondicion: 'Vibración en chumacera lado descarga con tendencia al alza. Corona y piñones con lubricación adecuada.',
            subsistemas: [
              { nombre: 'Revestimientos internos', estado: 'REGULAR', detalle: 'Espesor lifters 42%' },
              { nombre: 'Chumacera de descanso', estado: 'REGULAR', detalle: 'Temperatura 68°C (alarma en 75°C)' },
              { nombre: 'Sistema Girth Gear', estado: 'BUENO', detalle: 'Patrón de contacto 82%' },
            ],
            historial: [
              { fecha: '13/10/2026', tipo: 'Inspección Semanal', inspector: 'Lorena Silva', hallazgo: 'Chumacera con leve aumento térmico', estado: 'REGULAR' },
            ],
            fotos: [
              { id: 'f-6', titulo: 'Inspección boroscópica trunnion', fecha: '13/10/2026', tag: 'Trunnion', criticidad: 'REGULAR', src: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80' },
            ],
            analisisIA: {
              diagnostico: 'Monitorear incremento térmico en chumacera lado descarga. No amerita detención inmediata pero sí control de temperatura cada 4 horas.',
              severidadRecomendada: 'REGULAR',
              acciones: [
                { prioridad: '24 HORAS', accion: 'Verificar caudal de retorno de aceite de lubricación hidrostática.' },
                { prioridad: 'PRÓXIMA PARADA', accion: 'Revisión y torqueo de pernos de lifter liners.' }
              ],
              audioTranscrito: '"Lorena Silva: Chumacera del SAG operando a 68 grados, aumentamos monitoreo preventivo."',
            }
          }
        ]
      }
    ]
  },
  {
    id: 'emp-2',
    nombre: 'Planta Química del Norte · AASA',
    industria: 'Química Industrial',
    totalEquipos: 24,
    cumplimiento: 88,
    criticos: 1,
    observados: 4,
    alDia: 19,
    areas: [
      {
        id: 'area-3',
        nombre: 'Área Reactores y Síntesis',
        codigo: 'REA-01',
        equipos: [
          {
            id: 'eq-301',
            tag: 'RX-10',
            nombre: 'Reactor Continuo Agitado 50m³',
            criticidad: 'ALTA',
            estado: 'BUENO',
            saludScore: 91,
            ubicacion: 'Nave de Síntesis · Torre B',
            fabricante: 'Pfaudler',
            modelo: 'Glass-Lined 50',
            horasOperacion: 8400,
            ultimaInspeccion: '11/10/2026',
            inspector: 'Hugo Alarcón',
            resumenCondicion: 'Sello mecánico presurizado estanco, sin rastro de vapores corrosivos ni vibración en agitador.',
            subsistemas: [
              { nombre: 'Sello mecánico doble', estado: 'BUENO', detalle: 'Presión de barrera 4.2 bar estable' },
              { nombre: 'Camisa de enfriamiento', estado: 'BUENO', detalle: 'Delta T normal 12°C' },
            ],
            historial: [
              { fecha: '11/10/2026', tipo: 'Inspección de Seguridad', inspector: 'Hugo Alarcón', hallazgo: 'Sello y agitador conformes', estado: 'BUENO' },
            ],
            fotos: [
              { id: 'f-7', titulo: 'Cabezal agitador y sello', fecha: '11/10/2026', tag: 'Sello', criticidad: 'BUENO', src: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80' },
            ],
            analisisIA: {
              diagnostico: 'Operación en condiciones óptimas. Parámetros de proceso y mecánicos en rango nominal.',
              severidadRecomendada: 'BUENO',
              acciones: [
                { prioridad: 'MENSUAL', accion: 'Inspección de chispómetro en recubrimiento vitrificado.' }
              ],
              audioTranscrito: '"Reactor RX-10 verificado, sin fugas ni anomalías en sellos."',
            }
          }
        ]
      }
    ]
  }
];

export default function InspectorLayoutDemo() {
  // Estado de navegación jerárquica (Zona A)
  const [empresaId, setEmpresaId] = useState('emp-1');
  const [areaId, setAreaId] = useState('area-1');
  const [equipoId, setEquipoId] = useState('eq-101');
  const [busquedaEquipo, setBusquedaEquipo] = useState('');

  // Estado de pestaña activa (Zona B)
  // 'ESTADO' | 'HISTORIA' | 'FOTOS' | 'ANALISIS_IA' | 'REPORTE'
  const [activeTab, setActiveTab] = useState('ESTADO');

  // Control de posición de KPIs: 'TOP' (encabezado) vs 'BOTTOM' (como en el boceto)
  const [posicionKpis, setPosicionKpis] = useState('TOP');

  // Estado interactivo de simulación IA
  const [iaRunning, setIaRunning] = useState(false);
  const [iaSuccess, setIaSuccess] = useState(false);

  // Selector activo actual
  const empresaActual = useMemo(() => {
    return EMPRESAS_DEMO.find(e => e.id === empresaId) || EMPRESAS_DEMO[0];
  }, [empresaId]);

  const areasDisponibles = empresaActual.areas;

  const areaActual = useMemo(() => {
    return areasDisponibles.find(a => a.id === areaId) || areasDisponibles[0];
  }, [areasDisponibles, areaId]);

  const equiposDisponibles = areaActual.equipos;

  const equiposFiltrados = useMemo(() => {
    if (!busquedaEquipo.trim()) return equiposDisponibles;
    const q = busquedaEquipo.toLowerCase();
    return equiposDisponibles.filter(
      eq => eq.tag.toLowerCase().includes(q) || eq.nombre.toLowerCase().includes(q)
    );
  }, [equiposDisponibles, busquedaEquipo]);

  const equipoActual = useMemo(() => {
    return equiposDisponibles.find(e => e.id === equipoId) || equiposDisponibles[0] || null;
  }, [equiposDisponibles, equipoId]);

  const handleCambioEmpresa = (newEmpId) => {
    setEmpresaId(newEmpId);
    const emp = EMPRESAS_DEMO.find(e => e.id === newEmpId);
    if (emp && emp.areas.length > 0) {
      setAreaId(emp.areas[0].id);
      if (emp.areas[0].equipos.length > 0) {
        setEquipoId(emp.areas[0].equipos[0].id);
      }
    }
  };

  const handleCambioArea = (newAreaId) => {
    setAreaId(newAreaId);
    const ar = areasDisponibles.find(a => a.id === newAreaId);
    if (ar && ar.equipos.length > 0) {
      setEquipoId(ar.equipos[0].id);
    }
  };

  const handleSimularIA = () => {
    setIaRunning(true);
    setIaSuccess(false);
    setTimeout(() => {
      setIaRunning(false);
      setIaSuccess(true);
      setTimeout(() => setIaSuccess(false), 4000);
    }, 1500);
  };

  // Helper de badges de criticidad/estado
  const renderBadgeEstado = (estado) => {
    switch (estado) {
      case 'CRITICO':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3" /> Crítico
          </span>
        );
      case 'REGULAR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Observado
          </span>
        );
      case 'BUENO':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Operativo
          </span>
        );
    }
  };

  // Renderizador del bloque de KPIs (reutilizable en TOP o BOTTOM)
  const renderBloqueKPIs = (compact = false) => (
    <div className={`grid grid-cols-2 sm:grid-cols-4 gap-3 ${compact ? 'py-1' : 'p-4 bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md'}`}>
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Total Activos</div>
          <div className="text-xl font-bold text-white flex items-baseline gap-1.5">
            {empresaActual.totalEquipos}
            <span className="text-xs font-normal text-slate-400">equipos</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-rose-400 font-semibold">Críticos / Alerta</div>
          <div className="text-xl font-bold text-rose-300 flex items-baseline gap-1.5">
            {empresaActual.criticos}
            <span className="text-xs font-normal text-rose-400/80">requieren acción</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-amber-300 font-semibold">Observados</div>
          <div className="text-xl font-bold text-amber-200 flex items-baseline gap-1.5">
            {empresaActual.observados}
            <span className="text-xs font-normal text-amber-400/80">en seguimiento</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">Cumplimiento PGP</div>
          <div className="text-xl font-bold text-emerald-300 flex items-baseline gap-1.5">
            {empresaActual.cumplimiento}%
            <span className="text-xs font-normal text-emerald-400/80">al día</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* 1. BARRA SUPERIOR DE APLICACIÓN */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 px-4 sm:px-6 py-3">
        <div className="max-w-[1700px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Logo y contexto */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-black text-white shadow-lg shadow-sky-500/20 text-lg">
              AI
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-white tracking-tight">Agente Inspector</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Boceto Interactivo
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Disposición modular: Selección jerárquica lateral + Ficha técnica en pestañas
              </p>
            </div>
          </div>

          {/* Selector interactivo de posición de KPIs (Permite comparar en vivo la propuesta vs boceto) */}
          <div className="flex items-center gap-2 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400 px-2 font-medium flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-sky-400" /> Posición KPIs:
            </span>
            <button
              onClick={() => setPosicionKpis('TOP')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                posicionKpis === 'TOP'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Superior (Optimizado)
            </button>
            <button
              onClick={() => setPosicionKpis('BOTTOM')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                posicionKpis === 'BOTTOM'
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Inferior (Boceto papel)
            </button>
          </div>

          {/* Enlaces de regreso / perfil */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-all flex items-center gap-1.5"
            >
              Volver a App Principal
            </Link>
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                CV
              </div>
              <span>Carlos Vera (Inspector)</span>
            </div>
          </div>
        </div>

        {/* SI LOS KPIS ESTÁN EN TOP: Se muestran aquí inmediatamente */}
        {posicionKpis === 'TOP' && (
          <div className="max-w-[1700px] mx-auto mt-3 pt-3 border-t border-slate-800/60">
            {renderBloqueKPIs(true)}
          </div>
        )}
      </header>

      {/* 2. CUERPO PRINCIPAL: PANEL A (IZQUIERDA) + PANEL B (DERECHA) */}
      <div className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ======================================================== */}
        {/* ZONA A: SELECTORES JERÁRQUICOS (EMPRESA -> AREA -> EQUIPO) */}
        {/* ======================================================== */}
        <aside className="lg:col-span-4 xl:col-span-3.5 flex flex-col gap-5 bg-slate-900/60 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl sticky top-24">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-sm tracking-wide">
              <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xs font-black">
                A
              </div>
              <span>FILTROS Y JERARQUÍA</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Drill-down</span>
          </div>

          {/* 1. Selector de Empresa */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-sky-400" />
              1. Empresa
            </label>
            <div className="relative">
              <select
                value={empresaId}
                onChange={(e) => handleCambioEmpresa(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer shadow-inner appearance-none pr-9"
              >
                {EMPRESAS_DEMO.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} ({emp.totalEquipos} activos)
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Industria: {empresaActual.industria}</span>
              <span className="text-emerald-400 font-medium">{empresaActual.cumplimiento}% inspeccionado</span>
            </div>
          </div>

          {/* 2. Selector de Área */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
              2. Área / Ubicación
            </label>
            <div className="relative">
              <select
                value={areaId}
                onChange={(e) => handleCambioArea(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all cursor-pointer shadow-inner appearance-none pr-9"
              >
                {areasDisponibles.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.nombre} [{area.codigo}]
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {equiposDisponibles.length} equipos registrados en esta ubicación
            </div>
          </div>

          {/* 3. Selector de Equipo con buscador rápido */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-sky-400" />
                3. Equipo / Activo
              </label>
              <span className="text-[11px] text-sky-400 font-semibold">{equiposFiltrados.length} disponibles</span>
            </div>

            {/* Buscador de equipos dentro del área */}
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por tag o nombre..."
                value={busquedaEquipo}
                onChange={(e) => setBusquedaEquipo(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Lista interactiva de equipos (Click para seleccionar) */}
            <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1">
              {equiposFiltrados.map((eq) => {
                const isSelected = eq.id === equipoId;
                return (
                  <button
                    key={eq.id}
                    onClick={() => setEquipoId(eq.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-sky-600/20 border-sky-500 text-white shadow-md shadow-sky-600/10'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs text-sky-300">{eq.tag}</span>
                        <span className="text-xs font-medium truncate text-slate-200">{eq.nombre}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>Score: {eq.saludScore}%</span>
                        <span>•</span>
                        <span>{eq.ultimaInspeccion}</span>
                      </div>
                    </div>
                    <div>
                      {renderBadgeEstado(eq.estado)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FICHA RESUMEN DEL EQUIPO SELECCIONADO */}
          {equipoActual && (
            <div className="mt-2 pt-4 border-t border-slate-800/80 bg-slate-950/40 -mx-1 p-3 rounded-xl border border-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Activo en Foco</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  equipoActual.criticidad === 'ALTA' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-slate-800 text-slate-300'
                }`}>
                  Criticidad {equipoActual.criticidad}
                </span>
              </div>
              <div className="text-sm font-extrabold text-white">{equipoActual.tag} - {equipoActual.nombre}</div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" /> {equipoActual.ubicacion}
              </div>
              <div className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-800/60 text-slate-300">
                <span>Horas: <b className="text-white font-mono">{equipoActual.horasOperacion.toLocaleString()} hrs</b></span>
                <span>Última: <b className="text-white font-mono">{equipoActual.ultimaInspeccion}</b></span>
              </div>

              <button
                onClick={() => setActiveTab('ANALISIS_IA')}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" /> Inspección Rápida con IA
              </button>
            </div>
          )}
        </aside>

        {/* ======================================================== */}
        {/* ZONA B: PESTAÑAS DE TRABAJO Y DETALLE DEL ACTIVO          */}
        {/* ======================================================== */}
        <main className="lg:col-span-8 xl:col-span-8.5 flex flex-col gap-4">
          
          {/* BARRA DE PESTAÑAS (TABS DEL BOCETO) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 shadow-xl backdrop-blur-md flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <div className="px-2 font-bold text-xs text-sky-400 flex items-center gap-1 mr-1">
                <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-[10px] font-black">
                  B
                </div>
                <span>PESTAÑAS:</span>
              </div>

              {/* 1. Estado */}
              <button
                onClick={() => setActiveTab('ESTADO')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'ESTADO'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Activity className="w-4 h-4" />
                Estado
              </button>

              {/* 2. Historia / Historial */}
              <button
                onClick={() => setActiveTab('HISTORIA')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'HISTORIA'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <History className="w-4 h-4" />
                Historia
              </button>

              {/* 3. Fotos */}
              <button
                onClick={() => setActiveTab('FOTOS')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'FOTOS'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Camera className="w-4 h-4" />
                Fotos
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 font-mono">
                  {equipoActual?.fotos.length || 0}
                </span>
              </button>

              {/* 4. Análisis IA */}
              <button
                onClick={() => setActiveTab('ANALISIS_IA')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'ANALISIS_IA'
                    ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sparkles className="w-4 h-4 text-cyan-300" />
                Análisis IA
              </button>

              {/* 5. Reporte */}
              <button
                onClick={() => setActiveTab('REPORTE')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'REPORTE'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" />
                Reporte
              </button>
            </div>

            {/* Acciones directas de la cabecera */}
            <div className="hidden xl:flex items-center gap-2 pr-2">
              <span className="text-xs text-slate-400 font-mono">
                Activo: <strong className="text-sky-300">{equipoActual?.tag}</strong>
              </span>
            </div>
          </div>

          {/* CONTENEDOR DINÁMICO DE LA PESTAÑA ACTIVA */}
          <div className="bg-slate-900/60 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl min-h-[540px]">
            
            {/* ---------------------------------------------------- */}
            {/* PESTAÑA 1: ESTADO                                    */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'ESTADO' && equipoActual && (
              <div className="flex flex-col gap-6">
                {/* Header de la pestaña */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Condición Operativa & Salud del Activo</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Monitoreo continuo de subsistemas mecánicos, eléctricos y fluidos.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-400 font-medium">Índice de Salud (Health Score)</div>
                      <div className="text-2xl font-black text-white font-mono flex items-center gap-1.5 justify-end">
                        <span className={equipoActual.saludScore < 70 ? 'text-rose-400' : 'text-emerald-400'}>
                          {equipoActual.saludScore}%
                        </span>
                      </div>
                    </div>
                    {renderBadgeEstado(equipoActual.estado)}
                  </div>
                </div>

                {/* Resumen de condición */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 mt-0.5">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Resumen Técnico de Campo</h4>
                    <p className="text-sm text-slate-200 mt-1 leading-relaxed">
                      {equipoActual.resumenCondicion}
                    </p>
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-3">
                      <span>Inspector: <strong className="text-slate-300">{equipoActual.inspector}</strong></span>
                      <span>•</span>
                      <span>Fecha evaluación: <strong className="text-slate-300">{equipoActual.ultimaInspeccion}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Checklist detallado de subsistemas */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    Estado por Subsistema Crítico
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {equipoActual.subsistemas.map((sub, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white">{sub.nombre}</span>
                          {renderBadgeEstado(sub.estado)}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                          {sub.detalle}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Parámetros Operativos Rápidos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Horas en Marcha</span>
                    <div className="text-lg font-mono font-bold text-white mt-1">{equipoActual.horasOperacion.toLocaleString()} h</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Fabricante</span>
                    <div className="text-sm font-semibold text-white mt-1 truncate">{equipoActual.fabricante}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Modelo Técnico</span>
                    <div className="text-sm font-semibold text-white mt-1 truncate">{equipoActual.modelo}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Ubicación Física</span>
                    <div className="text-sm font-semibold text-sky-400 mt-1 truncate">{areaActual.nombre}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* PESTAÑA 2: HISTORIA (HISTORIAL)                      */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'HISTORIA' && equipoActual && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Línea de Tiempo & Trazabilidad de Intervenciones</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Historial completo de inspecciones preventivas, correctivas y eventos detectados en {equipoActual.tag}.
                    </p>
                  </div>
                  <button className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Exportar Historial
                  </button>
                </div>

                {/* Timeline visual vertical */}
                <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-800 flex flex-col gap-6 my-2">
                  {equipoActual.historial.map((item, idx) => (
                    <div key={idx} className="relative group">
                      {/* Punto en la línea de tiempo */}
                      <div className={`absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full border-2 border-slate-950 ${
                        item.estado === 'CRITICO' ? 'bg-rose-500 shadow-lg shadow-rose-500/50' :
                        item.estado === 'REGULAR' ? 'bg-amber-500 shadow-lg shadow-amber-500/50' :
                        'bg-emerald-500'
                      }`} />

                      <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 group-hover:border-slate-700 transition-all">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-sky-400">{item.fecha}</span>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold">
                              {item.tipo}
                            </span>
                          </div>
                          {renderBadgeEstado(item.estado)}
                        </div>
                        <p className="text-sm text-slate-200 mt-2 font-medium">
                          {item.hallazgo}
                        </p>
                        <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                          <span>Responsable: <strong className="text-slate-400">{item.inspector}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* PESTAÑA 3: FOTOS                                     */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'FOTOS' && equipoActual && (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Evidencia Fotográfica de Campo</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Registro visual georreferenciado con anotaciones de desgaste y averías para {equipoActual.tag}.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/25 flex items-center gap-1.5 transition-all">
                      <PlusCircle className="w-4 h-4" /> Tomar / Subir Foto
                    </button>
                  </div>
                </div>

                {/* Grid de Fotos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {equipoActual.fotos.map((foto) => (
                    <div
                      key={foto.id}
                      className="group relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-sky-500 transition-all flex flex-col shadow-lg"
                    >
                      <div className="relative aspect-video overflow-hidden bg-slate-900">
                        <img
                          src={foto.src}
                          alt={foto.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/70 backdrop-blur-md text-white border border-white/20">
                            {foto.tag}
                          </span>
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          {renderBadgeEstado(foto.criticidad)}
                        </div>
                      </div>

                      <div className="p-3.5 flex flex-col justify-between flex-1">
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors">
                            {foto.titulo}
                          </h4>
                          <span className="text-[11px] text-slate-400 mt-1 block font-mono">
                            Registrado: {foto.fecha}
                          </span>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                          <button className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Ampliar
                          </button>
                          <span className="text-[10px] text-slate-500">Drive sync ✓</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* PESTAÑA 4: ANÁLISIS IA                               */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'ANALISIS_IA' && equipoActual && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        <Sparkles className="w-4 h-4" />
                      </span>
                      <h2 className="text-xl font-black text-white">
                        Diagnóstico Multimodal Asistido por IA
                      </h2>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Procesamiento de notas de voz, fotos térmicas y telemetría por el Agente Inspector.
                    </p>
                  </div>

                  <button
                    onClick={handleSimularIA}
                    disabled={iaRunning}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-xl shadow-indigo-600/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${iaRunning ? 'animate-spin' : ''}`} />
                    {iaRunning ? 'Analizando evidencia...' : 'Re-ejecutar Análisis IA'}
                  </button>
                </div>

                {iaSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                    <Check className="w-4 h-4" /> Diagnóstico actualizado con éxito con los últimos parámetros de campo.
                  </div>
                )}

                {/* Bloque de Audio Dictado */}
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-400" />
                      Transcripción de Nota de Voz del Inspector
                    </span>
                    <span className="text-[10px] font-mono text-indigo-400/80">Whisper / Gemini Voice</span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 italic bg-black/30 p-3 rounded-xl border border-indigo-500/10 leading-relaxed">
                    {equipoActual.analisisIA.audioTranscrito}
                  </p>
                </div>

                {/* Diagnóstico técnico sintetizado */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-sky-400" />
                      Diagnóstico y Estimación de Falla
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Severidad IA:</span>
                      {renderBadgeEstado(equipoActual.analisisIA.severidadRecomendada)}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {equipoActual.analisisIA.diagnostico}
                  </p>
                </div>

                {/* Plan de Acción Recomendado */}
                <div>
                  <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Recomendaciones Automatizadas
                  </h3>
                  <div className="flex flex-col gap-2.5">
                    {equipoActual.analisisIA.acciones.map((acc, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3"
                      >
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide whitespace-nowrap mt-0.5 ${
                          acc.prioridad.includes('INMEDIATA') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          acc.prioridad.includes('HORAS') ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}>
                          {acc.prioridad}
                        </span>
                        <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed">
                          {acc.accion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---------------------------------------------------- */}
            {/* PESTAÑA 5: REPORTE                                   */}
            {/* ---------------------------------------------------- */}
            {activeTab === 'REPORTE' && equipoActual && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Previsualización del Informe Técnico Oficial</span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Ficha de reporte lista para exportación a PDF o Word con formato normado PGP.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => alert('Simulación: Descargando Reporte Técnico PDF para ' + equipoActual.tag)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30 flex items-center gap-1.5 transition-all"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar PDF
                    </button>
                    <button
                      onClick={() => alert('Enviando reporte a supervisión de mina...')}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" /> Enviar
                    </button>
                  </div>
                </div>

                {/* Hoja formal de reporte (Estilo documento técnico) */}
                <div className="p-6 sm:p-8 rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200">
                  {/* Cabecera del Documento */}
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-slate-900">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                        INFORME TÉCNICO DE INSPECCIÓN EN TERRENO
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                        {equipoActual.tag} · {equipoActual.nombre}
                      </h1>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {empresaActual.nombre} · {areaActual.nombre}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-slate-700">Folio: PGP-2026-{equipoActual.tag}</div>
                      <div className="text-xs text-slate-500">Fecha: {equipoActual.ultimaInspeccion}</div>
                      <div className="mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                          ESTADO: {equipoActual.estado}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Cuerpo del Reporte */}
                  <div className="mt-6 flex flex-col gap-5 text-xs sm:text-sm">
                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 mb-2">
                        1. Resumen Ejecutivo de la Condición
                      </h4>
                      <p className="text-slate-700 leading-relaxed">
                        Durante la jornada de inspección se evaluaron los componentes críticos de <strong>{equipoActual.nombre}</strong>.
                        Se determinó un índice de salud operacional de <strong>{equipoActual.saludScore}%</strong>, catalogado con severidad <strong>{equipoActual.estado}</strong>.
                        {equipoActual.resumenCondicion}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 mb-2">
                        2. Tabla de Hallazgos por Subsistema
                      </h4>
                      <table className="w-full text-left border-collapse border border-slate-200">
                        <thead>
                          <tr className="bg-slate-100 text-slate-800 text-xs">
                            <th className="p-2 border border-slate-200">Subsistema</th>
                            <th className="p-2 border border-slate-200">Condición</th>
                            <th className="p-2 border border-slate-200">Detalle / Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {equipoActual.subsistemas.map((sub, idx) => (
                            <tr key={idx} className="border border-slate-200">
                              <td className="p-2 font-semibold text-slate-900 border border-slate-200">{sub.nombre}</td>
                              <td className="p-2 border border-slate-200 font-mono text-xs font-bold">
                                {sub.estado}
                              </td>
                              <td className="p-2 text-slate-700 border border-slate-200">{sub.detalle}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-1 mb-2">
                        3. Dictamen y Recomendación de Ingeniería
                      </h4>
                      <p className="text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200 italic">
                        "{equipoActual.analisisIA.diagnostico}"
                      </p>
                    </div>

                    {/* Firmas */}
                    <div className="mt-6 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
                      <div>
                        <div className="font-bold text-slate-900">{equipoActual.inspector}</div>
                        <div className="text-slate-500">Inspector Especialista PGP</div>
                        <div className="text-[10px] text-emerald-600 font-semibold mt-1">✓ Firma Digital Validada</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Superintendencia de Mantenimiento</div>
                        <div className="text-slate-500">{empresaActual.nombre}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Revisión y Aprobación</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ======================================================== */}
      {/* SI LOS KPIS ESTÁN EN BOTTOM: (COMO EN EL BOCETO DE PAPEL) */}
      {/* ======================================================== */}
      {posicionKpis === 'BOTTOM' && (
        <section className="border-t border-slate-800 bg-slate-950/90 py-5 px-4 sm:px-6 mt-auto">
          <div className="max-w-[1700px] mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xs font-black">
                  C
                </span>
                <span className="text-sm font-bold uppercase tracking-wider text-white">
                  KPI de la Empresa: {empresaActual.nombre}
                </span>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                * Panel inferior transversal (disposición boceto)
              </span>
            </div>
            {renderBloqueKPIs(false)}
          </div>
        </section>
      )}

      {/* PIE DE PÁGINA */}
      <footer className="border-t border-slate-900 py-3 px-4 text-center text-xs text-slate-500 bg-slate-950">
        Agente Inspector 2026 · Prototipo interactivo de interfaz de usuario
      </footer>
    </div>
  );
}
