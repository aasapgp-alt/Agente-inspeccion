from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Any, List
import sqlite3
import json
import logging

from app.core.dependencies import get_db, get_current_user, require_role
from app.core.audit import log_modificacion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("", response_model=List[Dict[str, Any]])
def get_settings(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Retorna la lista de todas las configuraciones del sistema, ordenadas por categoría y clave.
    Cualquier usuario autenticado puede visualizar las configuraciones.
    """
    try:
        cursor = db.cursor()
        cursor.execute("""
            SELECT id, clave, valor, tipo, descripcion, categoria, editable 
            FROM configuracion 
            ORDER BY categoria, clave
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Error al obtener configuraciones: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener configuraciones: {str(e)}"
        )

class SettingsBulkUpdateRequest(BaseModel):
    settings: Dict[str, Any]

@router.put("", response_model=Dict[str, Any])
def update_settings(
    data: SettingsBulkUpdateRequest, 
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(require_role("admin"))
):
    """
    Actualización masiva de configuraciones del sistema.
    Solo accesible para usuarios con el rol ADMIN.
    Valida el tipo de dato y registra los cambios en la tabla de auditoría.
    """
    try:
        cursor = db.cursor()
        
        # Obtener todas las configuraciones actuales para validar existencia, tipo y valor anterior
        cursor.execute("SELECT id, clave, valor, tipo, editable FROM configuracion")
        current_configs = {
            row["clave"]: {
                "id": row["id"],
                "valor_anterior": row["valor"],
                "tipo": row["tipo"],
                "editable": row["editable"]
            } for row in cursor.fetchall()
        }
        
        cambios_realizados = []
        
        for clave, valor_crudo in data.settings.items():
            if clave not in current_configs:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La configuración '{clave}' no existe en el sistema."
                )
                
            config_meta = current_configs[clave]
            
            # Verificar si es editable
            if not config_meta["editable"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"La configuración '{clave}' no es editable."
                )
                
            tipo = config_meta["tipo"]
            valor_anterior = config_meta["valor_anterior"]
            valor_str = ""
            
            # Validar y serializar según el tipo
            if tipo == "number":
                try:
                    # Debe poder convertirse a float/int
                    num_val = float(valor_crudo)
                    # Mantener formato string para almacenamiento
                    valor_str = str(valor_crudo)
                except (ValueError, TypeError):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El valor para '{clave}' debe ser un número válido."
                    )
            elif tipo == "boolean":
                if isinstance(valor_crudo, bool):
                    valor_str = "true" if valor_crudo else "false"
                elif str(valor_crudo).lower() in ("true", "1", "yes", "on"):
                    valor_str = "true"
                elif str(valor_crudo).lower() in ("false", "0", "no", "off"):
                    valor_str = "false"
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"El valor para '{clave}' debe ser un booleano válido."
                    )
            elif tipo == "json":
                # Si viene como dict/list, serializar. Si viene como string, validar cargando
                if isinstance(valor_crudo, (dict, list)):
                    valor_str = json.dumps(valor_crudo)
                else:
                    try:
                        json.loads(str(valor_crudo))
                        valor_str = str(valor_crudo)
                    except (ValueError, TypeError):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"El valor para '{clave}' debe ser un JSON válido."
                        )
            else:
                # String standard
                valor_str = str(valor_crudo)
                
            # Solo actualizar si el valor cambió
            if valor_str != valor_anterior:
                cursor.execute("""
                    UPDATE configuracion 
                    SET valor = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE clave = ?
                """, (valor_str, clave))
                
                cambios_realizados.append({
                    "config_id": config_meta["id"],
                    "clave": clave,
                    "anterior": valor_anterior,
                    "nuevo": valor_str
                })
                
        # Guardar en base de datos
        db.commit()
        
        # Registrar en la tabla de auditoría para cada cambio realizado
        for cambio in cambios_realizados:
            log_modificacion(
                usuario_id=current_user["id"],
                tabla="configuracion",
                registro_id=cambio["config_id"],
                cambios={
                    "clave": cambio["clave"],
                    "valor_anterior": cambio["anterior"],
                    "valor_nuevo": cambio["nuevo"]
                }
            )
            
        return {
            "status": "success",
            "message": f"Se actualizaron {len(cambios_realizados)} configuraciones correctamente.",
            "updated_keys": [c["clave"] for c in cambios_realizados]
        }
        
    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        logger.error(f"Error al actualizar configuraciones: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar configuraciones: {str(e)}"
        )
