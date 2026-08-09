# MIGRACIÓN DE COMPONENTES — MODO CAMPO (AGENTE-INSPECTOR)

Documento oficial de registro de migración modular y separación de componentes para el frontend de **Modo Campo** (Etapa 3).

---

## 1. Resumen Ejecutivo de Migración

En la Etapa 3 se completó la extracción e independización modular de todos los elementos de la interfaz móvil de Modo Campo en la nueva estructura `frontend/components/campo/`.

El objetivo principal fue **separar responsabilidades** preservando el 100% de la lógica de negocio, IndexedDB, servicios API, algoritmos de sincronización y estilos visuales actuales.

---

## 2. Matriz Consolidada de Migración de Componentes

### 2.1 Módulo HOME (`frontend/components/campo/home/` y `layout/`)

| Componente Original | Componente Nuevo | Ubicación | Responsabilidades | Dependencias | Estado / Pendientes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bloque Header en `app/campo/page.js` | **`CampoHeader.jsx`** | `frontend/components/campo/layout/` | Encabezado adaptable con saludo al inspector, indicador de estado online/offline y botón de notificaciones. | `lucide-react`, `UserCard` | ✅ Extraído e integrado |
| Bloque Perfil en `CampoHeader.jsx` | **`UserCard.jsx`** | `frontend/components/campo/home/` | Renderizado aislado de la tarjeta de usuario inspector (avatar, rol, nombre completo). | `lucide-react` | ✅ Extraído e integrado |
| Buscador en `app/campo/page.js` | **`EquipoSearch.jsx`** | `frontend/components/campo/home/` | Input de búsqueda con envío por formulario y dropdown autocompletado en tiempo real. | `lucide-react`, `haptics`, `next/link` | ✅ Extraído e integrado |
| Grilla Accesos en `app/campo/page.js` | **`QuickActions.jsx`** | `frontend/components/campo/home/` | Grilla 2x2 para accesos rápidos (Equipos, Historial, Drive Planta, Pendientes). | `lucide-react`, `haptics`, `next/link` | ✅ Extraído e integrado |
| Resumen Actividades en `app/campo/page.js` | **`ActivitySummary.jsx`** | `frontend/components/campo/home/` | Tarjetas de resumen de métricas (Inspecciones pendientes en cola y completadas hoy). | `lucide-react` | ✅ Extraído e integrado |
| Lista Itinerario en `app/campo/page.js` | **`ItinerarioList.jsx`** | `frontend/components/campo/home/` | Envoltorio contenedor de la lista de itinerario asignado con spinner de precarga. | `lucide-react`, `ItinerarioCard` | ✅ Extraído e integrado |
| Tarjeta Equipo Itinerario | **`ItinerarioCard.jsx`** | `frontend/components/campo/home/` | Tarjeta individual de equipo asignado en itinerario con botón de acción "INSPECCIONAR". | `haptics`, `next/link` | ✅ Extraído e integrado |

---

### 2.2 Módulo INSPECCIÓN (`frontend/components/campo/inspeccion/`)

| Componente Original | Componente Nuevo | Ubicación | Responsabilidades | Dependencias | Estado / Pendientes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Encabezado en `app/campo/inspeccion/[id]/page.js` | **`EquipoHeader.jsx`** | `frontend/components/campo/inspeccion/` | Encabezado compacto con código del activo, nombre, botón volver y menú de opciones/historial. | `lucide-react`, `haptics` | ✅ Extraído e integrado |
| Selector Estado en `app/campo/inspeccion/[id]/page.js` | **`EstadoEquipo.jsx`** | `frontend/components/campo/inspeccion/` | Contenedor principal de selección de salud del equipo (Bueno, Regular, Crítico). | `BotonEstado` | ✅ Extraído e integrado |
| Opción de Estado en `BotonEstado.jsx` | **`EstadoEquipoOption.jsx`** | `frontend/components/campo/inspeccion/` | Renderizado individual de tarjeta de opción de estado con iconos y bordes dinámicos. | `lucide-react`, `haptics` | ✅ Extraído e integrado |
| Módulo Cámara en `app/campo/inspeccion/[id]/page.js` | **`EvidenciaFotos.jsx`** | `frontend/components/campo/inspeccion/` | Envoltorio del módulo de captura de fotos y selección de categoría de evidencia. | `CapturaFoto` | ✅ Extraído e integrado |
| Chips Categoría en `CapturaFoto.jsx` | **`CategoriaEquipo.jsx`** | `frontend/components/campo/inspeccion/` | Chips selecciones de categoría de foto ('Succión', 'Impulsión', 'General'). | `haptics` | ✅ Extraído e integrado |
| Módulo Audio en `app/campo/inspeccion/[id]/page.js` | **`EvidenciaAudio.jsx`** | `frontend/components/campo/inspeccion/` | Envoltorio del módulo de grabación y reproducción de notas de voz. | `GrabadoraAudio` | ✅ Extraído e integrado |
| Observaciones en `app/campo/inspeccion/[id]/page.js` | **`Observaciones.jsx`** | `frontend/components/campo/inspeccion/` | Área de texto para notas con botón integrado de dictado por voz (Web Speech API). | `lucide-react` | ✅ Extraído e integrado |
| Botón Guardar / Modal en `app/campo/inspeccion/[id]/page.js` | **`GuardarSiguiente.jsx`** | `frontend/components/campo/inspeccion/` | Botón principal de guardado y modal emergente de confirmación y navegación. | `lucide-react`, `haptics` | ✅ Extraído e integrado |

---

### 2.3 Módulo DRIVE (`frontend/components/campo/drive/`)

| Componente Original | Componente Nuevo | Ubicación | Responsabilidades | Dependencias | Estado / Pendientes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Selector Drive en `app/campo/page.js` | **`DriveMobile.jsx`** | `frontend/components/campo/drive/` | Drawer/Modal principal de exploración e interacción con Google Drive de planta. | `apiService`, `haptics`, `DriveFolderList`, `DriveFolderActions` | ✅ Extraído e integrado |
| Lista Carpetas en `DriveMobile.jsx` | **`DriveFolderList.jsx`** | `frontend/components/campo/drive/` | Renderizado de lista scrolleable de subcarpetas en el nivel actual con indicador de carga. | `lucide-react`, `DriveFolderItem` | ✅ Extraído e integrado |
| Fila Carpeta en `DriveMobile.jsx` | **`DriveFolderItem.jsx`** | `frontend/components/campo/drive/` | Fila individual de carpeta con evento de selección y navegación descendente. | `lucide-react`, `haptics` | ✅ Extraído e integrado |
| Panel Acciones en `DriveMobile.jsx` | **`DriveFolderActions.jsx`** | `frontend/components/campo/drive/` | Acciones: Subir un nivel, seleccionar carpeta actual y formulario de creación de carpetas. | `lucide-react`, `haptics` | ✅ Extraído e integrado |

---

### 2.4 Módulo NAVEGACIÓN (`frontend/components/campo/navegacion/`)

| Componente Original | Componente Nuevo | Ubicación | Responsabilidades | Dependencias | Estado / Pendientes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Barra Inferior Móvil | **`CampoBottomNav.jsx`** | `frontend/components/campo/navegacion/` | Barra de navegación fija inferior móvil con botón central flotante (+) para rápida captura. | `lucide-react`, `haptics`, `next/navigation`, `next/link` | ✅ Centralizado y reutilizado |
| Menú Lateral Inspector | **`CampoMenuDrawer.jsx`** | `frontend/components/campo/navegacion/` | Drawer lateral con información de sesión del inspector, acceso a Drive y modal de confirmación de Logout. | `lucide-react`, `haptics` | ✅ Centralizado y reutilizado |

---

## 3. Registro de Componentes Auxiliares y Reutilizados

| Componente | Ubicación Actual | Uso en Arquitectura |
| :--- | :--- | :--- |
| **`BadgeEstadoSync.jsx`** | `frontend/components/campo/` | Consumido por `CampoStatusBar.jsx` para visualización del estado de sincronización offline/online. |
| **`BotonEstado.jsx`** | `frontend/components/campo/` | Consumido por `EstadoEquipo.jsx` para el selector de salud técnica del equipo. |
| **`CapturaFoto.jsx`** | `frontend/components/campo/` | Consumido por `EvidenciaFotos.jsx` como motor de compresión y captura de imágenes. |
| **`GrabadoraAudio.jsx`** | `frontend/components/campo/` | Consumido por `EvidenciaAudio.jsx` como grabador HTML5/WebAudio. |
| **`HistorialActivoModal.jsx`**| `frontend/components/campo/` | Consumido en `app/campo/inspeccion/[id]/page.js` y `app/campo/activo/[id]/page.js`. |
| **`DriveFolderSelector.jsx`**| `frontend/components/` | Mantendido como wrapper de compatibilidad para la interfaz Desktop (`Sidebar.jsx`). |

---

## 4. Componentes Pendientes para Etapas Posteriores

1. **`BannerInstalacionPWA.jsx`**:
   - Módulo para sugerir instalación PWA en iOS/Android. Se mantendrá como componente secundario para ser integrado en el rediseño visual (Etapa 4).
2. **Rediseño Visual (Etapa 4)**:
   - Toda modificación estética de tipografía, colores Tailwind y espaciados se realizará de forma limpia sobre los componentes en `frontend/components/campo/` sin necesidad de alterar las páginas en `app/campo/`.
