# SULVY MODO CAMPO — MOBILE DESIGN SYSTEM

Este documento establece la especificación oficial del **Design System Mobile** para la interfaz del Modo Campo (inspector de planta).

---

## 1. COLORES Y TOKENS VISUALES

El sistema visual del Modo Campo está optimizado para pantallas OLED móviles, maximizando el contraste en entornos industriales con alta o baja iluminación.

### Tokens Principales (`--campo-*`)

| Token | Valor CSS Hex | Uso / Propósito |
| :--- | :--- | :--- |
| `--campo-bg` | `#090d16` | Fondo global de la aplicación móvil |
| `--campo-surface` | `#131c2e` | Cards, paneles principales y contendores |
| `--campo-surface-hover` | `#1a263d` | Estado hover/active de tarjetas interactivas |
| `--campo-surface-secondary` | `#1e293d` | Contenedores secundarios y badges |
| `--campo-border` | `#1e293d` | Bordes sutiles entre componentes |
| `--campo-border-strong` | `#28364e` | Bordes de énfasis y separación activa |
| `--campo-primary` | `#0284c7` | Acciones principales, botones primarios (Sky-600) |
| `--campo-primary-hover` | `#0369a1` | Hover/Active de acciones principales |
| `--campo-success` | `#10b981` | Guardado, éxito, estado Bueno (Emerald-500) |
| `--campo-warning` | `#f59e0b` | Alertas, pendientes, estado Regular (Amber-500) |
| `--campo-danger` | `#ef4444` | Fallas severas, estado Crítico (Red-500) |
| `--campo-muted` | `#64748b` | Texto deshabilitado o de baja prioridad (Slate-500) |
| `--campo-text` | `#f8fafc` | Texto principal de alta legibilidad (Slate-50) |
| `--campo-text-secondary` | `#94a3b8` | Subtítulos, etiquetas secundarias (Slate-400) |

---

## 2. TIPOGRAFÍA

El sistema utiliza **Inter** como familia tipográfica principal con jerarquía definida para pantallas móviles compactas.

| Nivel | Tamaño | Peso | Interlineado | Caso de Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Título Grande** | `24px` (`text-[24px]`) | `800` (ExtraBold) | `tight` | Saludos de cabecera, modales |
| **Título Sección** | `14px` (`text-sm`) | `800` (ExtraBold) | `tight` | Código de equipo, títulos de card |
| **Header Sección** | `12px` (`text-xs`) | `800` (ExtraBold) | `wider` | Subtítulos de sección (UPPERCASE) |
| **Cuerpo Principal** | `12px` (`text-xs`) | `500`/`700` (Medium/Bold) | `normal` | Textos de cards, opciones, campos |
| **Texto Secundario**| `11px` (`text-[11px]`) | `500` (Medium) | `normal` | Fechas, estados, subtítulos |
| **Etiqueta Micro** | `9px` (`text-[9px]`) | `900` (Black) | `wider` | Insignias, contadores, badges |

---

## 3. ESPACIADO (SPACING SCALE)

Escala basada en múltiplos de 4px para garantizar alineación vertical y horizontal consistente:

- **4px** (`gap-1` / `p-1`) — Micro separaciones entre texto e iconos.
- **8px** (`gap-2` / `p-2`) — Separación entre elementos compactos.
- **12px** (`gap-3` / `p-3`) — Padding interno estándar de tarjetas móviles.
- **16px** (`gap-4` / `p-4`) — Margen lateral del layout y separación de secciones.
- **20px** (`gap-5` / `p-5`) — Espaciado modal e inspección.
- **24px** (`gap-6` / `p-6`) — Separadores de bloque mayor.

---

## 4. BOTONES (`CampoButton`)

Componente canónico: `frontend/components/campo/shared/CampoButton.jsx`

### Matriz de Variantes:
1. **`primary`**: Fondo `#0284c7` (Sky-600), texto blanco. Acción principal.
2. **`secondary`**: Fondo `#1e293d`, borde `#28364e`. Acción secundaria.
3. **`success`**: Fondo `#10b981`, texto blanco. Guardar e inspeccionar.
4. **`warning`**: Fondo `#f59e0b`, texto blanco. Alerta o atención.
5. **`danger`**: Fondo `#ef4444`, texto blanco. Eliminación o rechazo.
6. **`ghost`**: Fondo transparente, hover `#1e293d`. Acciones limpias.
7. **`outline`**: Fondo transparente con borde `#28364e`.

### Tamaños y Área Táctil:
- **`small`**: Altura adaptativa `min-h-[44px]`, padding `py-1.5 px-3`, `text-xs`.
- **`medium`**: Altura adaptativa `min-h-[44px]`, padding `py-2.5 px-4`, `text-xs`.
- **`large`**: Altura `min-h-[52px]`, padding `py-3 px-6`, `text-sm`.

> **Garantía Táctil**: Todo botón en el Modo Campo garantiza un área efectiva de interacción de al menos `44px x 44px`.

---

## 5. CARDS (`CampoCard`)

Componente canónico: `frontend/components/campo/shared/CampoCard.jsx`

- **Fondo**: `#131c2e` (`var(--campo-surface)`).
- **Borde**: `1px solid #1e293d` (`var(--campo-border)`).
- **Border Radius**: `16px` (`rounded-2xl` / `rounded-xl`).
- **Padding**:
  - `none`: `0px`
  - `small`: `10px` (`p-2.5`)
  - `medium`: `14px` (`p-3.5`)
  - `large`: `20px` (`p-5`)
- **Estado Interactivo**: `campo-card-interactive` activa feedback táctil en hover/press con cambio de superficie a `#1a263d` y escala `active:scale-[0.99]`.

---

## 6. INPUTS Y SELECCIONES (`CampoInput`)

Componente canónico: `frontend/components/campo/shared/CampoInput.jsx`

- **Fondo**: `#131c2e`.
- **Borde**: `#1e293d`, foco `#38bdf8` (ring de 2px).
- **Radius**: `12px` (`rounded-xl`).
- **Altura Mínima**: `44px` para prevenir errores de escritura en movimiento.
- **Soporte**: Icono a la izquierda, botón de limpiado rápido (X) a la derecha, manejo de errores y soporte textarea multilínea.

---

## 7. ESTADOS Y BADGES (`CampoBadge`)

Componente canónico: `frontend/components/campo/shared/CampoBadge.jsx`

### Estados de Equipo:
- **Bueno**: Fondo verde translúcido (`rgba(16,185,129,0.15)`), texto verde (`#34d399`), icono `CheckCircle2`.
- **Regular**: Fondo ámbar translúcido (`rgba(245,158,11,0.15)`), texto amarillo (`#fbbf24`), icono `AlertTriangle`.
- **Crítico**: Fondo rojo translúcido (`rgba(239,68,68,0.15)`), texto rojo (`#f87171`), icono `AlertOctagon`.
- **Fuera de Ruta**: Fondo púrpura translúcido (`rgba(139,92,246,0.15)`), texto violeta (`#c084fc`), icono `HelpCircle`.

### Estados del Sistema / Conectividad:
- **Online**: Verde translúcido con pulso.
- **Offline**: Ámbar translúcido con indicador de red local.
- **Pendiente**: Gris Slate translúcido.
- **Completado**: Verde Emerald translúcido.

---

## 8. ICONOS

- **Biblioteca Única**: `lucide-react`.
- **Escala de Tamaños**:
  - `Small`: `14px x 14px` (`w-3.5 h-3.5`) — Badges y texto micro.
  - `Medium`: `16px x 16px` (`w-4 h-4`) — Botones y entradas de lista.
  - `Large`: `20px x 20px` (`w-5 h-5`) — Cabeceras y acciones destacadas.
  - `Hero`: `24px x 24px` (`w-6 h-6`) — Indicadores flotantes y modales.

---

## 9. ÁREAS TÁCTILES (TOUCH TARGETS & SAFE AREAS)

- **Regla Estricta**: Ningún elemento accionable posee un tamaño táctil menor a `44px x 44px` (`.touch-target`).
- **Safe Area Insets**:
  - Respeto del `safe-area-inset-top` (`var(--sat)`) para muescas/cámaras frontales.
  - Respeto del `safe-area-inset-bottom` (`var(--sab)`) para la barra de navegación gestual de Android y la barra de inicio de iOS (`pb-[max(0.5rem,env(safe-area-inset-bottom))]`).

---

## 10. RESOLUCIONES Y RESPONSIVE

El sistema está validado y responde fluidamente en las 5 resoluciones de referencia móvil:

1. **360 x 800 px** (Android compacto / Galaxy A series)
2. **375 x 812 px** (iPhone X / 11 Pro / 12 Mini)
3. **390 x 844 px** (iPhone 13 / 14 / 15)
4. **412 x 915 px** (Pixel 6 / 7 / 8 / Samsung S22)
5. **430 x 932 px** (iPhone 14 Pro Max / 15 Plus)

Todas las pantallas mantienen alineación central con ancho máximo `max-w-md` (`448px`) para evitar dispersión en pantallas grandes o tablets manteniendo la experiencia mobile-first.
