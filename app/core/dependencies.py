import sqlite3
from typing import Dict, Any, Callable, Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings
from app.core.security import verify_access_token

# Se define el esquema para la autenticación OAuth2 de FastAPI
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")

def get_db() -> Generator[sqlite3.Connection, None, None]:
    """
    Generador de dependencia que provee la conexión a la base de datos SQLite.
    Asegura que la conexión se cierre correctamente después de usarse.
    """
    conn = None
    try:
        conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        # Integridad referencial activa por conexión.
        conn.execute("PRAGMA foreign_keys = ON")
        yield conn
    except sqlite3.Error as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al conectar a la base de datos: {e}"
        )
    finally:
        if conn:
            conn.close()

def get_user_from_token(token: str) -> dict:
    """
    Recibe el token, lo valida y extrae la información principal del usuario.
    """
    try:
        payload = verify_access_token(token)
        username: str = payload.get("sub")
        
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No se pudieron validar las credenciales: formato del token inválido.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Extraer campos adicionales almacenados en el payload
        user_id = payload.get("id")
        role = payload.get("role", "USER")
        
        return {
            "id": user_id,
            "username": username,
            "role": role
        }
    except ValueError as e:
        # Se captura el error de validación proveniente de verify_access_token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Error inesperado al leer el token de sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token: str = Depends(oauth2_scheme), db: sqlite3.Connection = Depends(get_db)) -> dict:
    """
    Dependencia de FastAPI. Valida el token del Header Authorization y 
    verifica en la base de datos que el usuario esté activo y la sesión sea válida.
    """
    user_info = get_user_from_token(token)
    
    # Verificar en BD
    cursor = db.cursor()
    # 1. Verificar que la sesión no haya sido revocada (debe estar en sesiones_activas)
    cursor.execute("SELECT 1 FROM sesiones_activas WHERE token = ? AND user_id = ?", (token, user_info["id"]))
    if not cursor.fetchone():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ha expirado o ha sido cerrada.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # 2. Verificar que el usuario sigue activo
    cursor.execute("SELECT activo, rol, empresa FROM usuarios WHERE id = ?", (user_info["id"],))
    user_row = cursor.fetchone()
    
    if not user_row or not user_row["activo"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario ha sido desactivado.",
        )
        
    # Actualizar roles y empresa desde la BD por si cambiaron
    user_info["role"] = user_row["rol"]
    user_info["empresa"] = user_row["empresa"]
    user_info["token"] = token # Para poder invalidarlo al hacer logout
    
    return user_info

def require_role(rol: Any) -> Callable:
    """
    Fábrica de dependencias para verificar si el usuario logueado 
    tiene el rol requerido. Soporta tanto una cadena como una lista de cadenas.
    """
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        import traceback
        try:
            user_role = current_user.get("role")
            print(f"DEBUG: user_role={user_role} (type={type(user_role)}), rol={rol} (type={type(rol)})")
            if not user_role:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permiso denegado. Rol de usuario no encontrado."
                )
                
            # Soportar si se pasa una lista de roles o una cadena única
            if isinstance(rol, list):
                roles_lower = [r.lower() for r in rol]
                if isinstance(user_role, list):
                    user_roles_lower = [ur.lower() for ur in user_role]
                    if not any(ur in roles_lower for ur in user_roles_lower):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permiso denegado. Se requiere uno de los roles: {', '.join(roles_lower)}."
                        )
                else:
                    if user_role.lower() not in roles_lower:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permiso denegado. Se requiere uno de los roles: {', '.join(roles_lower)}."
                        )
            else:
                if isinstance(user_role, list):
                    user_roles_lower = [ur.lower() for ur in user_role]
                    if rol.lower() not in user_roles_lower:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permiso denegado. Se requiere el rol '{rol.lower()}' para realizar esta acción."
                        )
                else:
                    if user_role.lower() != rol.lower():
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Permiso denegado. Se requiere el rol '{rol.lower()}' para realizar esta acción."
                        )
                
            return current_user
        except Exception as e:
            print("ERROR IN role_checker:")
            traceback.print_exc()
            raise e
    return role_checker

def require_any_role(roles: list[str]) -> Callable:
    """
    Fábrica de dependencias para verificar si el usuario logueado 
    tiene AL MENOS UNO de los roles requeridos.
    """
    def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        roles_lower = [r.lower() for r in roles]
        
        if not user_role or user_role.lower() not in roles_lower:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso denegado. Se requiere uno de los roles: {', '.join(roles_lower)}."
            )
            
        return current_user
    return role_checker

def verify_user_exists(username: str) -> bool:
    """
    Verifica rápidamente y de forma síncrona si un usuario existe en 
    la base de datos (por su username). 
    Útil para chequeos fuera del inyector de dependencias (Depends).
    """
    try:
        with sqlite3.connect(settings.DB_PATH, check_same_thread=False) as conn:
            cursor = conn.cursor()
            
            # Chequeamos si la tabla de usuarios existe antes de hacer query
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'")
            if not cursor.fetchone():
                return False
                
            cursor.execute("SELECT 1 FROM usuarios WHERE username = ?", (username,))
            result = cursor.fetchone()
            
            return result is not None
    except sqlite3.Error as e:
        print(f"Error de base de datos al verificar existencia de usuario: {e}")
        return False
    except Exception as e:
        print(f"Error inesperado al verificar existencia de usuario: {e}")
        return False
