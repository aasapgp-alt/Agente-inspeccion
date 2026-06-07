# services/learning_service.py

import json
import streamlit as st
from datetime import datetime
from services.drive_service import descargar_archivo, buscar_archivo, buscar_carpeta, subir_archivo, crear_archivo
from config.defaults import PERFIL_DEFAULT, CONOCIMIENTO_DEFAULT

def load_json(fid, drive):
    """Carga JSON desde Drive con manejo de errores"""
    if not fid or not drive:
        return None
    
    data = descargar_archivo(fid, drive)
    if not data:
        return None
    
    try:
        content = data.decode("utf-8").strip()
        if not content:
            return None
        return json.loads(content)
    except json.JSONDecodeError as e:
        st.warning(f"⚠️ JSON inválido: {e}")
        return None
    except UnicodeDecodeError as e:
        st.warning(f"⚠️ Error de codificación JSON: {e}")
        return None
    except Exception as e:
        st.warning(f"⚠️ Error cargando JSON: {e}")
        return None

def save_json(fid, obj, drive):
    """Guarda JSON en Drive"""
    if not fid or not drive:
        return False
    
    try:
        data = json.dumps(obj, ensure_ascii=False, indent=2).encode("utf-8")
        return subir_archivo(fid, data, "application/json", drive)
    except Exception as e:
        st.warning(f"⚠️ Error guardando JSON: {e}")
        return False

def load_txt(fid, drive):
    """Carga archivo de texto con encoding fallback"""
    if not fid or not drive:
        return ""
    
    data = descargar_archivo(fid, drive)
    if not data:
        return ""
    
    try:
        # Probar diferentes codificaciones
        for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']:
            try:
                content = data.decode(encoding)
                if content.strip():
                    return content
            except UnicodeDecodeError:
                continue
        # Fallback final
        return data.decode('utf-8', errors='ignore')
    except Exception as e:
        st.warning(f"⚠️ Error cargando TXT: {e}")
        return ""

def save_txt(fid, txt, drive):
    """Guarda archivo de texto en Drive"""
    if not fid or not drive:
        return False
    
    try:
        return subir_archivo(fid, txt.encode("utf-8"), "text/plain", drive)
    except Exception as e:
        st.warning(f"⚠️ Error guardando TXT: {e}")
        return False

def cargar_recursos_config(drive, carpeta_raiz_id, session_state):
    """Carga perfil, conocimiento y aprendizaje desde Drive con manejo de errores"""
    
    if not drive:
        st.error("❌ Drive no disponible para cargar configuración")
        session_state.perfil = PERFIL_DEFAULT.copy()
        session_state.conocimiento = CONOCIMIENTO_DEFAULT
        session_state.few_shots = []
        return False
    
    # Buscar carpeta de configuración
    cfg_id = buscar_carpeta("00_CONFIG", carpeta_raiz_id, drive)
    
    if not cfg_id:
        st.info("📁 Carpeta '00_CONFIG' no encontrada, usando valores por defecto")
        session_state.perfil = PERFIL_DEFAULT.copy()
        session_state.conocimiento = CONOCIMIENTO_DEFAULT
        session_state.few_shots = []
        return True
    
    # ===== PERFIL =====
    fid_perfil = buscar_archivo("inspector_perfil.json", cfg_id, drive)
    if fid_perfil:
        try:
            p = load_json(fid_perfil, drive)
            if p and isinstance(p, dict) and len(p) > 0:
                # Asegurar que todas las claves necesarias existan
                perfil_completo = PERFIL_DEFAULT.copy()
                perfil_completo.update(p)
                session_state.perfil = perfil_completo
                session_state.fid_perfil = fid_perfil
            else:
                st.warning("⚠️ Archivo de perfil corrupto, usando valores por defecto")
                session_state.perfil = PERFIL_DEFAULT.copy()
                # Intentar recrear el archivo
                if save_json(fid_perfil, PERFIL_DEFAULT, drive):
                    st.info("📝 Archivo de perfil recreado")
        except Exception as e:
            st.warning(f"⚠️ Error cargando perfil: {e}")
            session_state.perfil = PERFIL_DEFAULT.copy()
    else:
        # Crear archivo de perfil por defecto
        fid_perfil = crear_archivo("inspector_perfil.json", cfg_id,
                                   json.dumps(PERFIL_DEFAULT, ensure_ascii=False, indent=2).encode("utf-8"),
                                   "application/json", drive)
        if fid_perfil:
            session_state.fid_perfil = fid_perfil
            session_state.perfil = PERFIL_DEFAULT.copy()
            st.info("📝 Archivo de perfil creado por defecto")
        else:
            session_state.perfil = PERFIL_DEFAULT.copy()
    
    # ===== CONOCIMIENTO =====
    fid_conoc = buscar_archivo("conocimiento_patologias.txt", cfg_id, drive)
    if fid_conoc:
        try:
            t = load_txt(fid_conoc, drive)
            if t and len(t.strip()) > 50:
                session_state.conocimiento = t
                session_state.fid_conoc = fid_conoc
            else:
                st.warning("⚠️ Archivo de conocimiento vacío, usando valores por defecto")
                session_state.conocimiento = CONOCIMIENTO_DEFAULT
                # Intentar recrear el archivo
                if save_txt(fid_conoc, CONOCIMIENTO_DEFAULT, drive):
                    st.info("📝 Archivo de conocimiento recreado")
        except Exception as e:
            st.warning(f"⚠️ Error cargando conocimiento: {e}")
            session_state.conocimiento = CONOCIMIENTO_DEFAULT
    else:
        # Crear archivo de conocimiento por defecto
        fid_conoc = crear_archivo("conocimiento_patologias.txt", cfg_id,
                                   CONOCIMIENTO_DEFAULT.encode("utf-8"),
                                   "text/plain", drive)
        if fid_conoc:
            session_state.fid_conoc = fid_conoc
            session_state.conocimiento = CONOCIMIENTO_DEFAULT
            st.info("📝 Archivo de conocimiento creado por defecto")
        else:
            session_state.conocimiento = CONOCIMIENTO_DEFAULT
    
    # ===== APRENDIZAJE =====
    fid_fs = buscar_archivo("few_shot_ejemplos.json", cfg_id, drive)
    if fid_fs:
        try:
            fs = load_json(fid_fs, drive)
            if fs is not None and isinstance(fs, list):
                session_state.few_shots = fs
                session_state.fid_fs = fid_fs
            else:
                st.warning("⚠️ Archivo de aprendizaje corrupto, creando nuevo")
                session_state.few_shots = []
                save_json(fid_fs, [], drive)
        except Exception as e:
            st.warning(f"⚠️ Error cargando aprendizaje: {e}")
            session_state.few_shots = []
    else:
        # Crear archivo de aprendizaje por defecto
        fid_fs = crear_archivo("few_shot_ejemplos.json", cfg_id, b"[]", "application/json", drive)
        if fid_fs:
            session_state.fid_fs = fid_fs
            session_state.few_shots = []
            st.info("📝 Archivo de aprendizaje creado por defecto")
        else:
            session_state.few_shots = []
    
    return True

def guardar_correccion(few_shots, fid_fs, drive, equipo, ia_dijo, inspector_corrigio, leccion):
    """Guarda una corrección para aprendizaje"""
    if not few_shots:
        few_shots = []
    
    nueva_correccion = {
        "equipo": str(equipo)[:100],
        "fecha": datetime.now().strftime("%Y-%m-%d"),
        "ia_dijo": str(ia_dijo)[:300],
        "inspector_corrigio": str(inspector_corrigio)[:300],
        "leccion": str(leccion)[:200]
    }
    
    few_shots.append(nueva_correccion)
    
    # Mantener solo las últimas 50 correcciones
    if len(few_shots) > 50:
        few_shots = few_shots[-50:]
    
    # Guardar en Drive si es posible
    if fid_fs and drive:
        try:
            save_json(fid_fs, few_shots, drive)
        except Exception as e:
            st.warning(f"⚠️ No se pudo guardar la corrección en Drive: {e}")
    
    return few_shots

def obtener_aprendizaje_texto(few_shots, limit=8):
    """Obtiene el texto de aprendizaje para incluir en el prompt"""
    if not few_shots:
        return ""
    
    texto = "\n## CORRECCIONES PREVIAS (aprendizaje):\n"
    for ej in few_shots[-limit:]:
        if ej.get("leccion"):
            texto += f"- {ej.get('leccion', '')}\n"
    
    return texto if len(texto) > 50 else ""