from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
import sqlite3
from app.core.dependencies import get_db, get_current_user, require_any_role

router = APIRouter(prefix="/api/audit", tags=["audit"])

@router.get("/logs", response_model=Dict[str, Any])
def get_logs(
    limit: int = 50,
    offset: int = 0,
    usuario_id: Optional[int] = None,
    accion: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(require_any_role(["admin", "supervisor"]))
):
    """
    Retorna los registros de auditoría paginados con filtros.
    Solo accesible por administradores y supervisores.
    """
    try:
        query = """
            SELECT a.id, a.user_id, a.accion, a.tabla, a.registro_id, a.detalles, a.ip_address, a.created_at,
                   u.username, u.nombre_completo as usuario_nombre
            FROM auditoria a
            LEFT JOIN usuarios u ON a.user_id = u.id
            WHERE 1=1
        """
        params = []
        
        if usuario_id is not None:
            query += " AND a.user_id = ?"
            params.append(usuario_id)
            
        if accion is not None and accion.strip() != "":
            query += " AND a.accion = ?"
            params.append(accion.strip())
            
        if fecha_desde is not None and fecha_desde.strip() != "":
            query += " AND a.created_at >= ?"
            params.append(fecha_desde.strip())
            
        if fecha_hasta is not None and fecha_hasta.strip() != "":
            hasta_val = fecha_hasta.strip()
            if len(hasta_val) == 10:  # YYYY-MM-DD
                hasta_val = f"{hasta_val} 23:59:59"
            query += " AND a.created_at <= ?"
            params.append(hasta_val)
            
        # Conteo total para paginación
        count_query = f"SELECT COUNT(*) FROM ({query})"
        cursor = db.cursor()
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]
        
        # Ordenación y paginación
        query += " ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        logs = []
        for row in rows:
            d = dict(row)
            # Normalizar detalles si es JSON
            logs.append(d)
            
        return {
            "total": total,
            "logs": logs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener logs de auditoría: {str(e)}")

@router.get("/acciones", response_model=List[str])
def get_acciones(
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(require_any_role(["admin", "supervisor"]))
):
    """
    Retorna la lista de acciones distintas registradas.
    """
    try:
        cursor = db.cursor()
        cursor.execute("SELECT DISTINCT accion FROM auditoria ORDER BY accion")
        return [row[0] for row in cursor.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
