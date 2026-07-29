'use client';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as fabric from 'fabric';

export default function AnnotationWrapper(props) {
  const {
    src,
    alt,
    annotations,
    value,
    type,
    onSubmit,
    renderHighlight,
    renderEditor,
    zoom = 1,
    style
  } = props;

  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [canvas, setCanvas] = useState(null);
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorPosition, setEditorPosition] = useState({ x: 0, y: 0, screenX: 0, screenY: 0 });

  const isDrawingRef = useRef(false);
  const startPointRef = useRef({ x: 0, y: 0 });
  const activeObjRef = useRef(null);
  const pointsRef = useRef([]);
  const naturalSizeRef = useRef({ width: 0, height: 0 });

  const typeRef = useRef(type);
  const colorRef = useRef(value?.geometry?.color || '#ef4444');
  const lineWidthRef = useRef(value?.geometry?.lineWidth || 2);
  const zoomRef = useRef(zoom);

  // Sync refs to avoid re-binding events on value/type/zoom changes
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    colorRef.current = value?.geometry?.color || '#ef4444';
    lineWidthRef.current = value?.geometry?.lineWidth || 2;
  }, [value]);

  useEffect(() => {
    zoomRef.current = zoom;
    if (canvas) {
      canvas.calcOffset();
    }
  }, [zoom, canvas]);

  // Helper to compute exact pointer coordinates relative to canvas internal space
  const getPointer = (o) => {
    if (!canvas) return { x: 0, y: 0 };
    canvas.calcOffset();
    const e = o.e || o;
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (clientX === undefined) {
      if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    }

    const currentZoom = zoomRef.current || 1;
    const w = canvas.getWidth();
    const h = canvas.getHeight();

    const targetEl = imageRef.current || canvasRef.current;
    if (targetEl && clientX !== undefined && clientY !== undefined) {
      const rect = targetEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(w, (clientX - rect.left) / currentZoom));
      const y = Math.max(0, Math.min(h, (clientY - rect.top) / currentZoom));
      return { x, y };
    }

    const p = canvas.getPointer(e);
    if (p && !isNaN(p.x) && !isNaN(p.y)) {
      return { x: Math.max(0, Math.min(w, p.x)), y: Math.max(0, Math.min(h, p.y)) };
    }

    return { x: 0, y: 0 };
  };

  const createArrow = (x1, y1, x2, y2, color, width) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length < 1) return null;
    const angle = Math.atan2(dy, dx);
    const headSize = Math.max(8, Math.min(18, length * 0.18));

    // Build line from origin to (length - headSize, 0) in local space
    const line = new fabric.Line([0, 0, length - headSize, 0], {
      stroke: color,
      strokeWidth: width,
      strokeUniform: true,
      selectable: false,
      evented: false,
      originX: 'left',
      originY: 'center'
    });

    // Triangle sits at the tip, centered horizontally on the endpoint
    const triangle = new fabric.Triangle({
      width: headSize,
      height: headSize,
      fill: color,
      left: length - headSize / 2,
      top: 0,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false
    });

    // Create group — Fabric will auto-center children in local space.
    // We must compensate: the group's visual center is at (length/2, 0) in local coords,
    // so position the group so that its left edge aligns with x1/y1.
    const group = new fabric.Group([line, triangle], {
      originX: 'center',
      originY: 'center',
      left: x1 + (dx / 2),   // center of the arrow in world space
      top: y1 + (dy / 2),
      angle: angle * 180 / Math.PI,
      selectable: false,
      evented: false
    });

    return group;
  };

  const handleImageLoad = () => {
    if (!imageRef.current || !canvas) return;
    const width = imageRef.current.offsetWidth || imageRef.current.clientWidth || imageRef.current.getBoundingClientRect().width;
    const height = imageRef.current.offsetHeight || imageRef.current.clientHeight || imageRef.current.getBoundingClientRect().height;
    if (width > 0 && height > 0) {
      canvas.setDimensions({ width, height });
      canvas.calcOffset();
      canvas.renderAll();
    }
    // Store natural dimensions as coordinate reference
    naturalSizeRef.current = {
      width: imageRef.current.naturalWidth || width,
      height: imageRef.current.naturalHeight || height
    };
  };

  // Ensure canvas is resized when image loads or completes caching
  useEffect(() => {
    if (imageRef.current && imageRef.current.complete) {
      handleImageLoad();
    }
  }, [canvas]);

  // Keep canvas size synchronized with the image using ResizeObserver
  useEffect(() => {
    if (!imageRef.current || !canvas) return;

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => {
        handleImageLoad();
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    const observer = new ResizeObserver(() => {
      handleImageLoad();
    });

    observer.observe(imageRef.current);

    return () => {
      observer.disconnect();
    };
  }, [canvas]);

  // Initialize Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const fbCanvas = new fabric.Canvas(canvasRef.current, {
      selection: false,
      defaultCursor: 'crosshair',
      backgroundColor: 'transparent'
    });

    setCanvas(fbCanvas);

    return () => {
      fbCanvas.dispose();
    };
  }, []);

  // Sync annotations array onto Fabric canvas as native Fabric objects
  useEffect(() => {
    if (!canvas) return;

    canvas.clear();
    canvas.backgroundColor = 'transparent';

    const w = canvas.getWidth();
    const h = canvas.getHeight();
    if (!w || !h) return;

    (annotations || []).forEach((ann) => {
      const { geometry, data } = ann;
      if (!geometry) return;

      const color = geometry.color || '#ef4444';
      const width = geometry.lineWidth || 2;

      let obj = null;

      if (geometry.type === 'RECTANGLE') {
        obj = new fabric.Rect({
          left: (geometry.x / 100) * w,
          top: (geometry.y / 100) * h,
          width: (geometry.width / 100) * w,
          height: (geometry.height / 100) * h,
          stroke: color,
          strokeWidth: width,
          fill: 'transparent',
          selectable: false,
          evented: false
        });
      } else if (geometry.type === 'CIRCLE') {
        obj = new fabric.Ellipse({
          left: (geometry.x / 100) * w,
          top: (geometry.y / 100) * h,
          rx: ((geometry.width / 2) / 100) * w,
          ry: ((geometry.height / 2) / 100) * h,
          stroke: color,
          strokeWidth: width,
          fill: 'transparent',
          selectable: false,
          evented: false
        });
      } else if (geometry.type === 'LINE') {
        const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x || 0);
        const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y || 0);
        const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
        const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
        obj = new fabric.Line([
          (x1 / 100) * w,
          (y1 / 100) * h,
          (x2 / 100) * w,
          (y2 / 100) * h
        ], {
          stroke: color,
          strokeWidth: width,
          selectable: false,
          evented: false
        });
      } else if (geometry.type === 'ARROW') {
        const x1 = geometry.x1 !== undefined ? geometry.x1 : (geometry.x || 0);
        const y1 = geometry.y1 !== undefined ? geometry.y1 : (geometry.y || 0);
        const x2 = geometry.x2 !== undefined ? geometry.x2 : x1;
        const y2 = geometry.y2 !== undefined ? geometry.y2 : y1;
        obj = createArrow(
          (x1 / 100) * w,
          (y1 / 100) * h,
          (x2 / 100) * w,
          (y2 / 100) * h,
          color,
          width
        );
      } else if (geometry.type === 'TEXT') {
        const textStr = data?.text || 'Texto';
        const boxLeft = (geometry.x / 100) * w;
        const boxTop = (geometry.y / 100) * h;
        const boxW = Math.max(40, ((geometry.width || 15) / 100) * w);
        const boxH = Math.max(20, ((geometry.height || 8) / 100) * h);

        const rect = new fabric.Rect({
          left: boxLeft,
          top: boxTop,
          width: boxW,
          height: boxH,
          stroke: color,
          strokeWidth: 1,
          strokeDashArray: [3, 3],
          fill: 'rgba(0, 0, 0, 0.6)',
          rx: 4,
          ry: 4,
          selectable: false,
          evented: false
        });

        const txt = new fabric.Text(textStr, {
          left: boxLeft + boxW / 2,
          top: boxTop + boxH / 2,
          originX: 'center',
          originY: 'center',
          fill: color,
          fontSize: 12,
          fontWeight: 'bold',
          selectable: false,
          evented: false
        });

        obj = new fabric.Group([rect, txt], {
          selectable: false,
          evented: false
        });
      } else if (geometry.type === 'FREEHAND') {
        const pts = (geometry.points || []).map(([px, py]) => ({
          x: (px / 100) * w,
          y: (py / 100) * h
        }));
        if (pts.length > 0) {
          obj = new fabric.Polyline(pts, {
            stroke: color,
            strokeWidth: width,
            fill: 'transparent',
            selectable: false,
            evented: false,
            strokeLineCap: 'round',
            strokeLineJoin: 'round'
          });
        }
      }

      if (obj) {
        canvas.add(obj);
      }
    });

    canvas.renderAll();
  }, [annotations, canvas]);

  // Set up Drawing event listeners
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = (o) => {
      if (showEditor) return;

      const pointer = getPointer(o.e);
      isDrawingRef.current = true;

      const currentTool = typeRef.current;
      const currentColor = colorRef.current;
      const strokeWidth = lineWidthRef.current;

      startPointRef.current = { x: pointer.x, y: pointer.y };

      if (currentTool === 'RECTANGLE') {
        activeObjRef.current = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          stroke: currentColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
          selectable: false,
          evented: false
        });
        canvas.add(activeObjRef.current);
      } else if (currentTool === 'CIRCLE') {
        activeObjRef.current = new fabric.Ellipse({
          left: pointer.x,
          top: pointer.y,
          rx: 0,
          ry: 0,
          stroke: currentColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
          selectable: false,
          evented: false
        });
        canvas.add(activeObjRef.current);
      } else if (currentTool === 'LINE') {
        activeObjRef.current = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: currentColor,
          strokeWidth: strokeWidth,
          selectable: false,
          evented: false
        });
        canvas.add(activeObjRef.current);
      } else if (currentTool === 'ARROW') {
        const line = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: currentColor,
          strokeWidth: strokeWidth,
          selectable: false,
          evented: false
        });
        const head = new fabric.Triangle({
          width: 0,
          height: 0,
          fill: currentColor,
          left: pointer.x,
          top: pointer.y,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          angle: 90
        });
        activeObjRef.current = { line, head };
        canvas.add(line);
        canvas.add(head);
      } else if (currentTool === 'TEXT') {
        activeObjRef.current = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          stroke: currentColor,
          strokeWidth: 1,
          strokeDashArray: [3, 3],
          fill: 'rgba(255, 255, 255, 0.08)',
          selectable: false,
          evented: false
        });
        canvas.add(activeObjRef.current);
      } else if (currentTool === 'FREEHAND') {
        const pt = { x: pointer.x, y: pointer.y };
        pointsRef.current = [pt];
        activeObjRef.current = new fabric.Polyline([pt], {
          stroke: currentColor,
          strokeWidth: strokeWidth,
          fill: 'transparent',
          selectable: false,
          evented: false,
          strokeLineCap: 'round',
          strokeLineJoin: 'round'
        });
        canvas.add(activeObjRef.current);
      }
    };

    const handleMouseMove = (o) => {
      if (!isDrawingRef.current || !activeObjRef.current) return;

      const pointer = getPointer(o.e);
      const start = startPointRef.current;
      const currentTool = typeRef.current;

      if (currentTool === 'RECTANGLE' || currentTool === 'TEXT') {
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const width = Math.abs(start.x - pointer.x);
        const height = Math.abs(start.y - pointer.y);
        activeObjRef.current.set({ left, top, width, height });
      } else if (currentTool === 'CIRCLE') {
        const left = Math.min(start.x, pointer.x);
        const top = Math.min(start.y, pointer.y);
        const rx = Math.abs(start.x - pointer.x) / 2;
        const ry = Math.abs(start.y - pointer.y) / 2;
        activeObjRef.current.set({ left, top, rx, ry });
      } else if (currentTool === 'LINE') {
        // Recrear la línea con coordenadas absolutas: mutar x2/y2 sobre una
        // fabric.Line deja su bounding box (left/top) desactualizado y la dibuja
        // desplazada respecto al cursor, lo que hace que la marca "salte" al
        // confirmarse como SVG. Recrearla mantiene el preview pegado al cursor.
        canvas.remove(activeObjRef.current);
        activeObjRef.current = new fabric.Line([start.x, start.y, pointer.x, pointer.y], {
          stroke: colorRef.current,
          strokeWidth: lineWidthRef.current,
          selectable: false,
          evented: false
        });
        canvas.add(activeObjRef.current);
      } else if (currentTool === 'ARROW') {
        const head = activeObjRef.current.head;
        const x2 = pointer.x;
        const y2 = pointer.y;
        // Recrear la línea (mismo motivo que LINE). La punta usa left/top
        // absolutos, así que no sufre el desfase: solo se reposiciona.
        canvas.remove(activeObjRef.current.line);
        canvas.remove(head);
        const newLine = new fabric.Line([start.x, start.y, x2, y2], {
          stroke: colorRef.current,
          strokeWidth: lineWidthRef.current,
          selectable: false,
          evented: false
        });
        canvas.add(newLine);

        const dx = x2 - start.x;
        const dy = y2 - start.y;
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        // Adjust head size based on stroke width to match SVG marker
        const markerSize = (lineWidthRef.current / (canvas.getZoom() || 1)) * 6;
        head.set({
          left: x2,
          top: y2,
          angle: angle + 90,
          width: markerSize,
          height: markerSize
        });
        canvas.add(head); // re-agregar para que la punta quede al frente
        activeObjRef.current = { line: newLine, head };
      } else if (currentTool === 'FREEHAND') {
        const pt = { x: pointer.x, y: pointer.y };
        pointsRef.current.push(pt);
        activeObjRef.current.set({ points: [...pointsRef.current] });
      }
      canvas.renderAll();
    };

    const handleMouseUp = (o) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;

      const pointer = getPointer(o.e);
      const currentTool = typeRef.current;

      // Check if the drawing size is significant (ignores accidental clicks)
      let isSignificant = true;
      if (currentTool === 'RECTANGLE' || currentTool === 'CIRCLE' || currentTool === 'TEXT') {
        const start = startPointRef.current;
        const width = Math.abs(start.x - pointer.x);
        const height = Math.abs(start.y - pointer.y);
        if (width < 5 || height < 5) isSignificant = false;
      } else if (currentTool === 'LINE' || currentTool === 'ARROW') {
        const start = startPointRef.current;
        const dx = pointer.x - start.x;
        const dy = pointer.y - start.y;
        if (Math.sqrt(dx * dx + dy * dy) < 5) isSignificant = false;
      } else if (currentTool === 'FREEHAND') {
        if (pointsRef.current.length < 3) isSignificant = false;
      }

      if (!isSignificant) {
        clearActiveDrawing();
        return;
      }

      // Las coordenadas (start/pointer) provienen de canvas.getScenePoint, es
      // decir viven en el espacio lógico del canvas de Fabric. El porcentaje DEBE
      // calcularse sobre ese mismo espacio (canvas.getWidth/Height), no sobre
      // imageRef.offsetWidth: si el canvas y la imagen difieren en tamaño lógico
      // (por timing de carga o resize), mezclar ambas bases desplaza la marca al
      // pasar del preview de Fabric al overlay SVG. Unificar la base evita el salto.
      const w = canvas.getWidth();
      const h = canvas.getHeight();
      const natW = naturalSizeRef.current.width || w;
      const natH = naturalSizeRef.current.height || h;
      // Factor de escala: de píxeles del canvas a píxeles naturales de la imagen.
      const scaleX = natW / w;
      const scaleY = natH / h;
      let geometry = {};
      const start = startPointRef.current;

      if (currentTool === 'RECTANGLE' || currentTool === 'CIRCLE' || currentTool === 'TEXT') {
        const x = Math.min(start.x, pointer.x);
        const y = Math.min(start.y, pointer.y);
        const width = Math.abs(start.x - pointer.x);
        const height = Math.abs(start.y - pointer.y);
        geometry = {
          type: currentTool,
          x: (x / w) * 100,
          y: (y / h) * 100,
          width: (width / w) * 100,
          height: (height / h) * 100,
          naturalPx: {
            x: Math.round(x * scaleX),
            y: Math.round(y * scaleY),
            width: Math.round(width * scaleX),
            height: Math.round(height * scaleY),
            imageWidth: natW,
            imageHeight: natH
          }
        };
      } else if (currentTool === 'LINE' || currentTool === 'ARROW') {
        geometry = {
          type: currentTool,
          x: (start.x / w) * 100,
          y: (start.y / h) * 100,
          x1: (start.x / w) * 100,
          y1: (start.y / h) * 100,
          x2: (pointer.x / w) * 100,
          y2: (pointer.y / h) * 100,
          naturalPx: {
            x1: Math.round(start.x * scaleX),
            y1: Math.round(start.y * scaleY),
            x2: Math.round(pointer.x * scaleX),
            y2: Math.round(pointer.y * scaleY),
            imageWidth: natW,
            imageHeight: natH
          }
        };
      } else if (currentTool === 'FREEHAND') {
        const pts = pointsRef.current;
        const pctPoints = pts.map(p => [(p.x / w) * 100, (p.y / h) * 100]);
        if (pctPoints.length > 0) {
          let minX = pctPoints[0][0];
          let maxX = pctPoints[0][0];
          let minY = pctPoints[0][1];
          let maxY = pctPoints[0][1];
          pctPoints.forEach(([px, py]) => {
            if (px < minX) minX = px;
            if (px > maxX) maxX = px;
            if (py < minY) minY = py;
            if (py > maxY) maxY = py;
          });
          geometry = {
            type: currentTool,
            points: pctPoints,
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            naturalPx: {
              points: pointsRef.current.map(p => [
                Math.round(p.x * scaleX),
                Math.round(p.y * scaleY)
              ]),
              imageWidth: natW,
              imageHeight: natH
            }
          };
        }
      }

      // ARROW: the { line, head:null } preview stays on canvas while popup is open.
      // Do NOT create a fabric.Group here — group recentering causes a visual shift.
      // The preview line already has correct coordinates from mouse:move.
      // handleEditorSubmit will remove it via activeObjRef.current.line.

      // Position note editor popup using robust viewport coords (avoids CSS scale mismatch)
      let clientX = o.e.clientX;
      let clientY = o.e.clientY;

      if (clientX === undefined) {
        if (o.e.changedTouches && o.e.changedTouches.length > 0) {
          clientX = o.e.changedTouches[0].clientX;
          clientY = o.e.changedTouches[0].clientY;
        } else if (o.e.touches && o.e.touches.length > 0) {
          clientX = o.e.touches[0].clientX;
          clientY = o.e.touches[0].clientY;
        } else {
          // safe fallback
          const rect = canvasRef.current ? canvasRef.current.getBoundingClientRect() : {left:0, top:0, width:0, height:0};
          clientX = rect.left + (pointer.x / w) * rect.width;
          clientY = rect.top + (pointer.y / h) * rect.height;
        }
      }

      setEditorPosition({
        screenX: clientX || 0,
        screenY: clientY || 0,
        x: (pointer.x / w) * 100,
        y: (pointer.y / h) * 100
      });

      // Show note editor popup
      setActiveAnnotation({
        geometry,
        data: { text: '' }
      });
      setShowEditor(true);
    };

    const clearActiveDrawing = () => {
      if (!activeObjRef.current) return;
      if (activeObjRef.current.line) {
        canvas.remove(activeObjRef.current.line);
        if (activeObjRef.current.head) canvas.remove(activeObjRef.current.head);
      } else {
        canvas.remove(activeObjRef.current);
      }
      activeObjRef.current = null;
      canvas.renderAll();
    };

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

    return () => {
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:move', handleMouseMove);
      canvas.off('mouse:up', handleMouseUp);
    };
  }, [canvas, showEditor]);

  // Clean up selected tool selections when tool changes
  useEffect(() => {
    if (showEditor && canvas) {
      if (activeObjRef.current) {
        if (activeObjRef.current.line) {
          canvas.remove(activeObjRef.current.line);
          if (activeObjRef.current.head) canvas.remove(activeObjRef.current.head);
        } else {
          canvas.remove(activeObjRef.current);
        }
        activeObjRef.current = null;
        canvas.renderAll();
      }
      setShowEditor(false);
      setActiveAnnotation(null);
    }
  }, [type]);

  const handleEditorChange = (updatedAnn) => {
    setActiveAnnotation(updatedAnn);
  };

  const handleEditorSubmit = () => {
    if (activeAnnotation) {
      onSubmit(activeAnnotation);
    }
    // Clean up drawing from canvas
    if (canvas && activeObjRef.current) {
      if (activeObjRef.current.line) {
        canvas.remove(activeObjRef.current.line);
        if (activeObjRef.current.head) canvas.remove(activeObjRef.current.head);
      } else {
        canvas.remove(activeObjRef.current);
      }
      activeObjRef.current = null;
      canvas.renderAll();
    }
    setShowEditor(false);
    setActiveAnnotation(null);
  };

  return (
    <>
      <div style={{ position: 'relative', display: 'inline-block', ...style }}>
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', pointerEvents: 'none' }}
        />
        <div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
          <canvas ref={canvasRef} />
        </div>


      </div>

      {/* Note Editor Overlay — rendered via Portal so position:fixed escapes transform:scale() */}
      {showEditor && activeAnnotation && createPortal(
        <div style={{
          position: 'fixed',
          left: `${editorPosition.screenX}px`,
          top: `${editorPosition.screenY}px`,
          zIndex: 9999,
          transform: 'translate(-50%, 10px)'
        }}>
          {renderEditor({
            annotation: activeAnnotation,
            onChange: handleEditorChange,
            onSubmit: handleEditorSubmit
          })}
        </div>,
        document.body
      )}
    </>
  );
}
