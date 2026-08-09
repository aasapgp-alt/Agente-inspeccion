# DOCUMENTACIÓN OFICIAL FINAL — MODO CAMPO (AGENTE-INSPECTOR)

Fecha de consolidación: **9 de Agosto, 2026**  
Estado: **ETAPA 10 — CONSOLIDACIÓN DEL DESIGN SYSTEM MOBILE (COMPLETADO)**  

---

## 1. Arquitectura Final

El sistema **Inspector PGP (Modo Campo)** adopta una arquitectura desacoplada en **5 capas conceptuales**, diseñada para garantizar operaciones offline resilientes, alto rendimiento en dispositivos móviles y una clara separación de responsabilidades:

```
┌────────────────────────────────────────────────────────┐
│ 1. PÁGINAS (frontend/app/campo/)                       │
│    - Coordinan estado, IndexedDB, routing y hooks      │
├────────────────────────────────────────────────────────┤
│ 2. COMPONENTES UI (frontend/components/campo/)         │
│    - Presentación visual pura, componentes de toque    │
├────────────────────────────────────────────────────────┤
│ 3. HOOKS / ESTADO (frontend/hooks/)                    │
│    - Reactividad global, estado de red y precarga      │
├────────────────────────────────────────────────────────┤
│ 4. SERVICES (frontend/services/)                       │
│    - Cliente API REST (api.js), headers JWT, retries   │
├────────────────────────────────────────────────────────┤
│ 5. UTILS / STORAGE (frontend/utils/)                   │
│    - Base de datos Dexie (db.js), Sync (sync.js),      │
│      Hápticos (haptics.js)                             │
└────────────────────────────────────────────────────────┘
```

---

## 2. Árbol Frontend Final

```
frontend/
├── app/
│   └── campo/
│       ├── page.js                      # Home Modo Campo (Dashboard Inspector)
│       ├── layout.js                    # Layout contenedor con metadata PWA
│       ├── campo.css                    # Definición de tokens visuales y animaciones
│       ├── buscar/
│       │   └── page.js                  # Buscador reactivo de activos en IndexedDB
│       ├── activo/[id]/
│       │   └── page.js                  # Ficha técnica compacta del equipo
│       └── inspeccion/[id]/
│           └── page.js                  # Captura de inspección, evidencia multimedia y guardado
│
├── components/
│   ├── DriveFolderSelector.jsx          # Wrapper de compatibilidad para Dashboard Desktop
│   └── campo/                           # Componentes especializados de Modo Campo (Sin archivos sueltos en raíz)
│       ├── layout/
│       │   ├── CampoShell.jsx           # Contenedor principal con ancho máximo y tema oscuro
│       │   ├── CampoHeader.jsx          # Header adaptable con saludo, usuario y notificaciones
│       │   └── CampoStatusBar.jsx       # Barra superior sticky de conectividad y sincronización
│       │
│       ├── home/
│       │   ├── UserCard.jsx             # Tarjeta de perfil del inspector
│       │   ├── EquipoSearch.jsx         # Input de búsqueda (50px) con autocompletado Dexie
│       │   ├── QuickActions.jsx         # Grilla 2x2 de accesos rápidos (52px)
│       │   ├── ActivitySummary.jsx      # Métricas reales de la jornada
│       │   ├── ItinerarioList.jsx       # Lista contenedora del itinerario asignado
│       │   └── ItinerarioCard.jsx       # Tarjeta individual con botón INSPECCIONAR (46px)
│       │
│       ├── inspeccion/
│       │   ├── EquipoHeader.jsx         # Encabezado con código, nombre y modal historial
│       │   ├── EstadoEquipo.jsx         # Selector canónico del estado de salud del activo (52px / 5px gap)
│       │   ├── EvidenciaFotos.jsx       # Módulo canónico de captura (0/20), compresión y galería
│       │   ├── CategoriaEquipo.jsx      # Chips de categoría (Succión, Impulsión, General)
│       │   ├── EvidenciaAudio.jsx       # Módulo canónico de grabación de voz (0/5) y reproductor
│       │   ├── Observaciones.jsx        # Textarea con dictado Web Speech API
│       │   └── GuardarSiguiente.jsx     # Botón verde (50px, 100%) y modal de confirmación
│       │
│       ├── drive/
│       │   ├── DriveMobile.jsx          # Drawer/Modal contenedor de Google Drive
│       │   ├── DriveFolderList.jsx      # Lista scrolleable de subcarpetas (56px)
│       │   ├── DriveFolderItem.jsx      # Fila individual de carpeta en Drive
│       │   └── DriveFolderActions.jsx   # Acciones: subir nivel, carpeta actual, crear
│       │
│       ├── navegacion/
│       │   ├── CampoBottomNav.jsx       # Navegación inferior fija canónica con safe area
│       │   └── CampoMenuDrawer.jsx      # Drawer lateral de perfil y logout
│       │
│       └── shared/
│           ├── BannerInstalacionPWA.jsx # Banner opcional de instalación PWA
│           ├── CampoBadge.jsx           # Badge canónico para estados de equipo y sync
│           ├── CampoButton.jsx          # Botón canónico con variantes (primary, secondary, success, etc.)
│           ├── CampoCard.jsx            # Tarjeta base canónica con variantes de padding y fondo
│           ├── CampoInput.jsx           # Input/Textarea canónico móvil con icono y botón de limpiado
│           ├── CampoSection.jsx         # Envoltorio canónico de sección con título y acción
│           ├── HistorialActivoModal.jsx # Modal de historial unificado (Dexie + Backend + IA Gemini)
│           └── index.js                 # Exportador unificado de componentes compartidos
```

---

## 3. Componentes Campo

Los componentes visuales del Modo Campo operan bajo las siguientes premisas:
- **Tema Oscuro Industrial**: Fondos `#090d16` y `#131c2e` con bordes `#1e293d` de alto contraste.
- **Áreas Táctiles Amplias**: Objetivos de toque de entre 46px y 52px para operar con una sola mano o guantes ligeros.
- **Feedback Háptico**: Invocaciones integradas a `vibrar(ms)` en cada interacción para confirmar acciones sin dependencia visual exclusiva.
- **Pureza Visual**: Reciben datos y eventos via props, evitando acoplamiento directo a llamadas HTTP REST o IndexedDB.

---

## 4. Home (`app/campo/page.js`)

Secuencia de renderizado vertical verificada:
1. **Estado ONLINE/OFFLINE (`CampoStatusBar.jsx`)**: Badge reactivo superior sticky, conteo de borradores y botón manual de sync.
2. **Usuario Inspector (`CampoHeader.jsx` & `UserCard.jsx`)**: Saludo personalizado y datos del usuario obtenidos de `apiService.getCurrentUser()`.
3. **Buscar Equipo (`EquipoSearch.jsx`)**: Input de 50px de altura (`h-[50px]`) con dropdown de autocompletado en tiempo real desde `equipos_cache` de Dexie.
4. **Accesos Rápidos (`QuickActions.jsx`)**: Grilla 2x2 con tarjetas de 52px (`h-[52px]`) para *Equipos*, *Historial*, *Drive Planta* y *Pendientes*.
5. **Estado de Actividades (`ActivitySummary.jsx`)**: Contadores strictly evaluados (`pendingCount ?? 0`, `completedTodayCount ?? 0`) sin valores ficticios de demo.
6. **Mi Itinerario de Hoy (`ItinerarioList.jsx` & `ItinerarioCard.jsx`)**: Tarjetas de equipos asignados con botón azul principal **INSPECCIONAR** de 46px (`h-[46px]`).

---

## 5. Inspección (`app/campo/inspeccion/[id]/page.js`)

Secuencia y módulos verificados:
1. **Encabezado (`EquipoHeader.jsx`)**: Botón `← Equipo`, identificador `Código · Nombre` y botón de opciones/historial.
2. **Control Segmentado**: Pestañas `INSPECCIÓN` | `HISTORIAL` | `ARCHIVOS`.
3. **Selector de Salud (`BotonEstado.jsx`)**: Tarjetas de 52px de altura con 5px de separación vertical (`BUENO`, `REGULAR`, `CRÍTICO`, `FUERA DE RUTA`).
4. **Evidencia Fotográfica (`CapturaFoto.jsx`)**: Badge `0/20`, botón `TOMAR FOTO` (cámara trasera `capture="environment"`), chips de categoría (*Succión*, *Impulsión*, *General*) y galería de miniaturas con compresión local JPEG.
5. **Nota de Voz / Audio (`GrabadoraAudio.jsx`)**: Badge `0/5`, botón `GRABAR AUDIO`, temporizador en tiempo real y almacenamiento WebM local.
6. **Observaciones (`Observaciones.jsx`)**: Textarea compacto con dictado por voz mediante Web Speech API native (`SpeechRecognition`).
7. **Guardar y Siguiente (`GuardarSiguiente.jsx`)**: Botón verde esmeralda de 50px de altura y 100% de ancho, con modal de confirmación para avanzar al siguiente equipo o volver al inicio.

---

## 6. Drive (`DriveMobile.jsx`)

Especificación de la interfaz de exploración de Google Drive:
- **Modo Responsive**: Fullscreen (`100% x 100dvh`) en smartphones y modal centrado (`max-w-lg`) con backdrop blur en desktop.
- **Encabezado**: Retorno `←`, título `"Drive / Planta"` y botón de cierre `X`.
- **Carpeta Seleccionada**: Indicador de carpeta activa y badge de estado verde `"Conectado"`.
- **Lista de Carpetas (`DriveFolderList.jsx`)**: Filas de 56px (`h-[56px]`) con chevron derecho para navegación descendente.
- **Acciones (`DriveFolderActions.jsx`)**: Tres botones de 50px (`↑ Subir nivel`, `📌 Carpeta actual`, `＋ Nueva carpeta`).
- **Confirmación**: Botón verde esmeralda `CONFIRMAR Y USAR CARPETA` de 50px de altura.

---

## 7. Navegación (`CampoBottomNav.jsx` & `CampoMenuDrawer.jsx`)

- **CampoBottomNav**: Barra fija en el borde inferior con 4 accesos principales y botón central flotante `(+)` para foco en el buscador de equipos. Incluye soporte para la zona segura del dispositivo (`env(safe-area-inset-bottom)`).
- **CampoMenuDrawer**: Drawer deslizable lateral con información detallada de la sesión, acceso directo a la carpeta de Drive de planta y modal con confirmación para cierre de sesión.

---

## 8. Hooks (`frontend/hooks/`)

- **`useOnlineStatus`**: Detecta cambios en la conectividad del navegador (`window.addEventListener('online'/'offline')`), consulta contadores reactivos en Dexie (`inspecciones_pendientes`) y desencadena la sincronización en segundo plano mediante `forceSync()`.
- **`usePreCargaInicial`**: Descarga en segundo plano y cachea en Dexie los catálogos de equipos e itinerarios al iniciar la sesión.

---

## 9. Services (`frontend/services/api.js`)

Centraliza todas las peticiones HTTP REST hacia el backend Python / FastAPI:
- Manejo automático de headers `Authorization: Bearer <token>`.
- Métodos especializados para autenticación (`login`, `getCurrentUser`), equipos (`getEquipos`), itinerarios (`getItinerario`), inspecciones (`getInspeccionesEquipo`, `subirInspeccionesBatch`) y Google Drive (`getDriveRoot`, `getDriveCarpetas`, `crearDriveCarpeta`).
- Manejo estandarizado de errores HTTP y respuestas fallback.

---

## 10. Utils (`frontend/utils/`)

- **`db.js`**: Definición de tablas en IndexedDB via Dexie (`equipos_cache`, `itinerario_cache`, `inspecciones_pendientes`, `archivos_pendientes`).
- **`sync.js`**: Algoritmo de sincronización que transforma imágenes/audios en Base64 y envía lotes mediante la API `/api/inspecciones/batch`.
- **`haptics.js`**: Wrapper para la API `navigator.vibrate` (`vibrar`, `vibrarExito`, `vibrarError`).

---

## 11. Offline (Dexie & IndexedDB)

- Permite capturar e inspeccionar equipos con desconexión total a internet.
- Los borradores se guardan con `estado_sync: 'borrador'`.
- Al presionar **GUARDAR Y SIGUIENTE**, el estado cambia a `estado_sync: 'pendiente'`.
- Los archivos multimedia (fotos y audios) se almacenan como `Blob` en la tabla `archivos_pendientes` vinculados por el ID local de la inspección.

---

## 12. Sincronización (`sync.js` & Backend `/api/inspecciones/batch`)

1. Al recuperar la señal de red (`isOnline === true`), `useOnlineStatus` invoca `forceSync()`.
2. `sync.js` lee todas las inspecciones con `estado_sync: 'pendiente'`.
3. Convierte los blobs de fotos y audios a cadenas Base64.
4. Envía un objeto JSON al endpoint del backend `/api/inspecciones/batch`.
5. El backend actualiza la tabla SQLite `inspecciones`, guarda imágenes en el sistema de archivos, transcribe los audios mediante Gemini IA y marca los registros locales como `sincronizado: true`.

---

## 13. Reglas para Futuras Modificaciones (REGLA DE ORO)

> [!IMPORTANT]
> **REGLA DE ORO DEL MODO CAMPO**:
> A partir de la finalización de la Etapa 10, cualquier futura modificación visual o ajuste de interfaz debe realizarse **preferentemente modificando**:
>
> `frontend/components/campo/shared/`
>
> **Sin tener que editar individualmente cada pantalla**, y **Sin modificar**:
> - `frontend/services/`
> - `frontend/utils/`
> - `backend app/`
>
> salvo que exista una necesidad funcional o de API expresamente justificada.

---

## 14. Problemas Conocidos

1. **Compresión de Imágenes en Dispositivos Antiguos**: En smartphones de gama baja con menos de 2GB RAM, la compresión simultánea de más de 10 fotografías en HD puede ocasionar lentitud puntual en la UI. Se recomienda mantener el límite predeterminado de 20 fotos por inspección.
2. **Dictado por Voz Web Speech API**: Depende del soporte del navegador del dispositivo (Google Chrome Mobile y Safari iOS cuentan con soporte nativo completo, navegadores secundarios pueden requerir fallback de teclado).

---

## 15. Consolidación de Componentes (Etapa 9)

En la Etapa 9 se llevó a cabo la **auditoría y consolidación arquitectónica** de `frontend/components/campo/`. Se eliminaron wrappers vacíos, componentes proxy y redundancias en la raíz del directorio, garantizando que **exista un único componente canónico para cada responsabilidad**.

---

## 16. Consolidación del Design System Mobile y Corrección de Regresión Visual (Etapa 10)

En la Etapa 10 se consolidó el **Design System Visual** para todo el Modo Campo, centralizando tokens visuales, componentes de interfaz y solucionando la regresión visual observada mediante el ajuste fino de la cascada CSS y la especificidad.

### Matriz de Diagnóstico y Corrección de la Regresión Visual:

| Area / Component | Root Cause | Fix Applied |
| :--- | :--- | :--- |
| **Tailwind Config** | `corePlugins: { preflight: false }` was removed during DS consolidation, causing Tailwind CSS base resets to inject global styles on `button`, `svg`, `div`, etc. | Re-enabled `corePlugins: { preflight: false }` in [tailwind.config.js](file:///c:/Agente-Inspector/frontend/tailwind.config.js). |
| **Global CSS Rules** | `@import "tailwindcss";` (v4 directive) was added to `globals.css`, and `CampoShell` lacked `.campo-wrapper` class, causing desktop button styles to target field mode elements. | Added `@import "tailwindcss";`, `@config "../tailwind.config.js";` and `@source "../components";` in [globals.css](file:///c:/Agente-Inspector/frontend/app/globals.css), ensuring `.campo-wrapper` is present in [CampoShell.jsx](file:///c:/Agente-Inspector/frontend/components/campo/layout/CampoShell.jsx). |
| **Touch Area Helper** | `.touch-target` in `campo.css` enforced `display: inline-flex !important`, overriding element flex layouts and stretching compact controls. | Removed `display: inline-flex; align-items: center; justify-content: center;` from `.touch-target` in [campo.css](file:///c:/Agente-Inspector/frontend/app/campo/campo.css). |
| **Card Variant Logic** | `CampoCard.jsx` ignored variant classes (`secondary`, `outline`) when `interactive={true}`. | Updated `cardClass` calculation in [CampoCard.jsx](file:///c:/Agente-Inspector/frontend/components/campo/shared/CampoCard.jsx) to combine base variant classes with interactive state. |
| **Quick Actions Grid** | Wrapper `<button>` tags for Drive and Pendientes inherited desktop button padding and backgrounds. | Added transparent reset classes (`bg-transparent border-0 p-0 shadow-none outline-none cursor-pointer block`) to [QuickActions.jsx](file:///c:/Agente-Inspector/frontend/components/campo/home/QuickActions.jsx). |
| **Search Control** | Search submit icon button rendered as a separate white button inside `<form>`. | Applied transparent button resets in [EquipoSearch.jsx](file:///c:/Agente-Inspector/frontend/components/campo/home/EquipoSearch.jsx). |
| **Status Bar** | Retry/Sync buttons used `touch-target min-h-[44px]`, stretching the compact sticky bar. | Removed `touch-target min-h-[44px]` from [CampoStatusBar.jsx](file:///c:/Agente-Inspector/frontend/components/campo/layout/CampoStatusBar.jsx). |
| **Itinerario Card** | `[ INSPECCIONAR ]` button was partially obscured by fixed bottom navigation. | Increased bottom padding to `pb-28` in [CampoShell.jsx](file:///c:/Agente-Inspector/frontend/components/campo/layout/CampoShell.jsx). |

### Logros y Entregables de la Etapa 10:
1. **Tokens Visuales Centralizados (`campo.css`)**:
   - Variables CSS `--campo-*` para superficie (`#131c2e`), fondo (`#090d16`), bordes, textos y acciones principales (`#0284c7`).
   - Tokens de estado unificados para salud de activo (`Bueno`, `Regular`, `Crítico`, `Fuera de Ruta`) y conectividad (`Online`, `Offline`, `Pendiente`, `Completado`).
2. **Componentes Shared Extendidos**:
   - `CampoButton.jsx`: Matriz completa de variantes (`primary`, `secondary`, `success`, `warning`, `danger`, `ghost`, `outline`), tamaños (`small`, `medium`, `large`) y área táctil `>= 44px`.
   - `CampoCard.jsx`: Presets de padding, variantes de fondo y estados interactivos.
   - `CampoSection.jsx`: Cabeceras normalizadas con tipografía uppercase y slots de acción.
   - `CampoInput.jsx`: Input y textarea móvil estandarizado con icono leading, botón de limpiado y garantía de toque táctil.
   - `CampoBadge.jsx`: Indicador de estado unificado para activos y sincronización local/remota.
3. **Migración Progresiva y Estabilización Visual**:
   - Enlazado de las pantallas de **Home**, **Inspección**, **Drive**, **Navegación** y **Layout** a los componentes shared sin alterar la lógica de negocio ni el backend.
4. **Documentación Oficial**:
   - Creada guía completa [docs/MOBILE_UI_DESIGN_SYSTEM.md](file:///c:/Agente-Inspector/docs/MOBILE_UI_DESIGN_SYSTEM.md).

