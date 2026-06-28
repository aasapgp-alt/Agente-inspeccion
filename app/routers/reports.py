from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
import sqlite3
import os
import datetime
import zipfile
import tempfile
from app.core.dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/api/reportes", tags=["reportes"])

def remove_temp_file(filepath: str):
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Error al eliminar archivo temporal {filepath}: {e}")

@router.get("/", response_model=List[Dict[str, Any]])
def list_reports(
    estado: Optional[str] = None,
    campania: Optional[str] = None,
    fecha: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista todos los reportes (retrocompatible)
    """
    query = "SELECT * FROM reportes WHERE 1=1"
    params = []
    if estado:
        query += " AND estado_general = ?"
        params.append(estado)
    if campania:
        query += " AND campania = ?"
        params.append(campania)
    if fecha:
        query += " AND fecha_generacion LIKE ?"
        params.append(f"%{fecha}%")
        
    cursor = db.cursor()
    cursor.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]

@router.get("/individuales", response_model=Dict[str, Any])
def get_reportes_individuales(
    ubicacion_id: Optional[int] = None,
    estado: Optional[str] = None,
    campania: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista reportes individuales con filtros y paginación
    """
    query = """
        SELECT r.*, u.nombre as nombre_ubicacion, u.id as ubicacion_id, us.nombre_completo as nombre_usuario
        FROM reportes r
        LEFT JOIN equipos e ON r.equipo_id = e.id
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN usuarios us ON r.usuario_id = us.id
        WHERE 1=1
    """
    params = []
    
    if ubicacion_id:
        query += " AND u.id = ?"
        params.append(ubicacion_id)
        
    if estado:
        query += " AND r.estado_general = ?"
        params.append(estado.upper())
        
    if campania:
        query += " AND r.campania = ?"
        params.append(campania)
        
    if fecha_desde:
        query += " AND r.fecha_generacion >= ?"
        params.append(fecha_desde)
        
    if fecha_hasta:
        hasta_val = fecha_hasta
        if len(fecha_hasta) == 10:
            hasta_val = f"{fecha_hasta} 23:59:59"
        query += " AND r.fecha_generacion <= ?"
        params.append(hasta_val)
        
    if search:
        query += " AND (r.codigo_equipo LIKE ? OR r.nombre_equipo LIKE ? OR r.numero_acta LIKE ?)"
        like_search = f"%{search}%"
        params.extend([like_search, like_search, like_search])

    # Conteo total
    count_query = f"SELECT COUNT(*) FROM ({query})"
    cursor = db.cursor()
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    # Ordenar y paginar
    query += " ORDER BY r.fecha_generacion DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    return {
        "total": total_count,
        "results": [dict(row) for row in rows]
    }

@router.get("/{id}", response_model=Dict[str, Any])
def get_report(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reportes WHERE id = ?", (id,))
    report = cursor.fetchone()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return dict(report)

@router.get("/{id}/download")
def download_report(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT ruta_pdf_local FROM reportes WHERE id = ?", (id,))
    report = cursor.fetchone()
    if not report or not report["ruta_pdf_local"] or not os.path.exists(report["ruta_pdf_local"]):
        raise HTTPException(status_code=404, detail="Archivo de reporte no encontrado")
    return FileResponse(path=report["ruta_pdf_local"], filename=os.path.basename(report["ruta_pdf_local"]))

@router.get("/{id}/drive", response_model=Dict[str, Any])
def get_report_drive(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT ruta_pdf_drive FROM reportes WHERE id = ?", (id,))
    report = cursor.fetchone()
    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
    return {"drive_file_id": "", "drive_url": report["ruta_pdf_drive"]}

@router.delete("/{id}", response_model=Dict[str, Any], dependencies=[Depends(require_role("admin"))])
def delete_report(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Elimina un reporte y todas sus versiones. Solo ejecutable por Administradores.
    """
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reportes WHERE id = ?", (id,))
    reporte = cursor.fetchone()
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte no encontrado")
        
    # Eliminar archivo físico
    pdf_local = reporte["ruta_pdf_local"]
    if pdf_local and os.path.exists(pdf_local):
        try:
            os.remove(pdf_local)
        except Exception as e:
            print(f"Error al eliminar archivo físico de reporte: {e}")
            
    # Eliminar archivos físicos de las versiones
    cursor.execute("SELECT ruta_pdf_local FROM versiones_reportes WHERE tipo = 'individual' AND reporte_id = ?", (id,))
    versiones = cursor.fetchall()
    for v in versiones:
        v_path = v["ruta_pdf_local"]
        if v_path and os.path.exists(v_path) and v_path != pdf_local:
            try:
                os.remove(v_path)
            except Exception as e:
                print(f"Error al eliminar versión física de reporte: {e}")
                
    try:
        # Borrar de la base de datos
        cursor.execute("DELETE FROM versiones_reportes WHERE tipo = 'individual' AND reporte_id = ?", (id,))
        cursor.execute("DELETE FROM reportes WHERE id = ?", (id,))
        db.commit()
        
        # Registrar en auditoría
        try:
            from app.core.audit import registrar_auditoria
            registrar_auditoria(
                usuario_id=current_user.get("id"),
                accion="ELIMINAR_REPORTE",
                tabla="reportes",
                registro_id=id,
                detalles=f"Eliminado reporte individual ID {id} (Acta: {reporte.get('numero_acta')}) y todas sus versiones."
            )
        except Exception as audit_err:
            print(f"Error al registrar auditoría: {audit_err}")
            
        return {"message": "Reporte y todas sus versiones eliminados correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/estado/{inspeccion_id}", response_model=Dict[str, Any])
def get_report_estado(inspeccion_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cursor = db.cursor()
    cursor.execute("SELECT estado FROM inspecciones WHERE id = ?", (inspeccion_id,))
    inspeccion = cursor.fetchone()
    if not inspeccion:
        raise HTTPException(status_code=404, detail="Inspección no encontrada")
    return {"estado": inspeccion["estado"]}

@router.get("/versiones/{inspeccion_id}", response_model=List[Dict[str, Any]])
def get_report_versiones(inspeccion_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """
    Retorna versiones de reporte asociadas a una inspección (retrocompatible)
    """
    cursor = db.cursor()
    cursor.execute("SELECT * FROM reportes WHERE inspeccion_id = ? ORDER BY version DESC", (inspeccion_id,))
    return [dict(row) for row in cursor.fetchall()]

@router.post("/generar-manual/{inspeccion_id}", response_model=Dict[str, Any])
def generar_manual_route(inspeccion_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        from app.services.reporte_service import generar_manual
        res = generar_manual(inspeccion_id)
        if res.get("status") == "success":
            return {"message": res.get("message", "Reporte generado"), "reporte_id": res.get("reporte_id")}
        else:
            raise HTTPException(status_code=400, detail=res.get("message", "Error al generar"))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generar/{equipo_id}", response_model=Dict[str, Any])
def generar_reporte_individual(
    equipo_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        from app.services.reporte_service import crear_reporte_individual_completo
        res = crear_reporte_individual_completo(equipo_id, db, current_user.get("id"))
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno al generar el reporte: {str(e)}")

@router.post("/generar-todos/{ubicacion_id}", response_model=Dict[str, Any])
def generar_todos_reportes(
    ubicacion_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(require_role("admin"))
):
    """
    Genera reportes para todos los equipos activos de una ubicación que tengan inspección 2026 pero no tengan un reporte ya generado.
    """
    try:
        cursor = db.cursor()
        
        # 1. Obtener todos los equipos activos de la ubicación
        cursor.execute("""
            SELECT id, codigo, nombre FROM equipos 
            WHERE ubicacion_id = ? AND activo = 1
        """, (ubicacion_id,))
        equipos = [dict(row) for row in cursor.fetchall()]
        
        if not equipos:
            return {"generados": 0, "existentes": 0, "errores": 0, "detalle": "No hay equipos activos en esta ubicación."}
            
        generados = 0
        existentes = 0
        errores = 0
        
        from app.services.reporte_service import crear_reporte_individual_completo
        
        for eq in equipos:
            eq_id = eq["id"]
            
            # Verificar si ya existe reporte generado para PGP 2026
            cursor.execute("""
                SELECT id FROM reportes 
                WHERE equipo_id = ? AND campania = 'PGP 2026' AND ruta_pdf_local IS NOT NULL AND ruta_pdf_local != ''
                LIMIT 1
            """, (eq_id,))
            if cursor.fetchone():
                existentes += 1
                continue
                
            # Verificar si tiene inspección de 2026 registrada
            cursor.execute("""
                SELECT id FROM inspecciones 
                WHERE equipo_id = ? AND anio = 2026
                LIMIT 1
            """, (eq_id,))
            if not cursor.fetchone():
                # No se puede generar porque no hay inspección 2026
                errores += 1
                continue
                
            # Generar reporte
            try:
                crear_reporte_individual_completo(eq_id, db, current_user.get("id"))
                generados += 1
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error generando reporte para equipo {eq.get('codigo')}: {e}")
                errores += 1
                
        return {
            "generados": generados,
            "existentes": existentes,
            "errores": errores
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar reportes de la ubicación: {str(e)}")

@router.get("/exportar-zip/{ubicacion_id}")
def exportar_reportes_zip(
    ubicacion_id: int,
    background_tasks: BackgroundTasks,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Exporta todos los reportes individuales de una ubicación en la campaña actual como un archivo ZIP.
    """
    cursor = db.cursor()
    cursor.execute("""
        SELECT r.ruta_pdf_local, r.nombre_equipo, r.codigo_equipo
        FROM reportes r
        JOIN equipos e ON r.equipo_id = e.id
        WHERE e.ubicacion_id = ? AND r.campania = 'PGP 2026' AND r.ruta_pdf_local IS NOT NULL AND r.ruta_pdf_local != ''
    """, (ubicacion_id,))
    rows = cursor.fetchall()
    
    if not rows:
        raise HTTPException(status_code=404, detail="No se encontraron reportes generados para esta ubicación en la campaña PGP 2026.")
        
    # Crear archivo ZIP temporal
    temp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    temp_zip_path = temp_zip.name
    temp_zip.close() # Cerrar para que zipfile pueda escribir
    
    try:
        with zipfile.ZipFile(temp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for row in rows:
                pdf_path = row["ruta_pdf_local"]
                if pdf_path and os.path.exists(pdf_path):
                    # Usar el nombre del archivo PDF en el ZIP
                    zip_file.write(pdf_path, os.path.basename(pdf_path))
                    
        # Programar la eliminación del archivo ZIP temporal después de enviarlo
        background_tasks.add_task(remove_temp_file, temp_zip_path)
        
        # Obtener el nombre de la ubicación para el nombre del ZIP
        cursor.execute("SELECT nombre FROM ubicaciones WHERE id = ?", (ubicacion_id,))
        ubi_row = cursor.fetchone()
        ubi_name = ubi_row["nombre"] if ubi_row else f"Ubicacion_{ubicacion_id}"
        safe_name = "".join([c if c.isalnum() or c in (' ', '_', '-') else '' for c in ubi_name]).strip().replace(' ', '_')
        
        return FileResponse(
            path=temp_zip_path,
            filename=f"REPORTES-{safe_name}-PGP2026.zip",
            media_type="application/zip"
        )
    except Exception as e:
        remove_temp_file(temp_zip_path)
        raise HTTPException(status_code=500, detail=f"Error al generar archivo ZIP: {str(e)}")

@router.get("/{reporte_id}/versiones", response_model=List[Dict[str, Any]])
def get_versiones_reporte(
    reporte_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas las versiones de un reporte individual
    """
    cursor = db.cursor()
    cursor.execute("""
        SELECT v.*, us.nombre_completo as nombre_usuario
        FROM versiones_reportes v
        LEFT JOIN usuarios us ON v.usuario_id = us.id
        WHERE v.tipo = 'individual' AND v.reporte_id = ?
        ORDER BY v.version DESC
    """, (reporte_id,))
    return [dict(row) for row in cursor.fetchall()]
