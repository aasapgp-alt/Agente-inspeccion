import sqlite3
import os
import logging
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DB_PATH", os.path.join("data", "inspecciones.db"))
LEGACY_DB_PATH = os.getenv("LEGACY_DB_PATH", "legacy_database.db")

def get_db_connection() -> sqlite3.Connection:
    # Ensure directory exists
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Integridad referencial: las FK deben activarse en cada conexión, no solo en init_db.
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def get_legacy_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(LEGACY_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def obtener_lista_equipos_db(empresa: str = None, area: str = None, anio: int = None, estado: str = None) -> list:
    try:
        with get_db_connection() as conn:
            query = """
            SELECT e.*, u.nombre as area, emp.nombre as empresa, e.codigo as numero 
            FROM equipos e
            LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            WHERE 1=1
            """
            params = []
            if empresa:
                query += " AND emp.nombre = ?"
                params.append(empresa)
            if area:
                query += " AND u.nombre = ?"
                params.append(area)
            if estado:
                query += " AND e.estado_actual = ?"
                params.append(estado)
            # Nota: 'anio' era de inspecciones, en este caso filtramos estado_actual directo o habria que joinear inspecciones
            # si realmente se requiere filtrar equipos por anio de inspeccion. 
                
            cursor = conn.execute(query, params)
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error al obtener lista de equipos: {e}")
        return []

def obtener_equipo_db(equipo_id: int) -> dict:
    try:
        with get_db_connection() as conn:
            query = """
            SELECT e.*, u.nombre as area, emp.nombre as empresa, e.codigo as numero 
            FROM equipos e
            LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            WHERE e.id = ?
            """
            cursor = conn.execute(query, (equipo_id,))
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logger.error(f"Error al obtener equipo {equipo_id}: {e}")
        return None

def actualizar_equipo_db(equipo_id: int, datos: dict) -> bool:
    try:
        with get_db_connection() as conn:
            set_clause = ", ".join([f"{k} = ?" for k in datos.keys()])
            params = list(datos.values()) + [equipo_id]
            conn.execute(f"UPDATE equipos SET {set_clause} WHERE id = ?", params)
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error al actualizar equipo {equipo_id}: {e}")
        return False

def eliminar_equipo_db(equipo_id: int) -> bool:
    try:
        with get_db_connection() as conn:
            conn.execute("DELETE FROM equipos WHERE id = ?", (equipo_id,))
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error al eliminar equipo {equipo_id}: {e}")
        return False

def guardar_inspeccion_db(datos: dict) -> int:
    try:
        with get_db_connection() as conn:
            columns = ", ".join(datos.keys())
            placeholders = ", ".join(["?"] * len(datos))
            cursor = conn.execute(
                f"INSERT INTO inspecciones ({columns}) VALUES ({placeholders})",
                list(datos.values())
            )
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"Error al guardar inspeccion: {e}")
        return 0

def obtener_inspeccion_db(equipo_id: int, anio: int) -> dict:
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM inspecciones WHERE equipo_id = ? AND anio = ? ORDER BY id DESC LIMIT 1",
                (equipo_id, anio)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logger.error(f"Error al obtener inspeccion {equipo_id}-{anio}: {e}")
        return None

def obtener_estadisticas_db(empresa_id: int = None) -> dict:
    try:
        with get_db_connection() as conn:
            query = "SELECT COUNT(*) as total, estado FROM equipos"
            params = []
            if empresa_id:
                query += " WHERE empresa_id = ?"
                params.append(empresa_id)
            query += " GROUP BY estado"
            
            cursor = conn.execute(query, params)
            stats = {row['estado']: row['total'] for row in cursor.fetchall()}
            return stats
    except Exception as e:
        logger.error(f"Error al obtener estadisticas: {e}")
        return {}

def obtener_historial_equipo_db(equipo_id: int) -> list:
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("SELECT * FROM historial_equipos WHERE equipo_id = ? ORDER BY fecha DESC", (equipo_id,))
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error al obtener historial equipo {equipo_id}: {e}")
        return []

def get_config_value_db(clave: str, default: Any = None) -> Any:
    """
    Obtiene el valor de una configuración desde la base de datos de manera dinámica y
    castea el valor según su tipo ('string', 'number', 'boolean', 'json').
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("SELECT valor, tipo FROM configuracion WHERE clave = ?", (clave,))
            row = cursor.fetchone()
            if not row:
                return default
            
            valor = row["valor"]
            tipo = row["tipo"]
            
            if tipo == "number":
                try:
                    if "." in valor:
                        return float(valor)
                    return int(valor)
                except ValueError:
                    return valor
            elif tipo == "boolean":
                return valor.lower() in ("true", "1", "yes", "on")
            elif tipo == "json":
                try:
                    import json
                    return json.loads(valor)
                except Exception:
                    return valor
            return valor
    except sqlite3.OperationalError as e:
        # Por si la tabla no existe durante la inicialización temprana
        logger.warning(f"La tabla configuracion no existe o no es accesible: {e}")
        return default
    except Exception as e:
        logger.error(f"Error al obtener configuracion '{clave}' de la base de datos: {e}")
        return default
