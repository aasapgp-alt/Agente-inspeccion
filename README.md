# Agente Inspector PGP

El **Agente Inspector PGP** es una aplicación corporativa Full-Stack diseñada para digitalizar, automatizar y estandarizar el proceso de inspección técnica en Paradas Generales de Planta (PGP). Integra Inteligencia Artificial (Google Gemini) para asistir en el diagnóstico de patologías industriales, manteniendo un riguroso control de versiones, autenticación por roles y generación automática de reportes.

---

## 🛠️ Arquitectura del Sistema

La plataforma está dividida en un entorno moderno y asíncrono:

- **Frontend:** Aplicación web interactiva en React, utilizando un diseño premium *Glassmorphism* (interfaces translúcidas, modo oscuro profundo y animaciones sutiles).
- **Backend:** Desarrollado en Python con **FastAPI**, lo que garantiza alta concurrencia y tiempos de respuesta ágiles.
- **Base de Datos Multicapa:** Utiliza **SQLite** como base de datos local para desarrollo/despliegues rápidos y sincroniza/persiste métricas hacia una base de datos centralizada en **PostgreSQL** para alta escalabilidad. Además, mantiene compatibilidad con bases de datos heredadas (legacy).
- **IA Multimodal:** Motor impulsado por **Google Gemini Vision** para la detección y análisis de patologías (oxidación, desgaste, fugas) en fotografías de equipos.

---

## 🚀 Funcionalidades Principales

### 1. Sistema de Autenticación y Auditoría (RBAC)
- Acceso restringido por roles: **Inspector** (sólo análisis), **Supervisor** (modificación de diagnósticos y datos técnicos) y **Admin** (eliminación de activos, gestión de usuarios).
- Sistema de login seguro usando hash PBKDF2 y tokens opacos de sesión (JWT/Hex).
- Registro estricto de auditoría para toda acción destructiva o modificación técnica (registra la IP, la fecha y el usuario).

### 2. Dashboard Dinámico y Jerarquía de Activos
- Visualización de indicadores en tiempo real que reflejan la salud general de la planta (**Bueno**, **Regular**, **Crítico** y **Fuera de Ruta**).
- Navegación jerárquica: `Empresa` -> `Área` -> `Equipo/Activo`.
- Permite la edición en caliente de variables de diseño de los equipos (Material, Fluido, Presión, Temperatura) desde el historial de activos.

### 3. Agente Inspector IA y Google Drive
- **Integración con Drive:** Auto-descubrimiento y navegación por el árbol de directorios de Google Drive para ubicar las carpetas de imágenes del equipo actual.
- **Contexto Histórico:** Durante el análisis, el backend envía de forma transparente el historial del equipo (ej. estado de la campaña 2024) y las instrucciones ingresadas por el usuario al motor de IA.
- **Bucle de Aprendizaje (Few-Shot):** Si el inspector corrige el diagnóstico provisto por Gemini, el sistema aprende. La corrección se guarda en Drive y se inyecta en los *prompts* de las futuras inspecciones para mejorar la precisión.

### 4. Flujo de Generación de Reportes PDF
- Al completar un diagnóstico, el inspector puede guardar los datos en la BD o desencadenar la **Generación de un Reporte PDF formal**.
- El sistema utiliza `ReportLab` para construir un acta de inspección con las fotografías, anotaciones y el veredicto técnico final.
- **Control de Versiones y Polling:** La generación de reportes se maneja con estados (`pendiente`, `generando`, `completado`, `error`). La UI realiza un "polling" (consulta) en tiempo real al backend para mostrar el avance interactivo (con animaciones). 
- Si un reporte se regenera, el backend rastrea la versión (v1, v2...) y almacena la copia tanto en el disco local como en la nube de Google Drive.

### 5. Carga Manual
- Para equipos que no requieran análisis fotográfico por IA, la plataforma provee un panel de **Carga Manual**.
- El usuario puede consultar el historial de la campaña pasada (como referencia interactiva) e ingresar directamente las acciones ejecutadas y el diagnóstico para el año en curso.

---

## ⚙️ Estructura del Proyecto

- `/frontend`: Código fuente en React/Next.js de la interfaz de usuario. Contiene componentes globales, paneles modulares (`InspectionPanel`, `ReportsPanel`, `AssetHistory`) y manejo de contexto de autenticación.
- `/app`: Servidor FastAPI (punto de entrada `app/main.py`, `app.main:app`). Incluye la lógica de enrutamiento (`app/routers/`, p. ej. `ia.py`), validación de modelos (`app/models/`), seguridad y configuración (`app/core/`).
- `/app/services`: Capa de abstracción de servicios (`db_service`, `drive_service`, `pdf_service`, `gemini_service`).
- `/app/config`: Prompts, constantes y valores por defecto de la IA.
- `/scripts`: Inicialización y migración de la base de datos (`init_db.py`, `migrate_legacy.py`).
- `/data`: Bases de datos SQLite y artefactos de persistencia (reportes, libros).
- `/Informes_Generados`: Directorio local (Windows) de respaldo donde el sistema guarda una copia física de todos los PDFs transaccionados.

---

## 📝 Reglas de Negocio Incorporadas

1. **Planificación Anual (PGP):** Toda acción o recomendación preventiva que no se ejecute en la campaña actual se reasigna a la campaña del año siguiente automáticamente en las recomendaciones.
2. **Evaluación Fotográfica Estricta:** La IA tiene prohibido inferir daños o patologías de componentes mecánicos para los cuales no existan fotografías subidas al sistema. Si faltan fotos, debe asumir el último estado conocido.
3. **Normalización de Nomenclaturas:** Las tablas de salud se restringen de forma estricta a 4 estados: `BUENO`, `REGULAR`, `CRITICO` y `FUERA DE RUTA`. Cualquier estado heredado es mapeado a esta norma para integridad de reportes.