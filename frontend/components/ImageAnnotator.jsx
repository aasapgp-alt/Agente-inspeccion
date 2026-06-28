import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './ImageAnnotator.module.css';

// Cargar dinámicamente el Wrapper para evitar problemas de SSR en Next.js
const Annotation = dynamic(
  () => import('./AnnotationWrapper'),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
        <div className="spinner" style={{ width: '30px', height: '30px', borderTopColor: 'var(--accent-primary)' }}></div>
      </div>
    )
  }
);

// Utilidad local para calcular coordenadas porcentuales relativas a la imagen
const getCoordPercentage = (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  
  if (e.targetTouches && e.targetTouches.length > 0) {
    const touch = e.targetTouches[0];
    const offsetX = touch.pageX - rect.left;
    const offsetY = touch.pageY - (rect.top + window.scrollY);
    return {
      x: Math.max(0, Math.min(100, (offsetX / rect.width) * 100)),
      y: Math.max(0, Math.min(100, (offsetY / rect.height) * 100))
    };
  }
  
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  return {
    x: (offsetX / rect.width) * 100,
    y: (offsetY / rect.height) * 100
  };
};

// 1. Selector de Rectángulo
const RectangleSelector = {
  TYPE: 'RECTANGLE',
  intersects: ({ x, y }, geometry) => {
    return x >= geometry.x && x <= geometry.x + geometry.width &&
           y >= geometry.y && y <= geometry.y + geometry.height;
  },
  area: (geometry) => geometry.width * geometry.height,
  methods: {
    onMouseDown(annotation, e) {
      if (!annotation.selection) {
        const { x: anchorX, y: anchorY } = getCoordPercentage(e);
        return {
          ...annotation,
          selection: {
            mode: 'SELECTING',
            anchorX,
            anchorY
          }
        };
      }
      return {};
    },
    onMouseMove(annotation, e) {
      if (annotation.selection && annotation.selection.mode === 'SELECTING') {
        const { anchorX, anchorY } = annotation.selection;
        const { x: newX, y: newY } = getCoordPercentage(e);
        const width = newX - anchorX;
        const height = newY - anchorY;
        return {
          ...annotation,
          geometry: {
            ...annotation.geometry,
            type: 'RECTANGLE',
            x: width > 0 ? anchorX : newX,
            y: height > 0 ? anchorY : newY,
            width: Math.abs(width),
            height: Math.abs(height)
          }
        };
      }
      return annotation;
    },
    onMouseUp(annotation, e) {
      if (annotation.selection && annotation.selection.mode === 'SELECTING') {
        if (!annotation.geometry) return {};
        return {
          ...annotation,
          selection: {
            ...annotation.selection,
            showEditor: true,
            mode: 'EDITING'
          }
        };
      }
      return annotation;
    }
  }
};

// 2. Selector de Círculo
const CircleSelector = {
  TYPE: 'CIRCLE',
  intersects: ({ x, y }, geometry) => {
    const rx = geometry.width / 2;
    const ry = geometry.height / 2;
    const h = geometry.x + rx;
    const k = geometry.y + ry;
    if (rx === 0 || ry === 0) return false;
    const val = Math.pow(x - h, 2) / Math.pow(rx, 2) + Math.pow(y - k, 2) / Math.pow(ry, 2);
    return val <= 1;
  },
  area: (geometry) => Math.PI * (geometry.width / 2) * (geometry.height / 2),
  methods: {
    onMouseDown: RectangleSelector.methods.onMouseDown,
    onMouseMove(annotation, e) {
      const res = RectangleSelector.methods.onMouseMove(annotation, e);
      if (res.geometry) {
        res.geometry.type = 'CIRCLE';
      }
      return res;
    },
    onMouseUp: RectangleSelector.methods.onMouseUp
  }
};

// 3. Selector de Línea Recta
const LineSelector = {
  TYPE: 'LINE',
  intersects: ({ x, y }, geometry) => {
    const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x !== undefined ? geometry.x : 0);
    const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y !== undefined ? geometry.y : 0);
    const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
    const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
    if (x2 === undefined || y2 === undefined) return false;
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy) < 3.5;
  },
  area: (geometry) => {
    const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x !== undefined ? geometry.x : 0);
    const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y !== undefined ? geometry.y : 0);
    const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
    const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy) * 2;
  },
  methods: {
    onMouseDown: RectangleSelector.methods.onMouseDown,
    onMouseMove(annotation, e) {
      if (annotation.selection && annotation.selection.mode === 'SELECTING') {
        const { anchorX, anchorY } = annotation.selection;
        const { x: newX, y: newY } = getCoordPercentage(e);
        return {
          ...annotation,
          geometry: {
            ...annotation.geometry,
            type: 'LINE',
            x: anchorX,
            y: anchorY,
            x2: newX,
            y2: newY
          }
        };
      }
      return annotation;
    },
    onMouseUp: RectangleSelector.methods.onMouseUp
  }
};

// 4. Selector de Flecha
const ArrowSelector = {
  TYPE: 'ARROW',
  intersects: LineSelector.intersects,
  area: LineSelector.area,
  methods: {
    onMouseDown: LineSelector.methods.onMouseDown,
    onMouseMove(annotation, e) {
      const res = LineSelector.methods.onMouseMove(annotation, e);
      if (res.geometry) {
        res.geometry.type = 'ARROW';
      }
      return res;
    },
    onMouseUp: LineSelector.methods.onMouseUp
  }
};

// 5. Selector de Caja de Texto
const TextSelector = {
  TYPE: 'TEXT',
  intersects: RectangleSelector.intersects,
  area: RectangleSelector.area,
  methods: {
    onMouseDown: RectangleSelector.methods.onMouseDown,
    onMouseMove(annotation, e) {
      const res = RectangleSelector.methods.onMouseMove(annotation, e);
      if (res.geometry) {
        res.geometry.type = 'TEXT';
      }
      return res;
    },
    onMouseUp: RectangleSelector.methods.onMouseUp
  }
};

// 6. Selector de Trazo Libre (Lápiz)
const FreehandSelector = {
  TYPE: 'FREEHAND',
  intersects: ({ x, y }, geometry) => {
    const points = geometry.points || [];
    if (points.length < 2) return false;
    for (let i = 0; i < points.length - 1; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i+1];
      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      if (lenSq !== 0) param = dot / lenSq;
      
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      
      const dx = x - xx;
      const dy = y - yy;
      if (Math.sqrt(dx * dx + dy * dy) < 3.5) return true;
    }
    return false;
  },
  area: (geometry) => {
    const points = geometry.points || [];
    if (points.length === 0) return 0;
    let minX = 100, maxX = 0, minY = 100, maxY = 0;
    points.forEach(([px, py]) => {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    });
    return (maxX - minX) * (maxY - minY);
  },
  methods: {
    onMouseDown(annotation, e) {
      if (!annotation.selection) {
        const coord = getCoordPercentage(e);
        return {
          ...annotation,
          selection: {
            mode: 'SELECTING'
          },
          geometry: {
            type: 'FREEHAND',
            points: [[coord.x, coord.y]],
            x: coord.x,
            y: coord.y,
            width: 0,
            height: 0
          }
        };
      }
      return {};
    },
    onMouseMove(annotation, e) {
      if (annotation.selection && annotation.selection.mode === 'SELECTING') {
        const coord = getCoordPercentage(e);
        const points = [...(annotation.geometry.points || []), [coord.x, coord.y]];
        
        let minX = 100, maxX = 0, minY = 100, maxY = 0;
        points.forEach(([px, py]) => {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        });

        return {
          ...annotation,
          geometry: {
            ...annotation.geometry,
            points,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          }
        };
      }
      return annotation;
    },
    onMouseUp: RectangleSelector.methods.onMouseUp
  }
};

// Agregar handlers de toque para todos los selectores
const addTouchHandlers = (selector) => {
  selector.methods.onTouchStart = selector.methods.onMouseDown;
  selector.methods.onTouchMove = selector.methods.onMouseMove;
  selector.methods.onTouchEnd = selector.methods.onMouseUp;
  return selector;
};

addTouchHandlers(RectangleSelector);
addTouchHandlers(CircleSelector);
addTouchHandlers(LineSelector);
addTouchHandlers(ArrowSelector);
addTouchHandlers(TextSelector);
addTouchHandlers(FreehandSelector);

const ALL_SELECTORS = [
  RectangleSelector,
  CircleSelector,
  LineSelector,
  ArrowSelector,
  TextSelector,
  FreehandSelector
];

export default function ImageAnnotator({ imageUrl, initialAnnotations, onSave, onClose, imageId }) {
  const [annotations, setAnnotations] = useState(initialAnnotations || []);
  const [annotation, setAnnotation] = useState({});
  const [activeTool, setActiveTool] = useState('rect');
  const [selectedColor, setSelectedColor] = useState('#ef4444'); // Rojo por defecto
  const [customColor, setCustomColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(2);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  // Definición de las herramientas de dibujo
  const tools = {
    rect: { type: 'RECTANGLE', label: 'Rectángulo', icon: '▭', desc: 'Resaltar un área' },
    circle: { type: 'CIRCLE', label: 'Círculo', icon: '◯', desc: 'Resaltar un punto' },
    line: { type: 'LINE', label: 'Línea', icon: '╱', desc: 'Dibujar línea recta' },
    arrow: { type: 'ARROW', label: 'Flecha', icon: '↗', desc: 'Señalar dirección' },
    text: { type: 'TEXT', label: 'Texto', icon: 'T', desc: 'Agregar nota de texto' },
    freehand: { type: 'FREEHAND', label: 'Lápiz', icon: '✎', desc: 'Dibujo libre' }
  };

  const colors = [
    { value: '#ef4444', name: 'Rojo' },
    { value: '#10b981', name: 'Verde' },
    { value: '#3b82f6', name: 'Azul' },
    { value: '#eab308', name: 'Amarillo' },
    { value: '#ec4899', name: 'Rosa' },
    { value: '#ffffff', name: 'Blanco' }
  ];

  const lineThicknesses = [1, 2, 3, 5, 8];

  // Sincronizar color personalizado
  useEffect(() => {
    setSelectedColor(customColor);
  }, [customColor]);

  // Manejo de cambios mientras se dibuja
  const onChange = (newAnnotation) => {
    setAnnotation({
      ...newAnnotation,
      geometry: newAnnotation.geometry ? {
        ...newAnnotation.geometry,
        color: selectedColor,
        lineWidth: lineWidth
      } : undefined
    });
  };

  // Guardado de la anotación actual en el listado
  const onSubmit = (newAnnotation) => {
    const { geometry, data } = newAnnotation;
    
    let text = data && data.text ? data.text.trim() : "";
    if (!text) {
      if (geometry.type === 'TEXT') {
        alert("Por favor, ingresa una nota para la anotación de texto.");
        return;
      }
      text = tools[activeTool].label;
    }

    const item = {
      geometry: {
        ...geometry,
        color: selectedColor,
        lineWidth: lineWidth
      },
      data: {
        ...data,
        text,
        id: Math.random().toString(36).substr(2, 9)
      }
    };

    setAnnotations(prev => prev.concat(item));
    setAnnotation({});
  };

  const handleDelete = (id) => {
    setAnnotations(prev => prev.filter(item => item.data.id !== id));
  };

  const handleUndo = () => {
    setAnnotations(prev => prev.slice(0, -1));
  };

  const handleClearAll = () => {
    if (window.confirm("¿Estás seguro de que deseas eliminar todas las anotaciones?")) {
      setAnnotations([]);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(annotations);
    }
  };

  // Zoom handlers
  const adjustZoom = (amount) => {
    setZoom(prev => Math.max(1, Math.min(3, prev + amount)));
  };

  // Renderizador personalizado de las formas vectoriales en SVG
  const renderAnnotationShape = (ann, active = false) => {
    const { geometry, data } = ann;
    if (!geometry) return null;

    const color = geometry.color || '#ef4444';
    const strokeWidth = geometry.lineWidth || 2;
    const strokeDashArray = active ? '4' : undefined;

    switch (geometry.type) {
      case 'RECTANGLE':
        return (
          <svg key={data?.id || 'active'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <rect
              x={`${geometry.x}%`}
              y={`${geometry.y}%`}
              width={`${geometry.width}%`}
              height={`${geometry.height}%`}
              stroke={color}
              strokeWidth={strokeWidth / zoom}
              strokeDasharray={strokeDashArray}
              fill={active ? 'rgba(255,255,255,0.08)' : 'transparent'}
            />
          </svg>
        );
      case 'CIRCLE':
        return (
          <svg key={data?.id || 'active'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <ellipse
              cx={`${geometry.x + geometry.width / 2}%`}
              cy={`${geometry.y + geometry.height / 2}%`}
              rx={`${geometry.width / 2}%`}
              ry={`${geometry.height / 2}%`}
              stroke={color}
              strokeWidth={strokeWidth / zoom}
              strokeDasharray={strokeDashArray}
              fill={active ? 'rgba(255,255,255,0.08)' : 'transparent'}
            />
          </svg>
        );
      case 'LINE': {
        const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x !== undefined ? geometry.x : 0);
        const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y !== undefined ? geometry.y : 0);
        const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
        const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
        return (
          <svg key={data?.id || 'active'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <line
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke={color}
              strokeWidth={strokeWidth / zoom}
              strokeDasharray={strokeDashArray}
            />
          </svg>
        );
      }
      case 'ARROW': {
        const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x !== undefined ? geometry.x : 0);
        const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y !== undefined ? geometry.y : 0);
        const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
        const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
        const color = geometry.color || '#ef4444';
        const strokeWidth = (geometry.lineWidth || 2) / zoom;
        const markerId = `arrowhead-${data?.id || 'active'}`;
        return (
          <svg
            key={data?.id || 'active'}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}
          >
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            </defs>
            <line
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke={color}
              strokeWidth={strokeWidth}
              markerEnd={`url(#${markerId})`}
            />
          </svg>
        );
      }
      case 'TEXT':
        return (
          <svg key={data?.id || 'active'} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
            <foreignObject
              x={`${geometry.x}%`}
              y={`${geometry.y}%`}
              width={`${geometry.width || 0}%`}
              height={`${geometry.height || 0}%`}
            >
              <div style={{
                width: '100%',
                height: '100%',
                color: color,
                fontSize: `${12 / zoom}px`,
                fontWeight: 'bold',
                wordBreak: 'break-word',
                padding: `${4 / zoom}px`,
                border: `${1 / zoom}px dashed ${color}`,
                backgroundColor: 'rgba(0,0,0,0.6)',
                borderRadius: `${4 / zoom}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                boxSizing: 'border-box'
              }}>
                {data && data.text ? data.text : 'Escribe...'}
              </div>
            </foreignObject>
          </svg>
        );
      case 'FREEHAND': {
        const points = geometry.points || [];
        if (points.length === 0) return null;
        const pathData = points.reduce((acc, [px, py], idx) => {
          return acc + (idx === 0 ? `M ${px} ${py}` : ` L ${px} ${py}`);
        }, '');

        return (
          <svg key={data?.id || 'active'} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1, overflow: 'visible' }}>
            <path
              d={pathData}
              stroke={color}
              strokeWidth={strokeWidth / zoom}
              strokeDasharray={strokeDashArray}
              fill="transparent"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        );
      }
      default:
        return null;
    }
  };

  // Editor flotante personalizado
  const renderEditor = ({ annotation: activeAnn, onChange: onActChange, onSubmit: onActSubmit }) => {
    const { geometry } = activeAnn;
    if (!geometry) return null;

    return (
      <div style={{
        background: 'rgba(15, 23, 42, 0.96)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '6px',
        padding: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '180px',
        fontFamily: 'inherit'
      }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          {geometry.type === 'TEXT' ? '📝 Texto a mostrar:' : '✏️ Nota de anotación:'}
        </div>
        <input
          type="text"
          value={(activeAnn.data && activeAnn.data.text) || ''}
          placeholder={geometry.type === 'TEXT' ? 'Ej. Brida 2' : 'Ej. Óxido leve'}
          onChange={e => onActChange({
            ...activeAnn,
            data: {
              ...activeAnn.data,
              text: e.target.value
            }
          })}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onActSubmit();
            }
          }}
          autoFocus
          style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '4px',
            color: 'white',
            padding: '4px 6px',
            fontSize: '0.8rem',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
          <button
            onClick={onActSubmit}
            style={{
              padding: '3px 8px',
              background: 'var(--accent-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Aceptar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.annotatorContainer}>
      {/* Barra de herramientas lateral */}
      <div className={styles.toolbar}>
        <div className={styles.toolSection}>
          <div className={styles.sectionTitle}>Formas</div>
          <div className={styles.toolGrid}>
            {Object.entries(tools).map(([key, t]) => (
              <button
                key={key}
                onClick={() => setActiveTool(key)}
                className={`${styles.toolButton} ${activeTool === key ? styles.activeTool : ''}`}
                title={t.desc}
              >
                <span className={styles.toolIcon}>{t.icon}</span>
                <span className={styles.toolLabel}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Paleta de colores */}
        <div className={styles.toolSection}>
          <div className={styles.sectionTitle}>Color</div>
          <div className={styles.colorPalette}>
            {colors.map(c => (
              <button
                key={c.value}
                onClick={() => setSelectedColor(c.value)}
                className={`${styles.colorBubble} ${selectedColor === c.value ? styles.activeColor : ''}`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <div className={styles.customColorContainer} title="Personalizado">
              <input
                type="color"
                value={customColor}
                onChange={e => setCustomColor(e.target.value)}
                className={styles.colorInput}
              />
              <span className={styles.customColorIcon}>🎨</span>
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Grosor de línea */}
        <div className={styles.toolSection}>
          <div className={styles.sectionTitle}>Grosor ({lineWidth}px)</div>
          <div className={styles.thicknessRow}>
            {lineThicknesses.map(t => (
              <button
                key={t}
                onClick={() => setLineWidth(t)}
                className={`${styles.thicknessButton} ${lineWidth === t ? styles.activeThickness : ''}`}
                style={{ fontSize: `${0.7 + t * 0.05}rem` }}
              >
                {t}px
              </button>
            ))}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Zoom */}
        <div className={styles.toolSection}>
          <div className={styles.sectionTitle}>Zoom ({Math.round(zoom * 100)}%)</div>
          <div className={styles.zoomControls}>
            <button onClick={() => adjustZoom(-0.1)} disabled={zoom <= 1} className={styles.zoomBtn}>➖</button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className={styles.zoomSlider}
            />
            <button onClick={() => adjustZoom(0.1)} disabled={zoom >= 3} className={styles.zoomBtn}>➕</button>
          </div>
        </div>

        <div className={styles.divider} />

        {/* Acciones rápidas */}
        <div className={styles.actionsRow}>
          <button onClick={handleUndo} disabled={annotations.length === 0} className={styles.actionBtn} title="Deshacer último trazo">
            Deshacer
          </button>
          <button onClick={handleClearAll} disabled={annotations.length === 0} className={`${styles.actionBtn} ${styles.dangerBtn}`} title="Limpiar todo">
            Limpiar
          </button>
        </div>
      </div>

      {/* Área central del canvas */}
      <div className={styles.canvasArea}>
        <div 
          ref={containerRef}
          className={styles.scrollWrapper}
        >
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            transition: 'transform 0.1s ease-out',
            position: 'relative',
            width: '100%',
            height: '100%',
            minWidth: `${zoom * 100}%`,
            minHeight: `${zoom * 100}%`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {imageUrl && (
              <Annotation
                src={imageUrl}
                alt="Imagen de Inspección"
                annotations={annotations}
                value={annotation}
                type={tools[activeTool].type}
                selectors={ALL_SELECTORS}
                onChange={onChange}
                onSubmit={onSubmit}
                renderHighlight={({ key, annotation: ann, active }) => renderAnnotationShape(ann, active)}
                renderSelector={({ annotation: selAnn }) => renderAnnotationShape(selAnn, true)}
                renderEditor={renderEditor}
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Barra lateral de anotaciones y guardado */}
      <div className={styles.sidebar}>
        <div style={{ padding: '0.8rem', backgroundColor: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px', fontSize: '0.75rem', color: '#93c5fd', lineHeight: '1.4' }}>
          <strong>Guía de Dibujo:</strong>
          <ul style={{ margin: '0.3rem 0 0 1rem', padding: 0 }}>
            <li>Elige una herramienta y haz clic/arrastra sobre la imagen.</li>
            <li>Escribe una nota opcional en el globo emergente y presiona Enter.</li>
            <li>Para texto, arrastra un cuadro y escribe el texto obligatorio.</li>
          </ul>
        </div>

        <div className={styles.annotationsListContainer}>
          <div className={styles.sidebarSectionTitle}>
            Anotaciones guardadas ({annotations.length})
          </div>
          
          {annotations.length === 0 ? (
            <div className={styles.emptyState}>
              No hay anotaciones aún. Usa el panel izquierdo para dibujar marcas en la imagen.
            </div>
          ) : (
            <div className={styles.annotationsList}>
              {annotations.map((item, index) => (
                <div key={item.data.id} className={styles.annotationItem}>
                  <div className={styles.annotationDetails}>
                    <span 
                      className={styles.annotationBadge}
                      style={{ backgroundColor: item.geometry.color || '#ef4444' }}
                    >
                      {index + 1}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.annotationText}>{item.data.text}</span>
                      <span className={styles.annotationType}>
                        {tools[Object.keys(tools).find(k => tools[k].type === item.geometry.type)]?.label || item.geometry.type}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.data.id)}
                    className={styles.deleteBtn}
                    title="Eliminar anotación"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footerActions}>
          <button onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
            Cancelar
          </button>
          <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>
            Guardar Marcas
          </button>
        </div>
      </div>
    </div>
  );
}
