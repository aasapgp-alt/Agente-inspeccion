# ESPECIFICACIÓN TÉCNICA — HOME MOBILE-FIRST (ETAPA 4)

Documento de referencia para la interfaz **Home del Modo Campo** del sistema **Inspector PGP**.

---

## 1. Visión General y Concepto de Diseño

La Home de Modo Campo ha sido transformada en una **interfaz mobile-first profesional** orientada a inspectores de planta en condiciones reales de campo.

### Principios Visuales y Conceptuales:
- **Formato**: Diseñado específicamente para pantallas de smartphones.
- **Paleta Oscura (Dark Mode)**: Fondo `#090d16` con tarjetas compactas `#131c2e` y bordes `#1e293d`.
- **Alto Contraste**: Tipografía en blanco puro (`#ffffff`), grises claros (`#f8fafc`, `#slate-300`) y acentos de color vibrantes (`#sky-400` para navegación y acción principal, `#emerald-400` para completados y online, `#amber-400` para advertencias/Drive, `#red-400` para pendientes).
- **Navegación Inferior Fija**: Barra móvil `CampoBottomNav` con botón central flotante `(+)` que respeta la zona segura del dispositivo (`env(safe-area-inset-bottom)`).

---

## 2. Estructura y Orden de Componentes

El renderizado vertical de la pantalla Home (`frontend/app/campo/page.js`) sigue estrictamente la secuencia especificada:

```
┌─────────────────────────────────────────┐
│ 1. Estado ONLINE/OFFLINE (Sync Status) │
├─────────────────────────────────────────┤
│ 2. Usuario (Inspector Header & Badge)   │
├─────────────────────────────────────────┤
│ 3. Buscar Equipo (Input Search 50px)    │
├─────────────────────────────────────────┤
│ 4. Accesos Rápidos (Grilla 2x2 52px)    │
├─────────────────────────────────────────┤
│ 5. Estado de Actividades (Pend/Comp)    │
├─────────────────────────────────────────┤
│ 6. Mi Itinerario de Hoy (Inspeccionar)  │
└─────────────────────────────────────────┘
```

---

## 3. Detalle de Componentes y Requisitos

### 3.1 Estado ONLINE/OFFLINE (`CampoStatusBar.jsx` & `BadgeEstadoSync.jsx`)
- **Posición**: Adherido en la parte superior (`sticky top-0 z-50`).
- **Métricas**: Muestra badge reactivo `ONLINE` / `OFFLINE (MODO CAMPO)`, cantidad de borradores offline, errores pendientes y botón manual de sincronización.

### 3.2 Usuario Inspector (`CampoHeader.jsx` & `UserCard.jsx`)
- **Módulos**:
  - Indicador de red + saludo dinámico `"Hola, [Nombre]"`.
  - Título `"Inspector PGP"` con descripción.
  - Tarjeta de usuario compacta `UserCard` con avatar iconográfico, rol y nombre completo obtenido de `apiService.getCurrentUser()`.

### 3.3 Buscar Equipo (`EquipoSearch.jsx`)
- **Jerarquía**: Acción prioritaria posicionada inmediatamente debajo del perfil de usuario.
- **Especificaciones**:
  - **Altura**: Fija a `50px` (`h-[50px]`).
  - **Placeholder**: `"Código, Tag o Nombre..."`.
  - **Interacción**: Input reactivo de alto contraste con anillo de enfoque `focus:ring-sky-500` y autocompletado desplegable de Dexie `equipos_cache`.
  - **Navegación**: Formulario con redirección a `/campo/buscar?q=...`.

### 3.4 Accesos Rápidos (`QuickActions.jsx`)
- **Formato**: Grilla de dos columnas (`grid-cols-2`).
- **Especificaciones**:
  - **Altura de Tarjetas**: `52px` (`h-[52px]`).
  - **Accesos**:
    1. **Equipos** (`/campo/buscar`): Icono `ClipboardList` celeste.
    2. **Historial** (`/campo`): Icono `Clock` verde esmeralda.
    3. **Drive / Planta**: Icono `HardDrive` ámbar. Abre el Drawer de Google Drive.
    4. **Pendientes**: Icono `AlertCircle` rojo con badge reactivo de inspecciones pendientes en cola.

### 3.5 Estado de Actividades (`ActivitySummary.jsx`)
- **Componentes**:
  - **Pendientes**: Tarjeta compacta con icono `Clock` ámbar y contador de cola local.
  - **Completados**: Tarjeta compacta con icono `CheckCircle2` verde y contador de inspecciones del día.
- **Regla de Integridad de Datos**:
  - **NO utiliza valores ficticios** ni fallbacks estáticos de demo (`count || valor_ficticio`).
  - **Utiliza evaluador nulo estricto**: `pendingCount ?? 0` y `completedTodayCount ?? 0`.

### 3.6 Mi Itinerario de Hoy (`ItinerarioList.jsx` & `ItinerarioCard.jsx`)
- **Sección**: Título de sección *"Mi Itinerario de Hoy"*.
- **Contenido de Tarjeta**:
  - Etiqueta *"Equipo asignado"*.
  - Código del equipo en tipografía extra bold de `3xl`.
  - Nombre del activo en mayúsculas.
  - Botón principal **"INSPECCIONAR"**:
    - **Altura**: `46px` (`h-[46px]`).
    - **Estilo**: Fondo azul `campo-btn-blue` con feedback táctil háptico (`vibrar(30)`).

---

## 4. Navegación y Áreas Seguras (`CampoBottomNav.jsx`)

- Barra de navegación inferior móvil fija (`fixed bottom-0`).
- Soporte para **Safe Area Inset**: `pb-[max(0.5rem,env(safe-area-inset-bottom))]` evita solapamientos en dispositivos iOS (iPhone X y superiores) y gestos de navegación Android.

---

## 5. Matriz Responsive Probadad

La interfaz ha sido validada sin desbordamiento horizontal (`overflow-x: hidden`) en las siguientes resoluciones:

| Dispositivo / Viewport | Ancho x Alto (px) | Estado de Renderizado |
| :--- | :--- | :--- |
| Mobile Pequeño | `360 x 800` | ✅ Correcto sin desbordamiento |
| iPhone Estándar | `375 x 812` | ✅ Correcto sin desbordamiento |
| Android Mediano | `390 x 844` | ✅ Correcto sin desbordamiento |
| Android Grande | `412 x 915` | ✅ Correcto sin desbordamiento |
| iPhone Max / Plus | `430 x 932` | ✅ Correcto sin desbordamiento |

---

## 6. Garantía de Inmutabilidad

Se garantiza que durante el rediseño de la Home **NO SE MODIFICÓ**:
- Backend Python / FastAPI.
- Endpoints de la API REST.
- Esquema de base de datos Dexie / IndexedDB (`db.js`).
- Algoritmo de sincronización offline (`sync.js`, `useOnlineStatus`).
- Lógica de autenticación (`getCurrentUser`, JWT).
- Formulario de inspección (`app/campo/inspeccion/[id]`).
- Selector y explorador de Google Drive (`DriveMobile.jsx`).
