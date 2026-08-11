from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Union
import sqlite3
import logging

from app.core.dependencies import get_db, get_current_user
from app.services.inspection_service import procesar_inspecciones_batch

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inspecciones", tags=["inspecciones"])


class FotoPayload(BaseModel):
    categoria: Optional[str] = "General"
    data: str
    timestamp: Optional[Union[int, float]] = None


class AudioPayload(BaseModel):
    data: str
    timestamp: Optional[Union[int, float]] = None


class InspeccionPayload(BaseModel):
    client_uuid: Optional[str] = None
    id_activo: Optional[int] = None
    codigo_activo: Optional[str] = None
    estado: Optional[str] = "Operativo"
    categoria_foto: Optional[str] = "General"
    notas: Optional[str] = ""
    drive_folder_id: Optional[str] = None
    timestamp: Optional[Union[int, float]] = None
    fotos: Optional[List[FotoPayload]] = []
    audios: Optional[List[AudioPayload]] = []


class BatchInspeccionesPayload(BaseModel):
    inspecciones: List[InspeccionPayload]


@router.post("/batch", response_model=Dict[str, Any])
def subir_inspecciones_batch(
    payload: BatchInspeccionesPayload,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Recibe un lote (batch) de inspecciones capturadas desde la app de celular/PWA.
    Guarda las inspecciones, actualiza estados de equipos, guarda fotos/comentarios y auditoría.
    """
    try:
        user_id = current_user.get("id")
        inspecciones_dict = [insp.model_dump() for insp in payload.inspecciones]
        res = procesar_inspecciones_batch(db, inspecciones_dict, user_id=user_id)
        return res
    except Exception as e:
        logger.error(f"Error procesando lote de inspecciones: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar batch de inspecciones: {str(e)}"
        )


@router.get("/{equipo_id}", response_model=List[Dict[str, Any]])
def get_inspecciones_equipo(
    equipo_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Obtiene el historial de inspecciones registradas en la base de datos para un equipo específico.
    """
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, equipo_id, anio, estado, acciones, diagnostico, recomendaciones, created_at, updated_at, reporte_generado, numero_acta
            FROM inspecciones
            WHERE equipo_id = ?
            ORDER BY anio DESC, id DESC
        """, (equipo_id,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        logger.error(f"Error al obtener inspecciones para equipo {equipo_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener inspecciones: {str(e)}"
        )
