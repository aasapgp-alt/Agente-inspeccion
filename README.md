# Agente Inspector PGP

El **Agente Inspector PGP** es una aplicación corporativa Full-Stack diseñada para digitalizar, automatizar y estandarizar el proceso de inspección técnica en Paradas Generales de Planta (PGP). Integra Inteligencia Artificial (Google Gemini) para asistir en el diagnóstico de patologías industriales, manteniendo un riguroso control de versiones, autenticación por roles y generación automática de reportes.

---

## 🛠️ Arquitectura del Sistema

La plataforma está dividida en un entorno moderno y asíncrono:

- **Frontend:** Aplicación web interactiva en React/Next.js, utilizando un diseño premium *Glassmorphism* (interfaces translúcidas, modo oscuro profundo y animaciones sutiles).
- **Backend:** Desarrollado en Python con **FastAPI**, lo que garantiza alta concurrencia y tiempos de respuesta ágiles.
- **Base de Datos Multicapa:** Utiliza **SQLite** como base de datos local. Mantiene también compatibilidad con **PostgreSQL** para alta escalabilidad.
- **IA Multimodal:** Motor impulsado por **Google Gemini Vision** para la detección y análisis de patologías (oxidación, desgaste, fugas) en fotografías de equipos.
- **Integración Google Drive:** Índice local de carpetas de Drive (SQLite) para sugerencias de ubicación en ~15ms sin llamadas en tiempo real.

---

## 🚀 Funcionalidades Principales

### 1. Sistema de Autenticación, Roles y Auditoría (RBAC)
- Acceso restringido por roles: **Inspector** (sólo análisis), **Supervisor** (modificación de diagnósticos y datos técnicos) y **Admin** (eliminación de activos, gestión de usuarios).
- Sistema de login seguro usando hash PBKDF2 y tokens JWT.
- **Panel de Auditoría** (solo Admin/Supervisor): registro detallado de todos los ingresos, egresos, intentos fallidos y modificaciones técnicas (con IP, fecha, usuario y diff del cambio).

### 2. Dashboard Dinámico y Jerarquía de Activos
- Visualización de indicadores en tiempo real que reflejan la salud general de la planta (**Bueno**, **Regular**, **Crítico** y **Fuera de Ruta**).
- Navegación jerárquica: `Empresa` → `Área` → `Equipo/Activo`.
- Permite la edición en caliente de variables de diseño de los equipos (Material, Fluido, Presión, Temperatura) desde el historial de activos.

### 3. Agente Inspector IA y Google Drive
- **Caché de Drive:** Al sincronizar desde el panel de Configuración, el sistema indexa toda la jerarquía de carpetas de Drive (~3000+ carpetas en ~13 segundos) y la almacena localmente. Las sugerencias de carpeta para cada equipo se calculan en **~15ms** sin tráfico de red, limitadas a un máximo de **5 sugerencias** relevantes.
- **Contexto Histórico PGP 2024:** Durante el análisis, el backend inyecta el historial del equipo (estado y diagnóstico de la campaña 2024) al prompt de Gemini. Para componentes no visibles en las fotos, la IA hereda el diagnóstico histórico sin mencionar limitaciones de imágenes.
- **Estilo de Informe Técnico Estandarizado:**
  - El **diagnóstico** se redacta en tiempo presente impersonal (ej: *"El tramo de cañería presenta..."*, *"Se observa deterioro..."*).
  - Las **acciones y recomendaciones** se escriben en infinitivo directivo (ej: *"Continuar con inspecciones anuales"*, *"Proceder a cambio de juntas"*).
  - Las recomendaciones se estructuran en **7 categorías fijas**: `EQUIPO INTERIOR`, `EQUIPO EXTERIOR`, `SOPORTES CAÑERÍAS ASOCIADAS`, `VÁLVULAS`, `ELEMENTOS DE SUJECIÓN EN GENERAL`, `ANCLAJES`, `ACOMETIDAS`.
  - Para equipos y cañerías de material plástico (FRP, ACRBA, PP), se inyecta automáticamente una **regla preventiva crítica** en `ACOMETIDAS` sobre el reemplazo de elementos de sujeción y juntas.
- **Bucle de Aprendizaje (Few-Shot):** Si el inspector corrige el diagnóstico provisto por Gemini, el sistema aprende. La corrección se guarda y se inyecta en los *prompts* de futuras inspecciones.

### 4. Flujo de Generación de Reportes PDF
- Al completar un diagnóstico, el inspector puede guardar los datos en la BD o desencadenar la **Generación de un Reporte PDF formal**.
- El sistema utiliza `ReportLab` para construir un acta de inspección con las fotografías, anotaciones y el veredicto técnico final.
- **Control de Versiones y Polling:** La generación de reportes se maneja con estados (`pendiente`, `generando`, `completado`, `error`). La UI realiza polling en tiempo real con animaciones interactivas.
- Si un reporte se regenera, el backend rastrea la versión (v1, v2...) y almacena la copia tanto en disco local como en Google Drive.

### 5. Carga Manual
- Para equipos que no requieran análisis fotográfico por IA, la plataforma provee un panel de **Carga Manual**.
- El usuario puede consultar el historial de la campaña pasada e ingresar directamente las acciones ejecutadas y el diagnóstico para el año en curso.

---

## ⚙️ Estructura del Proyecto

```
/frontend         → React/Next.js (InspectionPanel, ManualPanel, ReportsPanel,
                    AssetHistory, SettingsPanel, AuditPanel, GlobalDashboard)
/app              → FastAPI (main.py como punto de entrada)
  /routers        → ia.py, auth.py, drive.py, audit.py, campanias.py, ...
  /services       → db_service, drive_service, pdf_service, gemini_service
  /config         → Prompts y reglas de negocio para la IA (prompts.py)
/scripts          → Inicialización y migración de la BD (init_db.py, migrate_*.py)
/data             → SQLite local (inspecciones.db) + PDFs generados
/Informes_Generados → Respaldo físico local de todos los PDFs transaccionados
```

---

## 📝 Reglas de Negocio Incorporadas

1. **Planificación Anual (PGP):** Las recomendaciones preventivas no ejecutadas se arrastran a la campaña del año siguiente.
2. **Evaluación Fotográfica Estricta:** La IA hereda el último estado conocido para componentes sin fotografías; no asume ni inventa deterioros invisibles.
3. **Normalización de Nomenclaturas:** Los estados se restringen a 4 valores: `BUENO`, `REGULAR`, `CRITICO` y `FUERA DE RUTA`.
4. **Tono de Informe Técnico:** Diagnóstico en presente impersonal. Acciones y recomendaciones en infinitivo directivo. Sin primera persona singular.
5. **Regla Preventiva de Plásticos:** Para equipos FRP/ACRBA/PP, se aplica automáticamente la recomendación de reemplazo de sujeciones y juntas en plazo ≤ 1 año.

---

## 👤 Usuarios del Sistema (Semilla)

| Usuario | Rol |
|---------|-----|
| `admin` | Admin |
| `cristaldoiq` | Admin |
| `mpaltrinieri` | Inspector |
| `hpaltrinieri` | Inspector |
| `eirioni` | Inspector |
| `gabrielng2005` | Inspector |
| `anahivillalba_06` | Inspector |

---

## 🚀 Inicio Rápido

```bash
# Backend (desde raíz del proyecto)
set PYTHONPATH=.
venv\Scripts\python.exe -m uvicorn app.main:app --reload
# → http://localhost:8000

# Frontend (desde /frontend)
npm run dev
# → http://localhost:3000
```

> **Nota:** Se requiere un archivo `mycreds.txt` con credenciales OAuth de Google Drive y una API Key de Gemini configurada en la BD (panel Configuración).