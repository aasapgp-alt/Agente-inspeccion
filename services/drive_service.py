import io
import json
import streamlit as st
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
import google.generativeai as genai

def autenticar_drive():
    """Autentica y devuelve el servicio de Drive"""
    try:
        creds = service_account.Credentials.from_service_account_info(
            json.loads(st.secrets["GOOGLE_CREDENTIALS_JSON"]),
            scopes=["https://www.googleapis.com/auth/drive"]
        )
        return build("drive", "v3", credentials=creds)
    except Exception as e:
        st.error(f"❌ Error autenticando Drive: {e}")
        logging.error(f"Drive auth error: {e}", exc_info=True)
        return None

def inicializar_gemini():
    """Inicializa Gemini con la API key"""
    try:
        genai.configure(api_key=st.secrets["GEMINI_API_KEY"])
        return genai.GenerativeModel("gemini-2.5-flash")
    except Exception as e:
        st.error(f"❌ Error inicializando Gemini: {e}")
        logging.error(f"Gemini init error: {e}", exc_info=True)
        return None

def descargar_archivo(fid, drive, max_retries=3):
    """Descarga un archivo de Drive con retry"""
    for attempt in range(max_retries):
        try:
            req = drive.files().get_media(fileId=fid)
            fh = io.BytesIO()
            dl = MediaIoBaseDownload(fh, req)
            done = False
            while not done:
                _, done = dl.next_chunk()
            fh.seek(0)
            return fh.getvalue()
        except Exception as e:
            st.warning(f"⚠️ Intento {attempt+1}/{max_retries} falló para {fid}: {e}")  # ✅ Cambiado a st.warning
            if attempt == max_retries - 1:
                logging.error(f"❌ Error descargando {fid} después de {max_retries} intentos: {e}")
                return None

def subir_archivo(fid, data, mime, drive):
    """Sube/actualiza un archivo en Drive"""
    try:
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime, resumable=True)  # ✅ Corregido: mimetype en minúsculas
        drive.files().update(fileId=fid, media_body=media).execute()
        return True
    except Exception as e:
        logging.error(f"❌ Error subiendo {fid}: {e}", exc_info=True)
        return False

def crear_archivo(nombre, parent_id, data, mime, drive):
    """Crea un nuevo archivo en Drive"""
    try:
        meta = {"name": nombre, "parents": [parent_id]}
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype=mime, resumable=True)  # ✅ Corregido: mimetype en minúsculas
        f = drive.files().create(body=meta, media_body=media, fields="id").execute()
        return f.get("id")
    except Exception as e:
        st.error(f"❌ Error creando {nombre}: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error creando {nombre}: {e}", exc_info=True)
        return None

def buscar_archivo(nombre, parent_id, drive):
    """Busca un archivo por nombre en una carpeta"""
    try:
        q = f"'{parent_id}' in parents and name='{nombre}' and trashed=false"
        r = drive.files().list(q=q, fields="files(id)", pageSize=10).execute()
        fs = r.get("files", [])
        return fs[0]["id"] if fs else None
    except Exception as e:
        st.error(f"❌ Error buscando {nombre}: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error buscando {nombre}: {e}", exc_info=True)
        return None

def buscar_carpeta(nombre, parent_id, drive):
    """Busca una carpeta por nombre"""
    try:
        q = f"'{parent_id}' in parents and name='{nombre}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        r = drive.files().list(q=q, fields="files(id)", pageSize=10).execute()
        fs = r.get("files", [])
        return fs[0]["id"] if fs else None
    except Exception as e:
        st.error(f"❌ Error buscando carpeta {nombre}: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error buscando carpeta {nombre}: {e}", exc_info=True)
        return None

def crear_carpeta(nombre, parent_id, drive):
    """Crea una nueva carpeta"""
    fid = buscar_carpeta(nombre, parent_id, drive)
    if fid:
        return fid
    try:
        meta = {"name": nombre, "mimeType": "application/vnd.google-apps.folder", "parents": [parent_id]}
        f = drive.files().create(body=meta, fields="id").execute()
        return f.get("id")
    except Exception as e:
        st.error(f"❌ Error creando carpeta {nombre}: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error creando carpeta {nombre}: {e}", exc_info=True)
        return None

def verificar_acceso(folder_id, drive):
    """Verifica si se puede acceder a una carpeta"""
    try:
        drive.files().get(fileId=folder_id, fields="id").execute()
        return True
    except Exception as e:
        st.warning(f"⚠️ No se pudo acceder a {folder_id}: {e}")  # ✅ Cambiado a st.warning
        logging.warning(f"⚠️ No se pudo acceder a {folder_id}: {e}")  # ✅ Opcional: logging.warning
        return False

def resolver_shortcut(file_id, drive):
    """Resuelve un shortcut de Drive"""
    try:
        archivo = drive.files().get(
            fileId=file_id,
            fields="id, mimeType, shortcutDetails"
        ).execute()
        if archivo.get('mimeType') == 'application/vnd.google-apps.shortcut':
            destino = archivo.get('shortcutDetails', {}).get('targetId')
            return destino if destino else file_id
        return file_id
    except Exception as e:
        st.warning(f"⚠️ Error resolviendo shortcut {file_id}: {e}")  # ✅ Cambiado a st.warning
        logging.warning(f"⚠️ Error resolviendo shortcut {file_id}: {e}")  # ✅ Opcional: logging.warning
        return file_id

def navegar_carpetas(parent_id, drive):
    """Obtiene subcarpetas de una carpeta"""
    try:
        parent_real = resolver_shortcut(parent_id, drive)
        q = f"'{parent_real}' in parents and (mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut') and trashed=false"
        r = drive.files().list(q=q, fields="files(id, name, mimeType, shortcutDetails)", pageSize=100).execute()

        carpetas = {}
        for f in r.get("files", []):
            if f["name"].startswith("."):
                continue
            if f.get('mimeType') == 'application/vnd.google-apps.shortcut':
                destino = f.get('shortcutDetails', {}).get('targetId')
                if destino:
                    carpetas[f["name"]] = destino
            else:
                carpetas[f["name"]] = f["id"]
        return carpetas
    except Exception as e:
        st.error(f"❌ Error navegando carpetas: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error navegando carpetas: {e}", exc_info=True)
        return {}

def obtener_imagenes_carpeta(parent_id, drive):
    """Obtiene todas las imágenes de una carpeta"""
    try:
        parent_real = resolver_shortcut(parent_id, drive)
        q = f"'{parent_real}' in parents and mimeType contains 'image/' and trashed=false"
        r = drive.files().list(q=q, fields="files(id, name, size)", pageSize=200).execute()
        exts = (".jpg", ".jpeg", ".png", ".webp", ".bmp")
        return [{"id": f["id"], "name": f["name"], "size": int(f.get("size", 0))}
                for f in r.get("files", []) if f["name"].lower().endswith(exts)]
    except Exception as e:
        st.error(f"❌ Error obteniendo imágenes: {e}")  # ✅ Cambiado a st.error
        logging.error(f"❌ Error obteniendo imágenes: {e}", exc_info=True)
        return []

def guardar_csv(fid, df, drive):
    """Guarda un DataFrame como CSV en Drive"""
    buf = io.BytesIO()
    df.to_csv(buf, sep=';', index=False, encoding='utf-8-sig', quotechar='"')
    return subir_archivo(fid, buf.getvalue(), "text/csv", drive)