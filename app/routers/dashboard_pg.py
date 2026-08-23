from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List, Optional
import sqlite3
from app.core.dependencies import get_db, get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/stats", response_model=Dict[str, Any])
def get_dashboard_stats(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    
    # 1. Obtener campaña y año activo
    from app.services.db_service import get_config_value_db
    import re
    campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
    digits = re.findall(r'\d+', campania_activa)
    anio_campania = int(digits[0]) if digits else 2026

    # 2. Filtrar por empresa si se especifica
    eq_filter = ""
    eq_params = []
    if empresa_id:
        eq_filter = "JOIN ubicaciones u ON e.ubicacion_id = u.id WHERE e.activo = 1 AND u.empresa_id = ?"
        eq_params.append(empresa_id)
    else:
        eq_filter = "WHERE e.activo = 1"

    # Obtener todas las inspecciones más recientes de los equipos activos
    query = f"""
        SELECT e.id as equipo_id, e.ubicacion_id, 
               (SELECT estado FROM inspecciones WHERE equipo_id = e.id ORDER BY id DESC LIMIT 1) as estado,
               (SELECT COUNT(*) FROM inspecciones WHERE equipo_id = e.id AND anio = ?) as has_campaign_inspection
        FROM equipos e
        {eq_filter}
    """
    
    cursor.execute(query, [anio_campania] + eq_params)
    equipos_insps = [dict(row) for row in cursor.fetchall()]
    
    critical_alerts = 0
    under_observation = 0
    pending_inspections = 0
    good_condition = 0
    inspected_equipos = 0
    total_equipos = len(equipos_insps)
    
    for eq in equipos_insps:
        est = str(eq['estado'] or '').upper()
        if 'CRIT' in est:
            critical_alerts += 1
        elif 'REGULAR' in est:
            under_observation += 1
        elif 'BUEN' in est:
            good_condition += 1
        elif 'PEND' in est or not est:
            pending_inspections += 1
            
        if eq['has_campaign_inspection'] > 0:
            inspected_equipos += 1
            
    # Avance de campaña en porcentaje
    campaign_progress_pct = round((inspected_equipos / total_equipos) * 100, 1) if total_equipos > 0 else 0.0

    # Plants up to date (ubicaciones de la empresa donde el 100% de equipos activos tiene inspección en la campaña)
    loc_stats = {}
    for eq in equipos_insps:
        loc_id = eq['ubicacion_id']
        if loc_id not in loc_stats:
            loc_stats[loc_id] = {'total': 0, 'inspected': 0}
        loc_stats[loc_id]['total'] += 1
        if eq['has_campaign_inspection'] > 0:
            loc_stats[loc_id]['inspected'] += 1
            
    plants_up_to_date = 0
    for loc_id, val in loc_stats.items():
        if val['total'] > 0 and val['total'] == val['inspected']:
            plants_up_to_date += 1
            
    # Inspecciones reales de hoy (filtradas por empresa si aplica)
    if empresa_id:
        cursor.execute("""
            SELECT COUNT(*) FROM inspecciones i 
            JOIN equipos e ON i.equipo_id = e.id 
            JOIN ubicaciones u ON e.ubicacion_id = u.id 
            WHERE u.empresa_id = ? AND date(i.created_at) = date('now')
        """, [empresa_id])
    else:
        cursor.execute("SELECT COUNT(*) FROM inspecciones WHERE date(created_at) = date('now')")
    inspections_today = cursor.fetchone()[0] or 0
        
    # Total de inspecciones general (por empresa si se filtra)
    if empresa_id:
        cursor.execute("SELECT COUNT(*) FROM inspecciones i JOIN equipos e ON i.equipo_id = e.id JOIN ubicaciones u ON e.ubicacion_id = u.id WHERE u.empresa_id = ?", [empresa_id])
    else:
        cursor.execute("SELECT COUNT(*) FROM inspecciones")
    total_inspecciones = cursor.fetchone()[0]

    return {
        "total_equipos": total_equipos,
        "inspected_equipos": inspected_equipos,
        "campaign_progress_pct": campaign_progress_pct,
        "total_inspecciones": total_inspecciones,
        "critical_alerts": critical_alerts,
        "under_observation": under_observation,
        "good_condition": good_condition,
        "plants_up_to_date": plants_up_to_date,
        "inspections_today": inspections_today,
        "pending_inspections": pending_inspections
    }

@router.get("/factories", response_model=List[Dict[str, Any]])
def list_factories(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    
    ubi_query = "SELECT id, nombre FROM ubicaciones WHERE activo = 1"
    ubi_params = []
    if empresa_id:
        ubi_query += " AND empresa_id = ?"
        ubi_params.append(empresa_id)
    ubi_query += " ORDER BY id"
        
    cursor.execute(ubi_query, ubi_params)
    ubicaciones = [dict(row) for row in cursor.fetchall()]
    if not ubicaciones:
        return []

    # Obtener el estado de inspección más reciente de todos los equipos activos en una sola consulta
    if empresa_id:
        eq_query = """
            SELECT e.ubicacion_id,
                   COALESCE((SELECT estado FROM inspecciones WHERE equipo_id = e.id ORDER BY id DESC LIMIT 1), 'BUENO') as estado
            FROM equipos e
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            WHERE e.activo = 1 AND u.empresa_id = ?
        """
        cursor.execute(eq_query, (empresa_id,))
    else:
        eq_query = """
            SELECT e.ubicacion_id,
                   COALESCE((SELECT estado FROM inspecciones WHERE equipo_id = e.id ORDER BY id DESC LIMIT 1), 'BUENO') as estado
            FROM equipos e
            WHERE e.activo = 1
        """
        cursor.execute(eq_query)

    from collections import defaultdict
    loc_states = defaultdict(list)
    for row in cursor.fetchall():
        loc_states[row['ubicacion_id']].append(row['estado'])

    factories = []
    for ubi in ubicaciones:
        states = loc_states.get(ubi['id'], [])
        total_cnt = len(states)
        if total_cnt == 0:
            continue
            
        good_cnt = 0
        alert_cnt = 0
        broken_cnt = 0
        
        for est_raw in states:
            est = str(est_raw or '').upper()
            if 'CRIT' in est:
                broken_cnt += 1
            elif 'REGULAR' in est:
                alert_cnt += 1
            else:
                good_cnt += 1
                    
        factories.append({
            "id": ubi['id'],
            "name": ubi['nombre'],
            "good": round((good_cnt / total_cnt) * 100),
            "alert": round((alert_cnt / total_cnt) * 100),
            "broken": round((broken_cnt / total_cnt) * 100)
        })
        
    return factories

@router.get("/areas", response_model=List[Dict[str, Any]])
def list_areas(db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT DISTINCT nombre FROM ubicaciones WHERE activo = 1 ORDER BY nombre")
    areas = [{"nombre": row[0]} for row in cursor.fetchall() if row[0]]
    return areas

@router.get("/history", response_model=List[Dict[str, Any]])
def get_asset_history(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    query = """
        SELECT 
            e.id, 
            e.ubicacion_id,
            e.codigo as tag_codigo, 
            e.nombre as descripcion, 
            u.nombre as area_nombre, 
            emp.nombre as empresa_nombre,
            e.estado_actual,
            e.material,
            e.fluido,
            e.presion_diseno,
            e.temperatura_diseno,
            (SELECT diagnostico FROM inspecciones WHERE equipo_id = e.id AND diagnostico IS NOT NULL AND diagnostico != '' ORDER BY anio DESC LIMIT 1) as diagnostico,
            (SELECT recomendaciones FROM inspecciones WHERE equipo_id = e.id AND recomendaciones IS NOT NULL AND recomendaciones != '' ORDER BY anio DESC LIMIT 1) as recomendaciones,
            (SELECT acciones FROM inspecciones WHERE equipo_id = e.id AND acciones IS NOT NULL AND acciones != '' ORDER BY anio DESC LIMIT 1) as acciones
        FROM equipos e
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN empresas emp ON u.empresa_id = emp.id
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
            "ubicacion_id": row["ubicacion_id"] or 0,
            "tag_codigo": row["tag_codigo"] or "",
            "descripcion": row["descripcion"] or "",
            "area_nombre": row["area_nombre"] or "",
            "empresa_nombre": row["empresa_nombre"] or "Arauco",
            "estado_actual": row["estado_actual"] or "BUENO",
            "material": row["material"] or "",
            "fluido": row["fluido"] or "",
            "presion_diseno": row["presion_diseno"] or 0,
            "temperatura_diseno": row["temperatura_diseno"] or 0,
            "diagnostico": row["diagnostico"] or "",
            "recomendaciones": row["recomendaciones"] or "",
            "acciones": row["acciones"] or ""
        })
    return results
