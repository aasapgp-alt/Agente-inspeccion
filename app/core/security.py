import os
import hashlib
import binascii
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError

from app.core.config import settings

# Constantes para la derivación de claves PBKDF2
HASH_ALGORITHM = "sha256"
ITERATIONS = 100000

def hash_password(password: str) -> str:
    """
    Genera un hash seguro para la contraseña usando PBKDF2_HMAC.
    Incluye un salt aleatorio y el formato es compatible con validaciones futuras.
    """
    try:
        salt = os.urandom(16)
        hash_bytes = hashlib.pbkdf2_hmac(
            HASH_ALGORITHM,
            password.encode('utf-8'),
            salt,
            ITERATIONS
        )
        # Formato: pbkdf2:algoritmo:iteraciones$salt_hex$hash_hex
        salt_hex = binascii.hexlify(salt).decode('ascii')
        hash_hex = binascii.hexlify(hash_bytes).decode('ascii')
        return f"pbkdf2:{HASH_ALGORITHM}:{ITERATIONS}${salt_hex}${hash_hex}"
    except Exception as e:
        raise ValueError(f"Error al generar el hash de la contraseña: {str(e)}")

def verify_password(password: str, hashed: str) -> bool:
    """
    Verifica que la contraseña en texto plano coincida con el hash almacenado.
    """
    try:
        # Extraer las partes del hash almacenado
        parts = hashed.split('$')
        if len(parts) != 3:
            return False
            
        algo_info, salt_hex, hash_hex = parts
        algo_parts = algo_info.split(':')
        
        if len(algo_parts) != 3 or algo_parts[0] != "pbkdf2":
            return False
            
        hash_name = algo_parts[1]
        iterations = int(algo_parts[2])
        salt = binascii.unhexlify(salt_hex)
        hash_bytes_stored = binascii.unhexlify(hash_hex)
        
        # Calcular el hash de la contraseña provista usando el mismo salt
        hash_bytes_computed = hashlib.pbkdf2_hmac(
            hash_name,
            password.encode('utf-8'),
            salt,
            iterations
        )
        
        # Comparación segura en tiempo constante
        return secrets.compare_digest(hash_bytes_stored, hash_bytes_computed)
    except Exception as e:
        print(f"Error en la verificación de contraseña: {e}")
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Genera un token JWT de acceso incluyendo los datos y la fecha de expiración.
    """
    try:
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRATION_HOURS)
            
        to_encode.update({"exp": expire})
        
        encoded_jwt = jwt.encode(
            to_encode, 
            settings.JWT_SECRET, 
            algorithm=settings.JWT_ALGORITHM
        )
        return encoded_jwt
    except Exception as e:
        raise ValueError(f"Error al crear el token de acceso JWT: {str(e)}")

def verify_access_token(token: str) -> dict:
    """
    Verifica la firma y la vigencia del token JWT. Devuelve el payload si es válido.
    """
    try:
        payload = jwt.decode(
            token, 
            settings.JWT_SECRET, 
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        raise ValueError(f"Token JWT inválido o expirado: {str(e)}")
    except Exception as e:
        raise ValueError(f"Error inesperado al verificar el token JWT: {str(e)}")

def generate_session_token() -> str:
    """
    Genera un token seguro y aleatorio (hexadecimal) para sesiones temporales o recovery de cuentas.
    """
    try:
        return secrets.token_hex(32)
    except Exception as e:
        raise ValueError(f"Error al generar token de sesión: {str(e)}")
