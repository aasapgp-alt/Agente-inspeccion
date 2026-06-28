# app/config/constants.py

# Estados válidos
ESTADOS_VALIDOS = ["BUENO", "REGULAR", "CRITICO", "FUERA DE RUTA"]

# Roles
ROLES = ["inspector", "supervisor", "admin"]

# Campañas
CAMPAÑAS = ["PGP 2026", "PGP 2027", "PGP 2028"]

# Mapeo de colores para estados
COLORES_ESTADOS = {
    "BUENO": "#28a745",       # Verde
    "REGULAR": "#ffc107",     # Amarillo
    "CRITICO": "#dc3545",     # Rojo
    "FUERA DE RUTA": "#6c757d" # Gris
}

# Rutas de carpetas por defecto
CARPETAS_DEFAULT = {
    "DATA": "data/",
    "TEMP": "temp/",
    "REPORTES": "Informes_Generados/",
    "MEDIA": "extracted_media/"
}

# Límites numéricos
LIMITES = {
    "MAX_IMAGE_SIZE_MB": 10,
    "TIMEOUT_SECONDS": 60,
    "MAX_RETRIES": 3,
    "MAX_DIMENSION_IMG": 2048
}

# Constantes de configuración de Drive
DRIVE_CONFIG = {
    "SCOPES": ['https://www.googleapis.com/auth/drive'],
    "TOKEN_FILE": "token.json",
    "CREDENTIALS_FILE": "credentials.json"
}
