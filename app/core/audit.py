import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.core.config import settings
from app.core.db import get_db_connection

def _get_audit_db_connection():
    """Establece una conexión a la base de datos para registrar auditorías."""
    return get_db_connection()

def registrar_auditoria(
    usuario_id: int, 
    accion: str, 
    tabla: Optional[str] = None, 
    registro_id: Optional[int] = None, 
    detalles: Optional[str] = None,
    ip_address: Optional[str] = None
) -> bool:
    """
    Registra un evento de auditoría en la base de datos (compatible con Neon PostgreSQL y SQLite).
    """
    try:
        with _get_audit_db_connection() as conn:
            cursor = conn.cursor()
            query = """
                INSERT INTO auditoria (user_id, accion, tabla, registro_id, detalles, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            cursor.execute(query, (usuario_id, accion, tabla, registro_id, detalles, ip_address))
            conn.commit()
            return True
    except Exception as e:
        print(f"Error al registrar auditoría: {e}")
        return False

def obtener_auditoria(filtros: dict) -> List[Dict[str, Any]]:
    """
    Consulta el registro de auditoría utilizando filtros opcionales.
    """
    try:
        query = "SELECT * FROM auditoria WHERE 1=1"
        params = []
        
        if "usuario_id" in filtros and filtros["usuario_id"] is not None:
            query += " AND user_id = ?"
            params.append(filtros["usuario_id"])
            
        if "accion" in filtros and filtros["accion"] is not None:
            query += " AND accion = ?"
            params.append(filtros["accion"])
            
        if "tabla" in filtros and filtros["tabla"] is not None:
            query += " AND tabla = ?"
            params.append(filtros["tabla"])
            
        if "fecha_desde" in filtros and filtros["fecha_desde"] is not None:
            query += " AND created_at >= ?"
            params.append(filtros["fecha_desde"])
            
        query += " ORDER BY created_at DESC LIMIT ?"
        params.append(filtros.get("limit", 100))

        with _get_audit_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        print(f"Error al obtener auditoría: {e}")
        return []

def log_login(usuario_id: int, ip: str, resultado: str) -> bool:
    """
    Registra específicamente un intento de inicio de sesión (Login).
    """
    try:
        detalles = json.dumps({
            "ip": ip, 
            "resultado": resultado
        })
        return registrar_auditoria(
            usuario_id=usuario_id,
            accion="LOGIN",
            detalles=detalles,
            ip_address=ip
        )
    except Exception as e:
        print(f"Error en log_login: {e}")
        return False

def log_logout(usuario_id: int) -> bool:
    """
    Registra específicamente el cierre de sesión de un usuario.
    """
    return registrar_auditoria(
        usuario_id=usuario_id,
        accion="LOGOUT"
    )

def log_modificacion(usuario_id: int, tabla: str, registro_id: int, cambios: dict) -> bool:
    """
    Registra la modificación o actualización de un registro en la base de datos,
    guardando el estado de los cambios en JSON.
    """
    try:
        detalles_json = json.dumps(cambios)
        return registrar_auditoria(
            usuario_id=usuario_id,
            accion="MODIFICACION",
            tabla=tabla,
            registro_id=registro_id,
            detalles=detalles_json
        )
    except TypeError as e:
        print(f"Error de serialización JSON en log_modificacion: {e}")
        # Si falla el JSON, se convierte a string como fallback
        return registrar_auditoria(
            usuario_id=usuario_id,
            accion="MODIFICACION",
            tabla=tabla,
            registro_id=registro_id,
            detalles=str(cambios)
        )
    except Exception as e:
        print(f"Error inesperado en log_modificacion: {e}")
        return False
