"""Inspection Agent — Hugging Face Space."""

import streamlit as st
import os
import sqlite3
import logging

# ══════════════════════════════════════════════════════════════
# ⚠️ PAGE CONFIG — SIEMPRE PRIMERO (antes de cualquier otro st.*)
# ══════════════════════════════════════════════════════════════
st.set_page_config(
    page_title="🔍 Agente de Inspección",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ══════════════════════════════════════════════════════════════
# IMPORTS
# ══════════════════════════════════════════════════════════════
from services.drive_service import autenticar_drive, inicializar_gemini, descargar_archivo
from services.learning_service import cargar_recursos_config
from ui.sidebar import render_sidebar
from ui.inspection_tab import render_inspection_tab
from ui.history_tab import render_history_tab
from config.constants import CARPETA_RAIZ_ID, ANIO_ACTUAL
from config.defaults import PERFIL_DEFAULT, CONOCIMIENTO_DEFAULT

# Configurar logging básico
logging.basicConfig(level=logging.INFO)

# ══════════════════════════════════════════════════════════════
# INICIALIZACIÓN DE SESSION STATE
# ══════════════════════════════════════════════════════════════
def init_session_state():
    """Inicializa todas las variables de session_state"""
    defaults = {
        "drive": None,
        "gemini": None,
        "df": None,
        "fid_csv": None,
        "fid_sqlite": None,
        "fid_perfil": None,
        "fid_conoc": None,
        "fid_fs": None,
        "fid_inf": None,
        "equipo_seleccionado": None,
        "historial_seleccionado": None,
        "idx_equipo": None,
        "perfil": PERFIL_DEFAULT.copy(),
        "conocimiento": CONOCIMIENTO_DEFAULT,
        "few_shots": [],  # ← IMPORTANTE: inicializar few_shots
        "analisis_texto": "",
        "analisis_listo": False,
        "estado_sugerido": "REGULAR",
        "imgs_sel": [],
        "imgs_analizadas": [],
        "max_imgs": 10,
        "img_dim": 1024,
        "camino_fotos": [{"name": "EQUIPOS", "id": CARPETA_RAIZ_ID}],
        "comentario": "",
        "usar_db": True,
        "equipos_db": [],
        "db_path": "00_AASA_MINUTA_PGP_UTF8.sqlite",
        "db_descargado": False,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

# ══════════════════════════════════════════════════════════════
# AUTENTICACIÓN DE SERVICIOS
# ══════════════════════════════════════════════════════════════
def autenticar_servicios():
    """Autentica Drive y Gemini (solo una vez)"""
    if st.session_state.drive is None:
        with st.spinner("🔐 Autenticando con Google Drive..."):
            drive = autenticar_drive()
            if drive:
                st.session_state.drive = drive
                st.toast("✅ Drive conectado", icon="✅")
            else:
                st.error("❌ Error al conectar con Drive")
                return False

    if st.session_state.gemini is None and st.session_state.drive:
        with st.spinner("🤖 Inicializando Gemini..."):
            gemini = inicializar_gemini()
            if gemini:
                st.session_state.gemini = gemini
                st.toast("✅ Gemini listo", icon="✅")
                return True
            else:
                st.error("❌ Error al inicializar Gemini")
                return False
    return True

# ══════════════════════════════════════════════════════════════
# DESCARGAR SQLITE DESDE DRIVE
# ══════════════════════════════════════════════════════════════
def descargar_sqlite_desde_drive():
    """Busca y descarga el archivo SQLite desde Drive"""
    if st.session_state.drive is None:
        return False

    db_path = st.session_state.db_path

    if os.path.exists(db_path):
        st.session_state.db_descargado = True
        return True

    try:
        query = f"'{CARPETA_RAIZ_ID}' in parents and name='{db_path}' and trashed=false"
        results = st.session_state.drive.files().list(q=query, fields="files(id, name)").execute()
        files = results.get('files', [])

        if files:
            fid = files[0]['id']
            st.session_state.fid_sqlite = fid

            with st.spinner("📥 Descargando base de datos..."):
                data = descargar_archivo(fid, st.session_state.drive)
                if data:
                    with open(db_path, "wb") as f:
                        f.write(data)
                    st.session_state.db_descargado = True
                    return True
        return False
    except Exception as e:
        st.error(f"Error descargando DB: {e}")
        logging.error(f"Error descargando DB: {e}", exc_info=True)
        return False

# ══════════════════════════════════════════════════════════════
# CARGAR DATOS DESDE SQLITE
# ══════════════════════════════════════════════════════════════
def cargar_desde_sqlite():
    """Carga los datos desde el archivo SQLite local"""
    db_path = st.session_state.db_path

    if not os.path.exists(db_path):
        st.session_state.usar_db = False
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tablas = [row[0] for row in cursor.fetchall()]

        if 'equipos' not in tablas or 'inspecciones' not in tablas:
            conn.close()
            st.session_state.usar_db = False
            return False

        cursor.execute("SELECT COUNT(*) FROM equipos")
        total_equipos = cursor.fetchone()[0]

        if total_equipos == 0:
            conn.close()
            st.session_state.usar_db = False
            return False

        st.session_state.usar_db = True
        conn.close()
        return True

    except Exception as e:
        st.error(f"Error cargando DB: {e}")
        logging.error(f"Error cargando DB: {e}", exc_info=True)
        st.session_state.usar_db = False
        return False

# ══════════════════════════════════════════════════════════════
# FUNCIONES PARA ACCEDER A SQLITE
# ══════════════════════════════════════════════════════════════
def obtener_equipos_db():
    """Obtiene lista de equipos desde SQLite"""
    try:
        conn = sqlite3.connect(st.session_state.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, nombre, area, numero, criticidad, material
            FROM equipos
            ORDER BY area, nombre
        ''')

        equipos = []
        for row in cursor.fetchall():
            equipo_id, nombre, area, numero, criticidad, material = row

            nombre = str(nombre).strip() if nombre else ''
            area = str(area).strip() if area else ''
            numero = str(numero).strip() if numero else ''

            if not nombre or nombre == 'nan' or nombre == 'None':
                continue

            if numero and numero != 'nan' and numero != 'None':
                display = f"{numero} - {nombre}"
            else:
                display = nombre

            if area and area != 'nan' and area != 'None':
                display = f"[{area}] {display}"

            equipos.append({
                "id": equipo_id,
                "equipo": nombre,
                "area": area,
                "numero": numero,
                "criticidad": str(criticidad).strip() if criticidad else '',
                "material": str(material).strip() if material else '',
                "display": display
            })

        conn.close()
        return equipos

    except Exception as e:
        st.error(f"Error obteniendo equipos: {e}")
        logging.error(f"Error obteniendo equipos: {e}", exc_info=True)
        return []

def obtener_historial_equipo_db(equipo_id, anio_actual):
    """Obtiene historial completo de un equipo"""
    try:
        conn = sqlite3.connect(st.session_state.db_path)
        cursor = conn.cursor()

        cursor.execute('SELECT nombre, area, numero, criticidad, material FROM equipos WHERE id = ?', (equipo_id,))
        equipo_row = cursor.fetchone()

        if not equipo_row:
            conn.close()
            return None

        nombre, area, numero, criticidad, material = equipo_row

        historial = {
            "id": equipo_id,
            "equipo": str(nombre) if nombre else '',
            "area": str(area) if area else '',
            "numero": str(numero) if numero else '',
            "criticidad": str(criticidad) if criticidad else '',
            "material": str(material) if material else '',
            "estado_2023": "",
            "acciones_2023": "",
            "estado_2024": "",
            "acciones_2024": "",
            "estado_2025": "",
            "acciones_2025": "",
            "estado_actual": "",
            "acciones_actual": "",
            "diagnostico_2024": "",
            "diagnostico_2025": "",
            "diagnostico_actual": "",
            "recomendaciones_2024": "",
            "recomendaciones_2025": "",
            "recomendaciones_siguiente": "",
        }

        cursor.execute('''
            SELECT anio, estado, acciones, diagnostico, recomendaciones
            FROM inspecciones
            WHERE equipo_id = ?
            ORDER BY anio
        ''', (equipo_id,))

        for row in cursor.fetchall():
            anio, estado, acciones, diagnostico, recomendaciones = row

            estado = str(estado).strip() if estado and estado != 'nan' else ''
            acciones = str(acciones).strip() if acciones and acciones != 'nan' else ''
            diagnostico = str(diagnostico).strip() if diagnostico and diagnostico != 'nan' else ''
            recomendaciones = str(recomendaciones).strip() if recomendaciones and recomendaciones != 'nan' else ''

            if anio == 2023:
                historial["estado_2023"] = estado
                historial["acciones_2023"] = acciones
            elif anio == 2024:
                historial["estado_2024"] = estado
                historial["acciones_2024"] = acciones
                historial["diagnostico_2024"] = diagnostico
                historial["recomendaciones_2025"] = recomendaciones
            elif anio == 2025:
                historial["estado_2025"] = estado
                historial["acciones_2025"] = acciones
                historial["diagnostico_2025"] = diagnostico
                historial["recomendaciones_2026"] = recomendaciones
            elif anio == anio_actual:
                historial["estado_actual"] = estado
                historial["acciones_actual"] = acciones
                historial["diagnostico_actual"] = diagnostico
                historial["recomendaciones_siguiente"] = recomendaciones

        conn.close()
        return historial

    except Exception as e:
        st.error(f"Error obteniendo historial: {e}")
        logging.error(f"Error obteniendo historial: {e}", exc_info=True)
        return None

def guardar_inspeccion_db(equipo_id, anio, estado, acciones, diagnostico, recomendaciones):
    """Guarda los resultados de la inspección"""
    try:
        conn = sqlite3.connect(st.session_state.db_path)
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (equipo_id, anio, estado, acciones, diagnostico, recomendaciones))

        conn.commit()
        conn.close()
        return True
    except Exception as e:
        st.error(f"Error guardando: {e}")
        logging.error(f"Error guardando inspección: {e}", exc_info=True)
        return False

def obtener_stats_db(anio_actual):
    """Obtiene estadísticas desde SQLite"""
    try:
        conn = sqlite3.connect(st.session_state.db_path)
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM equipos')
        total = cursor.fetchone()[0]

        cursor.execute('''
            SELECT estado, COUNT(*)
            FROM inspecciones
            WHERE anio = ? AND estado IS NOT NULL AND estado != ''
            GROUP BY estado
        ''', (anio_actual,))

        bueno = regular = critico = 0
        for estado, count in cursor.fetchall():
            estado_upper = estado.upper() if estado else ''
            if "BUENO" in estado_upper:
                bueno = count
            elif "REGULAR" in estado_upper:
                regular = count
            elif "CRÍTICO" in estado_upper or "CRITICO" in estado_upper:
                critico = count

        cursor.execute('''
            SELECT COUNT(*) FROM equipos e
            LEFT JOIN inspecciones i ON e.id = i.equipo_id AND i.anio = ?
            WHERE i.id IS NULL OR i.estado IS NULL OR i.estado = ''
        ''', (anio_actual,))
        nd = cursor.fetchone()[0]

        conn.close()

        return {
            "total": total,
            "bueno": bueno,
            "regular": regular,
            "critico": critico,
            "nd": nd
        }
    except Exception as e:
        st.error(f"Error obteniendo stats: {e}")
        logging.error(f"Error obteniendo stats: {e}", exc_info=True)
        return {"total": 0, "bueno": 0, "regular": 0, "critico": 0, "nd": 0}

# ══════════════════════════════════════════════════════════════
# CALLBACKS
# ══════════════════════════════════════════════════════════════
def on_equipo_selected(equipo_id, historial):
    """Callback cuando se selecciona un equipo"""
    st.session_state.idx_equipo = equipo_id
    st.session_state.equipo_seleccionado = {
        "id": equipo_id,
        "equipo": historial.get("equipo"),
        "area": historial.get("area"),
        "numero": historial.get("numero"),
        "material": historial.get("material"),
        "criticidad": historial.get("criticidad"),
    }
    st.session_state.historial_seleccionado = historial
    st.session_state.analisis_listo = False
    st.session_state.analisis_texto = ""

def on_guardar(df_actualizado):
    """Callback cuando se guarda una inspección"""
    st.session_state.df = df_actualizado

# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════
def main():
    # Autenticar servicios (solo una vez)
    if not autenticar_servicios():
        st.stop()

    # Descargar SQLite
    if st.session_state.drive and not st.session_state.db_descargado:
        descargar_sqlite_desde_drive()

    # Cargar datos
    if not st.session_state.usar_db and st.session_state.db_descargado:
        cargar_desde_sqlite()

    if not st.session_state.usar_db:
        st.error("❌ No se pudo cargar la base de datos")
        st.stop()

    # Cargar configuración (usar valores por defecto si Drive no está disponible)
    if st.session_state.drive:
        cargar_recursos_config(st.session_state.drive, CARPETA_RAIZ_ID, st.session_state)
    else:
        # Usar valores por defecto si no hay Drive
        st.session_state.perfil = PERFIL_DEFAULT.copy()
        st.session_state.conocimiento = CONOCIMIENTO_DEFAULT
        st.session_state.few_shots = []  # ← Corrección: usar lista vacía directamente

    # Obtener equipos
    equipos = obtener_equipos_db()

    if not equipos:
        st.error("❌ No se encontraron equipos")
        st.stop()

    # Renderizar sidebar
    max_imgs, img_dim = render_sidebar(
        equipos,
        st.session_state.get("fid_csv"),
        st.session_state.drive,
        on_equipo_selected,
        st.session_state.perfil,
        st.session_state.get("fid_perfil"),
        st.session_state.conocimiento,
        st.session_state.get("fid_conoc"),
        st.session_state.few_shots,
        st.session_state.get("fid_fs"),
        usar_db=True  # ← Solo un argumento usar_db, sin coma después
    )

    st.session_state.max_imgs = max_imgs
    st.session_state.img_dim = img_dim

    # Header
    st.markdown(f"""
    <div style="background:#0d1117;border:1px solid #1e2d45;border-radius:10px;padding:18px 24px;margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.9rem;font-weight:700;letter-spacing:4px;color:#dde4f0;">⚙ Inspector IA Industrial</div>
                <div style="font-family:'JetBrains Mono',monospace;font-size:.62rem;color:#00c8d7;">Planta Arauco · Sistema de Inspección</div>
                <div style="font-size:.6rem;color:#3d4f66;margin-top:6px;">PGP {ANIO_ACTUAL} → {ANIO_ACTUAL+1}</div>
            </div>
            <div style="text-align:right;">
                <div style="font-size:.58rem;color:#3d4f66;">MODELO IA</div>
                <div style="font-size:1rem;color:#00c8d7;font-weight:600;">GEMINI-2.5-FLASH</div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Tabs
    tab1, tab2 = st.tabs(["🔍 Inspección", "📊 Histórico"])

    with tab1:
        render_inspection_tab(
            drive=st.session_state.drive,
            equipo_actual=st.session_state.equipo_seleccionado,
            historial_actual=st.session_state.historial_seleccionado,
            perfil=st.session_state.perfil,
            conocimiento=st.session_state.conocimiento,
            few_shots=st.session_state.few_shots,
            gemini=st.session_state.gemini,
            on_guardar=on_guardar,
            usar_db=True
        )

    with tab2:
        render_history_tab(
            df=st.session_state.get("df"),
            anio_actual=ANIO_ACTUAL,
            usar_db=True
        )

    # Footer
    st.markdown(f"""
    <div style="text-align:center;padding:20px 0 10px;font-family:'JetBrains Mono',monospace;font-size:.58rem;color:#1e2d45;">
    ARAUCO · Inspector IA · PGP {ANIO_ACTUAL}→{ANIO_ACTUAL+1}
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()