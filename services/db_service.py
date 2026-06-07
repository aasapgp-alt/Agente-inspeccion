import sqlite3
import json
import streamlit as st
from datetime import datetime
from utils.text_utils import limpiar_texto

# ✅ SOURCE OF TRUTH — Un solo path
def get_db_path():
    """Retorna el path de la DB desde session_state o default"""
    return st.session_state.get("db_path", "00_AASA_MINUTA_PGP_UTF8.sqlite")

DB_PATH = get_db_path()

def init_db():
    """Inicializa la base de datos con todas las tablas"""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Tabla de equipos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS equipos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa TEXT,
            area TEXT,
            numero TEXT,
            nombre TEXT UNIQUE,
            criticidad TEXT,
            material TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de inspecciones (historial por año)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inspecciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER,
            anio INTEGER,
            estado TEXT,
            acciones TEXT,
            diagnostico TEXT,
            recomendaciones TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (equipo_id) REFERENCES equipos(id),
            UNIQUE(equipo_id, anio)
        )
    ''')
    
    # Tabla de aprendizaje
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS aprendizaje (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo TEXT,
            ia_dijo TEXT,
            inspector_corrigio TEXT,
            leccion TEXT,
            fecha DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Tabla de configuración
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS configuracion (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Índices
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_equipos_nombre ON equipos(nombre)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_equipos_area ON equipos(area)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_inspecciones_equipo_anio ON inspecciones(equipo_id, anio)')
    
    conn.commit()
    conn.close()
    
    return True

def migrar_csv_a_db(df, drive):
    """Migra los datos del CSV a la base de datos SQLite"""
    if df is None:
        return False
    
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Limpiar tablas existentes
    cursor.execute('DELETE FROM inspecciones')
    cursor.execute('DELETE FROM equipos')
    
    # Función helper para obtener valor
    def get_val(row, *nombres):
        for nombre in nombres:
            if nombre in df.columns:
                val = str(row.get(nombre, '')).strip()
                if val and val != 'nan':
                    return limpiar_texto(val)
        return ''
    
    equipos_insertados = 0
    inspecciones_insertadas = 0
    
    for _, row in df.iterrows():
        # Obtener datos del equipo
        nombre = get_val(row, 'Línea_Equipo_Instalaciones', 'Línea Equipo Instalaciones', 'Equipo')
        if not nombre:
            continue
        
        # Insertar o actualizar equipo
        cursor.execute('''
            INSERT OR REPLACE INTO equipos (nombre, empresa, area, numero, criticidad, material, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            nombre,
            get_val(row, 'Empresa'),
            get_val(row, 'Area', 'Área'),
            get_val(row, 'Numero'),
            get_val(row, 'Criticidad'),
            get_val(row, 'Material'),
            datetime.now()
        ))
        
        equipo_id = cursor.lastrowid
        
        # Insertar inspecciones por año
        for anio in [2023, 2024, 2025, 2026, 2027]:
            estado = get_val(row, f'Estado PGP{anio}', f'Estado_PGP{anio}', f'Estado PGP {anio}')
            acciones = get_val(row, f'Acciones PGP {anio}', f'Acciones_PGP{anio}')
            diagnostico = get_val(row, f'Diagnostico {anio}', f'Diagnostico_{anio}')
            recomendaciones = get_val(row, f'Recomendaciones PGP {anio+1}', f'Recomendaciones_PGP{anio+1}')
            
            if estado or acciones or diagnostico or recomendaciones:
                cursor.execute('''
                    INSERT OR REPLACE INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, datetime.now()))
                inspecciones_insertadas += 1
        
        equipos_insertados += 1
    
    conn.commit()
    conn.close()
    
    # ✅ Actualizar session_state
    st.session_state.usar_db = True
    st.session_state.db_descargado = True
    
    st.success(f"✅ Migración completada: {equipos_insertados} equipos, {inspecciones_insertadas} inspecciones")
    return True

def obtener_lista_equipos_db():
    """Obtiene lista de equipos desde la base de datos"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, nombre, area, numero, criticidad, material 
            FROM equipos 
            ORDER BY area, nombre
        ''')
        
        equipos = []
        for row in cursor.fetchall():
            equipo_id, nombre, area, numero, criticidad, material = row
            display = f"{numero} - {nombre}" if numero and numero != 'nan' else nombre
            if area and area != 'nan':
                display = f"[{area}] {display}"
            
            equipos.append({
                "id": equipo_id,
                "equipo": nombre,
                "area": area or '',
                "numero": numero or '',
                "criticidad": criticidad or '',
                "material": material or '',
                "display": display
            })
        
        conn.close()
        return equipos
    
    except Exception as e:
        st.error(f"Error obteniendo equipos: {e}")
        return []

def obtener_historial_equipo_db(equipo_id, anio_actual):
    """Obtiene historial completo de un equipo desde SQLite local"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
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
        return None

def guardar_inspeccion_db(equipo_id, anio, estado, acciones, diagnostico, recomendaciones):
    """Guarda los resultados de la inspección en la base de datos"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, datetime.now()))
        
        # Actualizar timestamp del equipo
        cursor.execute('UPDATE equipos SET updated_at = ? WHERE id = ?', (datetime.now(), equipo_id))
        
        conn.commit()
        conn.close()
        
        # ✅ Actualizar session_state
        st.session_state.db_descargado = True
        
        return True
    except Exception as e:
        st.error(f"Error guardando: {e}")
        return False

def guardar_aprendizaje_db(equipo, ia_dijo, inspector_corrigio, leccion):
    """Guarda una corrección en la tabla de aprendizaje"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO aprendizaje (equipo, ia_dijo, inspector_corrigio, leccion, fecha)
            VALUES (?, ?, ?, ?, ?)
        ''', (equipo, ia_dijo, inspector_corrigio, leccion, datetime.now().date()))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        st.error(f"Error guardando aprendizaje: {e}")
        return False

def obtener_aprendizaje_db(limit=30):
    """Obtiene las últimas correcciones"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT equipo, ia_dijo, inspector_corrigio, leccion, fecha
            FROM aprendizaje
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        
        resultados = []
        for row in cursor.fetchall():
            resultados.append({
                "equipo": row[0],
                "ia_dijo": row[1],
                "inspector_corrigio": row[2],
                "leccion": row[3],
                "fecha": row[4]
            })
        
        conn.close()
        return resultados
    except Exception as e:
        st.error(f"Error obteniendo aprendizaje: {e}")
        return []

def obtener_configuracion_db(key):
    """Obtiene un valor de configuración"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT value FROM configuracion WHERE key = ?', (key,))
        row = cursor.fetchone()
        
        conn.close()
        
        # ✅ Manejo seguro de None
        if row and row[0]:
            return json.loads(row[0])
        return None
    except Exception as e:
        st.error(f"Error obteniendo configuración: {e}")
        return None

def guardar_configuracion_db(key, value):
    """Guarda un valor de configuración"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO configuracion (key, value, updated_at)
            VALUES (?, ?, ?)
        ''', (key, json.dumps(value), datetime.now()))
        
        conn.commit()
        conn.close()
        return True
    except Exception as e:
        st.error(f"Error guardando configuración: {e}")
        return False

def obtener_stats_db(anio_actual):
    """Obtiene estadísticas desde la base de datos"""
    db_path = get_db_path()
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Total de equipos
        cursor.execute('SELECT COUNT(*) FROM equipos')
        total = cursor.fetchone()[0]
        
        # Inspeccionados por año
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
        
        # Pendientes
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
        return {"total": 0, "bueno": 0, "regular": 0, "critico": 0, "nd": 0}
