# ESPECIFICACIÓN TÉCNICA — DRIVE / PLANTA MOBILE-FIRST (ETAPA 6)

Documento de referencia para la interfaz **Drive / Planta** del Modo Campo del sistema **Inspector PGP**.

---

## 1. Visión General y Concepto de Diseño

La interfaz de **Drive / Planta** (`DriveMobile.jsx`) ha sido transformada en una **experiencia 100% mobile-first en pantalla completa** para smartphones, manteniendo la posibilidad de desplegarse como modal emergente en pantallas de escritorio (Desktop).

### Principios Visuales y Conceptuales:
- **Pantalla Completa Móvil**: En smartphones, ocupa `width: 100%` y `height: 100dvh` para dar la sensación de una vista/pantalla nativa del sistema.
- **Modal Desktop**: En dispositivos de escritorio, conserva la presentación en modal centrado con bordes redondeados (`md:max-w-lg md:rounded-2xl`).
- **Paleta Oscura (Dark Mode)**: Fondo primario `#090d16`, tarjetas en `#131c2e` y bordes en `#1e293d`.
- **Alto Contraste y Feedback Háptico**: Colores de acento diferenciados (ámbar para carpetas, celeste para navegación, verde esmeralda para estado conectado y botón principal) con respuestas por vibración (`vibrar(20)` y `vibrar(40)`).

---

## 2. Estructura y Orden de Componentes

La vista `DriveMobile` se estructura verticalmente mediante `flex flex-col justify-between h-full`:

```
┌─────────────────────────────────────────┐
│ Encabezado: ← Drive / Planta          X │
├─────────────────────────────────────────┤
│ Carpeta seleccionada                    │
│ [📁 Nombre Real | Conectado ✓]           │
├─────────────────────────────────────────┤
│ Lista de Carpetas (52–60px)             │
│  📁 Planta Principal                 >  │
│  📁 Inspecciones 2025               >  │
│  📁 Equipos Críticos                 >  │
├─────────────────────────────────────────┤
│ Acciones (48–52px)                      │
│  ↑ Subir nivel                          │
│  📌 Carpeta actual                      │
│  ＋ Nueva carpeta                        │
├─────────────────────────────────────────┤
│ [CONFIRMAR Y USAR CARPETA (Verde 50px)] │
└─────────────────────────────────────────┘
```

---

## 3. Detalle de Secciones y Especificaciones

### 3.1 Encabezado (`DriveMobile.jsx`)
- **Diseño**: `flex items-center justify-between border-b border-slate-800/80 pb-3`.
- **Botón Izquierdo**: Botón de retorno `←` (`ArrowLeft`) que ejecuta la navegación al nivel superior si `navStack.length > 1` o dispara `onClose()` si se encuentra en la raíz.
- **Título**: `"Drive / Planta"` en tipografía bold extra de `text-base` (`#ffffff`).
- **Botón Derecho**: Icono `X` (`X` de `lucide-react`) para cerrar el selector.

### 3.2 Carpeta Seleccionada
- **Encabezado de Sección**: Etiqueta *"Carpeta seleccionada"*.
- **Contenido**:
  - Icono de disco duro `HardDrive` ámbar.
  - **Nombre Real**: Muestra el nombre real de la carpeta seleccionada en ese instante (ej. *"Planta Principal"*, *"Raíz de Drive"*).
  - **Estado de Conexión**: Badge en verde esmeralda `"Conectado"` con icono `CheckCircle2`.

### 3.3 Lista de Carpetas (`DriveFolderList.jsx` & `DriveFolderItem.jsx`)
- **Altura de Filas**: `56px` (`h-[56px]`) cumpliendo el rango requerido (52–60px).
- **Formato por Fila**:
  - Icono carpeta `📁` (`Folder` ámbar).
  - Nombre real de la subcarpeta en tipografía `text-xs font-bold`.
  - Icono chevron derecho `>` (`ChevronRight`) que al presionarse navega a la subcarpeta (`handleNavigateDown`).
- **Contenedor**: Área scrolleable con scrollbar personalizado.

### 3.4 Acciones de Carpeta (`DriveFolderActions.jsx`)
Tres botones de acción rápida de `50px` de altura (`h-[50px]`):
1. **`↑ Subir nivel`**: Icono `ArrowUp` celeste. Sube un nivel en la jerarquía de Drive.
2. **`📌 Carpeta actual`**: Icono `Pin` ámbar. Selecciona la carpeta actual navegada como destino.
3. **`＋ Nueva carpeta`**: Icono `Plus` celeste. Despliega el formulario inline para ingresar el nombre de una nueva carpeta en la ruta actual.

### 3.5 Botón de Confirmación
- **Texto**: `"CONFIRMAR Y USAR CARPETA"`.
- **Color**: Verde esmeralda (`bg-[#10b981]` hover `bg-[#059669]`).
- **Ancho**: Ancho completo (`w-full`).
- **Altura**: `50px` (`h-[50px]`).
- **Comportamiento**: Emite la señal háptica (`vibrar(40)`) y cierra el selector modal notificando el callback `onClose()`.

---

## 4. Matriz Responsive

| Viewport | Ancho x Alto | Comportamiento Visual |
| :--- | :--- | :--- |
| **Mobile Smartphone** | `100% x 100dvh` | Vista fullscreen fija (`fixed inset-0 z-50 bg-[#090d16]`). |
| **Desktop / Tablet** | `Max 512px` (`max-w-lg`) | Modal dialog centrado con backdrop blur (`backdrop-blur-sm`). |

---

## 5. Preservación de Lógica y Servicios

Se garantiza que durante el rediseño **NO SE MODIFICÓ**:
- Endpoint `/api/drive/root` (`apiService.getDriveRoot`).
- Endpoint `/api/drive/carpetas` (`apiService.getDriveCarpetas`).
- Endpoint `/api/drive/crear_carpeta` (`apiService.crearDriveCarpeta`).
- Tokens de autenticación JWT.
- IDs de carpetas de Google Drive.
- Estado de navegación de carpetas (`navStack`).
- Persistencia en `localStorage` (`campo_drive_folder_id`, `campo_drive_folder_title`).
