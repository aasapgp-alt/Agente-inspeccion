import os
import io
import logging
import re
import certifi

# Monkeypatch httplib2 to bypass SSL certificate verification issues
import httplib2
orig_init = httplib2.Http.__init__
def new_init(self, *args, **kwargs):
    kwargs['disable_ssl_certificate_validation'] = True
    orig_init(self, *args, **kwargs)
httplib2.Http.__init__ = new_init

os.environ["HTTPLIB2_CA_CERTS"] = certifi.where()

from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

logger = logging.getLogger(__name__)

def autenticar_drive() -> GoogleAuth:
    try:
        gauth = GoogleAuth(settings_file="settings.yaml")
        gauth.ServiceAuth()
        return gauth
    except Exception as e:
        logger.warning(f"Error autenticando con Google Drive: {e}. Usando modo MOCK.")
        return None

def get_drive_instance():
    gauth = autenticar_drive()
    if not gauth:
        return None
    return GoogleDrive(gauth)

def listar_carpetas(carpeta_id: str) -> list:
    drive = get_drive_instance()
    if not drive:
        # MOCK DATA
        if carpeta_id == "root":
            return [
                {"id": "mock_folder_1", "title": "Inspecciones 2024"},
                {"id": "mock_folder_2", "title": "Manuales de Equipos"},
                {"id": "mock_folder_3", "title": "123 - Impulsión Bomba 621-409"}
            ]
        return []
        
    try:
        query = f"'{carpeta_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
        file_list = drive.ListFile({'q': query}).GetList()
        return [{"id": file['id'], "title": file['title']} for file in file_list]
    except Exception as e:
        logger.error(f"Error listando carpetas en {carpeta_id}: {e}")
        return []

def listar_archivos(carpeta_id: str) -> list:
    drive = get_drive_instance()
    if not drive:
        # MOCK DATA
        return [
            {"id": "mock_img_1", "title": "foto_inspeccion_1.jpg", "mimeType": "image/jpeg", "fileSize": 2048000},
            {"id": "mock_img_2", "title": "desgaste_perno.jpg", "mimeType": "image/jpeg", "fileSize": 1500000}
        ]
        
    try:
        query = f"'{carpeta_id}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false"
        file_list = drive.ListFile({'q': query}).GetList()
        return [{"id": file['id'], "title": file['title'], "mimeType": file['mimeType'], "fileSize": int(file.get('fileSize', 0)), "thumbnailLink": file.get('thumbnailLink', '')} for file in file_list]
    except Exception as e:
        logger.error(f"Error listando archivos en {carpeta_id}: {e}")
        return []

def descargar_imagen(file_id: str) -> bytes:
    try:
        drive = get_drive_instance()
        file = drive.CreateFile({'id': file_id})
        tmp_name = f"{file_id}.tmp"
        file.GetContentFile(tmp_name)
        
        from PIL import Image, ImageOps
        import io
        try:
            with Image.open(tmp_name) as img:
                img = ImageOps.exif_transpose(img)
                out_buffer = io.BytesIO()
                img.save(out_buffer, format=img.format or "JPEG")
                content = out_buffer.getvalue()
        except Exception as img_err:
            logger.warning(f"No se pudo rotar la imagen {file_id}, usando original: {img_err}")
            with open(tmp_name, "rb") as f:
                content = f.read()
                
        os.remove(tmp_name)
        return content
    except Exception as e:
        logger.error(f"Error descargando imagen {file_id}: {e}")
        return b""

def subir_archivo(ruta_local: str, nombre: str, carpeta_id: str) -> dict:
    try:
        drive = get_drive_instance()
        file = drive.CreateFile({'title': nombre, 'parents': [{'id': carpeta_id}]})
        file.SetContentFile(ruta_local)
        file.Upload()
        return {"id": file['id'], "title": file['title']}
    except Exception as e:
        logger.error(f"Error subiendo archivo {nombre}: {e}")
        return {}

def buscar_carpeta(nombre: str, carpeta_id: str) -> str:
    try:
        drive = get_drive_instance()
        query = f"'{carpeta_id}' in parents and title='{nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        file_list = drive.ListFile({'q': query}).GetList()
        if file_list:
            return file_list[0]['id']
        return ""
    except Exception as e:
        logger.error(f"Error buscando carpeta {nombre}: {e}")
        return ""

def obtener_o_crear_carpeta_drive(nombre: str, parent_id: str = "root") -> str:
    drive = get_drive_instance()
    if not drive:
        return "mock_folder_id"
    try:
        folder_id = buscar_carpeta(nombre, parent_id)
        if folder_id:
            return folder_id
        folder_metadata = {
            'title': nombre,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id and parent_id != "root":
            folder_metadata['parents'] = [{'id': parent_id}]
        folder = drive.CreateFile(folder_metadata)
        folder.Upload()
        return folder['id']
    except Exception as e:
        logger.error(f"Error al obtener o crear carpeta {nombre} en {parent_id}: {e}")
        return "root"

def resolver_shortcut(file_id: str) -> str:
    try:
        drive = get_drive_instance()
        file = drive.CreateFile({'id': file_id})
        file.FetchMetadata(fields='shortcutDetails')
        details = file.get('shortcutDetails')
        if details and 'targetId' in details:
            return details['targetId']
        return file_id
    except Exception as e:
        logger.error(f"Error resolviendo shortcut {file_id}: {e}")
        return file_id

def sugerir_carpetas(codigo: str, nombre: str, carpeta_id: str) -> list:
    drive = get_drive_instance()
    
    # If the parent folder is 'root', resolve it to the configured drive_folder_id from DB settings
    if carpeta_id == "root":
        try:
            from app.services.db_service import get_config_value_db
            db_folder_id = get_config_value_db("drive_folder_id")
            if db_folder_id:
                carpeta_id = db_folder_id
        except Exception as db_err:
            logger.warning(f"Error resolving drive_folder_id configuration: {db_err}")

    # Extract clean significant keywords from name
    words = [w for w in re.split(r'\W+', nombre) if len(w) >= 3]
    stop_words = {'del', 'con', 'para', 'por', 'las', 'los', 'una', 'uno', 'de', 'la', 'el', 'en'}
    clean_words = [w for w in words if w.lower() not in stop_words]
    
    # Also include the code
    if codigo:
        clean_words.append(codigo)
        
    if not drive:
        # MOCK DATA
        termino_busqueda = clean_words[0] if clean_words else codigo
        return [
            {"id": "mock_folder_3", "title": f"Carpeta del Equipo {termino_busqueda} ({nombre})"},
            {"id": "mock_folder_4", "title": f"Historial {termino_busqueda}"}
        ]
        
    try:
        if not clean_words:
            carpetas = listar_carpetas(carpeta_id)
            return carpetas[:5]
            
        # Build search terms for Drive query matching ANY of the clean keywords
        query_parts = [f"title contains '{w}'" for w in clean_words[:5]]
        query = "mimeType='application/vnd.google-apps.folder' and (" + " or ".join(query_parts) + ") and trashed=false"
        
        file_list = drive.ListFile({'q': query}).GetList()
        sugeridas_raw = [{"id": file['id'], "title": file['title']} for file in file_list]
        
        results = []
        import unicodedata
        
        def clean_word(word):
            nfkd_form = unicodedata.normalize('NFKD', word)
            return "".join([ch for ch in nfkd_form if not unicodedata.combining(ch)]).lower()
            
        eq_words = set(clean_word(w) for w in re.split(r'\W+', nombre) if len(w) >= 2)
        
        for c in sugeridas_raw:
            folder_words = set(clean_word(w) for w in re.split(r'\W+', c['title']) if len(w) >= 2)
            
            overlap_score = 0
            if folder_words and eq_words:
                overlap = folder_words.intersection(eq_words)
                overlap_score = len(overlap) / len(folder_words.union(eq_words))
                
            # Extra points if title contains the code/number (e.g. '135')
            if codigo and clean_word(codigo) in clean_word(c['title']):
                overlap_score += 0.5
                
            results.append({
                "id": c['id'],
                "title": c['title'],
                "overlap_score": overlap_score
            })
            
        # Sort by score descending
        results.sort(key=lambda x: x['overlap_score'], reverse=True)
        
        if results:
            return [{"id": r['id'], "title": r['title'], "match_score": r['overlap_score']} for r in results]
            
        # Fallback to listing folder contents
        carpetas = listar_carpetas(carpeta_id)
        return carpetas[:5]
        
    except Exception as e:
        logger.error(f"Error sugiriendo carpetas para {nombre}: {e}")
        return []

def obtener_metadata_archivo(file_id: str) -> dict:
    try:
        drive = get_drive_instance()
        file = drive.CreateFile({'id': file_id})
        file.FetchMetadata()
        return dict(file)
    except Exception as e:
        logger.error(f"Error obteniendo metadata para {file_id}: {e}")
        return {}
