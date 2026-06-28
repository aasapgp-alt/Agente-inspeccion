from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
import sqlite3
import os
import json
from app.core.dependencies import get_db, get_current_user, require_role

router = APIRouter(prefix="/api/libros", tags=["libros"])

@router.get("", response_model=Dict[str, Any])
def get_libros(
    ubicacion_id: Optional[int] = None,
    estado: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Lista libros por área con filtros y paginación
    """
    query = """
        SELECT l.*, us.nombre_completo as nombre_usuario
        FROM libros l
        LEFT JOIN usuarios us ON l.usuario_id = us.id
        WHERE 1=1
    """
    params = []
    
    if ubicacion_id:
        query += " AND l.ubicacion_id = ?"
        params.append(ubicacion_id)
        
    if estado:
        # Filtrar libros que contengan equipos con ese estado
        query += " AND CAST(json_extract(l.resumen_estados, '$.' || ?) AS INTEGER) > 0"
        params.append(estado.upper())
        
    if fecha_desde:
        query += " AND l.fecha_generacion >= ?"
        params.append(fecha_desde)
        
    if fecha_hasta:
        # Agregar el final del día si solo viene la fecha
        hasta_val = fecha_hasta
        if len(fecha_hasta) == 10:
            hasta_val = f"{fecha_hasta} 23:59:59"
        query += " AND l.fecha_generacion <= ?"
        params.append(hasta_val)

    # Consulta de conteo total
    count_query = f"SELECT COUNT(*) FROM ({query})"
    cursor = db.cursor()
    cursor.execute(count_query, params)
    total_count = cursor.fetchone()[0]

    # Ordenar y paginar
    query += " ORDER BY l.fecha_generacion DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    results = []
    for row in rows:
        r_dict = dict(row)
        # Asegurar que resumen_estados y equipos_incluidos se parsean a JSON
        if r_dict.get("resumen_estados"):
            try:
                r_dict["resumen_estados"] = json.loads(r_dict["resumen_estados"])
            except:
                pass
        if r_dict.get("equipos_incluidos"):
            try:
                r_dict["equipos_incluidos"] = json.loads(r_dict["equipos_incluidos"])
            except:
                pass
        results.append(r_dict)
        
    return {
        "total": total_count,
        "results": results
    }

@router.get("/{libro_id}/versiones", response_model=List[Dict[str, Any]])
def get_versiones_libro(
    libro_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Retorna todas las versiones de un libro
    """
    cursor = db.cursor()
    cursor.execute("""
        SELECT v.*, us.nombre_completo as nombre_usuario
        FROM versiones_reportes v
        LEFT JOIN usuarios us ON v.usuario_id = us.id
        WHERE v.tipo = 'libro' AND v.reporte_id = ?
        ORDER BY v.version DESC
    """, (libro_id,))
    return [dict(row) for row in cursor.fetchall()]

@router.delete("/{libro_id}", response_model=Dict[str, Any], dependencies=[Depends(require_role("admin"))])
def delete_libro(
    libro_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Elimina un libro y todas sus versiones. Solo ejecutable por Administradores.
    """
    cursor = db.cursor()
    cursor.execute("SELECT ruta_pdf_local FROM libros WHERE id = ?", (libro_id,))
    libro = cursor.fetchone()
    if not libro:
        raise HTTPException(status_code=404, detail="Libro no encontrado")
        
    # Eliminar archivo físico si existe
    ruta_pdf = libro["ruta_pdf_local"]
    if ruta_pdf and os.path.exists(ruta_pdf):
        try:
            os.remove(ruta_pdf)
        except Exception as e:
            print(f"Error al eliminar archivo de libro: {e}")
            
    # Eliminar archivos físicos de las versiones
    cursor.execute("SELECT ruta_pdf_local FROM versiones_reportes WHERE tipo = 'libro' AND reporte_id = ?", (libro_id,))
    versiones = cursor.fetchall()
    for v in versiones:
        v_path = v["ruta_pdf_local"]
        if v_path and os.path.exists(v_path) and v_path != ruta_pdf:
            try:
                os.remove(v_path)
            except Exception as e:
                print(f"Error al eliminar archivo de versión de libro: {e}")

    try:
        # Eliminar registros en base de datos
        cursor.execute("DELETE FROM versiones_reportes WHERE tipo = 'libro' AND reporte_id = ?", (libro_id,))
        cursor.execute("DELETE FROM libros WHERE id = ?", (libro_id,))
        db.commit()
        
        # Registrar en auditoría
        try:
            from app.core.audit import registrar_auditoria
            registrar_auditoria(
                usuario_id=current_user.get("id"),
                accion="ELIMINAR_LIBRO",
                tabla="libros",
                registro_id=libro_id,
                detalles=f"Eliminado libro por área ID {libro_id} y todas sus versiones."
            )
        except Exception as audit_err:
            print(f"Error al registrar auditoría: {audit_err}")
            
        return {"message": "Libro y sus versiones eliminados correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar de la base de datos: {str(e)}")
