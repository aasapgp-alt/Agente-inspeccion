# DOCUMENTACIÓN DE INTERFAZ MOBILE-FIRST — PANTALLA DE INSPECCIÓN (AGENTE-INSPECTOR)

Fecha de actualización: 9 de Agosto, 2026  
Estado: **ETAPA 5 — NUEVA INTERFAZ MOBILE-FIRST DE INSPECCIÓN**  

---

## 1. Visión General

La **Pantalla de Captura de Inspección** (`/campo/inspeccion/[id]`) fue rediseñada como una interfaz táctil de alta velocidad para operar en campo bajo condiciones industriales adversas (uso con una sola mano, sol directo, poca iluminación, guantes ligeros y desconexión total a internet).

El diseño prioriza elementos de toque amplios, jerarquía visual de alto contraste en tema oscuro (`bg-slate-950`), soporte fluido para dictado de voz Web Speech API, compresión automática de fotografías en el cliente y persistencia garantizada en IndexedDB (Dexie).

---

## 2. Estructura de la Pantalla de Inspección

La pantalla sigue la estructura oficial exigida para el Modo Campo:

```
┌─────────────────────────────────────────────────────────┐
│ [STATUS BAR] Offline/Online · Sincronización · Reintentos│
├─────────────────────────────────────────────────────────┤
│ [ENCABEZADO]                                            │
│   ← Equipo             Código · Nombre              [...]│
├─────────────────────────────────────────────────────────┤
│ [TABS]                                                  │
│   [ INSPECCIÓN ]      [ HISTORIAL ]      [ ARCHIVOS ]   │
├─────────────────────────────────────────────────────────┤
│ [ESTADOS]                                               │
│   [ BUENO       · Sin anomalías                (✓) ]    │
│   [ REGULAR     · Requiere atención            ( ) ]    │
│   [ CRÍTICO     · Falla severa                 ( ) ]    │
│   [ FUERA RUTA  · Inaccesible                  ( ) ]    │
├─────────────────────────────────────────────────────────┤
│ [FOTOS]                                                 │
│   Evidencia Fotográfica                             0/20│
│   [ 📷 TOMAR FOTO ]                                     │
│   Categoría: [ Succión ] [ Impulsión ] [ General ]      │
│   [ Miniatura 1 ] [ Miniatura 2 ] [ Miniatura 3 ]       │
├─────────────────────────────────────────────────────────┤
│ [AUDIO]                                                 │
│   Nota de Voz / Audio                                0/5│
│   [ 🎙️ GRABAR AUDIO ]                                   │
│   [ ▶ Audio #1                                  (🗑️) ] │
├─────────────────────────────────────────────────────────┤
│ [OBSERVACIONES]                                         │
│   Observaciones                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │ Escriba o use el dictado de voz...           🎙️│   │
│   └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ [GUARDAR]                                               │
│   [ GUARDAR Y SIGUIENTE →                         ]     │
├─────────────────────────────────────────────────────────┤
│ [BOTTOM NAV] Inicio · Equipos · (+) · Historial · Menú  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Componentes y Especificaciones Técnicas

### 3.1 Encabezado (`EquipoHeader.jsx`)
- **Extremo Izquierdo**: Botón de retroceso táctil `← Equipo` (`<ArrowLeft />` + etiqueta `"Equipo"`) redirige a la lista o buscador.
- **Centro**: Identificador del activo formateado como `Código · Nombre` (ej. `107 · VENTILADOR 431-506`) utilizando el separador de punto medio `·`.
- **Extremo Derecho**: Botón de opciones (`<MoreHorizontal />`) para desplegar el `HistorialActivoModal`.

### 3.2 Control Segmentado de Pestañas
- **Pestañas**: `INSPECCIÓN` | `HISTORIAL` | `ARCHIVOS`.
- **Visualización Activa**: Fondo `#0284c7`, texto blanco en negrita `font-black` y sombra pronunciada.
- **Acción Historial**: Al presionar la pestaña `HISTORIAL` se activa la vista modal unificada con diagnósticos previos e IA Gemini.
- **Acción Archivos**: Muestra el resumen y conteo dinámico de evidencias multimedia adjuntas a la inspección actual.

### 3.3 Selector de Salud del Equipo (`BotonEstado.jsx`)
- **Opciones**: `BUENO`, `REGULAR`, `CRÍTICO`, `FUERA DE RUTA`.
- **Altura por Opción**: **52px** (Rango objetivo: 50–58px).
- **Separación Vertical**: **5px** (Rango objetivo: 4–6px).
- **Conservación de Lógica y Datos**:
  - `BUENO`: Fondo `#0f271f`, borde verde `#10b981`, subtexto `"Sin anomalías"`.
  - `REGULAR`: Fondo `#291f0d`, borde amarillo `#f59e0b`, subtexto `"Requiere atención"`.
  - `CRÍTICO`: Fondo `#2b1014`, borde rojo `#ef4444`, subtexto `"Falla severa"`.
  - `FUERA_DE_RUTA`: Fondo `#1e293b`, borde gris `#64748b`, subtexto `"Inaccesible"`.
- **Respuesta Tactil**: Haptics (`vibrar(20)`) al seleccionar.

### 3.4 Evidencia Fotográfica (`CapturaFoto.jsx`)
- **Encabezado y Contador**: Etiqueta `Evidencia Fotográfica` con badge numerado `0/20` (o `X/20`).
- **Área Principal / Botón**: Botón destacado `TOMAR FOTO` con icono de cámara y texto en mayúsculas.
- **Cámara & Almacenamiento**:
  - Atributo HTML `capture="environment"` para abrir la cámara trasera en dispositivos móviles.
  - Compresión en cliente via `browser-image-compression` (máx 0.5MB, 1024px, 65% calidad JPEG).
  - Persistencia local en `archivos_pendientes` de Dexie (IndexedDB).
- **Chips de Categoría**: Chips de selección `Succión`, `Impulsión` y `General` (`CategoriaEquipo.jsx`).
- **Galería de Miniaturas**: Grilla de 3 columnas con vista previa local `URL.createObjectURL`, badge de categoría y botón de eliminación individual con confirmación háptica.

### 3.5 Nota de Voz / Audio (`GrabadoraAudio.jsx`)
- **Encabezado y Contador**: Etiqueta `Nota de Voz / Audio` con badge numerado `0/5` (o `X/5`).
- **Botón Principal**: `GRABAR AUDIO` con icono de micrófono.
- **Modo Grabación**: Transición a `DETENER (00:15)` con animación pulsante roja y contador de segundos en tiempo real.
- **Funcionalidad**: Utiliza la API `MediaRecorder` del navegador guardando audio en formato WebM en `archivos_pendientes`. Reproducción integrada local con botón Play/Pause y eliminación.

### 3.6 Observaciones y Dictado de Voz (`Observaciones.jsx`)
- **Textarea Compacto**: 3 filas de alto con placeholder `Escriba o use el dictado de voz...`.
- **Dictado por Voz**: Botón de micrófono integrado utilizando la API nativa `SpeechRecognition` / `webkitSpeechRecognition`. Animación pulsante y respuesta háptica al activar.
- **Contador**: Muestra la cantidad de caracteres redactados.

### 3.7 Botón Guardar (`GuardarSiguiente.jsx`)
- **Texto**: `GUARDAR Y SIGUIENTE →`
- **Altura**: **50px** (Rango objetivo: 48–52px).
- **Ancho**: **100% (Ancho completo)**.
- **Color y Estilo**: Fondo verde esmeralda `#10b981`, texto blanco `font-black` y sombra elevada.
- **Lógica Manteniéndose**:
  1. Valida la selección obligatoria del estado de salud.
  2. Actualiza/crea el registro en IndexedDB `inspecciones_pendientes` asignando `estado_sync: 'pendiente'`.
  3. Si hay conectividad, gatilla la sincronización automática `forceSync()`.
  4. Despliega el modal de confirmación con opciones para avanzar al **Siguiente Equipo del Itinerario** o **Volver al Inicio**.

---

## 4. Adaptabilidad Responsive y Dispositivos Móviles

La pantalla de inspección fue validada para una respuesta ergonómica en las resoluciones móviles más comunes:

| Viewport (px) | Dispositivo de Referencia | Ajuste Aplicado |
| :--- | :--- | :--- |
| **360px** | Samsung Galaxy A series | Ajuste dinámico de padding horizontal (`px-3.5`), texto de tabs compacto y scroll sin desbordamiento. |
| **375px** | iPhone SE / iPhone 8 | Excelente legibilidad en selector de 52px y chips de categoría 3 columnas. |
| **390px** | iPhone 12/13/14 | Proporción táctil ideal sin recortes visuales. |
| **412px** | Google Pixel / Samsung S22 | Aprovechamiento total del ancho táctil. |
| **430px** | iPhone 14/15 Pro Max | Mantención del `max-w-md` centrado para evitar estiramiento excesivo. |

### Comportamiento con Teclado Abierto:
- El contenedor principal cuenta con scroll vertical independiente y espacio libre inferior (`pb-24`), evitando que el teclado virtual tape los botones de guardado o el input de notas.
- Al enfocar el textarea de observaciones, el navegador ajusta el scroll suavemente hacia el campo activo.

---

## 5. Matriz de No Modificación

Queda certificado que las siguientes capas del sistema no sufrieron alteración alguna durante la Etapa 5:
- **Backend FastAPI**: API REST, endpoints de auth, itinerarios, batch e inspecciones.
- **Base de Datos Local**: Esquema de Dexie / IndexedDB (`inspecciones_pendientes`, `archivos_pendientes`, `equipos_cache`).
- **Servicio de Sincronización**: Algoritmo de `sync.js` y conversión binaria.
- **Google Drive**: Integración y almacenamiento en la nube.
- **Página de Inicio (Home)**: `/campo/page.js` intacto.
