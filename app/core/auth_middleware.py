from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.security import verify_access_token
from app.services.db_service import get_db_connection
import logging

logger = logging.getLogger(__name__)

# Rutas que no requieren autenticación
EXCLUDED_PATHS = [
    "/api/auth/login",
    "/api/auth/register",
    "/docs",
    "/openapi.json",
    "/api/health",
    "/redoc"
]

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Permitir peticiones OPTIONS por CORS
        if request.method == "OPTIONS":
            return await call_next(request)
            
        path = request.url.path
        
        # Verificar si la ruta está excluida
        if any(path.startswith(excluded_path) for excluded_path in EXCLUDED_PATHS):
            return await call_next(request)
            
        # Si es ruta de API y no está en excepciones, verificar token
        if path.startswith("/api/"):
            auth_header = request.headers.get("Authorization")
            token = None
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
            elif path.startswith("/api/drive/imagen/"):
                token = request.query_params.get("token")
                
            if not token:
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "No autenticado o token ausente"}
                )
            try:
                payload = verify_access_token(token)
                user_id = payload.get("id")
                
                # Verificar sesión activa y usuario en BD
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    # Verificar sesión
                    cursor.execute("SELECT 1 FROM sesiones_activas WHERE token = ? AND user_id = ?", (token, user_id))
                    if not cursor.fetchone():
                        return JSONResponse(
                            status_code=status.HTTP_401_UNAUTHORIZED,
                            content={"detail": "Sesión inválida, expirada o cerrada"}
                        )
                        
                    # Verificar que el usuario sigue activo
                    cursor.execute("SELECT activo FROM usuarios WHERE id = ?", (user_id,))
                    user_row = cursor.fetchone()
                    if not user_row or not user_row["activo"]:
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "Usuario desactivado"}
                        )
            except Exception as e:
                logger.error(f"Error en middleware de autenticación: {e}")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": f"Token inválido o error de sesión"}
                )
                
        # Continuar con el request
        return await call_next(request)
