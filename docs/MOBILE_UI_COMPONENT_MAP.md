# MAPA DE COMPONENTES DEL MODO CAMPO — INSPECTOR PGP

Este documento detalla el mapa consolidado de componentes de la arquitectura del **Modo Campo**, especificando la ubicación, responsabilidad, invocadores y estado de cada componente.

---

## Mapa General de Componentes (`frontend/components/campo/`)

| Componente | Ubicación | Responsabilidad | Usado por | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **`CampoShell`** | `layout/` | Contenedor principal con tema oscuro, ancho máximo móvil (430px) y centrado horizontal. | `/campo`, `/campo/inspeccion/[id]` | CANÓNICO |
| **`CampoHeader`** | `layout/` | Encabezado superior con avatar, saludo al inspector, planta activa y estado de red. | `/campo` | CANÓNICO |
| **`CampoStatusBar`** | `layout/` | Barra superior sticky de estado de red (online/offline) y cola de sincronización. | `/campo`, `/campo/inspeccion/[id]` | CANÓNICO |
| **`UserCard`** | `home/` | Tarjeta de perfil compacto del usuario e información de la jornada. | `/campo` | CANÓNICO |
| **`EquipoSearch`** | `home/` | Input de búsqueda reactivo en IndexedDB con autocompletado en tiempo real. | `/campo` | CANÓNICO |
| **`QuickActions`** | `home/` | Grilla 2x2 de accesos directos principales (Escanear QR, Drive, Offline, Ayuda). | `/campo` | CANÓNICO |
| **`ActivitySummary`** | `home/` | Panel de métricas e indicadores de la jornada del inspector (inspeccionados/pendientes). | `/campo` | CANÓNICO |
| **`ItinerarioList`** | `home/` | Lista scrolleable de tarjetas de itinerarios asignados. | `/campo` | CANÓNICO |
| **`ItinerarioCard`** | `home/` | Tarjeta individual de equipo asignado con estado y acción de inspeccionar. | `home/ItinerarioList` | CANÓNICO |
| **`EquipoHeader`** | `inspeccion/` | Encabezado con tag de código, nombre del activo y disparador del modal de historial. | `/campo/inspeccion/[id]` | CANÓNICO |
| **`EstadoEquipo`** | `inspeccion/` | Selector interactivo de estado de salud (`BUENO`, `REGULAR`, `CRÍTICO`, `FUERA DE RUTA`). | `/campo/inspeccion/[id]` | CANÓNICO |
| **`EvidenciaFotos`** | `inspeccion/` | Módulo completo de captura con cámara trasera, compresión JPEG, selector de categoría y galería. | `/campo/inspeccion/[id]` | CANÓNICO |
| **`CategoriaEquipo`** | `inspeccion/` | Chips de categoría fotográfica (`Succión`, `Impulsión`, `General`). | `inspeccion/EvidenciaFotos` | CANÓNICO |
| **`EvidenciaAudio`** | `inspeccion/` | Grabadora de notas de voz con micrófono web, temporizador, reproducción y eliminación. | `/campo/inspeccion/[id]` | CANÓNICO |
| **`Observaciones`** | `inspeccion/` | Textarea con dictado reactivo mediante Web Speech API. | `/campo/inspeccion/[id]` | CANÓNICO |
| **`GuardarSiguiente`** | `inspeccion/` | Botón táctil principal (100% ancho, 50px alto) y modal de confirmación de guardado. | `/campo/inspeccion/[id]` | CANÓNICO |
| **`DriveMobile`** | `drive/` | Modal/Drawer deslizable de navegación por Google Drive y carpetas de planta. | `/campo`, `navegacion/CampoMenuDrawer` | CANÓNICO |
| **`DriveFolderList`** | `drive/` | Lista contenedora de carpetas de Google Drive. | `drive/DriveMobile` | CANÓNICO |
| **`DriveFolderItem`** | `drive/` | Item individual de carpeta de Drive con acción de navegación. | `drive/DriveFolderList` | CANÓNICO |
| **`DriveFolderActions`** | `drive/` | Acciones de carpeta (crear subcarpeta, subir nivel, seleccionar). | `drive/DriveMobile` | CANÓNICO |
| **`CampoBottomNav`** | `navegacion/` | Navegación inferior fija con 4 pestañas y botón flotante central `(+)`. | `/campo`, `/campo/inspeccion/[id]` | CANÓNICO |
| **`CampoMenuDrawer`** | `navegacion/` | Drawer lateral desplegable con menú del sistema, datos de usuario y logout. | `/campo` | CANÓNICO |
| **`HistorialActivoModal`** | `shared/` | Modal emergente con historial histórico combinado de IndexedDB y backend. | `/campo/inspeccion/[id]`, `/campo/activo/[id]` | CANÓNICO |
| **`BannerInstalacionPWA`** | `shared/` | Banner transversal opcional para prompt de instalación PWA en dispositivos móviles. | Reutilizable | CANÓNICO |
| **`CampoButton`** | `shared/` | Botón base reutilizable con variantes de estilo y feedback háptico. | Componentes de Modo Campo | CANÓNICO |
| **`CampoCard`** | `shared/` | Contenedor tarjeta base con bordes oscuros y sombra. | Componentes de Modo Campo | CANÓNICO |
| **`CampoSection`** | `shared/` | Sección contenedora con título e icono decorativo. | Componentes de Modo Campo | CANÓNICO |

---

## Componentes Consolidados / Eliminados durante la Etapa 9

| Componente Anterior | Destino de Consolidation | Motivo de Eliminación / Reubicación | Estado Actual |
| :--- | :--- | :--- | :--- |
| `frontend/components/campo/CampoBottomNav.jsx` | `navegacion/CampoBottomNav.jsx` | Re-exportación proxy innecesaria. Se mantuvo únicamente la implementación canónica en `navegacion/`. | ELIMINADO |
| `frontend/components/campo/BotonEstado.jsx` | `inspeccion/EstadoEquipo.jsx` | Componente de raíz obsoleto. Su lógica de configuración y renderizado de botones de estado fue inlinada en `EstadoEquipo.jsx`. | ELIMINADO |
| `frontend/components/campo/inspeccion/EstadoEquipoOption.jsx` | `inspeccion/EstadoEquipo.jsx` | Subcomponente duplicado no utilizado en la aplicación. Reemplazado totalmente por `EstadoEquipo.jsx`. | ELIMINADO |
| `frontend/components/campo/BadgeEstadoSync.jsx` | `layout/CampoStatusBar.jsx` | Componente de raíz que solo servía a `CampoStatusBar`. Su lógica fue inlinada dentro de `CampoStatusBar.jsx`. | ELIMINADO |
| `frontend/components/campo/CapturaFoto.jsx` | `inspeccion/EvidenciaFotos.jsx` | Componente de raíz de captura fotográfica inlinado en `EvidenciaFotos.jsx` para eliminar wrappers vacíos. | ELIMINADO |
| `frontend/components/campo/GrabadoraAudio.jsx` | `inspeccion/EvidenciaAudio.jsx` | Componente de raíz de grabación inlinado en `EvidenciaAudio.jsx` para eliminar wrappers vacíos. | ELIMINADO |
| `frontend/components/campo/HistorialActivoModal.jsx` | `shared/HistorialActivoModal.jsx` | Movido a `shared/` al ser utilizado de forma transversal por múltiples páginas (`inspeccion` y `activo`). | REUBICADO |
| `frontend/components/campo/BannerInstalacionPWA.jsx` | `shared/BannerInstalacionPWA.jsx` | Movido a `shared/` como componente transversal para instalación de PWA. | REUBICADO |
