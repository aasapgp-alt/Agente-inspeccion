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
    root_id = get_config_value_db("drive_folder_id") or "1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD"
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

@router.get("/ancestro", response_model=Dict[str, Any])
def get_folder_ancestro(folder_id: str, current_user: dict = Depends(get_current_user), db: sqlite3.Connection = Depends(get_db)):
    """
    Obtiene la cadena jerárquica de carpetas ancestro (desde la ubicación/área técnica hasta la carpeta especificada).
    Permite acotar y navegar dentro del árbol donde se localiza el equipo.
    """
    try:
        chain = []
        curr = folder_id
        visited = set()
        cursor = db.cursor()
        
        while curr and curr not in visited:
            visited.add(curr)
            cursor.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache WHERE drive_id = ?", (curr,))
            row = cursor.fetchone()
            if row:
                chain.append({"id": row["drive_id"], "title": row["nombre"]})
                curr = row["parent_id"]
            else:
                break
                
        chain.reverse()
        if not chain and folder_id:
            chain = [{"id": folder_id, "title": "Carpeta seleccionada"}]
            
        return {"ancestro": chain}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import urllib.parse
import os
import ipaddress
from urllib.parse import urlparse
from app.core.dependencies import get_user_from_token

ALLOWED_THUMBNAIL_DOMAINS = {
    "lh3.googleusercontent.com", 
    "lh4.googleusercontent.com", 
    "lh5.googleusercontent.com", 
    "lh6.googleusercontent.com", 
    "drive.google.com"
}

def _es_url_thumbnail_segura(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        # Rechazar localhost e IPs privadas/loopback/link-local
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local:
                return False
        except ValueError:
            pass  # Es un hostname de dominio

        if hostname in ("localhost", "127.0.0.1", "169.254.169.254"):
            return False

        # Validar si el hostname termina en alguno de los dominios permitidos de Google
        if any(hostname == domain or hostname.endswith("." + domain) for domain in ALLOWED_THUMBNAIL_DOMAINS) or hostname.endswith(".googleusercontent.com"):
            return True

        return False
    except Exception:
        return False

@router.get("/proxy_thumbnail")
def proxy_thumbnail(url: str, token: Optional[str] = Query(None), db: sqlite3.Connection = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Token no provisto")
    
    # Validar autenticación y sesión activa en BD
    try:
        user_info = get_user_from_token(token)
        cursor = db.cursor()
        cursor.execute("SELECT 1 FROM sesiones_activas WHERE token = ? AND user_id = ?", (token, user_info["id"]))
        if not cursor.fetchone():
            raise HTTPException(status_code=401, detail="Sesión no válida")
    except Exception:
        raise HTTPException(status_code=401, detail="No autorizado o token expirado")

    # Validar SSRF
    if not _es_url_thumbnail_segura(url):
        raise HTTPException(status_code=400, detail="URL no permitida por políticas de seguridad")

    try:
        import requests
        verify_ssl = not (os.getenv("DISABLE_SSL_VERIFY", "").lower() in ("1", "true", "yes"))
        res = requests.get(url, verify=verify_ssl, timeout=10, allow_redirects=False)
        if res.status_code == 200:
            return Response(content=res.content, media_type="image/jpeg")
        return Response(status_code=res.status_code)
    except Exception:
        raise HTTPException(status_code=500, detail="Error al consultar imagen remota")

@router.get("/imagenes", response_model=Dict[str, Any])
def list_imagenes(folder_id: str, current_user: dict = Depends(get_current_user)):
    try:
        archivos = listar_archivos(folder_id)
        imagenes = []
        for f in archivos:
            if f.get('mimeType', '').startswith('image/'):
                thumb_url = f.get('thumbnailLink', '')
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
        cursor.execute("SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE id = ?", (equipo_id,))
        eq = cursor.fetchone()
        
        if not eq:
            return {"sugerencias": []}
            
        codigo = str(eq['codigo']) if eq['codigo'] else ""
        nombre = str(eq['nombre']) if eq['nombre'] else ""
        drive_folder_id = eq['drive_folder_id'] if 'drive_folder_id' in eq.keys() else None
        
        if drive_folder_id:
            # Obtener nombre de la carpeta desde cache o por defecto nombre equipo
            cursor.execute("SELECT nombre FROM drive_folders_cache WHERE drive_id = ?", (drive_folder_id,))
            cache_row = cursor.fetchone()
            folder_title = cache_row['nombre'] if cache_row else f"{codigo} {nombre}"
            return {"sugerencias": [{"id": drive_folder_id, "name": folder_title, "score": 100}]}

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
            if (i == 0 and match_score >= 0.3) or (c.get('direct_link')) or (termino.lower() in c['title'].lower()):
                score = 100
            else:
                score = 50
            sugerencias.append({"id": c['id'], "name": c['title'], "score": score})
            
        return {"sugerencias": sugerencias}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FolderCreate(BaseModel):
    nombre: str
    parent_id: Optional[str] = "root"

@router.post("/crear_carpeta", response_model=Dict[str, Any])
def create_folder(folder: FolderCreate, current_user: dict = Depends(get_current_user)):
    try:
        from app.services.drive_service import obtener_o_crear_carpeta_drive
        folder_id = obtener_o_crear_carpeta_drive(folder.nombre, folder.parent_id)
        if folder_id == "mock_folder_id" or folder_id == "root":
            return {"id": folder_id, "title": folder.nombre, "message": "Carpeta creada (o modo mock)"}
        return {"id": folder_id, "title": folder.nombre, "message": "Carpeta creada exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import UploadFile, File, Form
import tempfile
import shutil

@router.post("/subir", response_model=Dict[str, Any])
async def upload_file_to_drive(
    file: UploadFile = File(...),
    carpeta_id: Optional[str] = Form(None),
    equipo_id: Optional[int] = Form(None),
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Sube un archivo o foto directamente a Google Drive dentro de la carpeta seleccionada
    o en la carpeta de la ubicación técnica / equipo correspondiente.
    """
    try:
        from app.services.drive_service import subir_archivo
        
        target_folder_id = carpeta_id
        if not target_folder_id and equipo_id:
            cursor = db.cursor()
            cursor.execute("""
                SELECT u.drive_folder_id 
                FROM equipos e 
                LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id 
                WHERE e.id = ?
            """, (equipo_id,))
            row_u = cursor.fetchone()
            if row_u:
                target_folder_id = row_u["drive_folder_id"] if isinstance(row_u, (sqlite3.Row, dict)) else row_u[0]
                
        if not target_folder_id or target_folder_id == "root":
            from app.services.db_service import get_config_value_db
            target_folder_id = get_config_value_db("drive_folder_id") or os.getenv("DRIVE_FOLDER_ID") or "1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD"
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        # Optimizar imagen antes de subir a Google Drive si corresponde
        es_imagen = (
            (file.content_type and file.content_type.startswith("image/")) or
            any((file.filename or "").lower().endswith(ext) for ext in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'))
        )
        if es_imagen:
            try:
                from app.utils.image_utils import optimizar_imagen_bytes
                with open(tmp_path, "rb") as f_in:
                    raw_in = f_in.read()
                opt_bytes = optimizar_imagen_bytes(raw_in, max_dimension=1600, calidad=80)
                if opt_bytes:
                    with open(tmp_path, "wb") as f_out:
                        f_out.write(opt_bytes)
            except Exception as opt_err:
                logger.warning(f"No se pudo optimizar la imagen antes de subir a Drive ({opt_err}). Continuando con original.")
            
        try:
            res = subir_archivo(tmp_path, file.filename, target_folder_id)
            if not res or "id" not in res:
                raise HTTPException(
                    status_code=500,
                    detail="Google Drive no devolvió ID de archivo. Verifique que la carpeta tenga permisos de Editor para la cuenta de servicio."
                )
            return {
                "id": res["id"],
                "title": res.get("title", file.filename),
                "carpeta_id": target_folder_id,
                "status": "success"
            }
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error en /api/drive/subir: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al subir a Google Drive: {str(e)}")
