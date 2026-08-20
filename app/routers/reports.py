from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query

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

@router.get("/equipo/{equipo_id}/pdf")
def get_reporte_pdf_by_equipo(
    equipo_id: int,
    campania: Optional[str] = Query(None),
    download: bool = Query(False),
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna o genera bajo demanda el archivo PDF del reporte técnico de inspección para un equipo.
    """
    cursor = db.cursor()
    
    # 1. Buscar en reportes existentes
    rep_query = "SELECT * FROM reportes WHERE equipo_id = ?"
    rep_params = [equipo_id]
    if campania:
        rep_query += " AND campania = ?"
        rep_params.append(campania)
    rep_query += " ORDER BY id DESC LIMIT 1"
    
    cursor.execute(rep_query, rep_params)
    rep_row = cursor.fetchone()
    
    local_pdf = rep_row["ruta_pdf_local"] if rep_row else None
    
    # 2. Si no está en reportes o el archivo físico no existe, buscar en inspecciones
    if not local_pdf or not os.path.exists(local_pdf):
        insp_query = "SELECT * FROM inspecciones WHERE equipo_id = ?"
        insp_params = [equipo_id]
        if campania:
            import re
            m = re.search(r'\b(20\d{2})\b', campania)
            if m:
                insp_query += " AND anio = ?"
                insp_params.append(int(m.group(1)))
        insp_query += " ORDER BY anio DESC, id DESC LIMIT 1"
        cursor.execute(insp_query, insp_params)
        insp_row = cursor.fetchone()
        
        if insp_row and insp_row["ruta_pdf_local"] and os.path.exists(insp_row["ruta_pdf_local"]):
            local_pdf = insp_row["ruta_pdf_local"]
            
    # 3. Si aún no existe el archivo físico pero hay datos de inspección registrados, generarlo bajo demanda
    if not local_pdf or not os.path.exists(local_pdf):
        cursor.execute("""
            SELECT e.*, i.id as inspeccion_id, i.estado, i.diagnostico, i.acciones
            FROM equipos e
            LEFT JOIN inspecciones i ON i.equipo_id = e.id
            WHERE e.id = ? AND (i.estado IN ('BUENO', 'REGULAR', 'CRITICO') OR (i.diagnostico IS NOT NULL AND length(i.diagnostico) > 3))
            ORDER BY i.anio DESC, i.id DESC LIMIT 1
        """, (equipo_id,))
        eq_inspec = cursor.fetchone()
        
        if eq_inspec:
            try:
                from app.services.reporte_service import crear_reporte_individual_completo
                res = crear_reporte_individual_completo(equipo_id, db, current_user.get("id", 1))
                if res and res.get("ruta") and os.path.exists(res.get("ruta")):
                    local_pdf = res.get("ruta")
            except Exception as gen_err:
                import logging
                logging.getLogger(__name__).error(f"Error generando reporte bajo demanda para equipo {equipo_id}: {gen_err}")
                
    if not local_pdf or not os.path.exists(local_pdf):
        raise HTTPException(
            status_code=404, 
            detail=f"No se encontró ni pudo generarse el archivo PDF para el equipo ID {equipo_id}. Asegúrese de que posea una inspección completada."
        )
        
    filename = os.path.basename(local_pdf)
    disposition = "attachment" if download else "inline"
    
    return FileResponse(
        path=local_pdf,
        media_type="application/pdf",
        filename=filename,
        headers={"Content-Disposition": f"{disposition}; filename={filename}"}
    )

@router.get("/minuta_resumen", response_model=List[Dict[str, Any]])
def get_minuta_resumen(
    empresa_id: Optional[int] = Query(None),
    campania: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    criticidad: Optional[str] = Query(None),
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna la lista estructurada para la Minuta Resumen PGP (Tabla estilo Pág. 15 del reporte).
    Soporta filtrado dinámico por campaña y empresa en tiempo real, con estado de inspección validado.
    """
    import re
    anio_target = None
    if campania:
        match = re.search(r'\b(20\d{2})\b', campania)
        if match:
            anio_target = int(match.group(1))

    if anio_target:
        join_clause = "LEFT JOIN inspecciones i ON i.equipo_id = e.id AND i.anio = ?"
        join_param = [anio_target]
    else:
        join_clause = "LEFT JOIN inspecciones i ON i.id = (SELECT id FROM inspecciones WHERE equipo_id = e.id ORDER BY anio DESC, id DESC LIMIT 1)"
        join_param = []

    query = f"""
        SELECT 
            e.id as equipo_id,
            e.codigo as tag,
            e.nombre as equipo_nombre,
            e.criticidad,
            e.material,
            e.fluido,
            u.nombre as sector,
            u.id as ubicacion_id,
            emp.nombre as empresa_nombre,
            emp.id as empresa_id,
            i.id as inspeccion_id,
            i.anio,
            i.estado,
            i.acciones,
            i.diagnostico,
            i.recomendaciones,
            i.numero_acta as informe,
            i.ruta_pdf_local,
            i.ruta_pdf_drive,
            i.drive_file_id,
            rep.id as reporte_id,
            rep.ruta_pdf_local as rep_pdf_local,
            rep.ruta_pdf_drive as rep_pdf_drive
        FROM equipos e
        JOIN ubicaciones u ON e.ubicacion_id = u.id
        JOIN empresas emp ON u.empresa_id = emp.id
        {join_clause}
        LEFT JOIN reportes rep ON rep.id = (SELECT id FROM reportes WHERE equipo_id = e.id ORDER BY id DESC LIMIT 1)
        WHERE 1=1
    """
    params = join_param.copy()
    if empresa_id:
        query += " AND u.empresa_id = ?"
        params.append(empresa_id)
        
    if criticidad:
        clean_crit_filter = str(criticidad).strip()
        query += " AND (e.criticidad = ? OR e.criticidad LIKE ?)"
        params.extend([clean_crit_filter, f"%{clean_crit_filter}%"])
        
    if search:
        query += " AND (e.codigo LIKE ? OR e.nombre LIKE ? OR u.nombre LIKE ? OR i.numero_acta LIKE ?)"
        like_str = f"%{search}%"
        params.extend([like_str, like_str, like_str, like_str])
        
    query += " ORDER BY e.id ASC"
    
    cursor = db.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    resumen_list = []
    idx = 1
    
    for row in rows:
        r = dict(row)
        
        informe_val = r.get("informe")
        if not informe_val:
            if r.get("empresa_id") == 170:
                informe_val = f"ARC MDA-24{str(idx).zfill(2)}"
            else:
                informe_val = f"ACTA-{r.get('tag')}-{anio_target or 2024}"

        recom_flag = "SI" if (r.get("recomendaciones") and len(str(r.get("recomendaciones")).strip()) > 2) else "NO"
        
        acciones_str = (r.get("acciones") or "").lower()
        obs_existente = (r.get("observaciones") or "").lower()
        estado_raw = (r.get("estado") or "PENDIENTE").upper()
        
        acc_correct = "SI" if ("correctiv" in acciones_str or "reparaci" in acciones_str or "servicio condicional" in obs_existente or estado_raw in ["REGULAR", "CRITICO"]) else "NO"
        acc_prevent = "SI" if ("preventiv" in acciones_str or "inspecci" in acciones_str or estado_raw in ["BUENO", "REGULAR", "CRITICO"]) else "NO"
        
        sector_nombre = r.get("sector") or ""
        sector_abrev = sector_nombre
        if "Servicios Auxiliares" in sector_nombre:
            sector_abrev = "SA"
        elif "Sorbent" in sector_nombre:
            sector_abrev = "SA Sorbent"
        elif "Tratamiento de agua" in sector_nombre:
            sector_abrev = "Tratamiento de agua"
        elif "HCl" in sector_nombre:
            sector_abrev = "SA"
            
        comentarios = "Inspección interior y exterior"
        if "cerrado" in (r.get("diagnostico") or "").lower() or ("exterior" in (r.get("acciones") or "").lower() and not "interior" in (r.get("acciones") or "").lower()):
            comentarios = "Inspección exterior. TK cerrado"
            
        observaciones = ""
        diag_obs = (r.get("diagnostico") or "").upper()
        if "CONDICIONAL" in diag_obs or "CONDICIONAL" in (r.get("acciones") or "").upper() or estado_raw == "REGULAR":
            observaciones = "Servicio condicional."
        if "AISLADO" in diag_obs or "AISLADO" in (r.get("acciones") or "").upper():
            observaciones = ("TK AISLADO. " + observaciones).strip()
        if "SUCIO" in diag_obs:
            observaciones = (observaciones + " INTERIOR MUY SUCIO.").strip()
        if "RECINTO" in diag_obs or "HCL" in (r.get("tag") or ""):
            if "Recinto" not in observaciones:
                observaciones = ("Incluye Anexo para Recinto de Contención. " + observaciones).strip()

        # Normalizar criticidad
        raw_crit = str(r.get("criticidad") or "2").replace("\xa0", "").strip()
        if raw_crit.startswith("1"):
            crit = "1"
        elif raw_crit.startswith("3"):
            crit = "3"
        else:
            crit = "2" if raw_crit in ["2", ""] else "1"

        # Determinación de estado de inspección real
        tiene_inspeccion = bool(
            r.get("inspeccion_id") and 
            estado_raw in ["BUENO", "REGULAR", "CRITICO"] or 
            (r.get("diagnostico") and len(str(r.get("diagnostico")).strip()) > 3)
        )

        # Definir la próxima inspección según criticidad y estado
        if not tiene_inspeccion:
            prox_insp = "Próxima PGP"
        elif crit == "1" or estado_raw == "CRITICO":
            prox_insp = "Próxima PGP (1 año)"
        elif crit == "2" or estado_raw == "REGULAR":
            prox_insp = "2 años"
        elif crit == "3":
            prox_insp = "5 años"
        else:
            prox_insp = "Próxima PGP"

        # Resolver URLs de reporte (ignorando mock-links)
        raw_drive = r.get("ruta_pdf_drive") or r.get("rep_pdf_drive")
        valid_drive = raw_drive if (raw_drive and "mock-link" not in raw_drive and raw_drive.startswith("http")) else None
        
        local_path = r.get("ruta_pdf_local") or r.get("rep_pdf_local")
        tiene_reporte = bool(local_path or valid_drive or tiene_inspeccion)

        resumen_list.append({
            "numero": idx,
            "equipo_id": r["equipo_id"],
            "tag": r["tag"],
            "equipo_nombre": r["equipo_nombre"],
            "sector": sector_abrev,
            "sector_completo": sector_nombre,
            "empresa_nombre": r["empresa_nombre"],
            "empresa_id": r["empresa_id"],
            "informe": informe_val,
            "recom": recom_flag,
            "acciones_correctivas": acc_correct,
            "acciones_preventivas": acc_prevent,
            "comentarios": comentarios,
            "observaciones": observaciones,
            "criticidad": crit,
            "proxima_inspeccion": prox_insp,
            "estado": estado_raw,
            "tiene_inspeccion": tiene_inspeccion,
            "tiene_reporte": tiene_reporte,
            "reporte_id": r.get("reporte_id"),
            "ruta_pdf_local": local_path,
            "ruta_pdf_drive": valid_drive,
            "drive_file_id": r.get("drive_file_id") if valid_drive else None
        })
        idx += 1
        
    return resumen_list


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
    cursor.execute("""
        SELECT v.*, us.nombre_completo as nombre_usuario
        FROM reportes_versiones v
        LEFT JOIN usuarios us ON v.usuario_id = us.id
        WHERE v.inspeccion_id = ?
        ORDER BY v.version DESC
    """, (inspeccion_id,))
    return [dict(row) for row in cursor.fetchall()]

@router.post("/generar-manual/{inspeccion_id}", response_model=Dict[str, Any])
def generar_manual_route(inspeccion_id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        from app.services.reporte_service import generar_manual
        res = generar_manual(inspeccion_id, user_id=current_user.get("id", 1))
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
        from app.services.db_service import get_config_value_db
        import re
        
        campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
        digits = re.findall(r'\d+', campania_activa)
        anio_campania = int(digits[0]) if digits else 2026
        
        for eq in equipos:
            eq_id = eq["id"]
            
            # Verificar si ya existe reporte generado para la campaña activa
            cursor.execute("""
                SELECT id FROM reportes 
                WHERE equipo_id = ? AND campania = ? AND ruta_pdf_local IS NOT NULL AND ruta_pdf_local != ''
                LIMIT 1
            """, (eq_id, campania_activa))
            if cursor.fetchone():
                existentes += 1
                continue
                
            # Verificar si tiene inspección del año de la campaña registrada
            cursor.execute("""
                SELECT id FROM inspecciones 
                WHERE equipo_id = ? AND anio = ?
                LIMIT 1
            """, (eq_id, anio_campania))
            if not cursor.fetchone():
                # No se puede generar porque no hay inspección de este año
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
    from app.services.db_service import get_config_value_db
    campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
    
    cursor = db.cursor()
    cursor.execute("""
        SELECT r.ruta_pdf_local, r.nombre_equipo, r.codigo_equipo
        FROM reportes r
        JOIN equipos e ON r.equipo_id = e.id
        WHERE e.ubicacion_id = ? AND r.campania = ? AND r.ruta_pdf_local IS NOT NULL AND r.ruta_pdf_local != ''
    """, (ubicacion_id, campania_activa))
    rows = cursor.fetchall()
    
    if not rows:
        raise HTTPException(status_code=404, detail=f"No se encontraron reportes generados para esta ubicación en la campaña {campania_activa}.")
        
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


