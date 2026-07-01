from fastapi import APIRouter, Depends, HTTPException, Response, Query, BackgroundTasks
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.core.dependencies import get_current_user, get_db
import sqlite3
import uuid
from app.services.drive_service import listar_carpetas, listar_archivos, descargar_imagen, sugerir_carpetas as drive_sugerir_carpetas

router = APIRouter(prefix="/api/drive", tags=["drive"])

sincronizacion_progress = {}

def bg_task_sincronizar_drive(task_id: str):
    from app.services.db_service import get_db_connection
    from app.services.drive_service import indexar_todas_las_carpetas_drive
    try:
        with get_db_connection() as conn:
            indexar_todas_las_carpetas_drive(conn, task_id, sincronizacion_progress)
    except Exception as e:
        sincronizacion_progress[task_id] = {"status": "failed", "progress": 100, "mensaje": f"Error: {str(e)}"}

@router.get("/root")
def get_root_folder(current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    from app.services.db_service import get_config_value_db
    root_id = get_config_value_db("drive_folder_id") or "root"
    return {"root_id": root_id}

@router.get("/carpetas", response_model=Dict[str, Any])
def list_carpetas(parent_id: str, current_user: dict = Depends(get_current_user)):
    try:
        carpetas = listar_carpetas(parent_id)
        # Frontend expects { [name]: id }
        carpetas_dict = {c['title']: c['id'] for c in carpetas}
        return {"carpetas": carpetas_dict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import urllib.parse

@router.get("/proxy_thumbnail")
def proxy_thumbnail(url: str, token: Optional[str] = Query(None), db: sqlite3.Connection = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Token no provisto")
    try:
        import requests
        res = requests.get(url, verify=False, timeout=10)
        if res.status_code == 200:
            return Response(content=res.content, media_type="image/jpeg")
        return Response(status_code=res.status_code)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/imagenes", response_model=Dict[str, Any])
def list_imagenes(folder_id: str, current_user: dict = Depends(get_current_user)):
    try:
        archivos = listar_archivos(folder_id)
        imagenes = []
        for f in archivos:
            if f.get('mimeType', '').startswith('image/'):
                thumb_url = f.get('thumbnailLink', '')
                if thumb_url:
                    encoded_url = urllib.parse.quote(thumb_url)
                    thumb_url = f"http://localhost:8000/api/drive/proxy_thumbnail?url={encoded_url}"
                    
                imagenes.append({
                    "id": f['id'], 
                    "name": f['title'], 
                    "size": f.get('fileSize', 0),
                    "thumbnail": thumb_url
                })
        return {"imagenes": imagenes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Query

@router.get("/imagen/{file_id}")
def get_imagen(
    file_id: str, 
    token: Optional[str] = Query(None), 
    db: sqlite3.Connection = Depends(get_db)
):
    if not token:
        raise HTTPException(status_code=401, detail="Token no provisto")
    try:
        from app.core.dependencies import get_user_from_token
        user_info = get_user_from_token(token)
        cursor = db.cursor()
        cursor.execute("SELECT 1 FROM sesiones_activas WHERE token = ? AND user_id = ?", (token, user_info["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=401, detail="Sesión no válida")
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado")

    try:
        image_content = descargar_imagen(file_id)
        if not image_content:
            raise HTTPException(status_code=404, detail="Imagen no encontrada")
        return Response(content=image_content, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sincronizar")
def sincronizar_drive(background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    task_id = str(uuid.uuid4())
    sincronizacion_progress[task_id] = {"status": "processing", "progress": 0, "mensaje": "Iniciando sincronización..."}
    background_tasks.add_task(bg_task_sincronizar_drive, task_id)
    return {"task_id": task_id}

@router.get("/sincronizar/estado/{task_id}")
def status_sincronizar_drive(task_id: str, current_user: dict = Depends(get_current_user)):
    if task_id not in sincronizacion_progress:
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return sincronizacion_progress[task_id]

@router.get("/sugerir_carpetas", response_model=Dict[str, Any])
def sugerir_carpetas_get(equipo_id: str, current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    try:
        cursor = db.cursor()
        cursor.execute("SELECT codigo, nombre FROM equipos WHERE id = ?", (equipo_id,))
        eq = cursor.fetchone()
        
        if not eq:
            return {"sugerencias": []}
            
        codigo = str(eq['codigo']) if eq['codigo'] else ""
        nombre = str(eq['nombre']) if eq['nombre'] else ""
        
        import re
        tags = re.findall(r'\d{3}-\d{3}', nombre)
        termino = tags[0] if tags else codigo
        
        from app.services.db_service import get_config_value_db
        root_folder_id = get_config_value_db("drive_folder_id") or "root"
        
        # drive_sugerir_carpetas will receive both to find the best match
        sugerencias_raw = drive_sugerir_carpetas(codigo, nombre, root_folder_id)
        
        # Limitar las sugerencias a un máximo de 5 para no dejar un listado muy largo
        sugerencias_raw = sugerencias_raw[:5]
        
        sugerencias = []
        for i, c in enumerate(sugerencias_raw):
            match_score = c.get('match_score', 0)
            # Match is high score (100) if best result is above threshold or contains search term
            if (i == 0 and match_score >= 0.3) or (termino.lower() in c['title'].lower()):
                score = 100
            else:
                score = 50
            sugerencias.append({"id": c['id'], "name": c['title'], "score": score})
            
        return {"sugerencias": sugerencias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
