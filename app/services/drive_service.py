import os
import io
import logging
import re
import certifi
import unicodedata
from typing import List, Dict, Optional, Any

import httplib2
# Solo aplicar deshabilitación de SSL si se especifica explícitamente la variable de entorno
if os.getenv("DISABLE_SSL_VERIFY", "").lower() in ("1", "true", "yes"):
    orig_init = httplib2.Http.__init__
    def new_init(self, *args, **kwargs):
        kwargs['disable_ssl_certificate_validation'] = True
        orig_init(self, *args, **kwargs)
    httplib2.Http.__init__ = new_init

os.environ["HTTPLIB2_CA_CERTS"] = certifi.where()

from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

logger = logging.getLogger(__name__)

_cached_drive = None

def autenticar_drive() -> Optional[GoogleAuth]:
    # 1. Si existe credencial OAuth de usuario autenticado (mycreds.txt), intentar usarla
    if os.path.exists("mycreds.txt"):
        try:
            gauth = GoogleAuth(settings_file="settings.yaml")
            gauth.LoadCredentialsFile("mycreds.txt")
            if gauth.credentials is not None and not getattr(gauth.credentials, 'invalid', False):
                if gauth.access_token_expired:
                    gauth.Refresh()
                else:
                    gauth.Authorize()
                gauth.SaveCredentialsFile("mycreds.txt")
                logger.info("Autenticado exitosamente en Google Drive usando OAuth de usuario (mycreds.txt).")
                return gauth
            else:
                logger.warning("mycreds.txt contiene credenciales expiradas/inválidas. Probando Cuenta de Servicio...")
        except Exception as oauth_err:
            logger.warning(f"Error con OAuth de usuario ({oauth_err}). Probando Cuenta de Servicio...")

    # 2. Si existe Service Account en variable de entorno (para Render/Cloud), usarla
    sa_env = os.getenv("SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON") or os.getenv("GOOGLE_CREDENTIALS")
    if sa_env and sa_env.strip():
        try:
            import json
            from oauth2client.service_account import ServiceAccountCredentials
            scope = ["https://www.googleapis.com/auth/drive"]
            key_dict = json.loads(sa_env)
            gauth = GoogleAuth()
            gauth.auth_method = 'service'
            gauth.credentials = ServiceAccountCredentials.from_json_keyfile_dict(key_dict, scope)
            logger.info("Autenticado exitosamente en Google Drive usando Cuenta de Servicio desde variable de entorno.")
            return gauth
        except Exception as env_sa_err:
            logger.warning(f"Error al autenticar Cuenta de Servicio desde variable de entorno: {env_sa_err}")

    # 3. Si existe archivo físico de Service Account, usarlo
    custom_sa_path = os.getenv("SERVICE_ACCOUNT_FILE") or os.getenv("SERVICE_ACCOUNT_PATH")
    service_paths = [
        custom_sa_path,
        "service_account.json",
        os.path.join(os.getcwd(), "service_account.json"),
        "agente-inspector-propietario-71d32fd94d89.json",
        "praxis-effort-464216-u5-b302073b59eb.json",
        "c:\\Agente-Inspector\\service_account.json"
    ]
    for sp in service_paths:
        if sp and os.path.exists(sp):
            try:
                from oauth2client.service_account import ServiceAccountCredentials
                scope = ["https://www.googleapis.com/auth/drive"]
                gauth = GoogleAuth()
                gauth.auth_method = 'service'
                gauth.credentials = ServiceAccountCredentials.from_json_keyfile_name(sp, scope)
                logger.info(f"Autenticado exitosamente en Google Drive usando Cuenta de Servicio ({sp}).")
                return gauth
            except Exception as sa_err:
                logger.warning(f"Error al autenticar Cuenta de Servicio {sp}: {sa_err}")

    logger.warning("No se pudo autenticar con Google Drive. Usando modo MOCK.")
    return None

def get_drive_instance():
    global _cached_drive
    if _cached_drive is not None:
        return _cached_drive
    gauth = autenticar_drive()
    if not gauth:
        return None
    _cached_drive = GoogleDrive(gauth)
    return _cached_drive

def listar_carpetas(carpeta_id: str) -> list:
    drive = get_drive_instance()
    if not drive:
        # Intentar consultar caché local de Drive primero
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT drive_id as id, nombre as title FROM drive_folders_cache WHERE parent_id = ?", (carpeta_id,))
                rows = [dict(row) for row in cursor.fetchall()]
                if rows:
                    return rows
        except Exception as db_err:
            logger.warning(f"Error consultando caché local en listar_carpetas mock: {db_err}")

        # MOCK DATA
        if carpeta_id == "root":
            return [
                {"id": "mock_folder_1", "title": "Inspecciones 2024"},
                {"id": "mock_folder_2", "title": "Manuales de Equipos"},
                {"id": "mock_folder_3", "title": "123 - Impulsión Bomba 621-409"}
            ]
        return []
        
    try:
        seen_ids = set()
        result = []

        # 1. Direct children (folders and shortcuts)
        query = f"'{carpeta_id}' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut') and trashed=false"
        file_list = drive.ListFile({
            'q': query,
            'supportsAllDrives': True,
            'includeItemsFromAllDrives': True
        }).GetList()

        for f in file_list:
            mime = f.get('mimeType')
            f_id = f['id']
            f_title = f['title']

            if mime == 'application/vnd.google-apps.shortcut':
                details = f.get('shortcutDetails', {})
                if details.get('targetMimeType') == 'application/vnd.google-apps.folder':
                    f_id = details.get('targetId', f_id)
                else:
                    continue

            if f_id not in seen_ids:
                seen_ids.add(f_id)
                result.append({"id": f_id, "title": f_title})

        # 2. Shared with me items (folders and shortcuts) solo si se consulta la raíz
        from app.services.db_service import get_config_value_db
        root_configured_id = get_config_value_db("drive_folder_id") or "1Ovv-3p3Q406jDUKANcU1f6EFrULH_pXD"
        
        if carpeta_id in ("root", root_configured_id):
            try:
                query_shared = "sharedWithMe=true and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut') and trashed=false"
                shared_list = drive.ListFile({
                    'q': query_shared,
                    'supportsAllDrives': True,
                    'includeItemsFromAllDrives': True
                }).GetList()

                for f in shared_list:
                    mime = f.get('mimeType')
                    f_id = f['id']
                    f_title = f['title']

                    if mime == 'application/vnd.google-apps.shortcut':
                        details = f.get('shortcutDetails', {})
                        if details.get('targetMimeType') == 'application/vnd.google-apps.folder':
                            f_id = details.get('targetId', f_id)
                        else:
                            continue

                    if f_id not in seen_ids and f_id != carpeta_id:
                        seen_ids.add(f_id)
                        result.append({"id": f_id, "title": f_title})
            except Exception as shared_err:
                logger.warning(f"Error al consultar elementos compartidos en Drive: {shared_err}")

        return result
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

def generar_imagen_mock(file_id: str = "mock_img") -> bytes:
    try:
        from PIL import Image, ImageDraw
        img = Image.new('RGB', (400, 300), color=(15, 23, 42))
        draw = ImageDraw.Draw(img)
        draw.rectangle([(10, 10), (390, 290)], outline=(56, 189, 248), width=2)
        draw.text((30, 40), "IMAGEN DE INSPECCION (DEMO/MOCK)", fill=(255, 255, 255))
        draw.text((30, 80), f"ID Archivo: {file_id}", fill=(148, 163, 184))
        draw.text((30, 120), "Estado: Modo Demostración", fill=(56, 189, 248))
        draw.text((30, 160), "Equipo: T-169 Tubo FRP", fill=(203, 213, 225))
        draw.text((30, 200), "Campaña PGP 2026", fill=(100, 116, 139))
        out = io.BytesIO()
        img.save(out, format="JPEG")
        return out.getvalue()
    except Exception:
        # Minimal 1x1 valid JPEG fallback
        return b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9'

IMAGE_CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "cache_drive_images")
os.makedirs(IMAGE_CACHE_DIR, exist_ok=True)

def descargar_imagen(file_id: str, max_dim: Optional[int] = 1280, calidad: int = 80, original: bool = False) -> bytes:
    if file_id.startswith("mock_"):
        return generar_imagen_mock(file_id)

    # Cache en disco: {file_id}_orig.jpg para original, o {file_id}_{max_dim}_{calidad}.jpg para optimizada
    cache_filename = f"{file_id}_orig.jpg" if original else f"{file_id}_{max_dim or 1280}_{calidad}.jpg"
    cache_path = os.path.join(IMAGE_CACHE_DIR, cache_filename)

    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 0:
        try:
            with open(cache_path, "rb") as f:
                return f.read()
        except Exception as read_err:
            logger.warning(f"Error leyendo imagen en caché {cache_path}: {read_err}")

    tmp_name = os.path.join(IMAGE_CACHE_DIR, f"{file_id}.tmp")
    try:
        drive = get_drive_instance()
        if not drive:
            logger.warning(f"No hay conexión a Drive para descargar {file_id}, usando fallback mock.")
            return generar_imagen_mock(file_id)
        file = drive.CreateFile({'id': file_id})
        file.GetContentFile(tmp_name)
        
        with open(tmp_name, "rb") as f:
            raw_bytes = f.read()

        if original:
            processed_bytes = raw_bytes
        else:
            from app.utils.image_utils import optimizar_imagen_bytes
            processed_bytes = optimizar_imagen_bytes(raw_bytes, max_dimension=max_dim, calidad=calidad)

        # Guardar en disco para servir en < 15ms en subsiguientes peticiones
        try:
            with open(cache_path, "wb") as f_cache:
                f_cache.write(processed_bytes)
        except Exception as cache_write_err:
            logger.warning(f"No se pudo escribir en caché {cache_path}: {cache_write_err}")

        return processed_bytes
    except Exception as e:
        logger.error(f"Error descargando imagen {file_id}: {e}")
        return generar_imagen_mock(file_id)
    finally:
        if os.path.exists(tmp_name):
            try:
                os.remove(tmp_name)
            except Exception:
                pass

def subir_archivo(ruta_local: str, nombre: str, carpeta_id: str) -> dict:
    try:
        drive = get_drive_instance()
        if not drive:
            logger.warning(f"No hay conexión activa a Google Drive para subir {nombre}.")
            return {}
        file = drive.CreateFile({'title': nombre, 'parents': [{'id': carpeta_id}]})
        file.SetContentFile(ruta_local)
        file.Upload(param={'supportsAllDrives': True})
        logger.info(f"Archivo {nombre} subido exitosamente a carpeta Drive {carpeta_id} (ID: {file['id']})")
        return {"id": file['id'], "title": file['title']}
    except Exception as e:
        logger.error(f"Error subiendo archivo {nombre} a carpeta Drive {carpeta_id}: {e}")
        if "quotaExceeded" in str(e) or "Service Accounts do not have storage quota" in str(e):
            logger.warning(
                "ATENCIÓN: La Cuenta de Servicio no posee cuota propia en Drive. "
                "Para subir a carpetas de usuario común, ejecute 'python scripts/sync_reports_drive_oauth.py' "
                "para generar las credenciales de usuario 'mycreds.txt'."
            )
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
        import uuid
        folder_id = f"mock_folder_{uuid.uuid4().hex[:8]}"
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                conn.execute("""
                    INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (drive_id) DO UPDATE SET
                        nombre = EXCLUDED.nombre,
                        parent_id = EXCLUDED.parent_id,
                        updated_at = CURRENT_TIMESTAMP
                """, (folder_id, nombre, parent_id))
                conn.commit()
        except Exception as cache_err:
            logger.warning(f"Error al guardar carpeta mock en caché: {cache_err}")
        return folder_id
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
        folder_id = folder['id']
        
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                conn.execute("""
                    INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (drive_id) DO UPDATE SET
                        nombre = EXCLUDED.nombre,
                        parent_id = EXCLUDED.parent_id,
                        updated_at = CURRENT_TIMESTAMP
                """, (folder_id, nombre, parent_id))
                conn.commit()
        except Exception as cache_err:
            logger.warning(f"Error al guardar carpeta creada en caché: {cache_err}")
            
        return folder_id
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

def indexar_todas_las_carpetas_drive(db_conn, task_id: str = None, progress_store: dict = None) -> bool:
    """
    Lee todas las carpetas en Google Drive y las almacena en la tabla drive_folders_cache.
    Usa el progress_store para reportar el progreso si se ejecuta en segundo plano.
    """
    if task_id and progress_store is not None:
        progress_store[task_id] = {"status": "processing", "progress": 10, "mensaje": "Autenticando con Google Drive..."}
        
    drive = get_drive_instance()
    if not drive:
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "failed", "progress": 100, "mensaje": "No se pudo autenticar con Google Drive (Modo MOCK activo)."}
        return False
        
    try:
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "processing", "progress": 30, "mensaje": "Obteniendo carpetas de Google Drive..."}
            
        query = "mimeType='application/vnd.google-apps.folder' and trashed=false"
        file_list = drive.ListFile({'q': query}).GetList()
        total_folders = len(file_list)
        
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "processing", "progress": 60, "mensaje": f"Se obtuvieron {total_folders} carpetas. Guardando en caché local..."}
            
        cursor = db_conn.cursor()
        
        # Primero vaciamos la tabla para que quede limpia
        cursor.execute("DELETE FROM drive_folders_cache")
        
        for idx, f in enumerate(file_list):
            drive_id = f['id']
            title = f['title']
            parent_id = f['parents'][0]['id'] if f.get('parents') else None
            
            cursor.execute("""
                INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (drive_id) DO UPDATE SET
                    nombre = EXCLUDED.nombre,
                    parent_id = EXCLUDED.parent_id,
                    updated_at = CURRENT_TIMESTAMP
            """, (drive_id, title, parent_id))
            
            # Actualizar progreso cada 100 carpetas
            if idx % 100 == 0 and task_id and progress_store is not None:
                progress = int(60 + (idx / total_folders) * 35)
                progress_store[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "mensaje": f"Guardando carpetas en caché ({idx}/{total_folders})..."
                }
                
        db_conn.commit()
        
        if task_id and progress_store is not None:
            progress_store[task_id] = {
                "status": "completed",
                "progress": 100,
                "mensaje": f"Indexación completada con éxito. {total_folders} carpetas sincronizadas."
            }
        return True
    except Exception as e:
        logger.error(f"Error al indexar carpetas de Drive: {e}", exc_info=True)
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "failed", "progress": 100, "mensaje": f"Error: {str(e)}"}
        return False

def remover_prefijo_secuencia(titulo: str) -> str:
    if not titulo:
        return ""
    # Remover prefijos como '01-', '02- ', '11A- ', '101B- '
    return re.sub(r'^\d{1,3}[a-zA-Z]*-\s*', '', titulo)

def obtener_carpeta_drive_directa_equipo(equipo_id: int = None, codigo: str = None, nombre: str = None) -> Optional[Dict[str, Any]]:
    """Obtiene el ID directo de carpeta en Drive registrado en la BD para un equipo."""
    try:
        from app.services.db_service import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            row = None
            if equipo_id:
                cursor.execute("SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE id = ?", (equipo_id,))
                row = cursor.fetchone()
            elif codigo:
                cursor.execute("SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE codigo = ?", (codigo,))
                row = cursor.fetchone()
            
            if row and row['drive_folder_id']:
                df_id = row['drive_folder_id']
                cursor.execute("SELECT nombre FROM drive_folders_cache WHERE drive_id = ?", (df_id,))
                cache_row = cursor.fetchone()
                folder_title = cache_row['nombre'] if cache_row else f"{row['codigo']} {row['nombre']}"
                return {
                    "id": df_id,
                    "title": folder_title,
                    "match_score": 1.0,
                    "direct_link": True
                }
    except Exception as e:
        logger.warning(f"Error consultando carpeta directa de equipo en BD: {e}")
    return None

def sugerir_carpetas(codigo: str, nombre: str, carpeta_id: str) -> list:
    # 0. Intentar vínculo directo registrado en BD para el equipo
    direct_match = obtener_carpeta_drive_directa_equipo(codigo=codigo, nombre=nombre)
    if direct_match:
        return [direct_match]

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

    # NOTE: Do NOT return mock data here if drive is None.
    # Always try the local cache first — it works independently of Drive auth.
        
    try:
        # Intentar consultar caché local de Drive primero
        has_cache = False
        cache_rows = []
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM drive_folders_cache")
                count = cursor.fetchone()[0]
                if count > 0:
                    has_cache = True
                    cursor.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache")
                    cache_rows = [{"id": r[0], "title": r[1], "parent_id": r[2]} for r in cursor.fetchall()]
        except Exception as db_err:
            logger.warning(f"Error consultando caché local de Drive: {db_err}")
            has_cache = False

        import unicodedata
        def clean_word(word):
            nfkd_form = unicodedata.normalize('NFKD', word)
            return "".join([ch for ch in nfkd_form if not unicodedata.combining(ch)]).lower()

        # Extraer tags numéricos del nombre del equipo (ej: "431-032", "421-070")
        # Estos son los identificadores más específicos y deben tener mayor peso
        numeric_tags = re.findall(r'\d{3}-\s*\d{3}', nombre)
        # Normalizar (quitar espacios en el medio: "431- 032" -> "431-032")
        numeric_tags = [re.sub(r'\s+', '', t) for t in numeric_tags]

        if has_cache:
            # Búsqueda en el caché local
            clean_words_norm = [clean_word(w) for w in clean_words]
            sugeridas_raw = []

            # Si se especificó una carpeta de área padre (carpeta_id), filtrar candidatos ÚNICAMENTE a hijos de esa área
            candidate_rows = cache_rows
            if carpeta_id and carpeta_id != "root":
                direct_children = [r for r in cache_rows if r.get("parent_id") == carpeta_id]
                if direct_children:
                    candidate_rows = direct_children

            if clean_words_norm:
                for r in candidate_rows:
                    title_without_prefix = remover_prefijo_secuencia(r["title"])
                    title_norm = clean_word(title_without_prefix)
                    if any(w in title_norm for w in clean_words_norm):
                        sugeridas_raw.append(r)

            if not sugeridas_raw and carpeta_id:
                # Fallback: listar hijos directos en caché de esa área
                sugeridas_raw = [r for r in cache_rows if r["parent_id"] == carpeta_id]
        else:
            # No hay cache: intentar con la API de Drive en tiempo real (solo si está disponible)
            if not drive:
                # Sin cache y sin Drive: retornar lista vacía (no mockear)
                return []
            if not clean_words:
                carpetas = listar_carpetas(carpeta_id)
                return carpetas[:5]

            query_parts = [f"title contains '{w}'" for w in clean_words[:5]]
            query = "mimeType='application/vnd.google-apps.folder' and (" + " or ".join(query_parts) + ") and trashed=false"
            file_list = drive.ListFile({'q': query}).GetList()
            sugeridas_raw = [{"id": file['id'], "title": file['title']} for file in file_list]


        results = []
        eq_words = set(clean_word(w) for w in re.split(r'\W+', nombre) if len(w) >= 2)

        for c in sugeridas_raw:
            title_without_prefix = remover_prefijo_secuencia(c['title'])
            title_clean = clean_word(title_without_prefix)
            folder_words = set(clean_word(w) for w in re.split(r'\W+', title_without_prefix) if len(w) >= 2)

            # Score base: Jaccard overlap entre palabras del nombre y carpeta
            overlap_score = 0.0
            if folder_words and eq_words:
                overlap = folder_words.intersection(eq_words)
                overlap_score = len(overlap) / len(folder_words.union(eq_words))

            # Bonus fuerte si la carpeta contiene un tag numérico específico del equipo
            tag_bonus = 0.0
            for tag in numeric_tags:
                tag_norm = clean_word(tag)
                tag_no_dash = tag_norm.replace('-', '')
                title_no_dash = title_clean.replace('-', '').replace(' ', '')
                if tag_norm in title_clean or tag_no_dash in title_no_dash:
                    tag_bonus = 2.0  # supera cualquier score de Jaccard
                    break

            # Bonus menor si el código interno aparece en el título (solo si no es un número genérico)
            codigo_bonus = 0.0
            if codigo and len(codigo) > 2 and clean_word(codigo) in title_clean:
                codigo_bonus = 0.3

            total_score = overlap_score + tag_bonus + codigo_bonus

            results.append({
                "id": c['id'],
                "title": c['title'],
                "overlap_score": total_score
            })

        # Sort by score descending
        results.sort(key=lambda x: x['overlap_score'], reverse=True)

        # Limitar a máximo 5 resultados para evitar listas muy largas
        top_results = results[:5]

        if top_results:
            return [{"id": r['id'], "title": r['title'], "match_score": r['overlap_score']} for r in top_results]

        # Fallback a listar contenido
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

def _normalizar_texto(texto: str) -> str:
    if not texto:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', texto)
    return "".join([ch for ch in nfkd_form if not unicodedata.combining(ch)]).lower().strip()

def obtener_siguiente_secuencia(parent_id: str) -> int:
    folders = listar_carpetas(parent_id)
    max_seq = 0
    for f in folders:
        title = f['title']
        match = re.match(r'^(\d+)', title)
        if match:
            num = int(match.group(1))
            if num > max_seq:
                max_seq = num
    return max_seq + 1

def buscar_carpeta_area_por_nombre(ubicacion_nombre: str) -> Optional[str]:
    try:
        busqueda_norm = _normalizar_texto(ubicacion_nombre)
        palabras_busqueda = [w for w in re.split(r'\W+', busqueda_norm) if len(w) >= 3]
        if not palabras_busqueda:
            palabras_busqueda = [busqueda_norm]
            
        # 1. Intentar consultar en el caché local primero para hallar la carpeta de Área
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT drive_id, nombre FROM drive_folders_cache")
                cache_folders = cursor.fetchall()
                mejor_match = None
                mejor_score = 0
                for fid, fname in cache_folders:
                    fname_norm = _normalizar_texto(fname)
                    score = sum(1 for p in palabras_busqueda if p in fname_norm)
                    if score > mejor_score:
                        mejor_score = score
                        mejor_match = fid
                if mejor_match and mejor_score >= 1:
                    return mejor_match
        except Exception as cache_err:
            logger.warning(f"Error buscando área en cache: {cache_err}")

        # Fallback a raíz de Drive
        from app.services.db_service import get_config_value_db
        root_folder_id = get_config_value_db("drive_folder_id") or "root"
        
        folders = listar_carpetas(root_folder_id)
        if not folders:
            return None
            
        mejor_match = None
        mejor_score = 0
        
        for f in folders:
            title_without_prefix = remover_prefijo_secuencia(f['title'])
            folder_title_norm = _normalizar_texto(title_without_prefix)
            score = 0
            for palabra in palabras_busqueda:
                if palabra in folder_title_norm:
                    score += 1
            if score > mejor_score:
                mejor_score = score
                mejor_match = f['id']
                
        return mejor_match
    except Exception as e:
        logger.error(f"Error buscando carpeta de área para {ubicacion_nombre}: {e}")
        return None

def obtener_ruta_breadcrumb(folder_id: str) -> str:
    if not folder_id or folder_id in ("root", "local"):
        return "Almacenamiento Local"
    try:
        from app.services.db_service import get_db_connection
        with get_db_connection() as conn:
            cursor = conn.cursor()
            path_parts = []
            curr = folder_id
            visited = set()
            while curr and curr not in visited and len(path_parts) < 6:
                visited.add(curr)
                cursor.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache WHERE drive_id = ?", (curr,))
                row = cursor.fetchone()
                if not row:
                    break
                name = row[1] if row[1] else "Carpeta"
                if name not in ("INSP PGP INFORMES Y MINUTA", "root"):
                    path_parts.append(name)
                curr = row[2]
            if path_parts:
                return " ➔ ".join(reversed(path_parts))
    except Exception as e:
        logger.warning(f"Error generando breadcrumb para {folder_id}: {e}")
    return "Google Drive"

def crear_estructura_equipo(parent_id: str, nombre_equipo: str, campanias: List[str], subcarpetas: List[str]) -> dict:
    drive = get_drive_instance()
    if not drive:
        return {"id": "mock_equipo_folder_id", "title": nombre_equipo, "alternateLink": "https://drive.google.com/mock-link"}
        
    try:
        siguiente_seq = obtener_siguiente_secuencia(parent_id)
        folder_name = f"{str(siguiente_seq).zfill(2)}- {nombre_equipo}"
        
        eq_folder_metadata = {
            'title': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [{'id': parent_id}]
        }
        eq_folder = drive.CreateFile(eq_folder_metadata)
        eq_folder.Upload()
        eq_folder_id = eq_folder['id']
        eq_folder_link = eq_folder.get('alternateLink', '')
        
        created_folders = [(eq_folder_id, folder_name, parent_id)]
        
        for camp in campanias:
            camp_folder_metadata = {
                'title': camp,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [{'id': eq_folder_id}]
            }
            camp_folder = drive.CreateFile(camp_folder_metadata)
            camp_folder.Upload()
            camp_folder_id = camp_folder['id']
            created_folders.append((camp_folder_id, camp, eq_folder_id))
            
            for sub in subcarpetas:
                sub_folder_metadata = {
                    'title': sub,
                    'mimeType': 'application/vnd.google-apps.folder',
                    'parents': [{'id': camp_folder_id}]
                }
                sub_folder = drive.CreateFile(sub_folder_metadata)
                sub_folder.Upload()
                created_folders.append((sub_folder['id'], sub, camp_folder_id))
                
        # Guardar estructura creada en caché
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                for d_id, name, p_id in created_folders:
                    conn.execute("""
                        INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT (drive_id) DO UPDATE SET
                            nombre = EXCLUDED.nombre,
                            parent_id = EXCLUDED.parent_id,
                            updated_at = CURRENT_TIMESTAMP
                    """, (d_id, name, p_id))
                conn.commit()
        except Exception as cache_err:
            logger.warning(f"Error al guardar estructura creada en caché: {cache_err}")
            
        return {"id": eq_folder_id, "title": folder_name, "alternateLink": eq_folder_link}
    except Exception as e:
        logger.error(f"Error al crear estructura de equipo {nombre_equipo} en {parent_id}: {e}")
        raise e

def crear_campania_en_equipos_de_empresa(empresa_id: int, campania_nombre: str, subcarpetas: List[str], task_id: str = None, progress_store: dict = None):
    if task_id and progress_store is not None:
        progress_store[task_id] = {"status": "processing", "progress": 5, "current": 0, "total": 0, "mensaje": "Iniciando pre-replicación..."}
        
    try:
        from app.services.db_service import get_db_connection
        
        with get_db_connection() as conn:
            cursor = conn.execute("""
                SELECT e.id, e.codigo, e.nombre, u.nombre as area_nombre 
                FROM equipos e
                JOIN ubicaciones u ON e.ubicacion_id = u.id
                WHERE u.empresa_id = ? AND e.activo = 1
            """, (empresa_id,))
            db_equipos = [dict(row) for row in cursor.fetchall()]
            
        total_equipos = len(db_equipos)
        if total_equipos == 0:
            if task_id and progress_store is not None:
                progress_store[task_id] = {"status": "completed", "progress": 100, "current": 0, "total": 0, "mensaje": "No se encontraron equipos activos para esta empresa."}
            return
            
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "processing", "progress": 10, "current": 0, "total": total_equipos, "mensaje": f"Se encontraron {total_equipos} equipos. Mapeando carpetas..."}
            
        drive = get_drive_instance()
        if not drive:
            import time
            for idx, eq in enumerate(db_equipos):
                time.sleep(0.05)
                if task_id and progress_store is not None:
                    progress = int(10 + (idx / total_equipos) * 90)
                    progress_store[task_id] = {
                        "status": "processing",
                        "progress": progress,
                        "current": idx + 1,
                        "total": total_equipos,
                        "mensaje": f"Sincronizando {eq['codigo']} (MOCK)..."
                    }
            if task_id and progress_store is not None:
                progress_store[task_id] = {"status": "completed", "progress": 100, "current": total_equipos, "total": total_equipos, "mensaje": "Pre-replicación MOCK completada con éxito."}
            return

        areas_cache = {}
        resultados = {"sincronizados": 0, "no_encontrados": 0, "errores": 0, "detalle": []}
        
        for idx, eq in enumerate(db_equipos):
            try:
                area_nombre = eq['area_nombre']
                if area_nombre not in areas_cache:
                    area_folder_id = buscar_carpeta_area_por_nombre(area_nombre)
                    areas_cache[area_nombre] = area_folder_id
                else:
                    area_folder_id = areas_cache[area_nombre]
                    
                if not area_folder_id:
                    resultados["no_encontrados"] += 1
                    resultados["detalle"].append(f"Equipo {eq['codigo']}: Área '{area_nombre}' no encontrada en Drive.")
                    continue
                    
                drive_folders = listar_carpetas(area_folder_id)
                eq_folder_id = None
                
                codigo_norm = _normalizar_texto(eq['codigo'])
                nombre_norm = _normalizar_texto(eq['nombre'])
                
                tags = re.findall(r'\d{3}-\d{3}', eq['nombre'])
                tag_filtro = tags[0] if tags else None
                
                mejor_score = 0
                mejor_folder = None
                
                for f in drive_folders:
                    title_norm = _normalizar_texto(f['title'])
                    score = 0
                    
                    if tag_filtro and tag_filtro in f['title']:
                        score += 5.0
                        
                    parts = re.split(r'\W+', title_norm)
                    if codigo_norm in parts:
                        score += 3.0
                    elif codigo_norm in title_norm:
                        score += 1.0
                        
                    palabras_eq = [w for w in re.split(r'\W+', nombre_norm) if len(w) >= 3]
                    for w in palabras_eq:
                        if w in title_norm:
                            score += 0.5
                            
                    if score > mejor_score:
                        mejor_score = score
                        mejor_folder = f
                        
                if mejor_folder and mejor_score >= 1.0:
                    eq_folder_id = mejor_folder['id']
                    eq_folder_title = mejor_folder['title']
                else:
                    resultados["no_encontrados"] += 1
                    resultados["detalle"].append(f"Equipo {eq['codigo']} ({eq['nombre']}): Carpeta de equipo no encontrada en Drive.")
                    continue
                    
                subcarpetas_existentes = listar_carpetas(eq_folder_id)
                camp_folder_id = None
                for sf in subcarpetas_existentes:
                    if sf['title'].strip().lower() == campania_nombre.strip().lower():
                        camp_folder_id = sf['id']
                        break
                        
                # Buscar carpetas de campañas anteriores para imitar su estructura
                prev_campaign_folders = []
                for sf in subcarpetas_existentes:
                    title = sf['title'].strip()
                    match = re.search(r'(?i)pgp\s*(\d+)', title)
                    if match:
                        year = int(match.group(1))
                        prev_campaign_folders.append((year, sf['id']))
                
                # Por defecto, usamos la lista provista en el request
                subcarpetas_a_crear = list(subcarpetas)
                
                # Si encontramos campañas previas, imitamos la estructura de la más reciente
                if prev_campaign_folders:
                    prev_campaign_folders.sort(key=lambda x: x[0], reverse=True)
                    most_recent_camp_id = prev_campaign_folders[0][1]
                    
                    past_subfolders = listar_carpetas(most_recent_camp_id)
                    if past_subfolders:
                        # Tomar los nombres exactos de las subcarpetas de la campaña anterior
                        subcarpetas_a_crear = [ps['title'].strip() for ps in past_subfolders if ps['title'].strip()]
                
                created_folders_batch = []
                
                if not camp_folder_id:
                    camp_folder_metadata = {
                        'title': campania_nombre,
                        'mimeType': 'application/vnd.google-apps.folder',
                        'parents': [{'id': eq_folder_id}]
                    }
                    camp_folder = drive.CreateFile(camp_folder_metadata)
                    camp_folder.Upload()
                    camp_folder_id = camp_folder['id']
                    
                created_folders_batch.append((camp_folder_id, campania_nombre, eq_folder_id))
                    
                sub_existentes = {sf['title'].strip().lower() for sf in listar_carpetas(camp_folder_id)}
                for sub in subcarpetas_a_crear:
                    if sub.strip().lower() not in sub_existentes:
                        sub_folder_metadata = {
                            'title': sub,
                            'mimeType': 'application/vnd.google-apps.folder',
                            'parents': [{'id': camp_folder_id}]
                        }
                        sub_folder = drive.CreateFile(sub_folder_metadata)
                        sub_folder.Upload()
                        created_folders_batch.append((sub_folder['id'], sub, camp_folder_id))
                        
                # Guardar en caché local
                try:
                    from app.services.db_service import get_db_connection
                    with get_db_connection() as conn:
                        for d_id, name, p_id in created_folders_batch:
                            conn.execute("""
                                INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                                ON CONFLICT (drive_id) DO UPDATE SET
                                    nombre = EXCLUDED.nombre,
                                    parent_id = EXCLUDED.parent_id,
                                    updated_at = CURRENT_TIMESTAMP
                            """, (d_id, name, p_id))
                        conn.commit()
                except Exception as cache_err:
                    logger.warning(f"Error al guardar campaña en caché: {cache_err}")
                        
                resultados["sincronizados"] += 1
                
            except Exception as item_err:
                logger.error(f"Error sincronizando equipo {eq['codigo']}: {item_err}")
                resultados["errores"] += 1
                resultados["detalle"].append(f"Equipo {eq['codigo']}: Error: {str(item_err)}")
                
            if task_id and progress_store is not None:
                progress = int(10 + ((idx + 1) / total_equipos) * 85)
                progress_store[task_id] = {
                    "status": "processing",
                    "progress": progress,
                    "current": idx + 1,
                    "total": total_equipos,
                    "mensaje": f"Sincronizados {resultados['sincronizados']} de {total_equipos}..."
                }
                
        if task_id and progress_store is not None:
            progress_store[task_id] = {
                "status": "completed",
                "progress": 100,
                "current": total_equipos,
                "total": total_equipos,
                "mensaje": f"Sincronización completada. Éxito: {resultados['sincronizados']}, No encontrados: {resultados['no_encontrados']}, Errores: {resultados['errores']}.",
                "resultados": resultados
            }
            
    except Exception as e:
        logger.error(f"Error general en la pre-replicación: {e}", exc_info=True)
        if task_id and progress_store is not None:
            progress_store[task_id] = {"status": "failed", "progress": 100, "error": str(e), "mensaje": f"Error general: {str(e)}"}


def _calcular_o_recuperar_path(folder_id: str, cursor) -> str:
    """Obtiene el path_completo desde caché o lo calcula dinámicamente navegando ancestros."""
    try:
        cursor.execute("SELECT path_completo, nombre, parent_id FROM drive_folders_cache WHERE drive_id = ?", (folder_id,))
        row = cursor.fetchone()
        if row and row['path_completo']:
            return row['path_completo']
        
        chain = []
        curr = folder_id
        visited = set()
        while curr and curr not in visited:
            visited.add(curr)
            cursor.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache WHERE drive_id = ?", (curr,))
            r = cursor.fetchone()
            if r:
                chain.append((r['nombre'] or '').strip())
                curr = r['parent_id']
            else:
                break
        chain.reverse()
        path = " / ".join(chain)
        if path:
            try:
                cursor.execute("UPDATE drive_folders_cache SET path_completo = ? WHERE drive_id = ?", (path, folder_id))
            except Exception:
                pass
        return path or "Ubicación Planta"
    except Exception as e:
        logger.warning(f"Error calculando path para {folder_id}: {e}")
        return ""


def _recorrer_archivos_recursivo(folder_id: str, current_path: str, nivel: int = 1, max_nivel: int = 3, sub_ubicacion: str = "") -> list:
    """
    Recorre recursivamente una carpeta en Drive para encontrar todos los archivos,
    respetando sub-carpetas (ej: Succión 431-433, Impulsión 431-433, Tramo ACR, etc.).
    Cada archivo se etiqueta con su sub_ubicacion, sub_folder_id y path_completo.
    """
    archivos_resultado = []
    
    # 1. Listar archivos directos
    archivos_directos = listar_archivos(folder_id)
    for f in archivos_directos:
        archivos_resultado.append({
            "id": f["id"],
            "name": f["title"],
            "size": f["fileSize"],
            "thumbnail": f.get("thumbnailLink", ""),
            "mimeType": f.get("mimeType", ""),
            "sub_ubicacion": sub_ubicacion or current_path.split(" / ")[-1],
            "sub_folder_id": folder_id,
            "path_completo": current_path
        })
        
    # 2. Si nivel < max_nivel, explorar subcarpetas
    if nivel < max_nivel:
        try:
            subcarpetas = listar_carpetas(folder_id)
            for sc in subcarpetas:
                sc_id = sc["id"]
                sc_title = sc["title"]
                sc_path = f"{current_path} / {sc_title}" if current_path else sc_title
                sc_sub = sub_ubicacion if sub_ubicacion else sc_title
                archivos_hijos = _recorrer_archivos_recursivo(
                    sc_id, sc_path, nivel=nivel + 1, max_nivel=max_nivel, sub_ubicacion=sc_sub
                )
                archivos_resultado.extend(archivos_hijos)
        except Exception as e:
            logger.warning(f"Error recorriendo subcarpeta {folder_id}: {e}")
            
    return archivos_resultado


def obtener_evidencia_equipo(equipo_id: int, campania_activa: str = "PGP 2026") -> dict:
    """
    Obtiene y auto-clasifica en tiempo real toda la evidencia fotográfica, planos técnicos e histórico
    asociado a un equipo específico desde Google Drive, mapeando todos los niveles jerárquicos
    (Área -> Equipo -> Campaña -> Sub-tramo / Sub-componente) y concatenando cada lugar a su ubicación.
    Auto-actualiza la caché de base de datos con cualquier archivo o carpeta nueva creada en Drive.
    """
    from app.core.db import get_db_connection
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, codigo, nombre, drive_folder_id, ubicacion_id FROM equipos WHERE id = ?", (equipo_id,))
        eq_row = cursor.fetchone()
        if not eq_row:
            return {"error": "Equipo no encontrado"}
            
        eq = dict(eq_row)
        folder_id = eq.get("drive_folder_id")
        if not folder_id:
            return {"error": "El equipo no tiene carpeta de Drive vinculada", "equipo": eq}

        logger.info(f"Obteniendo evidencia multi-nivel para equipo {eq.get('codigo')} - {eq.get('nombre')} (Drive: {folder_id})")

        # 0. Obtener o calcular el path_completo base del equipo
        eq_path = _calcular_o_recuperar_path(folder_id, cursor)
        eq["path_completo"] = eq_path

        # 1. Obtener subcarpetas directas desde Google Drive
        subcarpetas_drive = listar_carpetas(folder_id)
        
        # 2. Auto-Upsert en BD de las subcarpetas de primer nivel
        for sc in subcarpetas_drive:
            try:
                sc_path = f"{eq_path} / {sc['title']}" if eq_path else sc['title']
                cursor.execute("""
                    INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, path_completo, updated_at)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT (drive_id) DO UPDATE SET
                        nombre = EXCLUDED.nombre,
                        path_completo = EXCLUDED.path_completo,
                        updated_at = CURRENT_TIMESTAMP
                """, (sc["id"], sc["title"], folder_id, sc_path))
            except Exception as up_err:
                logger.warning(f"Error en auto-upsert de subcarpeta {sc['id']}: {up_err}")
        conn.commit()

        # 3. Clasificación de carpetas por campaña y función
        id_campania_activa = None
        nombre_campania_activa = None
        carpetas_doc = []
        carpetas_hist = []
        carpetas_detectadas = []

        campania_norm = campania_activa.lower().replace(" ", "").replace("-", "")

        for sc in subcarpetas_drive:
            nombre = sc["title"]
            s_id = sc["id"]
            nombre_norm = nombre.lower().replace(" ", "").replace("-", "")
            
            tipo = "otro"
            if campania_norm in nombre_norm or "2026" in nombre_norm:
                tipo = "campania_activa"
                id_campania_activa = s_id
                nombre_campania_activa = nombre
            elif any(k in nombre_norm for k in ["doc", "plano", "tecnic", "codific"]):
                tipo = "documentacion"
                carpetas_doc.append({"id": s_id, "nombre": nombre})
            elif any(k in nombre_norm for k in ["2024", "2023", "2022", "2025", "hist"]):
                tipo = "historico"
                carpetas_hist.append({"id": s_id, "nombre": nombre})

            carpetas_detectadas.append({"id": s_id, "nombre": nombre, "tipo": tipo})

        # 4. Explorar campaña activa a TODOS LOS NIVELES
        fotos_campania = []
        secciones_campania = []
        seccion_recomendada = None
        seccion_recomendada_id = None

        if id_campania_activa:
            camp_path = f"{eq_path} / {nombre_campania_activa}" if eq_path else nombre_campania_activa
            subcarpetas_activa = listar_carpetas(id_campania_activa)
            
            # Upsert de sub-carpetas de campaña
            for sc in subcarpetas_activa:
                try:
                    sc_path = f"{camp_path} / {sc['title']}"
                    cursor.execute("""
                        INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, path_completo, updated_at)
                        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                        ON CONFLICT (drive_id) DO UPDATE SET
                            nombre = EXCLUDED.nombre,
                            path_completo = EXCLUDED.path_completo,
                            updated_at = CURRENT_TIMESTAMP
                    """, (sc["id"], sc["title"], id_campania_activa, sc_path))
                except Exception:
                    pass
            conn.commit()

            if subcarpetas_activa:
                # Caso multi-nivel: La campaña contiene sub-secciones (ej: Succión 431-433, Impulsión 431-433, Tramo ACR)
                for sc in subcarpetas_activa:
                    sc_id = sc["id"]
                    sc_title = sc["title"]
                    sc_path = f"{camp_path} / {sc_title}"
                    
                    archivos_sub = _recorrer_archivos_recursivo(sc_id, sc_path, nivel=1, max_nivel=3, sub_ubicacion=sc_title)
                    fotos_sub = [f for f in archivos_sub if f["mimeType"].startswith("image/")]
                    
                    for f in fotos_sub:
                        f["tipo"] = "foto_campania"
                    fotos_campania.extend(fotos_sub)
                    
                    secciones_campania.append({
                        "id": sc_id,
                        "nombre": sc_title,
                        "path_completo": sc_path,
                        "count": len(fotos_sub)
                    })
                
                # Archivos sueltos en la raíz de la campaña activa si hubiesen
                archivos_raiz_camp = listar_archivos(id_campania_activa)
                fotos_raiz_camp = [
                    {
                        "id": f["id"],
                        "name": f["title"],
                        "size": f["fileSize"],
                        "thumbnail": f.get("thumbnailLink", ""),
                        "mimeType": f.get("mimeType", ""),
                        "sub_ubicacion": "General",
                        "sub_folder_id": id_campania_activa,
                        "path_completo": camp_path,
                        "tipo": "foto_campania"
                    }
                    for f in archivos_raiz_camp if f.get("mimeType", "").startswith("image/")
                ]
                if fotos_raiz_camp:
                    fotos_campania.extend(fotos_raiz_camp)
                    secciones_campania.append({
                        "id": id_campania_activa,
                        "nombre": "General",
                        "path_completo": camp_path,
                        "count": len(fotos_raiz_camp)
                    })
            else:
                # Caso plano: Las fotos están directamente dentro de PGP 2026
                archivos_activa = listar_archivos(id_campania_activa)
                for f in archivos_activa:
                    if f.get("mimeType", "").startswith("image/"):
                        fotos_campania.append({
                            "id": f["id"],
                            "name": f["title"],
                            "size": f["fileSize"],
                            "thumbnail": f.get("thumbnailLink", ""),
                            "mimeType": f["mimeType"],
                            "sub_ubicacion": "General",
                            "sub_folder_id": id_campania_activa,
                            "path_completo": camp_path,
                            "tipo": "foto_campania"
                        })

            # Heurística de recomendación de sub-sección según el equipo con ponderación inteligente por fotos
            if secciones_campania:
                eq_nombre_norm = eq.get("nombre", "").lower().replace("ó", "o").replace("í", "i").replace("á", "a").replace("é", "e").replace("ú", "u")
                eq_code = str(eq.get("codigo") or "").strip().lower()
                
                # Palabras clave del equipo
                palabras_eq = [p for p in re.findall(r'[a-z0-9]+', eq_nombre_norm) if len(p) >= 3]
                
                scored_sections = []
                for sec in secciones_campania:
                    sec_norm = sec["nombre"].lower().replace("ó", "o").replace("í", "i").replace("á", "a").replace("é", "e").replace("ú", "u")
                    palabras_sec = [p for p in re.findall(r'[a-z0-9]+', sec_norm) if len(p) >= 3]
                    
                    score = 0
                    
                    # 1. Coincidencia exacta de nombre o token clave (ej: "succion" o "impulsion")
                    if sec_norm == eq_nombre_norm:
                        score += 100
                    elif "succion" in eq_nombre_norm and sec_norm == "succion":
                        score += 90
                    elif "impulsion" in eq_nombre_norm and sec_norm == "impulsion":
                        score += 90
                    elif "succion" in eq_nombre_norm and "succion" in sec_norm:
                        score += 40
                        # Penalizar si es un accesorio secundario como 'carretel' cuando el equipo no lo menciona
                        if "carretel" in sec_norm and "carretel" not in eq_nombre_norm:
                            score -= 30
                    elif "impulsion" in eq_nombre_norm and "impulsion" in sec_norm:
                        score += 40
                        if "carretel" in sec_norm and "carretel" not in eq_nombre_norm:
                            score -= 30
                    elif "ventilador" in eq_nombre_norm and "ventilador" in sec_norm:
                        score += 50
                    elif eq_code and eq_code in sec_norm:
                        score += 60
                    
                    # Coincidencia de palabras clave generales
                    interseccion = set(palabras_eq).intersection(set(palabras_sec))
                    score += len(interseccion) * 10
                    
                    # 2. Ponderación por presencia de fotos: NUNCA recomendar una carpeta vacía sobre una con fotos
                    count_fotos = sec.get("count", 0)
                    if count_fotos > 0:
                        score += 50 + min(count_fotos, 50)  # Bonificación por tener fotos reales
                    else:
                        score -= 60  # Penalización fuerte si tiene 0 fotos
                        
                    scored_sections.append((score, sec))
                
                # Ordenar por score descendente
                scored_sections.sort(key=lambda x: x[0], reverse=True)
                
                # Solo aceptar si el mejor score es positivo y tiene fotos (o si todas tienen 0 fotos)
                if scored_sections and scored_sections[0][0] > 0:
                    mejor_sec = scored_sections[0][1]
                    seccion_recomendada = mejor_sec["nombre"]
                    seccion_recomendada_id = mejor_sec["id"]
                else:
                    seccion_recomendada = None
                    seccion_recomendada_id = id_campania_activa

        # 5. Archivos sueltos en la raíz del equipo (fotos de emergencia o planos)
        archivos_raiz = listar_archivos(folder_id)
        documentacion_tecnica = []

        for f in archivos_raiz:
            mime = f.get("mimeType", "")
            if mime.startswith("image/"):
                fotos_campania.append({
                    "id": f["id"],
                    "name": f["title"],
                    "size": f["fileSize"],
                    "thumbnail": f.get("thumbnailLink", ""),
                    "mimeType": mime,
                    "sub_ubicacion": "Raíz Equipo",
                    "sub_folder_id": folder_id,
                    "path_completo": eq_path,
                    "tipo": "foto_raiz_campania"
                })
            elif mime == "application/pdf" or any(f["title"].lower().endswith(ext) for ext in [".pdf", ".dwg", ".dxf"]):
                documentacion_tecnica.append({
                    "id": f["id"],
                    "name": f["title"],
                    "size": f["fileSize"],
                    "thumbnail": f.get("thumbnailLink", ""),
                    "mimeType": mime,
                    "es_plano": True,
                    "sub_ubicacion": "Raíz Equipo",
                    "path_completo": eq_path,
                    "tipo": "documento_tecnico"
                })

        # 6. Documentación técnica y planos (recorriendo todos los subniveles técnicos)
        for doc in carpetas_doc:
            doc_id = doc["id"]
            doc_name = doc["nombre"]
            doc_path = f"{eq_path} / {doc_name}" if eq_path else doc_name
            archivos_doc = _recorrer_archivos_recursivo(doc_id, doc_path, nivel=1, max_nivel=3)
            for f in archivos_doc:
                documentacion_tecnica.append({
                    "id": f["id"],
                    "name": f["name"],
                    "size": f["size"],
                    "thumbnail": f.get("thumbnail", ""),
                    "mimeType": f.get("mimeType", ""),
                    "sub_ubicacion": f.get("sub_ubicacion", doc_name),
                    "path_completo": f.get("path_completo", doc_path),
                    "es_plano": any(k in f["name"].lower() for k in ["iso", "plano", "dwg", "esquema", "red", "spool", "pro-", "dxf"]),
                    "tipo": "documento_tecnico"
                })

        # 7. Fotos históricas (recorriendo todos los subniveles por año)
        fotos_historico = {}
        for h in carpetas_hist:
            h_id = h["id"]
            h_name = h["nombre"]
            h_path = f"{eq_path} / {h_name}" if eq_path else h_name
            archivos_h = _recorrer_archivos_recursivo(h_id, h_path, nivel=1, max_nivel=3)
            fotos_h = [
                {
                    "id": f["id"],
                    "name": f["name"],
                    "size": f["size"],
                    "thumbnail": f.get("thumbnail", ""),
                    "mimeType": f.get("mimeType", ""),
                    "sub_ubicacion": f.get("sub_ubicacion", h_name),
                    "path_completo": f.get("path_completo", h_path),
                    "anio": h_name
                }
                for f in archivos_h if f.get("mimeType", "").startswith("image/")
            ]
            if fotos_h:
                fotos_historico[h_name] = fotos_h

        return {
            "equipo": eq,
            "path_completo": eq_path,
            "campania_activa": campania_activa,
            "secciones_campania": secciones_campania,
            "seccion_recomendada": seccion_recomendada,
            "seccion_recomendada_id": seccion_recomendada_id,
            "resumen": {
                "total_fotos_campania": len(fotos_campania),
                "total_documentacion": len(documentacion_tecnica),
                "total_historicos": sum(len(v) for v in fotos_historico.values()),
                "total_secciones": len(secciones_campania)
            },
            "carpetas_detectadas": carpetas_detectadas,
            "fotos_campania": fotos_campania,
            "documentacion_tecnica": documentacion_tecnica,
            "fotos_historico": fotos_historico
        }


