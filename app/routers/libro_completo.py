from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import sqlite3
import os
import uuid
from app.core.dependencies import get_db, get_current_user, require_role
# from app.services.libro_completo_generator import LibroCompletoGenerator

router = APIRouter(prefix="/api/libro-completo", tags=["libro_completo"])

class GenerarLibroRequest(BaseModel):
    campania: str
    empresa_id: Optional[int] = None
    area: Optional[str] = None

# Diccionario temporal en memoria para rastrear tareas, en un entorno real podría usar Redis o BD
task_status_store = {}

def generar_libro_task(task_id: str, campania: str, empresa_id: Optional[int], area: Optional[str], user_id: int):
    # Simulando el proceso en background
    try:
        task_status_store[task_id] = {"status": "processing", "progress": 10}
        # service = LibroCompletoGenerator(...)
        # file_path = service.generate(...)
        task_status_store[task_id] = {"status": "completed", "progress": 100, "libro_id": 1} # Mock ID
    except Exception as e:
        task_status_store[task_id] = {"status": "failed", "error": str(e)}

@router.post("/generar", response_model=Dict[str, Any])
def generar_libro(data: GenerarLibroRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    task_status_store[task_id] = {"status": "pending", "progress": 0}
    
    background_tasks.add_task(generar_libro_task, task_id, data.campania, data.empresa_id, data.area, current_user["id"])
    
    return {"message": "Generación iniciada", "task_id": task_id}

@router.get("/estado/{task_id}", response_model=Dict[str, Any])
def get_libro_estado(task_id: str, current_user: dict = Depends(get_current_user)):
    status_info = task_status_store.get(task_id)
    if not status_info:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return status_info

@router.get("/descargar/{libro_id}")
def descargar_libro(libro_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT filepath FROM libros_completos WHERE id = ?", (libro_id,))
    libro = cursor.fetchone()
    if not libro or not libro["filepath"] or not os.path.exists(libro["filepath"]):
        raise HTTPException(status_code=404, detail="Archivo de libro no encontrado")
    return FileResponse(path=libro["filepath"], filename=os.path.basename(libro["filepath"]))

@router.get("/historial", response_model=List[Dict[str, Any]])
def historial_libros(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM libros_completos ORDER BY fecha_generacion DESC")
    return [dict(row) for row in cursor.fetchall()]

@router.get("/{libro_id}/drive", response_model=Dict[str, Any])
def get_libro_drive(libro_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT drive_file_id, drive_url FROM libros_completos WHERE id = ?", (libro_id,))
    libro = cursor.fetchone()
    if not libro:
        raise HTTPException(status_code=404, detail="Libro no encontrado")
    return {"drive_file_id": libro["drive_file_id"], "drive_url": libro["drive_url"]}

@router.delete("/{libro_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role("ADMIN"))])
def delete_libro(libro_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM libros_completos WHERE id = ?", (libro_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Libro no encontrado")
    try:
        cursor.execute("DELETE FROM libros_completos WHERE id = ?", (libro_id,))
        db.commit()
        return {"message": "Libro eliminado"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
