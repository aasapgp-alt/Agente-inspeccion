# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

## Qué es esto

**Agente Inspector PGP** — una aplicación full-stack para digitalizar inspecciones industriales durante las Paradas Generales de Planta (PGP). Un backend en FastAPI (Python) impulsa un frontend en Next.js, usa Google Gemini Vision para diagnosticar patologías de equipos a partir de fotos, persiste en SQLite y genera reportes de inspección en PDF almacenados tanto localmente como en Google Drive. El código, los comentarios, el esquema de la base de datos y la interfaz están en español.

## Arquitectura Gstack — Directrices operativas

Trabaja en este repositorio bajo la **arquitectura Gstack**: una operación coordinada por tres agentes lógicos internos que Claude adopta como roles según la naturaleza de cada tarea. No son procesos separados; son sombreros que Claude se pone de forma explícita y secuencial.

### Agentes lógicos internos

1. **[CEO/Planificador]** — Diseña los pasos para ordenar y estructurar el trabajo. Antes de tocar código, descompone la tarea en un plan corto y concreto, decide qué agentes intervienen y en qué orden, e identifica los archivos afectados. Es el único que define el alcance; mantiene la tarea dentro del presupuesto.
2. **[Frontend Designer]** — Ejecuta los cambios visuales y de interfaz. **Debe usar activamente el plugin `frontend-design`** (instalado en este proyecto) para toda decisión estética: dirección visual, tipografía, jerarquía y composición. Respeta el lenguaje de diseño glassmorphism oscuro y trabaja sobre `frontend/app/` y `frontend/components/`, canalizando las llamadas al backend por `frontend/services/api.js`.
3. **[Code Reviewer]** — Revisor experto enfocado en la **calidad, el rendimiento y la limpieza** del código. Verifica que el cambio respete las capas (routers → services → `db_service`), los imports absolutos `app.*`, el manejo de errores con `logger.error` y valores por defecto seguros, y la ausencia de duplicación o regresiones. Da el visto bueno final.

### Regla estricta de control de presupuesto

- **Prohibido entrar en bucles de discusión entre agentes.** Cada rol interviene una sola vez por tarea, en orden. Ningún agente revisa, contradice ni reabre lo decidido por otro de forma iterativa. Si hay un desacuerdo real, el **[CEO/Planificador]** decide y se continúa.
- **Límite máximo de 3 pasos por tarea.** Una tarea se resuelve en como mucho tres pasos (típicamente: planificar → ejecutar → revisar). Si no cabe en 3 pasos, el **[CEO/Planificador]** debe replantear el alcance o pedir aclaración al usuario antes de continuar — nunca encadenar pasos adicionales por iniciativa propia.

## Comandos

Backend (ejecutar desde la raíz del repositorio; requiere `PYTHONPATH` apuntando a la raíz para que los imports `app.*` se resuelvan):

```bash
# Wrapper de conveniencia para Windows (define PYTHONPATH, usa venv, puerto 8000):
run_backend.bat
# Invocación manual equivalente:
PYTHONPATH=. python -m uvicorn app.main:app --reload   # http://localhost:8000

python scripts/init_db.py        # crear/poblar SQLite (también se ejecuta automáticamente al arrancar)
python scripts/migrate_legacy.py # importar datos desde el *.sqlite heredado (legacy)
python scripts/migrate_versions.py
```

Frontend (desde `frontend/`):

```bash
npm run dev     # next dev, http://localhost:3000 (llama de forma fija al backend en :8000)
npm run build
npm run lint    # eslint
```

**No existe una suite de pruebas automatizada.** Los archivos `scratch_*.py` en la raíz del repositorio y `frontend/scripts/*.mjs` son sondas manuales ad-hoc, no un framework de pruebas.

## Convenciones críticas

- **El backend vive en `app/`, no en `backend/`.** `backend/` es un remanente vacío (solo `__init__.py`) de un renombrado; el README todavía dice `/backend`. El punto de entrada real es `app/main.py` (`app.main:app`). `replace_imports.py` fue la herramienta de migración puntual `backend.` → `app.` — no reintroduzcas imports `backend.`.
- **Todos los imports `app.*` son absolutos desde la raíz del repositorio.** Nada funciona sin que `PYTHONPATH` apunte a la raíz del proyecto (por eso `run_backend.bat` lo define).
- **El Next.js del frontend es una versión muy reciente (Next 16 / React 19).** Según `frontend/AGENTS.md`: las APIs y convenciones difieren de versiones anteriores de Next.js — lee `frontend/node_modules/next/dist/docs/` antes de escribir código del frontend en lugar de basarte en la memoria.
- El App Router activo vive en `frontend/app/` (`layout.js`, `page.js`). `frontend/src/app/` es scaffold por defecto sobrante — ignóralo.

## Estilo de código

- **Idioma:** todo el código nuevo (nombres de funciones, variables, comentarios, mensajes de log, textos de la interfaz y descripciones de la base de datos) se escribe en español, igual que el código existente.
- **Backend:** Python con type hints en las firmas (como en `app/core/`). Capas separadas estrictamente: routers → services → `db_service`. La lógica de negocio no va en los routers; el acceso crudo a SQLite no va en los services salvo a través de `db_service`.
- **Imports:** siempre absolutos desde la raíz (`from app.services...`), nunca relativos ni con el prefijo `backend.`.
- **Frontend:** componentes de cliente en `.jsx` dentro de `frontend/components/`; todas las llamadas al backend pasan por `frontend/services/api.js` (no usar `fetch` directo en los componentes). Lenguaje de diseño: glassmorphism oscuro.
- **Manejo de errores:** los services registran con `logger.error(...)` y devuelven valores por defecto seguros (listas/dicts vacíos) en lugar de propagar excepciones cuando corresponde, siguiendo el patrón de `db_service` y `gemini_service`.

## Arquitectura

### Configuración en dos capas (importante y fácil de equivocar)
1. **`app/core/config.py` (`settings`)** — singleton `Settings` basado en variables de entorno (JWT, rutas, límites). Lee `.env` mediante `python-dotenv`.
2. **Tabla `configuracion` en SQLite** — ajustes editables en tiempo de ejecución, leídos mediante `get_config_value_db()` en `db_service`. **Los valores de la BD tienen prioridad** para claves como `google_api_key` y `gemini_model` (ver `gemini_service.inicializar_gemini`), recurriendo a las variables de entorno solo cuando la clave de la BD está vacía.

Nota la inconsistencia en los nombres de la API key entre capas: `.env`/`gemini_service` usan `GEMINI_API_KEY`, `config.py` lee `GOOGLE_API_KEY`, y la clave de la BD es `google_api_key`. Al conectar Gemini, define `google_api_key` en la BD (vía el panel de Configuración) o la variable de entorno `GEMINI_API_KEY`.

### Autenticación y autorización
- El **`AuthMiddleware`** personalizado (`app/core/auth_middleware.py`) protege todas las rutas `/api/*` excepto una lista de permitidos en `EXCLUDED_PATHS` (login, register, health, docs). Valida la firma JWT del token Bearer **y** verifica que la fila del token exista en la tabla `sesiones_activas` **y** que el usuario siga `activo` — las sesiones son revocables del lado del servidor, no solo JWT sin estado. El endpoint de imágenes `/api/drive/imagen/*` además acepta el token como parámetro de query `?token=` (para etiquetas `<img>`).
- `app/core/dependencies.py` provee los equivalentes a nivel de ruta: `get_current_user`, `require_role(rol)`, `require_any_role([...])`. Los roles son `inspector` / `supervisor` / `admin` (RBAC; la comparación no distingue mayúsculas/minúsculas).
- Las contraseñas usan hashing PBKDF2 personalizado en `app/core/security.py` (formato `pbkdf2:algo:iters$salt$hash`), comparadas en tiempo constante. `init_db` crea un admin por defecto: **`admin` / `admin123`** — cámbialo en cualquier despliegue real.

### Flujo de petición
`app/main.py` registra los routers y CORS (permite `localhost:3000/3001`), deshabilita globalmente la verificación SSL (un workaround para Windows local — ver el inicio de `main.py`), ejecuta `scripts.init_db.init_db()` al arrancar y tiene un manejador de excepciones global que devuelve 500. Capas:

`app/routers/*` (HTTP, dependencias de auth, validación) → `app/services/*` (lógica de negocio) → `app/services/db_service.py` (SQLite crudo vía `get_db_connection`, filas `sqlite3.Row`).

Los routers vienen en variantes simples y `_pg` (`ia.py`/`ia_pg.py`, `dashboard_pg.py`) — las `_pg` apuntan a la ruta de PostgreSQL/métricas centralizadas (ver `postgres_migration/`); SQLite es el almacén primario/local.

### Jerarquía de dominio y reglas de negocio
La jerarquía de activos es `empresas` → `ubicaciones` (área) → `equipos`. Los estados de salud están **estrictamente normalizados a cuatro valores**: `BUENO`, `REGULAR`, `CRITICO`, `FUERA DE RUTA` — los estados heredados deben mapearse a estos. La etiqueta de campaña por defecto es `PGP 2026`. La IA no debe inferir daño en componentes sin fotos subidas (debe asumir el último estado conocido).

### IA de inspección y bucle de autoaprendizaje
`gemini_service.py` envía imágenes en base64 + el historial del equipo + instrucciones a Gemini Vision y parsea un diagnóstico estructurado. Cuando un inspector corrige la salida de Gemini, `learning_service.py` añade a `data/few_shot_examples.json` y `data/lessons_learned.txt`; estos se inyectan en los prompts futuros (aprendizaje few-shot). Los prompts/constantes/valores por defecto viven en `app/config/` (`prompts.py`, `constants.py`, `defaults.py`).

### Reportes y versionado
`pdf_service.py` (ReportLab) construye los PDFs de inspección individuales; los services `libro_completo_*` construyen un "libro" completo que agrega los equipos de una ubicación. La generación de reportes es asíncrona con estados (`pendiente`/`generando`/`completado`/`error`) que el frontend consulta por polling. Las regeneraciones se versionan en `versiones_reportes`; cada PDF se almacena tanto localmente (`data/reportes`, `data/libros`, más una copia de respaldo en `Informes_Generados/`) como se sube a Google Drive.

### Google Drive
`drive_service.py` usa una **cuenta de servicio** (PyDrive2) configurada vía `settings.yaml` → `praxis-effort-*.json`. Auto-descubre el árbol de carpetas de Drive para ubicar la carpeta de imágenes de un equipo, y sube los PDFs generados. El JSON de credenciales es sensible y está en gitignore — no lo subas al repositorio.

### Disposición de la persistencia
- Base de datos SQLite primaria: `data/inspecciones.db` (se sobreescribe con `DB_PATH`). El esquema se crea de forma idempotente con `scripts/init_db.py` (tablas: `usuarios`, `sesiones_activas`, `auditoria`, `libros`, `versiones_reportes`, `anotaciones_imagenes`, `configuracion`, más las tablas de dominio equipos/ubicaciones/empresas/inspecciones).
- SQLite heredada (`00_AASA_MINUTA_PGP_UTF8.sqlite` / `legacy_database.db`) leída vía `get_legacy_connection`; migrada con `migrate_legacy.py`.
- Los archivos sueltos `database.db` / `database.sqlite` en la raíz no son la BD activa — la activa es `data/inspecciones.db`.

### Frontend
App Router de Next.js (`frontend/app/`) + componentes de cliente en `frontend/components/` (`InspectionPanel`, `ReportsPanel`, `AssetHistory`, `GlobalDashboard`, `ManualPanel`, `SettingsPanel`, `Login`, `AuthProvider`, `Sidebar`, anotación de imágenes con `fabric`). Todas las llamadas al backend pasan por `frontend/services/api.js`, que fija `http://localhost:8000/api` y envía el token de sesión como header `Bearer`. El lenguaje de diseño es glassmorphism oscuro.
