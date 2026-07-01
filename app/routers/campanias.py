from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sqlite3
import uuid
import logging

from app.core.dependencies import get_db, get_current_user, require_role, require_any_role
from app.core.audit import registrar_auditoria, log_modificacion
from app.services.drive_service import crear_campania_en_equipos_de_empresa

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/campanias", tags=["campanias"])

class CampaniaCreate(BaseModel):
    empresa_id: int
    nombre: str
    descripcion: Optional[str] = None
    pre_replicar: bool = False
    subcarpetas: Optional[List[str]] = ["Succion", "Impulsión"]

class CampaniaUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activa: Optional[bool] = None

# Diccionario temporal en memoria para rastrear tareas de Drive
campania_tasks = {}

@router.get("", response_model=List[Dict[str, Any]])
def get_campanias(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Retorna la lista de todas las campañas registradas.
    Permite filtrar opcionalmente por empresa_id.
    """
    try:
        cursor = db.cursor()
        query = "SELECT c.*, e.nombre as empresa_nombre FROM campanias c JOIN empresas e ON c.empresa_id = e.id"
        params = []
        if empresa_id:
            query += " WHERE c.empresa_id = ?"
            params.append(empresa_id)
        query += " ORDER BY c.created_at DESC"
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error al obtener campañas: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("", response_model=Dict[str, Any])
def create_campania(
    campania: CampaniaCreate, 
    background_tasks: BackgroundTasks,
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(require_role("admin"))
):
    """
    Crea una nueva campaña para una empresa.
    Opcionalmente inicia una tarea en segundo plano para pre-replicar la estructura en Drive.
    """
    try:
        cursor = db.cursor()
        
        # Desactivar las campañas anteriores de la misma empresa si la nueva se crea como activa
        cursor.execute("UPDATE campanias SET activa = 0 WHERE empresa_id = ?", (campania.empresa_id,))
        
        cursor.execute("""
            INSERT INTO campanias (empresa_id, nombre, descripcion, activa)
            VALUES (?, ?, ?, 1)
        """, (campania.empresa_id, campania.nombre, campania.descripcion))
        
        # También actualizar el setting global de reporte_campania al nombre de la nueva campaña
        cursor.execute("""
            UPDATE configuracion 
            SET valor = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE clave = 'reporte_campania'
        """, (campania.nombre,))
        
        db.commit()
        nuevo_id = cursor.lastrowid
        
        registrar_auditoria(
            usuario_id=current_user.get("id"),
            accion="CREAR_CAMPANIA",
            tabla="campanias",
            registro_id=nuevo_id,
            detalles=f"Campaña '{campania.nombre}' creada para empresa ID {campania.empresa_id}."
        )
        
        task_id = None
        if campania.pre_replicar:
            task_id = str(uuid.uuid4())
            campania_tasks[task_id] = {"status": "pending", "progress": 0, "mensaje": "Tarea en cola..."}
            background_tasks.add_task(
                crear_campania_en_equipos_de_empresa,
                campania.empresa_id,
                campania.nombre,
                campania.subcarpetas,
                task_id,
                campania_tasks
            )
            
        return {
            "id": nuevo_id, 
            "message": "Campaña creada exitosamente",
            "task_id": task_id
        }
    except sqlite3.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="La campaña ya existe para esta empresa")
    except Exception as e:
        db.rollback()
        logger.error(f"Error al crear campaña: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/tareas/{task_id}", response_model=Dict[str, Any])
def get_tarea_status(task_id: str, current_user: dict = Depends(get_current_user)):
    """
    Retorna el estado de progreso de una tarea de pre-replicación en Drive.
    """
    status_info = campania_tasks.get(task_id)
    if not status_info:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return status_info

@router.put("/{id}", response_model=Dict[str, Any])
def update_campania(
    id: int, 
    data: CampaniaUpdate, 
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(require_any_role(["supervisor", "admin"]))
):
    """
    Actualiza metadatos de una campaña. Si se activa, desactiva las otras de la misma empresa.
    """
    try:
        cursor = db.cursor()
        cursor.execute("SELECT * FROM campanias WHERE id = ?", (id,))
        campania = cursor.fetchone()
        if not campania:
            raise HTTPException(status_code=404, detail="Campaña no encontrada")
            
        updates = []
        params = []
        
        if data.nombre is not None:
            updates.append("nombre = ?")
            params.append(data.nombre)
        if data.descripcion is not None:
            updates.append("descripcion = ?")
            params.append(data.descripcion)
        if data.activa is not None:
            updates.append("activa = ?")
            params.append(1 if data.activa else 0)
            
        if not updates:
            return {"message": "No hay datos para actualizar"}
            
        params.append(id)
        
        if data.activa:
            # Desactivar otras campañas de la misma empresa
            cursor.execute("UPDATE campanias SET activa = 0 WHERE empresa_id = ?", (campania["empresa_id"],))
            
            # Actualizar el setting de reporte_campania al nombre de la campaña activa
            camp_name = data.nombre if data.nombre is not None else campania["nombre"]
            cursor.execute("""
                UPDATE configuracion 
                SET valor = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE clave = 'reporte_campania'
            """, (camp_name,))
            
        cursor.execute(f"UPDATE campanias SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()
        
        registrar_auditoria(
            usuario_id=current_user.get("id"),
            accion="ACTUALIZAR_CAMPANIA",
            tabla="campanias",
            registro_id=id,
            detalles=f"Campaña ID {id} actualizada."
        )
        
        return {"message": "Campaña actualizada exitosamente"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar campaña {id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}", response_model=Dict[str, Any])
def delete_campania(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    """
    Elimina una campaña de la base de datos.
    """
    try:
        cursor = db.cursor()
        cursor.execute("SELECT * FROM campanias WHERE id = ?", (id,))
        campania = cursor.fetchone()
        if not campania:
            raise HTTPException(status_code=404, detail="Campaña no encontrada")
            
        cursor.execute("DELETE FROM campanias WHERE id = ?", (id,))
        db.commit()
        
        registrar_auditoria(
            usuario_id=current_user.get("id"),
            accion="ELIMINAR_CAMPANIA",
            tabla="campanias",
            registro_id=id,
            detalles=f"Campaña '{campania['nombre']}' eliminada."
        )
        return {"message": "Campaña eliminada exitosamente"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error al eliminar campaña {id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
