from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional, Dict, Any
import sqlite3
from app.core.dependencies import get_db, get_current_user, require_role, require_any_role
from app.services import db_service
from app.core.audit import registrar_auditoria, log_modificacion
from pydantic import BaseModel

router = APIRouter(prefix="/api/equipos", tags=["equipos"])

class EquipoCreate(BaseModel):
    ubicacion_id: int
    codigo: str
    nombre: str
    tag: Optional[str] = None
    material: Optional[str] = None
    fluido: Optional[str] = None
    presion_diseno: Optional[float] = None
    temperatura_diseno: Optional[float] = None
    fabricante: Optional[str] = None
    modelo: Optional[str] = None
    crear_carpeta_drive: Optional[bool] = False
    parent_folder_id: Optional[str] = None
    campanias_iniciales: Optional[List[str]] = []
    subcarpetas: Optional[List[str]] = ["Succion", "Impulsión"]


@router.get("", response_model=Dict[str, Any])
@router.get("/", response_model=Dict[str, Any])
def list_equipos(
    empresa: Optional[str] = None,
    area: Optional[str] = None,
    anio: Optional[str] = None,
    estado: Optional[str] = None,
    ubicacion_id: Optional[int] = None,
    q: Optional[str] = None,
    db: sqlite3.Connection = Depends(get_db)
):
    if ubicacion_id:
        cursor = db.execute("""
            SELECT e.*, dfc.nombre as drive_folder_nombre 
            FROM equipos e 
            LEFT JOIN drive_folders_cache dfc ON e.drive_folder_id = dfc.drive_id 
            WHERE e.activo = 1 AND e.ubicacion_id = ?
        """, (ubicacion_id,))
        equipos = [dict(row) for row in cursor.fetchall()]
        return {"equipos": equipos}
    
    # Consulta usando db_service para retrocompatibilidad y búsqueda global
    equipos = db_service.obtener_lista_equipos_db(empresa=empresa, area=area, anio=anio, estado=estado, q=q)
    return {"equipos": equipos}

@router.post("", response_model=Dict[str, Any])
@router.post("/", response_model=Dict[str, Any])
def create_equipo(equipo: EquipoCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    try:
        # 1. Determinar el código en orden secuencial de la base de datos si no fue especificado o es 'auto'
        codigo_calculado = equipo.codigo
        if not codigo_calculado or codigo_calculado.lower() == "auto":
            cursor_seq = db.execute("""
                SELECT MAX(CAST(codigo AS INTEGER)) 
                FROM equipos 
                WHERE ubicacion_id = ? AND codigo GLOB '[0-9]*'
            """, (equipo.ubicacion_id,))
            max_code = cursor_seq.fetchone()[0]
            codigo_calculado = str((max_code or 0) + 1)

        # 2. Determinar parent_folder_id de la ubicación técnica
        cursor_loc = db.execute("SELECT nombre, drive_folder_id FROM ubicaciones WHERE id = ?", (equipo.ubicacion_id,))
        loc_row = cursor_loc.fetchone()
        parent_id = equipo.parent_folder_id
        if loc_row and not parent_id:
            parent_id = loc_row["drive_folder_id"]

        drive_info = None
        eq_drive_folder_id = None

        # 3. Crear/Vinculación automática de carpeta en Google Drive y Caché Local
        from app.services.drive_service import obtener_o_crear_carpeta_drive, crear_estructura_equipo
        folder_title = f"{codigo_calculado}- {equipo.nombre}"

        if parent_id:
            try:
                campanias = equipo.campanias_iniciales
                if not campanias:
                    from app.services.db_service import get_config_value_db
                    campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
                    campanias = [campania_activa]
                
                res_drive = crear_estructura_equipo(
                    parent_id=parent_id,
                    nombre_equipo=folder_title,
                    campanias=campanias,
                    subcarpetas=equipo.subcarpetas
                )
                eq_drive_folder_id = res_drive.get("id")
                drive_info = {
                    "folder_id": eq_drive_folder_id,
                    "folder_title": res_drive.get("title", folder_title),
                    "folder_url": res_drive.get("alternateLink")
                }
            except Exception as drive_err:
                import logging
                logging.getLogger(__name__).error(f"Error vinculando/creando carpeta en Drive: {drive_err}", exc_info=True)
                # Fallback a creación en caché local
                eq_drive_folder_id = f"auto_eq_folder_{equipo.ubicacion_id}_{codigo_calculado}"

        # 4. Insertar equipo en la base de datos con su drive_folder_id vinculado
        cursor = db.execute("""
            INSERT INTO equipos (ubicacion_id, codigo, nombre, tag, material, fluido, presion_diseno, temperatura_diseno, fabricante, modelo, drive_folder_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (equipo.ubicacion_id, codigo_calculado, equipo.nombre, equipo.tag, equipo.material, equipo.fluido, equipo.presion_diseno, equipo.temperatura_diseno, equipo.fabricante, equipo.modelo, eq_drive_folder_id))
        db.commit()
        nuevo_id = cursor.lastrowid

        # 5. Sincronizar entrada en drive_folders_cache
        if eq_drive_folder_id:
            try:
                db.execute("""
                    INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (eq_drive_folder_id, folder_title, parent_id))
                db.commit()
            except Exception as cache_err:
                pass
        
        registrar_auditoria(
            usuario_id=current_user.get("id"),
            accion="CREAR_EQUIPO",
            tabla="equipos",
            registro_id=nuevo_id,
            detalles=f"Equipo '{codigo_calculado} - {equipo.nombre}' creado en ubicación {equipo.ubicacion_id} con Drive Folder ID '{eq_drive_folder_id}'."
        )
        return {
            "id": nuevo_id,
            "codigo": codigo_calculado,
            "drive_folder_id": eq_drive_folder_id,
            "message": "Equipo creado y vinculado exitosamente",
            "drive": drive_info
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="El código de equipo ya existe para esta ubicación")

@router.get("/{id}", response_model=Dict[str, Any])
def get_equipo(id: int, db: sqlite3.Connection = Depends(get_db)):
    equipo = db_service.obtener_equipo_db(id)
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return equipo

@router.put("/{id}", response_model=Dict[str, Any])
def update_equipo(id: int, data: Dict[str, Any], db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_any_role(["supervisor", "admin"]))):
    # Lógica simplificada
    equipo = db_service.obtener_equipo_db(id)
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")

    if not data:
        return {"message": "No data to update"}

    try:
        # Estado previo de los campos modificados, para trazabilidad de auditoría.
        cambios = {
            k: {"antes": equipo.get(k), "ahora": v}
            for k, v in data.items() if equipo.get(k) != v
        }
        db_service.actualizar_equipo_db(id, data)
        if cambios:
            log_modificacion(
                usuario_id=current_user.get("id"),
                tabla="equipos",
                registro_id=id,
                cambios=cambios
            )
        return db_service.obtener_equipo_db(id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{id}", response_model=Dict[str, Any])
def delete_equipo(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    equipo = db_service.obtener_equipo_db(id)
    success = db_service.eliminar_equipo_db(id)
    if not success:
        raise HTTPException(status_code=404, detail="Equipo no encontrado o error al eliminar")
    registrar_auditoria(
        usuario_id=current_user.get("id"),
        accion="ELIMINAR_EQUIPO",
        tabla="equipos",
        registro_id=id,
        detalles=f"Equipo '{equipo.get('codigo', id)} - {equipo.get('nombre', '')}' eliminado." if equipo else f"Equipo ID {id} eliminado."
    )
    return {"message": "Equipo eliminado correctamente", "id": id}

@router.get("/{id}/inspeccion/{anio}", response_model=Dict[str, Any])
def get_equipo_inspeccion(id: int, anio: str, db: sqlite3.Connection = Depends(get_db)):
    inspeccion = db_service.obtener_inspeccion_db(id, int(anio))
    if not inspeccion:
        raise HTTPException(status_code=404, detail="Inspección no encontrada para ese equipo y año")
    
    resp_data = dict(inspeccion)
    if int(anio) == 2026:
        from app.services.memory_service import obtener_memoria_imagenes
        resp_data['image_drive_ids'] = obtener_memoria_imagenes(id)
    else:
        resp_data['image_drive_ids'] = []
    return resp_data

class RevertirInspeccionPayload(BaseModel):
    motivo: str
    anio: Optional[int] = None

@router.post("/{id}/revertir-inspeccion", response_model=Dict[str, Any])
def revertir_inspeccion_equipo(
    id: int, 
    payload: RevertirInspeccionPayload, 
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(require_role("admin"))
):
    equipo = db_service.obtener_equipo_db(id)
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    
    motivo_texto = payload.motivo.strip() if payload.motivo and payload.motivo.strip() else ""
    if not motivo_texto:
        raise HTTPException(status_code=400, detail="Debe especificar un motivo o razón para revertir la inspección")
    
    estado_anterior = equipo.get("estado_actual", "PENDIENTE")
    
    # 1. Actualizar estado_actual a 'PENDIENTE'
    db.execute("UPDATE equipos SET estado_actual = 'PENDIENTE' WHERE id = ?", (id,))
    
    # 2. Eliminar o reiniciar registros de inspección asociados
    if payload.anio:
        db.execute("DELETE FROM inspecciones WHERE equipo_id = ? AND anio = ?", (id, payload.anio))
    else:
        db.execute("DELETE FROM inspecciones WHERE equipo_id = ?", (id,))
        
    db.commit()
    
    # 3. Registrar auditoría de la acción
    registrar_auditoria(
        usuario_id=current_user.get("id"),
        accion="REVERTIR_INSPECCION",
        tabla="equipos",
        registro_id=id,
        detalles=f"Equipo '{equipo.get('codigo')} - {equipo.get('nombre')}' (ID {id}) revertido a NO INSPECCIONADO (PENDIENTE). Estado previo: '{estado_anterior}'. Motivo/Error: {motivo_texto}"
    )
    
    return {
        "message": "Equipo pasado a no inspeccionado correctamente",
        "equipo_id": id,
        "estado_actual": "PENDIENTE",
        "motivo": motivo_texto
    }

