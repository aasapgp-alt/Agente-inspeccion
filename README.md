# Agente Inspector PGP

El **Agente Inspector PGP** es una aplicación corporativa Full-Stack diseñada para digitalizar, automatizar y estandarizar el proceso de inspección técnica en Paradas Generales de Planta (PGP). Integra una **App Móvil PWA Offline-First** para inspectores de campo y una **Consola Web de Gestión** con Inteligencia Artificial (Google Gemini) para asistir en el diagnóstico de patologías industriales, manteniendo control de versiones, autenticación por roles y generación automática de reportes.

---

## 🛠️ Arquitectura del Sistema

La plataforma está dividida en un entorno moderno y asíncrono:

- **Frontend & App Móvil PWA:** Aplicación desarrollada en Next.js / React. Incluye diseño *Glassmorphism* para escritorio y una arquitectura **PWA independiente para campo** (`/campo`) con hojas de estilo aisladas de alto contraste (`campo.css`), almacenamiento IndexedDB local (Dexie.js) y soporte completo para trabajo sin conexión a internet.
- **Backend:** Desarrollado en Python con **FastAPI**, lo que garantiza alta concurrencia, APIs REST asíncronas y respuestas ágiles.
- **Base de Datos Multicapa:** Utiliza **SQLite** como base de datos local y almacenamiento de itinierarios/auditoría. Mantiene también compatibilidad con **PostgreSQL** para alta escalabilidad.
- **IA Multimodal:** Motor impulsado por **Google Gemini Vision** para la detección y análisis de patologías (oxidación, desgaste, fugas) en fotografías de equipos.
- **Integración Google Drive:** Índice local de carpetas de Drive (SQLite) para sugerencias de ubicación en ~15ms sin llamadas en tiempo real.

---

## 🚀 Funcionalidades Principales

### 1. Aplicación Móvil PWA (Modo Campo Offline-First)
- **Interfaz de Alto Contraste (Sunlight & Night)**: Estilizado independiente en `app/campo/campo.css` con tipografía de alto contraste (blanco `#ffffff` sobre slate `#090d16`) y elementos táctiles de 68px de alto diseñados para operar con guantes anticorte.
- **IndexedDB & Dexie.js**: Almacenamiento y caché offline local de itinerarios, activos e inspecciones (`inspecciones_pendientes`, `archivos_pendientes`, `equipos_cache`, `historial_cache`).
- **Compresión de Imágenes & Notas de Voz**: Compresión en cliente mediante `browser-image-compression` (JPEG 0.65, <=1024px) y grabación de voz via `MediaRecorder` API. Límites dinámicos (5 fotos / 1 audio offline vs 20 fotos / 5 audios online).
- **Sincronización Batch Idempotente**: Transmisión en lote a `/api/inspecciones/batch` con `client_uuid` (generados vía `crypto.randomUUID()`) para prevenir duplicación de inspecciones en cortes de red.
- **Historial Completo del Activo**: Consulta del diagnóstico previo de Gemini y recomendaciones en la Ficha Compacta del Activo y a través del modal flotante `📜 HISTORIAL` sin perder borradores en curso.

### 2. Sistema de Autenticación, Roles y Auditoría (RBAC)
- Acceso restringido por roles: **Inspector** (sólo análisis/campo), **Supervisor** (modificación de diagnósticos y datos técnicos) y **Admin** (eliminación de activos, gestión de usuarios).
- Sistema de login seguro usando hash PBKDF2 y tokens JWT en formato JSON.
- **Panel de Auditoría** (solo Admin/Supervisor): registro detallado de todos los ingresos, egresos, intentos fallidos y modificaciones técnicas (con IP, fecha, usuario y diff del cambio).

### 3. Dashboard Dinámico y Jerarquía de Activos
- Visualización de indicadores en tiempo real que reflejan la salud general de la planta (**Bueno**, **Regular**, **Crítico** y **Fuera de Ruta**).
- Navegación jerárquica: `Empresa` → `Área` → `Equipo/Activo`.
- Permite la edición en caliente de variables de diseño de los equipos (Material, Fluido, Presión, Temperatura) desde el historial de activos.

### 4. Agente Inspector IA y Google Drive
- **Caché de Drive:** Al sincronizar desde el panel de Configuración, el sistema indexa toda la jerarquía de carpetas de Drive y la almacena localmente. Las sugerencias de carpeta para cada equipo se calculan en **~15ms** sin tráfico de red.
- **Contexto Histórico PGP 2024:** Durante el análisis, el backend inyecta el historial del equipo al prompt de Gemini. Para componentes no visibles en las fotos, la IA hereda el diagnóstico histórico sin mencionar limitaciones de imágenes.
- **Estilo de Informe Técnico Estandarizado:**
  - El **diagnóstico** se redacta en tiempo presente impersonal.
  - Las **acciones y recomendaciones** se escriben en infinitivo directivo.
  - Las recomendaciones se estructuran en **7 categorías fijas**: `EQUIPO INTERIOR`, `EQUIPO EXTERIOR`, `SOPORTES CAÑERÍAS ASOCIADAS`, `VÁLVULAS`, `ELEMENTOS DE SUJECIÓN EN GENERAL`, `ANCLAJES`, `ACOMETIDAS`.
  - Para equipos y cañerías de material plástico (FRP, ACRBA, PP), se inyecta automáticamente una **regla preventiva crítica** en `ACOMETIDAS` sobre el reemplazo de elementos de sujeción y juntas.
- **Bucle de Aprendizaje (Few-Shot):** Si el inspector corrige el diagnóstico provisto por Gemini, la corrección se guarda y se inyecta en los *prompts* de futuras inspecciones.

### 5. Flujo de Generación de Reportes PDF
- Al completar un diagnóstico, el inspector puede guardar los datos en la BD o desencadenar la **Generación de un Reporte PDF formal** en `ReportLab`.
- **Control de Versiones y Polling:** La generación de reportes se maneja con estados (`pendiente`, `generando`, `completado`, `error`).
- Si un reporte se regenera, el backend rastrea la versión (v1, v2...) y almacena la copia tanto en disco local como en Google Drive.

### 6. Planificación de Itinerarios Diarios (Rutas)
- **Asignación de Rutas:** Desde el panel web, los Administradores y Supervisores pueden planificar itinerarios diarios para los inspectores, buscando equipos e indexándolos en un itinerario con un orden de inspección dinámico.
- **Seguridad por Rol:** La vista de itinerarios está filtrada: los inspectores solo visualizan sus propias tareas programadas para el día.

---

## ⚙️ Estructura del Proyecto

```
Agente-Inspector/
├── app/                      # Backend FastAPI (Python)
│   ├── core/                 # Configuración, Seguridad JWT, Rate Limiter
│   ├── db/                   # Inicialización SQLite y esquemas
│   ├── routers/              # Endpoints API (Auth, Equipos, Itinerarios, Inspecciones, Dashboard)
│   └── services/             # Lógica de negocio, Gemini Vision, Drive, PDF
├── frontend/                 # Frontend Next.js / React
│   ├── app/                  # Router App (PWA Modo Campo en /campo, Login, Dashboard)
│   ├── components/           # Componentes Web y Modo Campo (HistorialActivoModal, BotonEstado, etc.)
│   ├── hooks/                # Custom Hooks (useOnlineStatus, usePreCargaInicial)
│   ├── services/             # api.js con comunicación REST
│   └── utils/                # db.js (IndexedDB Dexie), haptics.js, sync.js
├── MANUAL.md                 # Manual detallado de usuario y operador de campo
└── README.md                 # Documentación técnica del sistema
```
