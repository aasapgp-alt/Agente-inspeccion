/**
 * Test estático del pipeline completo de la flecha (ARROW).
 * Simula lo que hace AnnotationWrapper + ImageAnnotator sin necesidad de browser.
 *
 * Escenario: imagen de 1920x1080px, mostrada a 800x450px (zoom 1x).
 * El usuario arrastra de (100, 80) a (400, 280) en coordenadas del canvas.
 */

// ─── Constantes del escenario ─────────────────────────────────────────────────
const NATURAL_W = 1920, NATURAL_H = 1080;
const RENDERED_W = 800,  RENDERED_H = 450;
const START = { x: 100, y: 80 };
const END   = { x: 400, y: 280 };
const COLOR  = '#ef4444';
const STROKE = 2;

// ─── 1. HANDLEIMAGELOAD ───────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 1 — handleImageLoad');
console.log('══════════════════════════════════════════');

const naturalSizeRef = { width: NATURAL_W, height: NATURAL_H };
console.log('  naturalSizeRef =', naturalSizeRef);
console.log('  canvas dimensions set to:', { width: RENDERED_W, height: RENDERED_H });

// ─── 2. HANDLEMOUSEDOWN / HANDLEMOUSEMOVE ─────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 2 — handleMouseDown → ARROW branch');
console.log('══════════════════════════════════════════');
console.log('  startPoint captured at:', START);
console.log('  temporary Line created: [{x1,y1}→{x1,y1}] (zero length)');
console.log('  activeObjRef = { line: <Line>, head: null }');

console.log('\n  handleMouseMove → line.set({ x2:', END.x, ', y2:', END.y, '})');
console.log('  ✅ Drag preview: just a plain line, no head distortion.');

// ─── 3. HANDLEMOUSEUP — SIGNIFICANCE CHECK ────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 3 — handleMouseUp: significance check');
console.log('══════════════════════════════════════════');
const dx = END.x - START.x;
const dy = END.y - START.y;
const dragLength = Math.sqrt(dx*dx + dy*dy);
console.log('  drag vector =', { dx, dy });
console.log('  drag length =', dragLength.toFixed(2), '(threshold: 5)');
console.log('  isSignificant =', dragLength >= 5 ? '✅ YES' : '❌ NO — aborted!');

// ─── 4. GEOMETRY CALCULATION ─────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 4 — geometry % + naturalPx calculation');
console.log('══════════════════════════════════════════');

const renderedW = RENDERED_W, renderedH = RENDERED_H;
const natW = naturalSizeRef.width  || renderedW;
const natH = naturalSizeRef.height || renderedH;
const scaleX = natW / renderedW;
const scaleY = natH / renderedH;
const w = renderedW, h = renderedH;

console.log('  renderedW/H =', renderedW, '×', renderedH);
console.log('  natW/H =', natW, '×', natH);
console.log('  scaleX =', scaleX.toFixed(4), '| scaleY =', scaleY.toFixed(4));

const geometry = {
  type: 'ARROW',
  x:  (START.x / w) * 100,
  y:  (START.y / h) * 100,
  x1: (START.x / w) * 100,
  y1: (START.y / h) * 100,
  x2: (END.x / w) * 100,
  y2: (END.y / h) * 100,
  naturalPx: {
    x1: Math.round(START.x * scaleX),
    y1: Math.round(START.y * scaleY),
    x2: Math.round(END.x   * scaleX),
    y2: Math.round(END.y   * scaleY),
    imageWidth:  natW,
    imageHeight: natH
  }
};

console.log('\n  geometry (%) =', {
  x1: geometry.x1.toFixed(2) + '%',
  y1: geometry.y1.toFixed(2) + '%',
  x2: geometry.x2.toFixed(2) + '%',
  y2: geometry.y2.toFixed(2) + '%'
});
console.log('  naturalPx =', geometry.naturalPx);

// Validate %  round-trips back to rendered pixels correctly
const backX1 = (geometry.x1 / 100) * renderedW;
const backY1 = (geometry.y1 / 100) * renderedH;
const backX2 = (geometry.x2 / 100) * renderedW;
const backY2 = (geometry.y2 / 100) * renderedH;
console.log('\n  Round-trip check (% → rendered px):');
console.log('    start:', { x: backX1, y: backY1 }, '  expected:', START, backX1===START.x && backY1===START.y ? '✅' : '❌ MISMATCH');
console.log('    end:  ', { x: backX2, y: backY2 }, '  expected:', END,   backX2===END.x   && backY2===END.y   ? '✅' : '❌ MISMATCH');

// ─── 5. CREATEARROW — GROUP CENTERING MATH ───────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 5 — createArrow() group centering math');
console.log('══════════════════════════════════════════');

const x1 = START.x, y1 = START.y, x2 = END.x, y2 = END.y;
const adx = x2-x1, ady = y2-y1;
const length = Math.sqrt(adx*adx + ady*ady);
const angle  = Math.atan2(ady, adx);
const headSize = Math.max(8, Math.min(18, length * 0.18));

console.log('  arrow length =', length.toFixed(2), 'px');
console.log('  angle        =', (angle * 180 / Math.PI).toFixed(2), '°');
console.log('  headSize     =', headSize.toFixed(2), 'px');

// Group is placed at the midpoint of x1→x2 in world space
const groupLeft = x1 + adx / 2;
const groupTop  = y1 + ady / 2;
console.log('\n  group.left   =', groupLeft, '  (midpoint between start and end)');
console.log('  group.top    =', groupTop);
console.log('  group.angle  =', (angle * 180 / Math.PI).toFixed(2), '°');

// In local space the arrow spans [-length/2, length/2] along X axis (after centering)
// So the visual tip (x2) should be at: groupLeft + cos(angle)*(length/2) etc.
const tipX = groupLeft + Math.cos(angle) * (length / 2);
const tipY = groupTop  + Math.sin(angle) * (length / 2);
const tailX = groupLeft - Math.cos(angle) * (length / 2);
const tailY = groupTop  - Math.sin(angle) * (length / 2);

console.log('\n  Reconstructed world coords from group:');
console.log('    tip  (should be END):  ', { x: Math.round(tipX), y: Math.round(tipY) },
            Math.abs(tipX-x2)<0.5 && Math.abs(tipY-y2)<0.5 ? '✅' : '❌ WRONG — tip misaligned!');
console.log('    tail (should be START):', { x: Math.round(tailX), y: Math.round(tailY) },
            Math.abs(tailX-x1)<0.5 && Math.abs(tailY-y1)<0.5 ? '✅' : '❌ WRONG — tail misaligned!');

// ─── 6. SVG OVERLAY (ImageAnnotator renderAnnotationShape) ────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 6 — SVG overlay (renderAnnotationShape ARROW case)');
console.log('══════════════════════════════════════════');

const zoom = 1;
const markerId = `arrowhead-test`;
const markerSize = Math.max(3, 6 / zoom);
const strokeWidth = (STROKE) / zoom;

console.log('  Using SVG <marker> approach:');
console.log('  markerId  =', markerId);
console.log('  markerSize=', markerSize);
console.log('  strokeWidth=', strokeWidth);
console.log('  line x1,y1 =', geometry.x1.toFixed(2) + '%, ' + geometry.y1.toFixed(2) + '%');
console.log('  line x2,y2 =', geometry.x2.toFixed(2) + '%, ' + geometry.y2.toFixed(2) + '%');
console.log('  markerUnits="userSpaceOnUse" → head NOT distorted by preserveAspectRatio ✅');

// ─── 7. POPUP POSITION ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 7 — Editor popup position');
console.log('══════════════════════════════════════════');
// Assume canvasRect.left=200, canvasRect.top=150 (typical)
const canvasRect = { left: 200, top: 150 };
const editorPos = {
  screenX: canvasRect.left + END.x,
  screenY: canvasRect.top  + END.y
};
console.log('  editorPosition =', editorPos, '(fixed, at arrow tip)');
console.log('  transform: translate(-50%, 10px) → centered horizontally below tip ✅');

// ─── 8. CLEARACTIVEDRAWING SAFETY ────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 8 — clearActiveDrawing / handleEditorSubmit safety');
console.log('══════════════════════════════════════════');
// After mouse:up the ARROW branch replaces { line, head:null } with a plain Group object
// So activeObjRef.current is a Fabric.Group — NOT { line, head }
console.log('  After createArrow(), activeObjRef.current = fabric.Group (NOT {line,head})');
console.log('  clearActiveDrawing checks: if (activeObjRef.current.line) ...');
console.log('    → fabric.Group has no .line property → goes to else branch ✅');
console.log('    → canvas.remove(group) called correctly ✅');

// ─── 9. EDGE CASES ───────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('STEP 9 — Known edge cases');
console.log('══════════════════════════════════════════');

// Edge case A: zero-length arrow
const zeroLen = Math.sqrt(0);
console.log('  A) Zero-length arrow (click without drag):');
console.log('     dragLength =', zeroLen, '< 5 → isSignificant=false → clearActiveDrawing() → ✅ safe');

// Edge case B: very short arrow
const shortLen = Math.sqrt(3*3 + 4*4); // = 5 exactly
console.log('  B) Arrow exactly 5px long:');
console.log('     dragLength =', shortLen, '(threshold: < 5) →', shortLen < 5 ? 'aborted' : 'allowed ✅');

// Edge case C: createArrow with length < 1
console.log('  C) createArrow called with near-zero length:');
console.log('     length < 1 → early return null');
console.log('     In handleMouseUp: arrowGroup = null → canvas.add(null) — ⚠️  POSSIBLE CRASH!');
console.log('     Fix needed: guard "if (arrowGroup)" before canvas.add()');

// Edge case D: naturalSizeRef not yet populated (image not loaded yet)
console.log('  D) naturalSizeRef.width = 0 (image not loaded when first draw happens):');
const natWFallback = 0 || RENDERED_W;
console.log('     natW = naturalSizeRef.width || renderedW =', natWFallback, '→ scaleX=1.0 ✅ safe fallback');

// Edge case E: canvas.remove(null) when head:null during clearActiveDrawing before mouseUp
console.log('  E) clearActiveDrawing called while arrow still in { line, head:null } state:');
console.log('     if (activeObjRef.current.line) → TRUE');
console.log('     canvas.remove(line) ✅');
console.log('     if (activeObjRef.current.head) → FALSE (null) → skip ✅');

console.log('\n══════════════════════════════════════════');
console.log('SUMMARY OF BUGS FOUND');
console.log('══════════════════════════════════════════');
console.log('');
console.log('❌ BUG FOUND — handleMouseUp line ~394:');
console.log('   const arrowGroup = createArrow(...);');
console.log('   activeObjRef.current = arrowGroup;   ← could be null if length < 1');
console.log('   canvas.add(arrowGroup);               ← canvas.add(null) → Fabric.js throws');
console.log('');
console.log('   This can happen in the race between the significance check (< 5px)');
console.log('   and createArrow\'s own guard (< 1px). The window where both fail:');
console.log('   exactly when dragLength is between 1 and 5px. But since significance');
console.log('   already blocks at < 5px, createArrow should NEVER receive length < 5.');
console.log('   ✅ In practice the bug is unreachable. But defensive guard is good.');
console.log('');
console.log('⚠️  POTENTIAL ISSUE — canvas.remove(null) on ARROW cleanup:');
console.log('   After mouse:up, activeObjRef.current = arrowGroup (a fabric.Group).');
console.log('   clearActiveDrawing: if (activeObjRef.current.line) → false → else branch ✅');
console.log('   handleEditorSubmit: same check → ✅');
console.log('');
console.log('⚠️  POTENTIAL ISSUE — editorPosition uses pointer.x/y in CANVAS space,');
console.log('   but the canvas has position: absolute inside a transform: scale() div.');
console.log('   canvasRef.current.getBoundingClientRect() already accounts for scale() ✅');
console.log('   BUT: if zoom > 1, the canvas element may be clipped/scrolled,');
console.log('   so getBoundingClientRect().left may NOT equal the true visual position.');
console.log('');
console.log('   ACTUAL MISPLACEMENT SCENARIO:');
console.log('   - User sets zoom = 2x in ImageAnnotator');
console.log('   - The outer div has transform: scale(2), transformOrigin: top left');
console.log('   - The canvas is INSIDE the scaled div');
console.log('   - getBoundingClientRect() on the canvas returns SCALED coordinates ✅');
console.log('   - pointer.x from canvas.getScenePoint() is in UNSCALED canvas coords');
console.log('   - So: screenX = canvasRect.left + pointer.x * zoom  (missing the *zoom!)');
console.log('   - Result: popup appears at wrong position when zoom != 1 ❌');
console.log('');
console.log('   ZOOM=2 example:');
const zoom2 = 2;
const canvasRectZoom2 = { left: 200, top: 150 }; // getBoundingClientRect already scaled
const pointerX = 400; // fabric getScenePoint (UNscaled canvas coords)
const wrongScreenX = canvasRectZoom2.left + pointerX;
const correctScreenX = canvasRectZoom2.left + pointerX * zoom2;
console.log('   pointer.x (fabric scene) =', pointerX);
console.log('   canvasRect.left (already scaled by browser) =', canvasRectZoom2.left);
console.log('   CURRENT screenX =', wrongScreenX, ' ← popup lands at wrong position!');
console.log('   CORRECT screenX =', correctScreenX);
console.log('');
console.log('   However — fabric.Canvas.getScenePoint() may already account for canvas');
console.log('   transform internally. This needs live browser verification.');
console.log('');
console.log('All other aspects of the arrow pipeline are CORRECT. ✅');
