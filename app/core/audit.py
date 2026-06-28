import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.core.config import settings

def _get_audit_db_connection():
    """Establece una conexión aislada a la base de datos para registrar auditorías."""
    conn = sqlite3.connect(settings.DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def registrar_auditoria(
    usuario_id: int, 
    accion: str, 
    tabla: Optional[str] = None, 
    registro_id: Optional[int] = None, 
    detalles: Optional[str] = None
) -> bool:
    """
    Registra un evento de auditoría genérico en la base de datos de manera dinámica y tolerante a esquemas.
    """
    try:
        with _get_audit_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar las columnas existentes de la tabla auditoria
            cursor.execute("PRAGMA table_info(auditoria)")
            cols = {row[1] for row in cursor.fetchall()}
            
            if not cols:
                # Si la tabla no existe, crearla con el esquema esperado
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS auditoria (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        accion TEXT NOT NULL,
                        tabla TEXT,
                        registro_id INTEGER,
                        detalles TEXT,
                        ip_address TEXT,
                        created_at TEXT NOT NULL
                    )
                ''')
                cols = {"id", "user_id", "accion", "tabla", "registro_id", "detalles", "ip_address", "created_at"}
                
            insert_cols = []
            vals = []
            
            if "user_id" in cols:
                insert_cols.append("user_id")
                vals.append(usuario_id)
            elif "usuario_id" in cols:
                insert_cols.append("usuario_id")
                vals.append(usuario_id)
                
            insert_cols.append("accion")
            vals.append(accion)
            
            if "tabla" in cols and tabla is not None:
                insert_cols.append("tabla")
                vals.append(tabla)
                
            if "registro_id" in cols and registro_id is not None:
                insert_cols.append("registro_id")
                vals.append(registro_id)
                
            if "detalles" in cols and detalles is not None:
                insert_cols.append("detalles")
                vals.append(detalles)
                
            fecha_iso = datetime.now(timezone.utc).isoformat()
            if "created_at" in cols:
                insert_cols.append("created_at")
                vals.append(fecha_iso)
            elif "fecha" in cols:
                insert_cols.append("fecha")
                vals.append(fecha_iso)
                
            cols_str = ", ".join(insert_cols)
            placeholders = ", ".join(["?"] * len(insert_cols))
            
            query = f"INSERT INTO auditoria ({cols_str}) VALUES ({placeholders})"
            cursor.execute(query, vals)
            conn.commit()
            return True
    except sqlite3.Error as e:
        print(f"Error de base de datos al registrar auditoría: {e}")
        return False
    except Exception as e:
        print(f"Error inesperado al registrar auditoría: {e}")
        return False

def obtener_auditoria(filtros: dict) -> List[Dict[str, Any]]:
    """
    Consulta el registro de auditoría utilizando filtros opcionales.
    """
    try:
        query = "SELECT * FROM auditoria WHERE 1=1"
        params = []
        
        if "usuario_id" in filtros and filtros["usuario_id"] is not None:
            query += " AND usuario_id = ?"
            params.append(filtros["usuario_id"])
            
        if "accion" in filtros and filtros["accion"] is not None:
            query += " AND accion = ?"
            params.append(filtros["accion"])
            
        if "tabla" in filtros and filtros["tabla"] is not None:
            query += " AND tabla = ?"
            params.append(filtros["tabla"])
            
        if "fecha_desde" in filtros and filtros["fecha_desde"] is not None:
            query += " AND fecha >= ?"
            params.append(filtros["fecha_desde"])
            
        query += " ORDER BY fecha DESC LIMIT ?"
        params.append(filtros.get("limit", 100))

        with _get_audit_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar si la tabla existe primero para evitar errores
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='auditoria'")
            if not cursor.fetchone():
                return []
                
            cursor.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except sqlite3.Error as e:
        print(f"Error de base de datos al obtener auditoría: {e}")
        return []
    except Exception as e:
        print(f"Error inesperado al obtener auditoría: {e}")
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
            detalles=detalles
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
