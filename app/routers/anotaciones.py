from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sqlite3
import json
import logging

from app.core.dependencies import get_db, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/anotaciones", tags=["anotaciones"])

class AnotacionSaveRequest(BaseModel):
    equipo_id: int
    image_id: str
    annotations: List[Dict[str, Any]]

@router.get("/{equipo_id}", response_model=Dict[str, Any])
def get_anotaciones(equipo_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        cursor = db.cursor()
        cursor.execute("SELECT image_id, annotations FROM anotaciones_imagenes WHERE equipo_id = ?", (equipo_id,))
        rows = cursor.fetchall()
        
        anotaciones_map = {}
        for row in rows:
            image_id = row["image_id"]
            try:
                anotaciones_map[image_id] = json.loads(row["annotations"])
            except Exception:
                anotaciones_map[image_id] = []
                
        return {
            "equipo_id": equipo_id,
            "anotaciones": anotaciones_map
        }
    except Exception as e:
        logger.error(f"Error al obtener anotaciones para equipo {equipo_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al obtener anotaciones: {str(e)}")

@router.post("", response_model=Dict[str, Any])
def save_anotaciones(data: AnotacionSaveRequest, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        cursor = db.cursor()
        annotations_json = json.dumps(data.annotations)
        cursor.execute("""
            INSERT OR REPLACE INTO anotaciones_imagenes (equipo_id, image_id, annotations, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        """, (data.equipo_id, data.image_id, annotations_json))
        db.commit()
        return {
            "status": "success",
            "message": f"Anotaciones guardadas correctamente para la imagen {data.image_id}."
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error al guardar anotaciones: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al guardar anotaciones: {str(e)}")
