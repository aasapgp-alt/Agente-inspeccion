# 🏭 Agente Inspector PGP

**Agente Inspector PGP** es una plataforma corporativa Full-Stack diseñada para digitalizar, estandarizar y potenciar con Inteligencia Artificial el proceso integral de inspección técnica en **Paradas Generales de Planta (PGP)** y campañas de mantenimiento en plantas industriales.

La solución combina una **App Móvil PWA Offline-First** para inspectores en campo, una **Consola Web de Gestión y Diagnóstico Multimodal con IA (Google Gemini)**, un motor automatizado de generación de **Reportes Individuales y Libros de Inspección (PDF)** con ReportLab, sincronización con **Google Drive API** y control de accesos por roles (**RBAC**) con auditoría técnica.

---

## 🌟 Características Principales

### 📱 1. Modo Campo (App Móvil PWA Offline-First)
- **Interfaz industrial de alto contraste:** Diseñada específicamente en `app/campo/campo.css` con tipografía de alta visibilidad (`#ffffff` sobre slate `#090d16`) y componentes táctiles (*glove-friendly* de 68px) para operar bajo luz solar directa o en turno nocturno con guantes.
- **Arquitectura Offline (IndexedDB / Dexie.js):** Almacena localmente activos, itinerarios asignados, fotos comprimidas y notas de voz para operar sin conexión en el interior de plantas.
- **Compresión inteligente en el dispositivo:** Reducción de imágenes en cliente (JPEG 0.65, $\le$ 1024px) vía `browser-image-compression` y grabación de audios vía `MediaRecorder API`.
- **Asistente de Campo con IA:** Modal interactivo (`AsistenteCampoModal`) que responde consultas técnicas sobre el equipo en inspección.
- **Historial Flotante sin pérdida de datos:** Consulta del historial completo (`📜 HISTORIAL`) y diagnósticos previos sin perder fotos, audios ni textos redactados en el borrador en curso.
- **Sincronización Batch Idempotente:** Sincronización en lote (`POST /api/inspecciones/batch`) con identificadores únicos (`client_uuid`) que evitan duplicados en caso de cortes de red.

### 🧠 2. Consola Web & Diagnóstico Asistido por IA (Gemini Vision)
- **Diagnóstico Multimodal:** Detección de patologías (corrosión, picaduras, desalineación, fallas en anclajes y juntas) a partir de fotografías y notas de voz.
- **Copilot de Equipo (`EquipoCopilotDrawer`):** Drawer interactivo para consultar dudas técnicas, consultar antecedentes y generar recomendaciones contextuales en tiempo real para cada equipo.
- **Visor HD de Fotografías (`ImageViewerModal`):** Modal de alta resolución con zoom, navegación entre imágenes y análisis detallado de evidencias fotográficas.
- **Estándar Técnico Estructurado:**
  - Diagnóstico en tiempo presente impersonal.
  - Acciones y recomendaciones en infinitivo directivo.
  - **7 categorías normativas fijas:** `EQUIPO INTERIOR`, `EQUIPO EXTERIOR`, `SOPORTES CAÑERÍAS ASOCIADAS`, `VÁLVULAS`, `ELEMENTOS DE SUJECIÓN EN GENERAL`, `ANCLAJES`, `ACOMETIDAS`.
  - **Regla preventiva para plásticos:** Inyección automática de pautas de recambio de juntas y elementos de fijación para equipos en FRP, ACRBA, PP.
- **Bucle de Aprendizaje (Few-Shot):** Las correcciones aplicadas por supervisores alimentan el contexto para futuros diagnósticos.

### 📊 3. Dashboard Dinámico, Minutas y Resumen PGP
- **Semáforo de Salud de Planta:** Métricas globales en tiempo real (**Bueno**, **Regular**, **Crítico**, **Fuera de Ruta**).
- **Panel de Minutas y Resumen PGP:** Vista unificada con indicadores KPI, resumen ejecutivo, filtros por ubicación/área y exportación de datos para comités de planta.
- **Jerarquía Multinivel:** `Empresa` $\rightarrow$ `Ubicación / Área` $\rightarrow$ `Equipo / Activo`.

### 📑 4. Generación de Reportes PDF y Libros Consolidados (ReportLab)
- **Reportes Individuales Versionados:** Generación asíncrona de informes PDF con carátula formal, datos de diseño del equipo, fotos integradas y firmas técnicas.
- **Estructura jerárquica en Disco y Google Drive:** Los reportes se almacenan organizados automáticamente en subcarpetas `[Ubicación] / [Año-Campaña]`.
- **Libros Consolidados por Área:** Generación de compendios PDF que unifican todos los reportes de un área con portada institucional, resumen de campaña, tablas de estado, firmas de directores e inspectores y plantilla de objetivos dinámicos.
- **Personalización Total:** Configuración de razón social de la empresa inspectora, subtítulos, normativas técnicas aplicadas (ASTM, NOGA, MTI, ESA/FSA), datos de firmantes y cargos.

### 🔐 5. Seguridad, Roles (RBAC) y Auditoría
- **Control de Acceso basado en Roles:**
  - `Admin`: Gestión de usuarios, configuración global, itinerarios, auditoría completa.
  - `Supervisor`: Edición técnica en caliente, aprobación de diagnósticos, planificación de itinerarios.
  - `Inspector`: Operación en campo PWA, carga manual, visualización de rutas asignadas.
- **Seguridad:** Tokens JWT, contraseñas con PBKDF2 y registro de auditoría de cada modificación técnica con diffs, usuario e IP.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | Next.js 14 / React, Tailwind CSS, Lucide Icons, Dexie.js (IndexedDB), Browser Image Compression |
| **Backend** | Python 3.10+, FastAPI, Pydantic, Uvicorn |
| **Base de Datos** | SQLite (Local / Default) con soporte y esquema listo para PostgreSQL |
| **Motor IA** | Google Gemini (Gemini 2.5 Flash / Gemini Pro Vision) |
| **Almacenamiento Cloud** | Google Drive API v3 (Service Account / OAuth2) |
| **Generación Documental**| ReportLab (PDF Engine con estilos corporativos) |

---

## 📂 Estructura del Repositorio

```
Agente-Inspector/
├── app/                              # Backend FastAPI
│   ├── core/                         # Configuración, Seguridad JWT, Middleware Auth
│   ├── db/                           # Conexión SQLite / Postgres y esquemas
│   ├── routers/                      # Endpoints REST (Auth, Equipos, IA, Itinerarios, Libro, Reports, Dashboard)
│   └── services/                     # Servicios (Gemini, Drive, PDF Service, Reporte Service, Auditoría)
├── frontend/                         # Frontend Next.js / PWA
│   ├── app/                          # App Router (Dashboard, /campo, Login)
│   ├── components/                   # Componentes Web (InspectionPanel, MinutaResumenPanel, SettingsPanel, etc.)
│   │   ├── campo/                    # Componentes modulares del Modo Campo PWA
│   │   ├── EquipoCopilotDrawer.jsx   # Copilot IA interactivo por equipo
│   │   └── ImageViewerModal.jsx      # Visor HD de fotos de inspección
│   ├── hooks/                        # Custom React Hooks (usePreCargaInicial, useOnlineStatus)
│   ├── services/                     # Clientes API (api.js)
│   └── utils/                        # Dexie DB (db.js), sincronización (sync.js), haptics.js
├── data/                             # Base de datos SQLite, reportes locales y libros
├── docs/                             # Especificaciones de diseño y arquitectura mobile
├── scripts/                          # Scripts de inicialización y migración (init_db.py)
├── MANUAL.md                         # Manual de usuario y guía operativa completa
├── requirements.txt                  # Dependencias de Python
└── README.md                         # Documentación técnica general
```

---

## ⚙️ Instalación y Puesta en Marcha

### Requisitos Previos
- **Python:** 3.10 o superior
- **Node.js:** 18.x o superior con `npm`
- **Cuenta de Google Cloud:** Con API de Google Drive habilitada y Service Account (opcional para Drive)
- **API Key de Google Gemini:** Para las funciones de visión e inteligencia artificial

---

### 1. Configuración del Backend (FastAPI)

1. Clonar el repositorio y posicionarse en la raíz:
   ```bash
   git clone https://github.com/aasapgp-alt/Agente-inspeccion.git
   cd Agente-Inspector
   ```

2. Crear y activar un entorno virtual de Python:
   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```

3. Instalar las dependencias de Python:
   ```bash
   pip install -r requirements.txt
   ```

4. Configurar las variables de entorno:
   Copiar `.env.example` a `.env` y configurar las claves:
   ```bash
   copy .env.example .env
   ```
   *Variables principales en `.env`:*
   ```env
   GEMINI_API_KEY=tu_gemini_api_key
   SECRET_KEY=tu_clave_secreta_jwt_para_tokens
   DATABASE_PATH=data/database.db
   DRIVE_FOLDER_ID=tu_carpeta_raiz_en_google_drive
   GOOGLE_APPLICATION_CREDENTIALS=service_account.json
   ```

5. Inicializar la base de datos con tablas y configuraciones por defecto:
   ```bash
   python scripts/init_db.py
   ```

6. Iniciar el servidor backend:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   *La documentación interactiva Swagger estará disponible en: `http://localhost:8000/docs`.*

---

### 2. Configuración del Frontend (Next.js)

1. Ingresar al directorio del frontend e instalar paquetes:
   ```bash
   cd frontend
   npm install
   ```

2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   *La consola web estará disponible en: `http://localhost:3000`.*  
   *La aplicación móvil PWA estará en: `http://localhost:3000/campo`.*

3. Para compilar a producción:
   ```bash
   npm run build
   npm start
   ```

---

## 🔑 Comandos Clave del Proyecto

| Acción | Comando |
|---|---|
| **Iniciar Backend** | `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` |
| **Iniciar Frontend** | `cd frontend && npm run dev` |
| **Inicializar BD** | `python scripts/init_db.py` |
| **Ejecutar Tests** | `pytest` |
| **Compilar Frontend** | `cd frontend && npm run build` |

---

## 📖 Documentación Adicional

- [Manual de Uso Operativo (MANUAL.md)](file:///c:/Agente-Inspector/MANUAL.md) — Guía paso a paso para Administradores, Supervisores e Inspectores de Campo.
- [Arquitectura de UI Móvil (docs/MOBILE_UI_ARCHITECTURE.md)](file:///c:/Agente-Inspector/docs/MOBILE_UI_ARCHITECTURE.md) — Especificación de componentes y flujo offline.
- [Diseño del Sistema Móvil (docs/MOBILE_UI_DESIGN_SYSTEM.md)](file:///c:/Agente-Inspector/docs/MOBILE_UI_DESIGN_SYSTEM.md) — Paleta de colores de alto contraste y lineamientos táctiles.

---

## 📄 Licencia

Este proyecto es de uso exclusivo y confidencial para inspecciones técnicas industriales en Paradas Generales de Planta (PGP).
