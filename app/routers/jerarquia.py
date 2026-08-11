from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Dict, Any, Optional
import sqlite3
from app.core.dependencies import get_db, get_current_user, require_role
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["jerarquia"])

class EmpresaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class UbicacionCreate(BaseModel):
    empresa_id: int
    nombre: str
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    drive_folder_id: Optional[str] = None

@router.get("/empresas", response_model=List[Dict[str, Any]])
def get_empresas(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.execute("SELECT * FROM empresas")
    return [dict(row) for row in cursor.fetchall()]

@router.post("/empresas", response_model=Dict[str, Any])
def create_empresa(empresa: EmpresaCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    try:
        cursor = db.execute("INSERT INTO empresas (nombre, descripcion) VALUES (?, ?)", (empresa.nombre, empresa.descripcion))
        db.commit()
        return {"id": cursor.lastrowid, "message": "Empresa creada exitosamente"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="La empresa ya existe")

@router.get("/ubicaciones", response_model=List[Dict[str, Any]])
def get_ubicaciones(empresa_id: Optional[int] = None, db: sqlite3.Connection = Depends(get_db)):
    query = "SELECT * FROM ubicaciones"
    params = []
    if empresa_id:
        query += " WHERE empresa_id = ?"
        params.append(empresa_id)
    cursor = db.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]

@router.post("/ubicaciones", response_model=Dict[str, Any])
def create_ubicacion(ubicacion: UbicacionCreate, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    try:
        # 1. Determinar el código en orden secuencial si no se proveyó
        codigo_calculado = ubicacion.codigo
        if not codigo_calculado:
            cursor_count = db.execute("SELECT COUNT(*) FROM ubicaciones WHERE empresa_id = ?", (ubicacion.empresa_id,))
            num_ub = cursor_count.fetchone()[0] + 1
            codigo_calculado = f"{str(num_ub).zfill(2)}"

        # 2. Si no se especificó drive_folder_id, intentar crear/vincular carpeta en Drive o Caché
        df_id = ubicacion.drive_folder_id
        folder_title = f"{codigo_calculado}- {ubicacion.nombre}"
        
        if not df_id:
            try:
                from app.services.drive_service import obtener_o_crear_carpeta_drive, get_config_value_db
                parent_root = get_config_value_db("drive_folder_id") or "1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD"
                df_id = obtener_o_crear_carpeta_drive(folder_title, parent_root)
            except Exception as d_err:
                import logging
                logging.getLogger(__name__).warning(f"Error creando carpeta de ubicación en Drive: {d_err}")
                df_id = f"auto_loc_folder_{ubicacion.empresa_id}_{codigo_calculado}"

        cursor = db.execute("""
            INSERT INTO ubicaciones (empresa_id, nombre, codigo, descripcion, drive_folder_id) 
            VALUES (?, ?, ?, ?, ?)
        """, (ubicacion.empresa_id, ubicacion.nombre, codigo_calculado, ubicacion.descripcion, df_id))
        db.commit()
        nuevo_id = cursor.lastrowid

        # 3. Registrar en drive_folders_cache
        if df_id:
            try:
                db.execute("""
                    INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (df_id, folder_title, None))
                db.commit()
            except Exception as cache_err:
                pass

        return {
            "id": nuevo_id,
            "codigo": codigo_calculado,
            "drive_folder_id": df_id,
            "message": "Ubicación creada y vinculada exitosamente"
        }
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="La ubicación ya existe para esta empresa")


@router.delete("/ubicaciones/{id}", response_model=Dict[str, Any])
def delete_ubicacion(id: int, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(require_role("admin"))):
    try:
        # Verificar si hay equipos asociados
        cursor = db.execute("SELECT COUNT(*) FROM equipos WHERE ubicacion_id = ?", (id,))
        count = cursor.fetchone()[0]
        if count > 0:
            raise HTTPException(status_code=400, detail="No se puede eliminar la ubicación porque tiene equipos asociados")
            
        cursor = db.execute("DELETE FROM ubicaciones WHERE id = ?", (id,))
        db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Ubicación no encontrada")
        return {"message": "Ubicación técnica eliminada correctamente", "id": id}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=str(e))

