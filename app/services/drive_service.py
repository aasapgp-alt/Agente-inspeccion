import os
import io
import logging
import re
import certifi
import unicodedata
from typing import List, Dict, Optional, Any

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
        # 1. Intentar usar Cuenta de Servicio (Service Account) para producción/cero login
        service_json_path = "c:\\Agente-Inspector\\service_account.json"
        if os.path.exists(service_json_path):
            from oauth2client.service_account import ServiceAccountCredentials
            scope = ["https://www.googleapis.com/auth/drive"]
            
            gauth = GoogleAuth()
            gauth.auth_method = 'service'
            gauth.credentials = ServiceAccountCredentials.from_json_keyfile_name(
                service_json_path, 
                scope
            )
            logger.info("Autenticado exitosamente en Google Drive usando Cuenta de Servicio.")
            return gauth

        # 2. Fallback a flujo OAuth normal (requiere login por navegador inicial)
        gauth = GoogleAuth(settings_file="settings.yaml")
        gauth.LoadCredentialsFile("mycreds.txt")
        if gauth.credentials is None:
            gauth.LocalWebserverAuth()
        elif gauth.access_token_expired:
            gauth.Refresh()
        else:
            gauth.Authorize()
        gauth.SaveCredentialsFile("mycreds.txt")
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
        folder_id = folder['id']
        
        try:
            from app.services.db_service import get_db_connection
            with get_db_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
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
                INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
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

            if clean_words_norm:
                for r in cache_rows:
                    title_norm = clean_word(r["title"])
                    if any(w in title_norm for w in clean_words_norm):
                        sugeridas_raw.append(r)

            if not sugeridas_raw:
                # Fallback: listar hijos directos en caché
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
            title_clean = clean_word(c['title'])
            folder_words = set(clean_word(w) for w in re.split(r'\W+', c['title']) if len(w) >= 2)

            # Score base: Jaccard overlap entre palabras del nombre y carpeta
            overlap_score = 0.0
            if folder_words and eq_words:
                overlap = folder_words.intersection(eq_words)
                overlap_score = len(overlap) / len(folder_words.union(eq_words))

            # Bonus fuerte si la carpeta contiene un tag numérico específico del equipo
            # (ej: "431-032" en el título) → máxima prioridad
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
        from app.services.db_service import get_config_value_db
        root_folder_id = get_config_value_db("drive_folder_id") or "root"
        
        folders = listar_carpetas(root_folder_id)
        if not folders:
            return None
            
        busqueda_norm = _normalizar_texto(ubicacion_nombre)
        palabras_busqueda = [w for w in re.split(r'\W+', busqueda_norm) if len(w) >= 3]
        if not palabras_busqueda:
            palabras_busqueda = [busqueda_norm]
            
        mejor_match = None
        mejor_score = 0
        
        for f in folders:
            folder_title_norm = _normalizar_texto(f['title'])
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
                        INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
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
                                INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
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

