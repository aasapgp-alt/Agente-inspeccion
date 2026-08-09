# ARQUITECTURA DEL FRONTEND — MODO CAMPO (AGENTE-INSPECTOR)

Documento oficial de arquitectura para la interfaz **Modo Campo** (PWA Mobile-First) del sistema **Inspector PGP**.

---

## 1. Principio Arquitectónico Fundacional

El frontend se organiza siguiendo una separación estricta en 5 capas conceptuales:

```
PÁGINAS (app/campo/)
    │
    ▼
COMPONENTES UI (components/campo/)
    │
    ▼
HOOKS / ESTADO (hooks/)
    │
    ▼
SERVICES (services/)
    │
    ▼
UTILS / STORAGE (utils/)
```

### Reglas de Responsabilidad por Capa:
1. **PÁGINAS (`frontend/app/campo/`)**:
   - Coordinan la carga y reactividad de datos.
   - Utilizan los custom hooks de red y la base de datos local IndexedDB.
   - Componen las vistas uniendo subcomponentes visuales.
   - Manejan la navegación del usuario (`useRouter`).
   - **Prohibido**: Incluir llamadas HTTP `fetch` directas ni lógica visual monolítica.

2. **COMPONENTES UI (`frontend/components/campo/`)**:
   - Responsables exclusivamente del renderizado de la interfaz y captura de eventos UI.
   - Reciben datos y funciones mediante props puras.
   - Divididos por módulos funcionales (`layout/`, `home/`, `inspeccion/`, `drive/`, `navegacion/`, `shared/`).
   - **Prohibido**: Ejecutar llamadas API REST o mutar el estado global sin pasar por props/callbacks.

3. **HOOKS / ESTADO (`frontend/hooks/`)**:
   - Encapsulan lógica reactiva reutilizable (estado de red `useOnlineStatus`, precarga en IndexedDB `usePreCargaInicial`).
   - Escuchan eventos globales y sincronizan la reactividad entre Dexie y la UI.

4. **SERVICES (`frontend/services/`)**:
   - Centralizan la comunicación REST HTTP con el backend mediante `apiService` (`api.js`).
   - Manejan cabeceras de autorización JWT, reintentos de red y fallbacks estructurados.

5. **UTILS / STORAGE (`frontend/utils/`)**:
   - `db.js`: Esquema de IndexedDB (Dexie) para almacenamiento offline de borradores, equipos e itinerarios.
   - `haptics.js`: Retroalimentación háptica táctil del dispositivo (`vibrar`).
   - `sync.js`: Algoritmo de sincronización en segundo plano y conversión de binarios.

---

## 2. Estructura Completa de Directorios y Componentes

```
frontend/
├── app/
│   └── campo/
│       ├── page.js                      # Home Modo Campo (Dashboard Inspector)
│       ├── layout.js                    # Layout contenedor de la sección Campo
│       ├── campo.css                    # Estilos específicos de Modo Campo
│       ├── buscar/
│       │   └── page.js                  # Buscador reactivo de activos en tiempo real
│       ├── activo/[id]/
│       │   └── page.js                  # Ficha técnica compacta del equipo
│       └── inspeccion/[id]/
│           └── page.js                  # Captura de inspección, evidencia multimedia y guardado
│
├── components/
│   ├── DriveFolderSelector.jsx          # Pass-through de compatibilidad para Dashboard Desktop
│   └── campo/                           # Componentes especializados de Modo Campo
│       ├── layout/
│       │   ├── CampoShell.jsx           # Contenedor shell con ancho máximo y tema oscuro
│       │   ├── CampoHeader.jsx          # Header adaptable con saludo, usuario y notificaciones
│       │   └── CampoStatusBar.jsx       # Envoltorio del indicador de conectividad y sincronización
│       │
│       ├── home/
│       │   ├── UserCard.jsx             # Tarjeta independiente de usuario inspector
│       │   ├── EquipoSearch.jsx         # Campo de búsqueda (50px) con autocompletado en tiempo real
│       │   ├── QuickActions.jsx         # Grilla 2x2 de accesos rápidos (52px)
│       │   ├── ActivitySummary.jsx      # Tarjetas de resumen de actividades (valores reales ?? 0)
│       │   ├── ItinerarioList.jsx       # Contenedor de lista de itinerario asignado
│       │   └── ItinerarioCard.jsx       # Tarjeta individual de itinerario con botón INSPECCIONAR (46px)
│       │
│       ├── inspeccion/
│       │   ├── EquipoHeader.jsx         # Encabezado con código, nombre y opciones del equipo
│       │   ├── EstadoEquipo.jsx         # Envoltorio selector del estado de salud
│       │   ├── EstadoEquipoOption.jsx   # Opción individual de estado de salud
│       │   ├── EvidenciaFotos.jsx       # Módulo de captura y galería de fotos
│       │   ├── CategoriaEquipo.jsx      # Chips de categoría para fotos (Succión, Impulsión, General)
│       │   ├── EvidenciaAudio.jsx       # Módulo de grabación de notas de voz
│       │   ├── Observaciones.jsx        # Área de texto con botón de dictado por voz Web Speech API
│       │   └── GuardarSiguiente.jsx     # Botón principal y modal de confirmación de guardado
│       │
│       ├── drive/
│       │   ├── DriveMobile.jsx          # Drawer/Modal contenedor de Google Drive
│       │   ├── DriveFolderList.jsx      # Lista de subcarpetas en la ruta actual
│       │   ├── DriveFolderItem.jsx      # Fila individual de carpeta en Drive
│       │   └── DriveFolderActions.jsx   # Acciones: subir nivel, carpeta actual y crear carpeta
│       │
│       ├── navegacion/
│       │   ├── CampoBottomNav.jsx       # Barra de navegación inferior móvil fija con safe-area-inset
│       │   └── CampoMenuDrawer.jsx      # Drawer lateral de perfil del inspector y logout
│       │
│       ├── shared/
│       │   ├── CampoButton.jsx          # Botón reutilizable con variantes visuales
│       │   ├── CampoCard.jsx            # Tarjeta base estilizada
│       │   └── CampoSection.jsx         # Envoltorio de sección con título
│       │
│       ├── BadgeEstadoSync.jsx          # Componente existente reutilizado (Barra de Sync)
│       ├── BotonEstado.jsx              # Componente existente reutilizado (SelectorEstadoHealth)
│       ├── CapturaFoto.jsx              # Componente existente reutilizado (Cámara y galería)
│       ├── GrabadoraAudio.jsx           # Componente existente reutilizado (Grabador audio)
│       └── HistorialActivoModal.jsx     # Componente existente reutilizado (Modal historial unificado)
```

---

## 3. Matriz de Componentes Reutilizados y Candidatos a Limpieza

| Componente | Ubicación | Estado / Uso | Acción Realizada / Recomendada |
| :--- | :--- | :--- | :--- |
| **`BadgeEstadoSync.jsx`** | `components/campo/` | Activo en Home e Inspección | Reutilizado dentro de `CampoStatusBar.jsx`. |
| **`BotonEstado.jsx`** | `components/campo/` | Activo en Inspección | Reutilizado dentro de `EstadoEquipo.jsx` / `EstadoEquipoOption.jsx`. |
| **`CapturaFoto.jsx`** | `components/campo/` | Activo en Inspección | Reutilizado dentro de `EvidenciaFotos.jsx`. |
| **`GrabadoraAudio.jsx`** | `components/campo/` | Activo en Inspección | Reutilizado dentro de `EvidenciaAudio.jsx`. |
| **`HistorialActivoModal.jsx`** | `components/campo/` | Activo en Ficha e Inspección | Reutilizado directamente por las páginas de activo e inspección. |
| **`DriveFolderSelector.jsx`** | `components/` | Requerido por `Sidebar.jsx` (Desktop) | Convertido en wrapper de compatibilidad que delega en `DriveMobile.jsx`. |
| **`BannerInstalacionPWA.jsx`**| `components/campo/` | Notificación PWA | Componente secundario conservado para etapas posteriores. |
| **`frontend/src/`** | `frontend/src/` | Remanente inactivo de boilerplate | **Candidato a eliminación** en la etapa de limpieza post-rediseño. |

---

## 4. Reglas de Dependencia e Importación

1. **Jerarquía Descendente Obligatoria**:
   - Una **Página** solo puede importar **Componentes**, **Hooks**, **Services** y **Utils**.
   - Un **Componente de UI** puede importar otros **Componentes de UI** o **Utils** (como `haptics`), pero NO debe consumir `db.js` directamente ni mutar IndexedDB por su cuenta.
   - Las operaciones sobre IndexedDB deben ser coordinadas por la Página o invocadas a través de callbacks pasados como props.
2. **Centralización de llamadas API**:
   - Toda llamada HTTP REST debe ejecutarse exclusivamente mediante los métodos exportados en `apiService` (`frontend/services/api.js`).
   - Queda strictly prohibido escribir `fetch('http://localhost:8000/...')` o URL hardcodeadas dentro de componentes visuales.
3. **Compatibilidad de Rutas y Exportaciones**:
   - Al trasladar o modularizar componentes (ej. `CampoBottomNav.jsx`), se deben mantener re-exportaciones de compatibilidad en las ubicaciones originales para evitar romper importaciones existentes.

---

## 5. Documentos Complementarios y Reglas para Futuras Modificaciones

1. **Especificación del Home Rediseñado**:
   - Consultar [`docs/MOBILE_UI_HOME.md`](file:///c:/Agente-Inspector/docs/MOBILE_UI_HOME.md) para el detalle de componentes visuales, alturas (50px buscador, 52px accesos, 46px botón inspeccionar) y métricas reales (`?? 0`) del Home en la Etapa 4.
2. **Especificación de la Pantalla de Inspección Rediseñada**:
   - Consultar [`docs/MOBILE_UI_INSPECCION.md`](file:///c:/Agente-Inspector/docs/MOBILE_UI_INSPECCION.md) para la arquitectura visual de la captura de campo en la Etapa 5:
     - Encabezado `← Equipo` y `Código · Nombre`.
     - Tabs `INSPECCIÓN` | `HISTORIAL` | `ARCHIVOS`.
     - Selector de salud de 52px de altura y 5px de separación (`BUENO`, `REGULAR`, `CRÍTICO`, `FUERA DE RUTA`).
     - Módulos `Evidencia Fotográfica` (`0/20`, `TOMAR FOTO`, miniaturas y chips `Succión`, `Impulsión`, `General`), `Nota de Voz / Audio` (`0/5`, `GRABAR AUDIO`), `Observaciones` (`Escriba o use el dictado de voz...`) y `GUARDAR Y SIGUIENTE →` (50px, ancho completo).
3. **Especificación de la Interfaz Drive / Planta Rediseñada**:
   - Consultar [`docs/MOBILE_UI_DRIVE.md`](file:///c:/Agente-Inspector/docs/MOBILE_UI_DRIVE.md) para la arquitectura visual de selección de carpetas en la Etapa 6:
     - Formato fullscreen `width: 100%`, `height: 100dvh` en mobile.
     - Encabezado `← Drive / Planta          X`.
     - Sección Carpeta Seleccionada con estado "Conectado".
     - Lista de carpetas con filas de `52–60px` (`h-[56px]`).
     - Acciones de 50px (`↑ Subir nivel`, `📌 Carpeta actual`, `＋ Nueva carpeta`).
     - Botón `CONFIRMAR Y USAR CARPETA` verde de `50px` de altura.
4. **Etapa de Rediseño Visual (Mobile-First)**:
   - Al encarar el rediseño visual de Modo Campo, las modificaciones deben aplicarse sobre los componentes ubicados en `frontend/components/campo/` (`layout/`, `home/`, `inspeccion/`, `drive/`, `navegacion/`, `shared/`).
   - Las páginas en `frontend/app/campo/` NO deben requerir cambios en su lógica de estado offline (Dexie / IndexedDB) al cambiar los estilos de la interfaz.
5. **Añadido de Nuevos Componentes de Campo**:
   - Si se requiere una nueva sección en la Home, crear la tarjeta en `frontend/components/campo/home/` e integrarla en `app/campo/page.js`.
   - Si se requiere un nuevo campo en el formulario de inspección, crear el componente en `frontend/components/campo/inspeccion/` y conectarlo via props en `app/campo/inspeccion/[id]/page.js`.
6. **Mantenimiento del Backend Intacto**:
   - Las modificaciones de interfaz no deben exigir cambios en los schemas ni en los endpoints del backend (`app/`), preservando la estructura actual de `/api/inspecciones/batch`, `/api/drive`, `/api/equipos`, etc.


