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
        cursor = db.execute("INSERT INTO ubicaciones (empresa_id, nombre, codigo, descripcion, drive_folder_id) VALUES (?, ?, ?, ?, ?)", 
                            (ubicacion.empresa_id, ubicacion.nombre, ubicacion.codigo, ubicacion.descripcion, ubicacion.drive_folder_id))
        db.commit()
        return {"id": cursor.lastrowid, "message": "Ubicación creada exitosamente"}
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

