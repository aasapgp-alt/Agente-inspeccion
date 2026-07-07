# 📖 Manual de Uso - Agente Inspector PGP

Este manual proporciona una guía detallada para operar la plataforma **Agente Inspector PGP**, cubriendo tanto la interfaz web (paneles de control, auditoría, reportes y configuración) como el bot interactivo de **Telegram** para campo.

---

## 👥 1. Matriz de Roles y Accesos

El sistema cuenta con un control de accesos estricto basado en roles (RBAC):

| Rol | Permisos Web | Permisos Telegram |
|---|---|---|
| **Administrador (`admin`)** | Acceso total, visualización de auditoría global, gestión y creación de usuarios, asignación/eliminación de itinerarios diarios, configuraciones generales. | Búsqueda de equipos, chat con Gemini, subida de fotos a Drive, consulta de historial y rutas. |
| **Supervisor (`supervisor`)** | Modificación de diagnósticos, edición en caliente de variables técnicas, visualización de auditoría, planificación de itinerarios diarios. | Búsqueda de equipos, chat con Gemini, subida de fotos a Drive, consulta de historial y rutas. |
| **Inspector (`inspector`)** | Carga manual, carga asistida por IA, consulta de su historial de rutas asignadas, visualización de reportes PDF. | Búsqueda de equipos, chat con Gemini, subida de fotos a Drive, consulta de historial y de su itinerario asignado. |

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

## 📱 3. Vinculación con el Bot de Telegram (`@Jarbbis_bot`)

Para que el bot sepa qué inspector está realizando las cargas en planta, la cuenta de Telegram debe estar vinculada al perfil del sistema:

### Opción A: Vinculación Rápida Directa (Desde Telegram)
1. Busque al bot en Telegram como `@Jarbbis_bot` e ingrese al chat.
2. Escriba su nombre de usuario (ej: `mpaltrinieri`) o su correo electrónico registrado (ej: `marco@empresa.com`).
3. El bot validará los datos en la base de datos y vinculará su cuenta al instante enviando un mensaje de bienvenida.

### Opción B: Vinculación por Código OTP (Desde la Web)
1. En la barra lateral de la interfaz web, localice la sección **Vinculación de Telegram 📱**.
2. Haga clic en **🔑 Vincular Bot**. Se generará un código único de 6 dígitos.
3. Presione el botón **Abrir en Telegram**; se abrirá la aplicación móvil o de escritorio apuntando al bot con el comando `/start <código>` pre-completado de manera automática.

---

## 🛠️ 4. Manual de Campo - Bot de Telegram

El bot está diseñado para operarse con una sola mano en planta, utilizando un teclado fijo persistente en la parte inferior de la pantalla:

```
+-----------------------------------+
|  📅 Mi Itinerario de Hoy           |
+-----------------+-----------------+
|  🔍 Buscar      |  🔑 Mi Cuenta   |
+-----------------+-----------------+
|  ❓ Ayuda       |  /salir         |
+-----------------+-----------------+
```

### 4.1 Visualización y Progreso del Itinerario
1. Pulse **`📅 Mi Itinerario de Hoy`**. El bot mostrará la lista ordenada de equipos pendientes para hoy.
2. Cada equipo tiene un botón interactivo: `▶️ Detalle/Inspeccionar <CÓDIGO>`.
3. Al presionarlo se despliega la **Ficha Técnica** de la máquina.

### 4.2 Proceso de Carga de Fotos
1. Desde la ficha de cualquier equipo, presione **`📸 Subir Fotos`**.
2. Seleccione la subcarpeta correspondiente: **`Succión`**, **`Impulsión`** o **`General`**.
3. Envíe las fotos del equipo. Puede enviar múltiples imágenes a la vez.
4. El bot descargará las fotos y las subirá automáticamente a Google Drive en la carpeta específica de la máquina y la campaña activa.
5. Al finalizar, escriba **`/salir`** o presione **`Finalizar Carga`**. El bot actualizará el estado de la ruta a `🟢 Completado` y te devolverá a la ficha del equipo.

### 4.3 Consultar el Historial de Campañas
1. Desde la ficha del equipo, pulse **`📜 Historial Completo`**.
2. El bot recuperará todos los diagnósticos y recomendaciones preventivas de campañas previas (2023, 2024...) para que conozca el comportamiento anterior del activo en planta.

### 4.4 Chat de Asistencia Técnica con Gemini (IA)
1. Si tiene dudas sobre patologías o qué zonas del activo fotografiar: presione **`💬 Consultar IA (Gemini)`**.
2. El chat se configurará automáticamente con todo el historial del equipo.
3. Pregunte sus dudas (ej: *"¿Qué patologías tiene el material FRP de este mixer?"*). Gemini responderá de forma técnica y concisa.
4. Para cerrar el chat técnico, escriba **`/salir`**. Volverá de inmediato a la Ficha Técnica del equipo.

### 4.5 Transcripción de Mensajes de Voz (Audio a Texto)
Para no escribir mientras camina por la planta:
1. Mantenga presionado el micrófono de Telegram y grabe un mensaje de voz indicando su duda o consulta.
2. El bot transcribirá el audio a texto automáticamente usando Gemini y procesará la respuesta sin necesidad de teclado físico.

---

## 📈 5. Análisis Técnico Asistido por IA (Consola Web)

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

## 📄 6. Reportes PDF y Control de Versiones

1. Una vez guardado el diagnóstico de un equipo, presione **Generar Reporte**.
2. La plataforma construirá un acta PDF formal con carátula, datos de diseño del activo, fotografías adjuntas y recomendaciones categorizadas.
3. Si un diagnóstico es modificado o corregido en el panel de **Carga Manual** o **Historial de Activos**, el botón pasará a indicar **Regenerar Reporte**.
4. El sistema guardará la nueva versión (ej: `ACTA-PGP2026-61_v2.pdf`) manteniendo a salvo el historial de reportes pasados.
