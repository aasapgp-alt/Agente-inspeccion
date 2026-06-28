import os
import secrets
import logging
from dotenv import load_dotenv

# Cargar variables de entorno desde un archivo .env si existe
load_dotenv()

logger = logging.getLogger(__name__)


def _resolver_jwt_secret() -> str:
    """Devuelve el JWT_SECRET del entorno. Si no está definido, genera uno
    aleatorio efímero y advierte: evita un secreto por defecto predecible en
    el código. En producción debe configurarse en variables de entorno."""
    valor = os.getenv("JWT_SECRET")
    if not valor:
        logger.warning(
            "JWT_SECRET no configurado: se generó uno temporal. Las sesiones se "
            "invalidarán en cada reinicio. Defina JWT_SECRET en .env para producción."
        )
        return secrets.token_hex(32)
    return valor


class Settings:
    """
    Configuración centralizada para la aplicación.
    Carga valores de las variables de entorno o utiliza valores por defecto seguros.
    """
    # Configuración JWT
    JWT_SECRET: str = _resolver_jwt_secret()
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    try:
        JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    except ValueError:
        JWT_EXPIRATION_HOURS = 24

    # Configuración Google
    # Nombre de variable unificado en GEMINI_API_KEY (coherente con .env y
    # gemini_service); se mantiene compatibilidad con la heredada GOOGLE_API_KEY.
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY", "")
    DRIVE_FOLDER_ID: str = os.getenv("DRIVE_FOLDER_ID", "")

    # Configuración BD
    DB_PATH: str = os.getenv("DB_PATH", os.path.join("data", "inspecciones.db"))
    DB_LEGACY_PATH: str = os.getenv("DB_LEGACY_PATH", "legacy.sqlite")

    # Configuración de directorios y reportes
    REPORTES_DIR: str = os.getenv("REPORTES_DIR", "data/reportes")
    LIBROS_DIR: str = os.getenv("LIBROS_DIR", "data/libros")

    # Configuración de límites (Archivos e Imágenes)
    try:
        MAX_IMAGE_SIZE_MB: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "5"))
    except ValueError:
        MAX_IMAGE_SIZE_MB = 5

    try:
        MAX_IMAGE_DIMENSION: int = int(os.getenv("MAX_IMAGE_DIMENSION", "1920"))
    except ValueError:
        MAX_IMAGE_DIMENSION = 1920

    # Configuración de Gemini (IA)
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    try:
        MAX_TOKENS: int = int(os.getenv("MAX_TOKENS", "4096"))
    except ValueError:
        MAX_TOKENS = 4096

    def __init__(self):
        # Asegurarse de que los directorios necesarios existan
        os.makedirs(self.REPORTES_DIR, exist_ok=True)
        os.makedirs(self.LIBROS_DIR, exist_ok=True)

# Instancia global de configuración
settings = Settings()
