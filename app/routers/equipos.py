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


@router.get("/", response_model=Dict[str, Any])
def list_equipos(
    empresa: Optional[str] = None,
    area: Optional[str] = None,
    anio: Optional[str] = None,
    estado: Optional[str] = None,
    ubicacion_id: Optional[int] = None,
    db: sqlite3.Connection = Depends(get_db)
    # Sin current_user explícito acá para dejarlo abierto, o agregar si es estricto
):
    if ubicacion_id:
        # Consulta directa para filtro por id de ubicación (nuevo formato)
        cursor = db.execute("SELECT * FROM equipos WHERE activo = 1 AND ubicacion_id = ?", (ubicacion_id,))
        equipos = [dict(row) for row in cursor.fetchall()]
        return {"equipos": equipos}
    
    # Consulta usando db_service para retrocompatibilidad
    equipos = db_service.obtener_lista_equipos_db(empresa=empresa, area=area, anio=anio, estado=estado)
    return {"equipos": equipos}

@router.post("/", response_model=Dict[str, Any])
def create_equipo(equipo: EquipoCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    try:
        cursor = db.execute("""
            INSERT INTO equipos (ubicacion_id, codigo, nombre, tag, material, fluido, presion_diseno, temperatura_diseno, fabricante, modelo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (equipo.ubicacion_id, equipo.codigo, equipo.nombre, equipo.tag, equipo.material, equipo.fluido, equipo.presion_diseno, equipo.temperatura_diseno, equipo.fabricante, equipo.modelo))
        db.commit()
        nuevo_id = cursor.lastrowid
        
        drive_info = None
        if equipo.crear_carpeta_drive:
            from app.services.drive_service import crear_estructura_equipo, buscar_carpeta_area_por_nombre
            
            # Determinar parent folder ID
            parent_id = equipo.parent_folder_id
            if not parent_id:
                cursor_loc = db.execute("SELECT nombre FROM ubicaciones WHERE id = ?", (equipo.ubicacion_id,))
                loc_row = cursor_loc.fetchone()
                if loc_row:
                    parent_id = buscar_carpeta_area_por_nombre(loc_row["nombre"])
            
            if parent_id:
                try:
                    campanias = equipo.campanias_iniciales
                    if not campanias:
                        from app.services.db_service import get_config_value_db
                        campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
                        campanias = [campania_activa]
                    
                    res_drive = crear_estructura_equipo(
                        parent_id=parent_id,
                        nombre_equipo=f"{equipo.codigo} {equipo.nombre}",
                        campanias=campanias,
                        subcarpetas=equipo.subcarpetas
                    )
                    drive_info = {
                        "folder_id": res_drive.get("id"),
                        "folder_title": res_drive.get("title"),
                        "folder_url": res_drive.get("alternateLink")
                    }
                except Exception as drive_err:
                    import logging
                    logging.getLogger(__name__).error(f"Error creando estructura en Google Drive: {drive_err}", exc_info=True)
        
        registrar_auditoria(
            usuario_id=current_user.get("id"),
            accion="CREAR_EQUIPO",
            tabla="equipos",
            registro_id=nuevo_id,
            detalles=f"Equipo '{equipo.codigo} - {equipo.nombre}' creado en ubicación {equipo.ubicacion_id}."
        )
        return {
            "id": nuevo_id, 
            "message": "Equipo creado exitosamente",
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
    return inspeccion
