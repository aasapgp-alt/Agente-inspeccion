from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import sqlite3
from datetime import date
from app.core.dependencies import get_db, get_current_user, require_any_role

router = APIRouter(prefix="/api/itinerarios", tags=["itinerarios"])

class ItinerarioCreate(BaseModel):
    username: str
    fecha: str
    equipos_codigos: List[str]

@router.get("/")
def get_itinerarios(fecha: Optional[str] = None, user_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        query = """
            SELECT pid.*, u.username, u.nombre_completo, e.codigo, e.nombre as equipo_nombre
            FROM plan_inspeccion_diaria pid
            JOIN usuarios u ON pid.usuario_id = u.id
            JOIN equipos e ON pid.equipo_id = e.id
            WHERE e.activo = 1
        """
        params = []
        
        # Si el usuario es inspector, restringir a sus propias tareas y por defecto al día de hoy
        if current_user.get("rol") == "inspector":
            target_user_id = current_user.get("id")
            target_fecha = fecha or date.today().isoformat()
            query += " AND pid.usuario_id = ? AND pid.fecha = ?"
            params.extend([target_user_id, target_fecha])
        else:
            if fecha:
                query += " AND pid.fecha = ?"
                params.append(fecha)
            if user_id:
                query += " AND pid.usuario_id = ?"
                params.append(user_id)
            
        query += " ORDER BY pid.fecha DESC, pid.usuario_id, pid.orden ASC"
        
        cursor = db.execute(query, params)
        rows = cursor.fetchall()
        return {"itinerarios": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hoy")
def get_itinerario_hoy(user_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Obtiene específicamente la ruta asignada para hoy al usuario autenticado."""
    try:
        hoy = date.today().isoformat()
        target_user_id = current_user.get("id")
        
        # Administradores y supervisores pueden consultar el de otro usuario si lo indican
        if current_user.get("rol") in ("admin", "supervisor") and user_id:
            target_user_id = user_id
            
        query = """
            SELECT pid.*, u.username, u.nombre_completo, e.codigo, e.nombre as equipo_nombre, e.estado_actual
            FROM plan_inspeccion_diaria pid
            JOIN usuarios u ON pid.usuario_id = u.id
            JOIN equipos e ON pid.equipo_id = e.id
            WHERE pid.fecha = ? AND pid.usuario_id = ? AND e.activo = 1
            ORDER BY pid.orden ASC
        """
        cursor = db.execute(query, (hoy, target_user_id))
        rows = cursor.fetchall()
        return {"itinerarios": [dict(r) for r in rows], "fecha": hoy, "usuario_id": target_user_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/progreso")
def get_progreso_itinerario(fecha: Optional[str] = None, user_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Obtiene el porcentaje y conteo de avance en vivo de las inspecciones programadas."""
    try:
        target_date = fecha or date.today().isoformat()
        
        # Si el usuario es inspector y no especificó user_id, forzar su propio id
        target_user_id = user_id
        if current_user.get("rol") == "inspector" or not target_user_id:
            if current_user.get("rol") == "inspector":
                target_user_id = current_user.get("id")

        query = "SELECT estado FROM plan_inspeccion_diaria WHERE fecha = ?"
        params = [target_date]
        if target_user_id:
            query += " AND usuario_id = ?"
            params.append(target_user_id)

        cursor = db.execute(query, params)
        rows = cursor.fetchall()
        
        total = len(rows)
        completados = sum(1 for r in rows if (r["estado"] or "").upper() in ("COMPLETADO", "FINALIZADO", "OK"))
        pendientes = total - completados
        porcentaje = round((completados / total * 100), 1) if total > 0 else 0.0

        return {
            "fecha": target_date,
            "total": total,
            "completados": completados,
            "pendientes": pendientes,
            "porcentaje": porcentaje,
            "usuario_id": target_user_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/")
def create_itinerario(data: ItinerarioCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_any_role(["supervisor", "admin"]))):
    try:
        # 1. Buscar usuario
        cursor = db.execute("SELECT id FROM usuarios WHERE username = ?", (data.username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuario '{data.username}' no encontrado")
            
        user_id = user["id"]
        
        # 2. Buscar e indexar equipos
        equipos_db = []
        for cod in data.equipos_codigos:
            cursor = db.execute("SELECT id FROM equipos WHERE codigo = ? AND activo = 1", (cod,))
            eq = cursor.fetchone()
            if not eq:
                raise HTTPException(status_code=400, detail=f"Equipo '{cod}' no existe o está inactivo")
            equipos_db.append(eq["id"])
            
        # 3. Limpiar itinerario existente para el usuario y fecha
        db.execute("DELETE FROM plan_inspeccion_diaria WHERE usuario_id = ? AND fecha = ?", (user_id, data.fecha))
        
        # 4. Insertar equipos en la ruta
        for orden, eq_id in enumerate(equipos_db, 1):
            db.execute("""
                INSERT INTO plan_inspeccion_diaria (usuario_id, fecha, equipo_id, orden, estado)
                VALUES (?, ?, ?, ?, 'PENDIENTE')
            """, (user_id, data.fecha, eq_id, orden))
            
        db.commit()
        return {"message": "Itinerario creado exitosamente", "usuario_id": user_id, "fecha": data.fecha, "equipos_count": len(equipos_db)}
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/")
def delete_itinerario(username: str, fecha: str, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_any_role(["supervisor", "admin"]))):
    try:
        cursor = db.execute("SELECT id FROM usuarios WHERE username = ?", (username,))
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuario '{username}' no encontrado")
            
        db.execute("DELETE FROM plan_inspeccion_diaria WHERE usuario_id = ? AND fecha = ?", (user["id"], fecha))
        db.commit()
        return {"message": "Itinerario eliminado exitosamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/usuarios")
def get_usuarios_itinerarios(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_any_role(["supervisor", "admin"]))):
    try:
        cursor = db.execute("SELECT id, username, nombre_completo, rol FROM usuarios WHERE activo = 1 ORDER BY nombre_completo")
        return {"usuarios": [dict(r) for r in cursor.fetchall()]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/equipos")
def get_equipos_itinerarios(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_any_role(["supervisor", "admin"]))):
    try:
        cursor = db.execute("SELECT id, codigo, nombre FROM equipos WHERE activo = 1 ORDER BY codigo")
        return {"equipos": [dict(r) for r in cursor.fetchall()]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
