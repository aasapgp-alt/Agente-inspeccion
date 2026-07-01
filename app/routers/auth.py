from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import sqlite3
from datetime import datetime, timedelta, timezone

from app.core.dependencies import get_db, get_current_user, require_role
from app.core.security import create_access_token, verify_password, hash_password
from app.core.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    nombre_completo: str
    rol: str = "inspector"
    empresa: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    nombre_completo: str
    rol: str
    empresa: Optional[str] = None
    activo: bool
    ultimo_login: Optional[str] = None
    created_at: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    # Accept both username or email for login
    cursor.execute("""
        SELECT id, username, email, password_hash, nombre_completo, rol, empresa, activo 
        FROM usuarios 
        WHERE username = ? OR email = ?
    """, (data.username, data.username))
    user = cursor.fetchone()
    
    ip_addr = request.client.host if request.client else "127.0.0.1"
    
    if not user or not verify_password(data.password, user["password_hash"]):
        if user:
            from app.core.audit import log_login
            log_login(usuario_id=user["id"], ip=ip_addr, resultado="FALLIDO: Contraseña incorrecta")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user["activo"]:
        from app.core.audit import log_login
        log_login(usuario_id=user["id"], ip=ip_addr, resultado="FALLIDO: Usuario desactivado")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario está desactivado"
        )
        
    # Actualizar ultimo_login
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute("UPDATE usuarios SET ultimo_login = ? WHERE id = ?", (now_str, user["id"]))
    
    # Generar token
    expires_delta = timedelta(hours=settings.JWT_EXPIRATION_HOURS)
    access_token = create_access_token(
        data={"sub": user["username"], "id": user["id"], "role": user["rol"], "empresa": user["empresa"]},
        expires_delta=expires_delta
    )
    
    # Registrar sesión activa
    expires_at = datetime.now(timezone.utc) + expires_delta
    cursor.execute(
        "INSERT INTO sesiones_activas (user_id, token, expires_at) VALUES (?, ?, ?)",
        (user["id"], access_token, expires_at.isoformat())
    )
    
    db.commit()
    
    # Registrar auditoría de login exitoso
    from app.core.audit import log_login
    log_login(usuario_id=user["id"], ip=ip_addr, resultado="EXITOSO")
    
    user_dict = dict(user)
    del user_dict["password_hash"]
    
    return TokenResponse(access_token=access_token, user=user_dict)

@router.post("/logout")
def logout(current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("DELETE FROM sesiones_activas WHERE token = ?", (current_user["token"],))
    db.commit()
    
    # Registrar auditoría de logout
    from app.core.audit import log_logout
    log_logout(usuario_id=current_user["id"])
    
    return {"message": "Sesión cerrada correctamente"}

@router.post("/register", response_model=UserResponse, dependencies=[Depends(require_role("admin"))])
def register(data: UserRegister, db: sqlite3.Connection = Depends(get_db)):
    if data.rol not in ["inspector", "supervisor", "admin"]:
        raise HTTPException(status_code=400, detail="Rol inválido")
        
    cursor = db.cursor()
    cursor.execute("SELECT id FROM usuarios WHERE username = ? OR email = ?", (data.username, data.email))
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="El usuario o email ya existe")
        
    pwd_hash = hash_password(data.password)
    try:
        cursor.execute(
            """INSERT INTO usuarios 
            (username, email, password_hash, nombre_completo, rol, empresa) 
            VALUES (?, ?, ?, ?, ?, ?)""",
            (data.username, data.email, pwd_hash, data.nombre_completo, data.rol, data.empresa)
        )
        db.commit()
        user_id = cursor.lastrowid
        
        cursor.execute("SELECT * FROM usuarios WHERE id = ?", (user_id,))
        new_user = cursor.fetchone()
        return dict(new_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM usuarios WHERE id = ?", (current_user["id"],))
    user = cursor.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return dict(user)

@router.post("/change-password")
def change_password(data: ChangePasswordRequest, current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT password_hash FROM usuarios WHERE id = ?", (current_user["id"],))
    user = cursor.fetchone()
    
    if not user or not verify_password(data.old_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Contraseña actual incorrecta")
        
    new_pwd_hash = hash_password(data.new_password)
    try:
        cursor.execute("UPDATE usuarios SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_pwd_hash, current_user["id"]))
        
        # Opcional: Cerrar todas las sesiones activas al cambiar la contraseña
        cursor.execute("DELETE FROM sesiones_activas WHERE user_id = ?", (current_user["id"],))
        
        db.commit()
        return {"message": "Contraseña actualizada correctamente. Debe iniciar sesión nuevamente."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usuarios", response_model=List[UserResponse], dependencies=[Depends(require_role("admin"))])
def list_usuarios(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, username, email, nombre_completo, rol, empresa, activo, ultimo_login, created_at FROM usuarios ORDER BY id DESC")
    return [dict(row) for row in cursor.fetchall()]

@router.post("/usuarios/{user_id}/toggle", dependencies=[Depends(require_role("admin"))])
def toggle_usuario(user_id: int, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT activo FROM usuarios WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
    new_status = not user["activo"]
    try:
        cursor.execute("UPDATE usuarios SET activo = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (new_status, user_id))
        if not new_status:
            # Eliminar sesiones activas si se desactiva
            cursor.execute("DELETE FROM sesiones_activas WHERE user_id = ?", (user_id,))
        db.commit()
        return {"message": f"Usuario {'activado' if new_status else 'desactivado'} correctamente", "activo": new_status}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
