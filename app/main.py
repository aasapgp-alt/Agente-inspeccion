from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
import ssl

# Bypass SSL certificate verification globally (useful for Windows local environments)
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

from app.routers import auth, equipos, drive, ia, reports, dashboard_pg, libro_completo, jerarquia, libro, libros, anotaciones, settings as settings_router
from app.services.db_service import get_db_connection
from app.core.security import hash_password, verify_access_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Agente Inspector API",
    description="API principal para el sistema de inspección y generación de reportes",
    version="1.0.0"
)

# Configurar CORS
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]

from app.core.auth_middleware import AuthMiddleware
app.add_middleware(AuthMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Manejo de excepciones globales
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error global detectado: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Ha ocurrido un error interno en el servidor."}
    )

from scripts.init_db import init_db

@app.on_event("startup")
async def startup_event():
    try:
        init_db()
        logger.info("Base de datos inicializada correctamente mediante scripts.init_db.")
    except Exception as e:
        logger.error(f"Error al inicializar la base de datos: {e}")

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

# Endpoint Health
@app.get("/api/health", tags=["health"])
async def health_check():
    return {"status": "ok"}
