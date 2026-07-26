Agente Inspector PGP






Plataforma full-stack para digitalizar, estandarizar y automatizar el proceso de inspección técnica durante las Paradas Generales de Planta (PGP). Integra Google Gemini Vision como asistente de diagnóstico, mantiene control de versiones, autenticación por roles (RBAC) y genera actas de inspección en PDF con respaldo en Google Drive.

Problema que resuelve: en cada PGP se inspeccionan manualmente cientos de equipos, generando informes dispersos, sin trazabilidad y con criterios inconsistentes entre inspectores. Esta plataforma centraliza el proceso, reduce el tiempo por inspección y unifica el formato de los reportes técnicos.

📋 Tabla de contenidos
Stack tecnológico
Arquitectura
Funcionalidades principales
Estructura del proyecto
Inicio rápido
Configuración de credenciales
Base de datos y migraciones
Tests
API y documentación interactiva
Reglas de negocio
Troubleshooting
Seguridad y notas para producción
Usuarios semilla (desarrollo)
Licencia
🧰 Stack tecnológico
Frontend
Tecnología	Versión	Uso
Next.js	16.2.7	Framework React (App Router)
React	19.2.4	UI
Fabric.js	7.4.0	Anotaciones sobre imágenes
ESLint	9	Linter
⚠️ Next 16 y React 19 son versiones muy recientes. Las APIs y convenciones difieren de versiones anteriores. Antes de tocar el frontend, leé frontend/AGENTS.md y frontend/node_modules/next/dist/docs/.

Backend
Tecnología	Versión	Uso
Python	3.11+	Runtime
FastAPI	0.100+	Framework HTTP async
Uvicorn	0.22+	ASGI server
SQLAlchemy / sqlite3	stdlib	Persistencia
ReportLab	4.0+	Generación de PDFs
google-generativeai	0.3+	Cliente Gemini
PyDrive2	1.15+	Cliente Google Drive
passlib + python-jose	—	Hashing PBKDF2 + JWT
pytest	8.0+	Tests
Persistencia
SQLite (data/inspecciones.db) — almacén primario, ideal para despliegues locales y campañas individuales.
PostgreSQL 14+ — soportado para alta concurrencia y despliegues multi-Usuario (ver postgres_migration/).
IA
Google Gemini Vision — análisis de imágenes y generación de diagnósticos estructurados.
🏗️ Arquitectura
text

Copy
┌──────────────────┐         ┌────────────────────────┐         ┌──────────────────┐

│  Frontend        │  HTTP   │  Backend FastAPI       │  API    │  Google Gemini   │

│  Next.js +       │ ──────► │  (app/routers +        │ ──────► │  Vision          │

│  React 19        │  :8000  │   app/services)        │         │                  │

│  (puerto 3000)   │ ◄────── │  Puerto 8000           │ ◄────── │  Diagnóstico     │

└──────────────────┘  JSON   └────────┬───────────────┘  JSON   └──────────────────┘

                                       │

                          ┌────────────┼────────────┐

                          ▼            ▼            ▼

                   ┌──────────┐ ┌──────────┐ ┌──────────────┐

                   │  SQLite  │ │ Google   │ │ Reportes PDF │

                   │  (local) │ │ Drive    │ │ (local + Drive)│

                   └──────────┘ └──────────┘ └──────────────┘
Capas del backend (estrictas):

text

Copy
app/routers/*  →  app/services/*  →  app/services/db_service.py  →  SQLite

   (HTTP)         (lógica)            (acceso a datos)
Configuración en dos capas:

1.
app/core/config.py lee .env (vía python-dotenv) — variables de entorno.
2.
Tabla configuracion en SQLite — ajustes editables en runtime desde el panel de Configuración. Tiene prioridad sobre .env para claves como google_api_key y gemini_model.
🚀 Funcionalidades principales
1. Autenticación, roles y auditoría (RBAC)
Tres roles: Inspector (sólo análisis), Supervisor (modifica diagnósticos y datos técnicos), Admin (elimina activos, gestiona Usuarios).
Hash de contraseñas PBKDF2 + tokens JWT + sesiones revocables del lado servidor (tabla sesiones_activas).
Panel de Auditoría (Admin/Supervisor): log detallado de ingresos, egresos, intentos fallidos y modificaciones técnicas, con IP, fecha, Usuario y diff del cambio.
2. Dashboard dinámico y jerarquía de activos
Indicadores en tiempo real: BUENO, REGULAR, CRITICO, FUERA DE RUTA.
Navegación jerárquica: Empresa → Área/Ubicación → Equipo/Activo.
Edición en caliente de variables de diseño (Material, Fluido, Presión, Temperatura) desde el historial del activo.
3. Agente Inspector IA + Google Drive
Caché de carpetas de Drive: indexa +3000 carpetas en ~13 s desde el panel de Configuración; las sugerencias se calculan en ~15 ms sin tráfico de red (máx. 5 sugerencias relevantes).
Contexto histórico PGP 2024: el backend inyecta el historial del equipo al prompt de Gemini. Para componentes sin foto, la IA hereda el último estado conocido sin inventar deterioros.
Estilo de informe técnico estandarizado:
Diagnóstico en presente impersonal ("El tramo de cañería presenta…", "Se observa deterioro…").
Acciones y recomendaciones en infinitivo directivo ("Continuar con inspecciones anuales", "Proceder a cambio de juntas").
7 categorías fijas: EQUIPO INTERIOR, EQUIPO EXTERIOR, SOPORTES CAÑERÍAS ASOCIADAS, VÁLVULAS, ELEMENTOS DE SUJECIÓN EN GENERAL, ANCLAJES, ACOMETIDAS.
Regla plástica (FRP/ACRBA/PP): inyección automática de recomendación crítica en ACOMETIDAS sobre reemplazo de sujeciones y juntas.
Bucle de aprendizaje (Few-Shot): cuando el inspector corrige el diagnóstico de Gemini, la corrección se guarda y se inyecta en futuros prompts.
4. Reportes PDF con control de versiones
Generación con ReportLab: fotografías, anotaciones y veredicto técnico.
Asíncrona con estados (pendiente → generando → completado / error) y polling desde la UI.
Versionado: cada regeneración incrementa la versión (v1, v2…); cada PDF se guarda en data/reportes/, data/libros/ y un respaldo en Informes_Generados/, más copia en Google Drive.
5. Carga manual
Panel para equipos sin análisis fotográfico por IA: consulta el historial de la campaña anterior y carga directamente las acciones y el diagnóstico.
📁 Estructura del proyecto
text

Copy
Agente-inspeccion/

├── frontend/                      # Next.js 16 + React 19

│   ├── app/                       # App Router activo (NO src/app — es scaffold sobrante)

│   ├── components/                # Componentes cliente (.jsx, glassmorphism oscuro)

│   ├── services/                  # api.js — cliente HTTP centralizado

│   └── scripts/                   # Scripts .mjs auxiliares

│

├── app/                           # Backend FastAPI

│   ├── main.py                    # Punto de entrada: app.main:app

│   ├── core/                      # AuthMiddleware, dependencies, security, config

│   ├── routers/                   # 19 routers REST

│   │   ├── auth.py                # Login, register, sesiones

│   │   ├── ia.py / ia_pg.py       # Análisis Gemini (SQLite / PostgreSQL)

│   │   ├── drive.py               # Sincronización e índice de Drive

│   │   ├── audit.py               # Panel de auditoría

│   │   ├── campanias.py           # Gestión de campañas PGP

│   │   ├── equipos.py             # CRUD de activos

│   │   ├── inspecciones.py        # CRUD de inspecciones

│   │   ├── reportes.py / reports.py

│   │   ├── anotaciones.py         # Anotaciones sobre imágenes

│   │   ├── libro.py / libro_completo.py / libros.py

│   │   ├── dashboard_pg.py        # Métricas agregadas

│   │   ├── config.py / settings.py

│   │   └── jerarquia.py

│   ├── services/                  # 13 servicios de negocio

│   │   ├── db_service.py          # Acceso a SQLite (única vía)

│   │   ├── gemini_service.py      # Cliente Gemini + parsing

│   │   ├── drive_service.py       # PyDrive2 + índice de carpetas

│   │   ├── pdf_service.py         # ReportLab

│   │   ├── learning_service.py    # Few-shot loop

│   │   └── ...

│   ├── config/                    # prompts.py, constants.py, defaults.py

│   └── utils/

│

├── scripts/                       # Inicialización y migraciones

│   ├── init_db.py                 # Crea esquema + siembra Usuarios

│   ├── migrate_legacy.py          # Importa SQLite heredado

│   ├── migrate_versions.py        # Upgrade entre versiones

│   ├── migrate_auditoria.py       # Upgrade pre-auditoría → con auditoría

│   └── migrate_drive_cache.py     # Regenera índice de Drive

│

├── tests/                         # Pytest

│   ├── conftest.py

│   ├── test_auth_routes.py

│   ├── test_db_service.py

│   ├── test_gemini_service.py

│   ├── test_ia_estado.py

│   ├── test_security.py

│   └── test_text_utils.py

│

├── data/                          # SQLite + PDFs generados

├── Informes_Generados/            # Respaldo físico de PDFs

├── postgres_migration/            # Utilidades para PostgreSQL

│

├── .env.example                   # Plantilla de variables de entorno

├── pytest.ini

├── requirements.txt

└── run_backend.bat                # Wrapper Windows (define PYTHONPATH)
⚡ Inicio rápido
Requisitos previos
Python 3.11+
Node.js 20+ y npm
SQLite 3 (incluido en Python) o PostgreSQL 14+ si vas a usar ese backend
Cuenta de Google Cloud con Drive API habilitada
API Key de Google Gemini
1. Clonar y configurar
bash

Copy
git clone https://github.com/aasapgp-alt/Agente-inspeccion.git

cd Agente-inspeccion


# Backend

python -m venv venv

# Windows:

venv\Scripts\activate

# Linux/macOS:

# source venv/bin/activate


pip install -r requirements.txt

cp .env.example .env       # editar credenciales (ver siguiente sección)
2. Inicializar la base de datos
bash

Copy
# Desde la raíz del proyecto (con venv activado)

python scripts/init_db.py
Este paso es obligatorio la primera vez. Crea data/inspecciones.db, el esquema completo y siembra los Usuarios de desarrollo.

3. Levantar el backend
bash

Copy
# Windows (recomendado — wrapper que setea PYTHONPATH y usa venv):

run_backend.bat


# Equivalente manual (cualquier SO):

set PYTHONPATH=.             # Windows

# export PYTHONPATH=.        # Linux/macOS

python -m uvicorn app.main:app --reload
Backend disponible en http://localhost:8000. init_db() se vuelve a ejecutar automáticamente al arrancar (es idempotente).

4. Levantar el frontend
bash

Copy
cd frontend

npm install

npm run dev
Frontend disponible en http://localhost:3000. Apunta fijo al backend en :8000.

🔐 Configuración de credenciales
1. Gemini API Key
Puede definirse en dos lugares (la BD tiene prioridad):

.env → GEMINI_API_KEY=tu_clave
Panel de Configuración (clave google_api_key en la tabla configuracion)
Si la clave de la BD está vacía, se recurre a la variable de entorno.

2. Google Drive (cuenta de servicio)
1.
En Google Cloud Console, creá una cuenta de servicio con acceso a la API de Drive.
2.
Descargá el JSON de credenciales y guardalo fuera del repo (ej: ~/.gcp/praxis-effort-XXXX.json).
3.
Configurá la ruta en app/services/drive_service.py → settings.yaml (o donde el service lo lea).
4.
Compartí la carpeta raíz de Drive con el email de la cuenta de servicio.
⚠️ El JSON de credenciales es sensible y está en .gitignore. Nunca lo subas al repositorio.

3. JWT Secret
Generá uno fuerte para producción:

bash

Copy
python -c "import secrets; print(secrets.token_hex(32))"
Pegalo en .env → JWT_SECRET.

4. Variables en .env
Variable	Descripción	Default
GEMINI_API_KEY	API key de Gemini (fallback si la BD está vacía)	—
JWT_SECRET	Secreto para firmar tokens JWT	⚠️ cambiar en prod
DB_PATH	Ruta al archivo SQLite	data/inspecciones.db
ADMIN_INITIAL_PASSWORD	Password del Usuario admin sembrado. Si se deja vacío, init_db genera una aleatoria y la imprime una sola vez en consola	vacío
DISABLE_SSL_VERIFY	Workaround para Windows local con problemas de certificados. Inseguro en prod.	false
🗄️ Base de datos y migraciones
Script	Cuándo ejecutarlo
python scripts/init_db.py	Siempre al instalar. Crea esquema y siembra Usuarios. Idempotente.
python scripts/migrate_legacy.py	Si traés datos de la versión heredada (.sqlite legacy).
python scripts/migrate_versions.py	Upgrade no destructivo entre versiones del esquema.
python scripts/migrate_auditoria.py	Si actualizás desde una versión pre-auditoría y querés el log.
python scripts/migrate_drive_cache.py	Para regenerar el índice local de carpetas de Drive.
ℹ️ La BD activa es data/inspecciones.db. Los archivos database.db o database.sqlite sueltos en la raíz no se usan — son remanentes.

Para usar PostgreSQL en vez de SQLite, consultá postgres_migration/.

✅ Tests
bash

Copy
# Todos los tests

pytest


# Archivo específico

pytest tests/test_auth_routes.py -v


# Solo los rápidos (excluir los de integración)

pytest -m "not slow"
Configuración en pytest.ini.

📡 API y documentación interactiva
Con el backend levantado, visitá:

Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc
OpenAPI JSON: http://localhost:8000/openapi.json
El prefijo de todas las rutas de negocio es /api/* (excepto health, docs y login). El middleware verifica JWT + sesión activa + Usuario activo.

📝 Reglas de negocio
1.
Planificación anual (PGP): las recomendaciones preventivas no ejecutadas se arrastran a la campaña del año siguiente.
2.
Evaluación fotográfica estricta: la IA hereda el último estado conocido para componentes sin foto; no asume ni inventa deterioros invisibles.
3.
Normalización de nomenclaturas: los estados se restringen a 4 valores: BUENO, REGULAR, CRITICO, FUERA DE RUTA.
4.
Tono del informe técnico: diagnóstico en presente impersonal, acciones/recomendaciones en infinitivo directivo, sin primera persona singular.
5.
Regla preventiva de plásticos: para equipos FRP/ACRBA/PP, se inyecta automáticamente la recomendación de reemplazo de sujeciones y juntas en plazo ≤ 1 año (categoría ACOMETIDAS).
6.
Herencia de campaña: etiqueta por defecto PGP 2026.
Los prompts/reglas viven en app/config/prompts.py y son editables.

🛟 Troubleshooting
Síntoma	Causa probable	Solución
ModuleNotFoundError: No module named 'app'	PYTHONPATH no apunta a la raíz	Usá run_backend.bat o exportá PYTHONPATH=.
no such table: usuarios	No se corrió init_db.py	python scripts/init_db.py
Frontend no carga datos	Backend no está corriendo en :8000	Verificá que uvicorn esté activo
Sugerencias de Drive vacías	Caché no sincronizada	Panel Configuración → "Sincronizar Drive"
Gemini devuelve error 4xx	API key inválida o ausente	Revisá BD (clave google_api_key) o .env (GEMINI_API_KEY)
Next 16 rompe un componente	API reciente, convenciones nuevas	Leé frontend/AGENTS.md y frontend/node_modules/next/dist/docs/
🔒 Seguridad y notas para producción
Cambiá JWT_SECRET por un valor aleatorio fuerte antes de cualquier despliegue real.
Cambiá la password del Usuario admin (default: admin123 en init_db). Usá ADMIN_INITIAL_PASSWORD o rotala después.
No subas credenciales: el JSON de Drive y .env están en .gitignore. Verificá antes de cada git push.
DISABLE_SSL_VERIFY=true es solo para Windows local con problemas de certificados. Nunca en producción.
Sesiones revocables: el logout invalida la fila en sesiones_activas, no solo el token. La revocación es inmediata.
Auditoría: toda acción de Supervisor/Admin queda registrada con IP, timestamp, Usuario y diff. No se puede borrar.
👤 Usuarios semilla (desarrollo)



📄 Licencia
Uso interno. Todos los derechos reservados.
