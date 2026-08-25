from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import logging
import ssl

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# La verificación de certificados SSL puede desactivarse para entornos locales de
# Windows que fallan con los certificados de las APIs de Google. Es INSEGURO: solo
# se aplica si se define explícitamente DISABLE_SSL_VERIFY, nunca por defecto.
if os.getenv("DISABLE_SSL_VERIFY", "").lower() in ("1", "true", "yes"):
    logger.warning(
        "DISABLE_SSL_VERIFY activo: se deshabilita la verificación de certificados "
        "SSL. No usar en producción."
    )
    ssl._create_default_https_context = ssl._create_unverified_context
    try:
        import requests
        import urllib3
        orig_request = requests.Session.request
        def hacked_request(self, method, url, *args, **kwargs):
            kwargs['verify'] = False
            return orig_request(self, method, url, *args, **kwargs)
        requests.Session.request = hacked_request
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except ImportError:
        pass

from app.routers import auth, equipos, drive, ia, reports, dashboard_pg, libro_completo, jerarquia, libro, libros, anotaciones, settings as settings_router, campanias, audit, itinerarios, inspecciones
from app.services.db_service import get_db_connection
from app.core.security import hash_password, verify_access_token

app = FastAPI(
    title="Agente Inspector API",
    description="API principal para el sistema de inspección y generación de reportes",
    version="1.0.0"
)

from app.core.auth_middleware import AuthMiddleware
app.add_middleware(AuthMiddleware)

# Configurar CORS para permitir localhost, IPs locales y dominios de Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "https://agente-inspeccion.vercel.app",
        "https://agente-inspector.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

from app.core.config import settings
from app.core.db import init_pg_pool, close_pg_pool
from scripts.init_db import init_db

@app.on_event("startup")
async def startup_event():
    try:
        if settings.IS_POSTGRES:
            logger.info("Modo Neon PostgreSQL detectado. Inicializando pool de conexiones...")
            init_pg_pool()
            logger.info("Conexión con Neon PostgreSQL establecida exitosamente.")
        else:
            init_db()
            logger.info("Base de datos SQLite inicializada correctamente mediante scripts.init_db.")
            try:
                from scripts.migrate_auditoria import migrate
                migrate()
                logger.info("Migración de auditoría y carga de usuarios realizada.")
            except Exception as mig_err:
                logger.error(f"Error al correr la migración de auditoría: {mig_err}")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    if settings.IS_POSTGRES:
        close_pg_pool()

# Incluir routers
app.include_router(auth.router)
app.include_router(equipos.router)
app.include_router(drive.router)
app.include_router(ia.router)
app.include_router(reports.router)
app.include_router(dashboard_pg.router)
app.include_router(libro_completo.router)
app.include_router(jerarquia.router)
app.include_router(libro.router)
app.include_router(libros.router)
app.include_router(anotaciones.router)
app.include_router(settings_router.router)
app.include_router(campanias.router)
app.include_router(audit.router)
app.include_router(itinerarios.router)
app.include_router(inspecciones.router)

# Endpoint Health
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
