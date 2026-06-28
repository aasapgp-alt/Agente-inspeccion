from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
import sqlite3
from app.core.dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    stats = {}
    
    query_equipos = "SELECT COUNT(*) FROM equipos"
    query_inspecciones = "SELECT COUNT(*) FROM inspecciones"
    params = []
    
    if empresa_id:
        query_equipos += " WHERE empresa_id = ?"
        # Asumiendo JOIN para inspecciones si tienen empresa_id, o filtrar por equipos de esa empresa
        query_inspecciones = "SELECT COUNT(*) FROM inspecciones i JOIN equipos e ON i.equipo_id = e.id WHERE e.empresa_id = ?"
        params.append(empresa_id)
        
    cursor.execute(query_equipos, params)
    stats["total_equipos"] = cursor.fetchone()[0]
    
    cursor.execute(query_inspecciones, params)
    stats["total_inspecciones"] = cursor.fetchone()[0]
    
    return stats

@router.get("/factories", response_model=List[Dict[str, Any]])
def list_factories(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT DISTINCT empresa FROM equipos")
    factories = [{"nombre": row[0]} for row in cursor.fetchall() if row[0]]
    return factories

@router.get("/areas", response_model=List[Dict[str, Any]])
def list_areas(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT DISTINCT area FROM equipos")
    areas = [{"nombre": row[0]} for row in cursor.fetchall() if row[0]]
    return areas

@router.get("/history", response_model=List[Dict[str, Any]])
def get_asset_history(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    query = """
        SELECT 
            e.id, 
            e.codigo as tag_codigo, 
            e.nombre as descripcion, 
            u.nombre as area_nombre, 
            e.estado_actual,
            e.material,
            e.fluido,
            e.presion_diseno,
            e.temperatura_diseno,
            (SELECT diagnostico FROM inspecciones WHERE equipo_id = e.id ORDER BY id DESC LIMIT 1) as diagnostico
        FROM equipos e
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
    """
    params = []
    
    if empresa_id:
        query += " WHERE u.empresa_id = ?"
        params.append(empresa_id)
        
    cursor.execute(query, params)
    
    results = []
    for row in cursor.fetchall():
        results.append({
            "id": row["id"],
            "tag_codigo": row["tag_codigo"] or "",
            "descripcion": row["descripcion"] or "",
            "area_nombre": row["area_nombre"] or "",
            "estado_actual": row["estado_actual"] or "BUENO",
            "material": row["material"] or "",
            "fluido": row["fluido"] or "",
            "presion_diseno": row["presion_diseno"] or 0,
            "temperatura_diseno": row["temperatura_diseno"] or 0,
            "diagnostico": row["diagnostico"] or ""
        })
    return results
