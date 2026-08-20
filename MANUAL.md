# 📖 Manual de Uso - Agente Inspector PGP

Este manual proporciona una guía detallada y completa para operar la plataforma **Agente Inspector PGP**, abarcando tanto la **Consola Web de Gestión** (paneles de control, inspección con IA, Copilot interactivo, minutas de planta, generación de reportes y libros, y administración) como la **Aplicación Móvil PWA (Modo Campo Offline-First)**.

---

## 👥 1. Matriz de Roles y Niveles de Acceso (RBAC)

El sistema cuenta con un control de accesos estricto basado en roles para asegurar la trazabilidad y la integridad de los datos técnicos:

| Rol | Permisos Web & PWA Campo |
|---|---|
| **Administrador (`admin`)** | Acceso total al sistema, visualización de auditoría global con diffs técnicos, gestión y creación de usuarios, asignación/eliminación de itinerarios diarios, configuración de parámetros del sistema (firmas, portadas, normativas, carpetas de Google Drive) y generación de Libros de Inspección. |
| **Supervisor (`supervisor`)** | Modificación y aprobación de diagnósticos técnicos, edición en caliente de variables de diseño de equipos, visualización de auditoría técnica, planificación y asignación de itinerarios de campo, generación de reportes individuales y Libros de Inspección. |
| **Inspector (`inspector`)** | Operación completa en la App Móvil PWA (`/campo`) con o sin conexión a internet, carga manual web, consulta y ejecución del itinerario diario asignado, visualización y descarga de reportes PDF generados. |

---

## 💻 2. Guía Operativa: Consola Web de Gestión

### 2.1 Tablero Principal (Dashboard de Salud de Planta)
1. Al iniciar sesión, el usuario visualiza el estado global de los activos mediante el semáforo industrial de cuatro estados:
   - 🟢 **Bueno**: Equipos en condiciones operativas óptimas sin anomalías significativas.
   - 🟡 **Regular**: Equipos con desgaste moderado o recomendaciones preventivas programadas.
   - 🔴 **Crítico**: Equipos con fallas estructurales, fugas activas o corrosión severa que requieren intervención prioritaria.
   - ⚪ **Fuera de Ruta**: Equipos no programados en el itinerario del día o pendientes de clasificación.
2. Utilice los selectores de **Empresa** y **Ubicación / Área** para segmentar los indicadores y visualizar el progreso de inspección en tiempo real.

---

### 2.2 Inspección con IA (Google Gemini Vision)
1. Ingrese a la sección **Inspección con IA** desde la barra lateral de navegación.
2. Seleccione el **Equipo / Activo** a inspeccionar mediante el buscador inteligente. El sistema mostrará la ficha técnica del equipo (Material, Fluido, Presión, Temperatura) y vinculará automáticamente la carpeta correspondiente de Google Drive.
3. **Carga de Evidencias**:
   - Arrastre o seleccione las fotografías del equipo (categorizadas o generales).
   - Opcionalmente, cargue o grabe un dictado de voz con observaciones del inspector.
4. **Procesamiento con IA**:
   - Presione **Analizar con IA**. El motor multimodal procesará las imágenes y el audio, cruzando la información con el **Historial PGP 2024** para conservar antecedentes no visibles en las fotos.
   - La IA generará el diagnóstico en tiempo presente impersonal y las recomendaciones en infinitivo estructuradas en las **7 categorías normativas fijas**:
     1. `EQUIPO INTERIOR`
     2. `EQUIPO EXTERIOR`
     3. `SOPORTES CAÑERÍAS ASOCIADAS`
     4. `VÁLVULAS`
     5. `ELEMENTOS DE SUJECIÓN EN GENERAL`
     6. `ANCLAJES`
     7. `ACOMETIDAS`
   - Si el equipo es de material plástico (FRP, ACRBA, PP), se incluirá automáticamente la cláusula preventiva sobre el recambio de juntas y pernos en acometidas.
5. **Revisión y Ajuste Humano**:
   - El supervisor o inspector puede ajustar el texto del diagnóstico y las recomendaciones en los campos editables.
   - Si se corrigen las recomendaciones de la IA, el sistema almacena la corrección en el bucle de aprendizaje (*few-shot*) para perfeccionar diagnósticos futuros.
6. Presione **Guardar Inspección** para registrar el estado oficial en la base de datos.

---

### 2.3 Copilot IA por Equipo (`EquipoCopilotDrawer`)
1. Al visualizar un equipo en la ficha técnica o en el panel de inspección, presione el botón flotante **🤖 Copilot Técnico**.
2. Se desplegará un panel lateral interactivo con contexto pre-cargado del equipo (tag, materiales, historial de patologías y normas aplicables).
3. Puede realizar preguntas en lenguaje natural tales como:
   - *"¿Qué antecedentes de corrosión tuvo este equipo en la campaña anterior?"*
   - *"¿Cuáles son los torques o recomendaciones para las bridas de este material?"*
   - *"Redacta una recomendación para fisura en tobera de salida."*

---

### 2.4 Visor de Fotografías en Alta Definición (`ImageViewerModal`)
1. Al hacer clic sobre cualquier miniatura fotográfica en el historial o en el panel de inspección, se abrirá el **Visor HD**.
2. **Funcionalidades del Visor:**
   - Zoom interactivo y paneo para inspeccionar fisuras, picaduras o detalles de placas técnicas.
   - Navegación rápida entre todas las fotos del equipo mediante las flechas laterales.
   - Información de metadatos (categoría de la foto, fecha de captura y autor).

---

### 2.5 Panel de Minutas y Resumen Ejecutivo PGP
1. Ingrese a la sección **Minutas / Resumen PGP** desde el menú principal.
2. Visualice la matriz consolidada de activos por área y su estado de conservación.
3. Permite:
   - Filtrar por estado de criticidad (Crítico, Regular, Bueno).
   - Generar resúmenes ejecutivos para comités de Parada General de Planta.
   - Exportar tablas de seguimiento de acciones pendientes.

---

### 2.6 Generación de Reportes Individuales y Libros de Inspección

#### A. Reportes Individuales por Equipo:
1. Desde el panel de inspección o desde el historial, presione **📄 Generar Reporte PDF**.
2. El sistema construirá el documento en formato formal con:
   - Carátula institucional y membrete corporativo (ej. SULVY SRL).
   - Ficha de variables de diseño del equipo.
   - Diagnóstico técnico y tabla de recomendaciones categorizadas.
   - Galería de fotos con leyendas descriptivas (hasta 6 fotos en el cuerpo del reporte).
   - Bloque de firmas con Director Técnico e Inspector matriculado.
3. Los reportes se guardan localmente organizados en `data/reportes/[Ubicación]/[Campaña]/` y se sincronizan en la subcarpeta correspondiente de **Google Drive**.
4. Si se modifica un diagnóstico previo, el botón pasará a **🔄 Regenerar Reporte**, creando una nueva versión controlada (v2, v3, etc.).

#### B. Libros Consolidados de Inspección por Ubicación / Área:
1. Ingrese al panel **Libros de Inspección**.
2. Seleccione la **Empresa**, la **Ubicación** y la **Campaña activa** (ej. PGP 2026).
3. Presione **📚 Generar Libro Consolidado**.
4. El sistema compilará un acta técnica completa que incluye:
   - Portada con tipografía corporativa y subtítulo de calidad.
   - Introducción y **Objetivo de Campaña** parametrizable.
   - Criterios y normativas técnicas aplicadas (ASTM, NOGA, MTI, ESA/FSA).
   - Tabla resumen de criticidad de todos los equipos del área.
   - Fichas técnicas completas de cada equipo con sus fotos principales (2 fotos por activo).
   - Bloque de cierre formal con firmas autorizadas.

---

### 2.7 Administración y Configuración (`SettingsPanel`)

#### A. Gestión de Usuarios (Exclusivo Administrador):
1. Ingrese a **Configuración > 👥 Usuarios**.
2. **Crear usuario**: Complete Username, Nombre Completo, Email, Contraseña, Rol (`admin`, `supervisor`, `inspector`) y Empresa.
3. **Modificar roles o desactivar**: Cambie el rol en caliente o suspenda cuentas de inmediato ante desvinculaciones.

#### B. Planificación de Itinerarios Diarios:
1. Ingrese a **Configuración > 📅 Itinerarios**.
2. Seleccione el **Inspector** y la **Fecha de ejecución**.
3. Añada equipos a la ruta utilizando el buscador.
4. Ordene la secuencia de inspección (#1, #2, #3...) para optimizar los traslados en planta.
5. Presione **🚀 Crear / Actualizar Ruta**.

#### C. Parámetros de Reportes, Portadas y Firmas:
1. Ingrese a **Configuración > 📄 Reportes & Libros**.
2. Configure:
   - **Razón Social y Subtítulo:** Nombre de la empresa inspectora y leyenda de acreditación.
   - **Información de Pie de Página:** Dirección, teléfonos y correo de contacto técnico.
   - **Firmantes Técnicos:** Nombres, cargos y matrículas de los firmantes 1 y 2.
   - **Normativas Aplicables:** Lista de normas (ASTM D 2563, NOGA 055-97, MTI 129-99, etc.) que se plasman en los libros.
   - **Plantilla de Objetivos:** Texto parametrizado para la carátula de los libros consolidados.

#### D. Sincronización e Índice de Google Drive:
1. Ingrese a **Configuración > ☁️ Google Drive**.
2. Presione **Sincronizar Estructura de Drive** para actualizar el árbol de carpetas en SQLite. Esto permite que las sugerencias de vinculación respondan en menos de **15 milisegundos**.

---

## 📱 3. Guía Operativa: Aplicación Móvil PWA (Modo Campo)

Diseñada para uso rudo en planta: alto contraste para visión bajo sol, elementos de 68px aptos para guantes y 100% operativa sin conectividad.

### 3.1 Acceso e Instalación
1. Abra el navegador en el dispositivo móvil e ingrese a:
   `http://<IP_SERVIDOR>:3000/campo`
2. Presione el botón superior **📲 INSTALAR APP DE CAMPO** para instalar la PWA en la pantalla de inicio del dispositivo.

---

### 3.2 Flujo de Trabajo en Planta

1. **Selección de Tarea:**
   - Al iniciar sesión, la pantalla inicial mostrará la sección **Mi Itinerario de Hoy** con los equipos asignados ordenados por prioridad de recorrido.
   - Si requiere inspeccionar un activo no planificado, use la barra **Buscar Activo Fuera de Ruta** para localizarlo en la base de datos local IndexedDB.
2. **Revisión de Antecedentes (`📜 HISTORIAL`):**
   - Presione el botón **`📜 HISTORIAL`** para desplegar los diagnósticos previos del equipo, materiales y componentes críticos.
   - Al cerrar el modal de historial, **el borrador en curso permanecerá intacto**.
3. **Asistente de Campo:**
   - Si tiene dudas sobre criterios de aceptación, presione el ícono del **Asistente de Campo** para obtener respuestas técnicas instantáneas.
4. **Registro de la Inspección:**
   - **Estado de Salud:** Seleccione el estado (`BUENO`, `REGULAR`, `CRÍTICO`) en los botones de alto contraste de 68px de alto.
   - **Fotografías:** Presione **Tomar / Subir Foto** seleccionando el tipo (`General`, `Placa`, `Interior`, `Fuga/Corrosión`). Las fotos se comprimen en milisegundos en el teléfono (JPEG $\le$ 1024px).
   - **Dictado de Voz:** Presione **Grabar Nota de Voz** para relatar las observaciones verbalmente sin necesidad de teclear con guantes.
   - **Observaciones:** Texto adicional redactado o dictado.
5. **Guardado y Avance:**
   - Presione **💾 GUARDAR Y SIGUIENTE**. La inspección se guardará de forma segura en IndexedDB y el sistema avanzará automáticamente al siguiente equipo del itinerario.

---

### 3.3 Sincronización y Recuperación de Red
- **Sincronización Automática:** Cuando el dispositivo detecte conexión WiFi o datos celulares, la barra de estado superior indicará `En Línea` y comenzará la subida en lote (`POST /api/inspecciones/batch`).
- **Idempotencia Garantizada:** Cada inspección utiliza un `client_uuid` criptográfico único, asegurando que ante reconexiones intermitentes ninguna inspección se duplique ni se pierda.
- **Sincronización Forzada:** Si desea subir los cambios de inmediato, presione el botón **🔄 Sincronizar Ahora** en el panel de estado.

---

## 🔧 4. Resolución de Problemas Frecuentes

| Síntoma | Causa Probable | Solución |
|---|---|---|
| **No se cargan las carpetas de Google Drive** | Service Account sin permisos o token expirado. | Verifique el archivo `service_account.json` y asegúrese de que el email de la Service Account tenga permisos de Editor en la carpeta raíz de Drive. |
| **La PWA no sincroniza los datos offline** | Sesión expirada o token JWT no válido. | Inicie sesión nuevamente en la PWA con conexión antes de ingresar a áreas sin cobertura. |
| **Error al generar el PDF del Libro** | Equipos sin inspecciones o caracteres incompatibles. | Verifique que los equipos seleccionados cuenten al menos con una inspección registrada y que las fotos estén disponibles en disco. |
| **La IA no devuelve diagnóstico** | Clave de Gemini API inválida o sin cuota. | Revise la variable `GEMINI_API_KEY` en el archivo `.env` del backend y compruebe los límites en Google AI Studio. |

---

## 📞 5. Soporte y Contacto Técnico

Para soporte técnico, reporte de fallas o solicitud de nuevas funcionalidades, contacte al equipo de soporte de ingeniería técnica o al administrador del sistema.
