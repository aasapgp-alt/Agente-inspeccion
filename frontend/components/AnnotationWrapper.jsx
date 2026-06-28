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

  // Sync refs to avoid re-binding events on value/type changes
  useEffect(() => {
    typeRef.current = type;
  }, [type]);

  useEffect(() => {
    colorRef.current = value?.geometry?.color || '#ef4444';
    lineWidthRef.current = value?.geometry?.lineWidth || 2;
  }, [value]);

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
    canvas.setDimensions({ width, height });
    canvas.renderAll();
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

  // Set up Drawing event listeners
  useEffect(() => {
    if (!canvas) return;

    const handleMouseDown = (o) => {
      if (showEditor) return;

      const pointer = canvas.getScenePoint(o.e);
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

      const pointer = canvas.getScenePoint(o.e);
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
        activeObjRef.current.set({ x2: pointer.x, y2: pointer.y });
      } else if (currentTool === 'ARROW') {
        const line = activeObjRef.current.line;
        const head = activeObjRef.current.head;
        const x1 = line.x1;
        const y1 = line.y1;
        const x2 = pointer.x;
        const y2 = pointer.y;
        line.set({ x2, y2 });
        
        const dx = x2 - x1;
        const dy = y2 - y1;
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

      const pointer = canvas.getScenePoint(o.e);
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

      // Calculate percentage geometry for database consistency
      const renderedW = imageRef.current ? imageRef.current.offsetWidth : canvas.getWidth();
      const renderedH = imageRef.current ? imageRef.current.offsetHeight : canvas.getHeight();
      const natW = naturalSizeRef.current.width || renderedW;
      const natH = naturalSizeRef.current.height || renderedH;
      // Scale factor: convert from rendered canvas pixels to natural image pixels
      const scaleX = natW / renderedW;
      const scaleY = natH / renderedH;
      const w = renderedW;
      const h = renderedH;
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

        {/* SVG Highlight Overlays */}
        {annotations && annotations.map((ann, index) => {
          return renderHighlight({
            key: ann.data?.id || index,
            annotation: ann,
            active: false
          });
        })}
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
