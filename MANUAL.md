# 📖 Manual de Uso - Agente Inspector PGP

Este manual proporciona una guía detallada para operar la plataforma **Agente Inspector PGP**, cubriendo tanto la consola web (paneles de control, auditoría, reportes y configuración) como la **Aplicación Móvil PWA (Modo Campo)**.

---

## 👥 1. Matriz de Roles y Accesos

El sistema cuenta con un control de accesos estricto basado en roles (RBAC):

| Rol | Permisos Web & PWA Campo |
|---|---|
| **Administrador (`admin`)** | Acceso total, visualización de auditoría global, gestión y creación de usuarios, asignación/eliminación de itinerarios diarios, configuraciones generales. |
| **Supervisor (`supervisor`)** | Modificación de diagnósticos, edición en caliente de variables técnicas, visualización de auditoría, planificación de itinerarios diarios. |
| **Inspector (`inspector`)** | Carga manual web, carga en App de Campo PWA (offline/online), consulta de itinerario asignado, visualización de reportes PDF. |

---

## 💻 2. Manual para Administradores y Supervisores

### 2.1 Gestión y Control de Usuarios (Exclusivo Administrador)
Para dar de alta a nuevos usuarios o gestionar cuentas activas:
1. Inicie sesión con su usuario administrador.
2. Ingrese a la sección **Configuración (Settings)** desde la barra lateral.
3. Haga clic en la pestaña **👥 Usuarios**.
4. **Registrar nuevo usuario**: Complete el formulario (Username, Nombre Completo, Correo, Contraseña, Rol y Empresa) y haga clic en **👥 Crear Usuario**.
5. **Modificar Roles**: En la lista lateral de usuarios, busque el usuario deseado y cambie su rol al instante mediante el menú desplegable (**inspector**, **supervisor**, **admin**).
6. **Activar/Desactivar**: Presione el botón **Desactivar** para suspender una cuenta. Si el usuario tuviera una sesión abierta en la web o estuviese operando, su acceso se invalidará de inmediato.

### 2.2 Planificación de Itinerarios Diarios (Rutas de Inspección)
Para establecer qué equipos inspeccionará cada operador hoy:
1. Ingrese a **Configuración (Settings) > 📅 Itinerarios**.
2. Seleccione el **Inspector** y la **Fecha** programada.
3. Utilice el **Buscador de Equipos** integrado para filtrar por nombre o código.
4. Haga clic en los equipos de la lista para añadirlos al itinerario. Se mostrarán como etiquetas ordenadas interactivas.
5. Para cambiar el orden de las inspecciones en la ruta, simplemente configure el orden agregándolos de manera lógica.
6. Presione **🚀 Crear / Sobrescribir Ruta**.
7. Si necesita cancelar una ruta planificada, pulse el botón **Eliminar** en la tabla de Historial de Rutas.

---

## 📱 3. Aplicación Móvil PWA ("Modo Campo")

La aplicación de campo está diseñada específicamente para inspectores que operan en planta industrial bajo luz solar intensa o nocturna, utilizando guantes anticorte y con o sin cobertura de red.

### 3.1 Acceso e Instalación PWA
1. **Acceso Web Móvil**: Abra el navegador de su celular (Chrome, Safari o Edge) e ingrese a:
   `http://<IP_SERVIDOR>:3000/campo`
2. **Instalación como App Nativa**: En la parte superior de la pantalla aparecerá un banner. Pulse el botón **📲 INSTALAR APP DE CAMPO** para agregar el ícono a la pantalla de inicio y operar en modo pantalla completa.

### 3.2 Operación y Flujo de Trabajo en Planta
1. **Chip de Usuario**: En la esquina superior derecha se muestra el nombre del inspector autenticado (`usuario_inspector`).
2. **Mi Itinerario de Hoy**: Presenta la lista ordenada (#1, #2, #3...) de equipos asignados al inspector para la jornada actual.
3. **Buscador de Activos**: Si requiere inspeccionar un equipo fuera de ruta, escriba el código, tag o nombre en la barra de búsqueda para obtener sugerencias instantáneas desde la caché IndexedDB.
4. **Ficha Compacta**: Al seleccionar un equipo, visualizará:
   - Estado de salud oficial registrado (`🔴 CRÍTICO`, `⚠️ REGULAR`, `✅ BUENO`).
   - **Diagnóstico Reciente (Gemini)**: Reporte completo generado por IA en campañas anteriores.
   - **Recomendaciones Preventivas**: Medidas sugeridas por el sistema.
5. **Consulta de Historial Anterior (`📜 HISTORIAL`)**:
   - Presione el botón **`📜 HISTORIAL`** en la ficha o durante la captura para revisar la historia del activo.
   - Al cerrar el modal flotante, **regresará a su borrador en curso sin perder fotos, audios ni textos redactados**.
6. **Registro e Inspección**:
   - **Botones de Estado (Glove Friendly)**: Seleccione el estado de salud en botones de 68px de alto diseñados para uso con guantes.
   - **Fotografías**: Presione **Tomar / Subir Foto** (categorizadas en `General`, `Placa`, `Interior`, `Fuga/Corrosión`). Se comprimirán automáticamente en el teléfono (JPEG <=1024px). Límite: 5 fotos offline / 20 online.
   - **Notas de Voz**: Presione **Grabar Nota de Voz** para dictar observaciones mediante el micrófono del celular. Límite: 1 audio offline / 5 online.
7. **Guardado y Sincronización**:
   - Al presionar **💾 GUARDAR Y SIGUIENTE**, la inspección se marca como pendiente y pasa automáticamente al siguiente equipo del itinerario.
   - Si la red vuelve, la PWA sincronizará los datos en lote (`POST /api/inspecciones/batch`) usando UUIDs únicos para garantizar la idempotencia sin duplicar información.

---

## 📈 4. Análisis Técnico Asistido por IA (Consola Web)

Cuando opera desde la aplicación web:
1. Ingrese a **Inspección con IA**.
2. Suba las fotografías del equipo.
3. El motor **Google Gemini Vision** analizará las imágenes apoyándose en:
   - **Historial PGP 2024**: Diagnósticos no visibles en las fotos serán heredados automáticamente para evitar vacíos de información.
   - **Reglas de Redacción**: Diagnósticos en presente impersonal, acciones en infinitivo directivo.
   - **Categorización Técnica**: Recomendaciones divididas automáticamente en las 7 categorías fijas (`EQUIPO INTERIOR`, `EQUIPO EXTERIOR`, etc.).
   - **Regla Preventiva de Plásticos**: Si el equipo es de material plástico (FRP, ACRBA, PP), la IA incluirá automáticamente la recomendación de reemplazo de pernos y juntas en acometidas.
4. Si corrige la recomendación provista por la IA, el sistema registrará la corrección para inyectarla como aprendizaje en futuros diagnósticos de ese activo.

---

## 📄 5. Reportes PDF y Control de Versiones

1. Una vez guardado el diagnóstico de un equipo, presione **Generar Reporte**.
2. La plataforma construirá un acta PDF formal con carátula, datos de diseño del activo, fotografías adjuntas y recomendaciones categorizadas.
3. Si un diagnóstico es modificado o corregido en el panel de **Carga Manual** o **Historial de Activos**, el botón pasará a indicar **Regenerar Reporte**.
