import sqlite3
import os

DB_PATH = 'data/inspecciones.db'
LEGACY_DB_PATH = 'data/00_AASA_MINUTA_PGP_UTF8.sqlite'

def migrate():
    print("Iniciando migración desde base de datos legacy...")
    
    # 1. Conectar a la BD principal y crear esquema
    conn_main = sqlite3.connect(DB_PATH)
    cursor_main = conn_main.cursor()
    
    cursor_main.execute("""
    CREATE TABLE IF NOT EXISTS empresas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT UNIQUE NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    cursor_main.execute("""
    CREATE TABLE IF NOT EXISTS ubicaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        empresa_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        codigo TEXT,
        descripcion TEXT,
        activo BOOLEAN DEFAULT 1,
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
        UNIQUE(empresa_id, nombre)
    );
    """)
    
    # Dropear y recrear equipos si es necesario, o alterar (para simplificar, crearemos una tabla temporal o dropearemos si es de prueba)
    cursor_main.execute("DROP TABLE IF EXISTS equipos;")
    
    cursor_main.execute("""
    CREATE TABLE IF NOT EXISTS equipos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ubicacion_id INTEGER NOT NULL,
        codigo TEXT NOT NULL,
        nombre TEXT NOT NULL,
        tag TEXT,
        material TEXT,
        criticidad TEXT,
        fluido TEXT,
        presion_diseno REAL,
        temperatura_diseno REAL,
        estado_actual TEXT DEFAULT 'PENDIENTE',
        activo BOOLEAN DEFAULT 1,
        fecha_instalacion DATE,
        fabricante TEXT,
        modelo TEXT,
        FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE CASCADE,
        UNIQUE(ubicacion_id, codigo)
    );
    """)
    
    conn_main.commit()
    
    # 2. Conectar a la BD legacy y extraer datos
    if not os.path.exists(LEGACY_DB_PATH):
        print(f"Base de datos legacy no encontrada en: {LEGACY_DB_PATH}")
        return
        
    conn_legacy = sqlite3.connect(LEGACY_DB_PATH)
    conn_legacy.row_factory = sqlite3.Row
    cursor_legacy = conn_legacy.cursor()
    
    cursor_legacy.execute("SELECT id, nombre, empresa, area, numero, criticidad, material FROM equipos")
    legacy_equipos = cursor_legacy.fetchall()
    
    print(f"Procesando {len(legacy_equipos)} equipos legacy...")
    
    empresas_dict = {}
    ubicaciones_dict = {}
    
    for row in legacy_equipos:
        empresa_nombre = row['empresa']
        area_nombre = row['area']
        
        # Insertar empresa si no existe
        if empresa_nombre not in empresas_dict:
            cursor_main.execute(
                "INSERT OR IGNORE INTO empresas (nombre) VALUES (?)", 
                (empresa_nombre,)
            )
            cursor_main.execute("SELECT id FROM empresas WHERE nombre = ?", (empresa_nombre,))
            empresa_id = cursor_main.fetchone()[0]
            empresas_dict[empresa_nombre] = empresa_id
        else:
            empresa_id = empresas_dict[empresa_nombre]
            
        # Insertar ubicacion si no existe
        ubi_key = (empresa_id, area_nombre)
        if ubi_key not in ubicaciones_dict:
            cursor_main.execute(
                "INSERT OR IGNORE INTO ubicaciones (empresa_id, nombre) VALUES (?, ?)",
                (empresa_id, area_nombre)
            )
            cursor_main.execute("SELECT id FROM ubicaciones WHERE empresa_id = ? AND nombre = ?", (empresa_id, area_nombre))
            ubi_id = cursor_main.fetchone()[0]
            ubicaciones_dict[ubi_key] = ubi_id
        else:
            ubi_id = ubicaciones_dict[ubi_key]
            
        # Insertar equipo
        # Mapeo: numero -> codigo, nombre -> nombre
        try:
            cursor_main.execute("""
                INSERT INTO equipos (id, ubicacion_id, codigo, nombre, criticidad, material)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                row['id'], 
                ubi_id, 
                row['numero'], 
                row['nombre'], 
                row['criticidad'], 
                row['material']
            ))
        except sqlite3.IntegrityError:
            pass # Equipo ya existe

    conn_main.commit()
    print("Migración de equipos, empresas y ubicaciones completada.")
    
    # Tambien sincronizamos inspecciones si es requerido (Historial 2024, 2026)
    print("Sincronizando inspecciones desde la tabla base...")
    cursor_main.execute("""
    CREATE TABLE IF NOT EXISTS inspecciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipo_id INTEGER,
        anio INTEGER,
        estado TEXT,
        acciones TEXT,
        diagnostico TEXT,
        recomendaciones TEXT,
        created_at TIMESTAMP,
        updated_at TIMESTAMP,
        reporte_generado BOOLEAN,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id TEXT,
        fecha_generacion_reporte DATETIME,
        tipo_reporte TEXT,
        numero_acta TEXT,
        estado_generacion TEXT,
        error_generacion TEXT
    );
    """)
    cursor_main.execute("DELETE FROM inspecciones")
    
    # Helper for clean state
    def clean_state(state):
        if not state:
            return 'PENDIENTE'
        state_upper = state.strip().upper()
        if 'BUENO' in state_upper:
            return 'BUENO'
        if 'REGULAR' in state_upper:
            return 'REGULAR'
        if 'CRITICO' in state_upper or 'CRÍTICO' in state_upper:
            return 'CRITICO'
        if 'FUERA DE RUTA' in state_upper or 'FUERA_DE_RUTA' in state_upper:
            return 'FUERA DE RUTA'
        return 'PENDIENTE'

    # Obtener filas de la tabla base en orden
    cursor_legacy.execute('SELECT rowid, * FROM "00_AASA_MINUTA_PGP_UTF8_Base_Insp_AASA" ORDER BY rowid')
    base_rows = cursor_legacy.fetchall()
    
    # Ya procesamos legacy_equipos en el paso anterior. Tienen el mismo orden 1-a-1.
    for idx in range(min(len(base_rows), len(legacy_equipos))):
        brow = dict(base_rows[idx])
        leg_eq = legacy_equipos[idx]
        equipo_id = leg_eq['id']
        
        # Mapear e insertar inspecciones para 2023, 2024 y 2026
        insps = []
        if brow.get('Estado_PGP2023') is not None:
            insps.append({
                'anio': 2023,
                'estado': clean_state(brow['Estado_PGP2023']),
                'acciones': brow.get('Acciones_PGP2023') or '',
                'diagnostico': '',
                'recomendaciones': brow.get('Recomendaciones_PGP2024') or ''
            })
        if brow.get('Estado_PGP2024') is not None:
            insps.append({
                'anio': 2024,
                'estado': clean_state(brow['Estado_PGP2024']),
                'acciones': brow.get('Acciones_PGP2024') or '',
                'diagnostico': brow.get('Diagnostico_2024') or '',
                'recomendaciones': brow.get('Recomendaciones_PGP2025') or ''
            })
        if brow.get('Estado_PGP2026') is not None:
            insps.append({
                'anio': 2026,
                'estado': clean_state(brow['Estado_PGP2026']),
                'acciones': brow.get('Acciones_PGP2026') or '',
                'diagnostico': brow.get('Diagnostico_2026') or '',
                'recomendaciones': brow.get('Recomendaciones_PGP2027') or ''
            })
            
        for insp in insps:
            cursor_main.execute("""
                INSERT INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (equipo_id, insp['anio'], insp['estado'], insp['acciones'], insp['diagnostico'], insp['recomendaciones']))
            
        # Actualizar el estado_actual en la tabla equipos
        final_state = clean_state(brow.get('Estado_PGP2026'))
        cursor_main.execute("""
            UPDATE equipos
            SET estado_actual = ?
            WHERE id = ?
        """, (final_state, equipo_id))

    conn_main.commit()
    print("Sincronización de inspecciones e impacto en estado de equipos completados.")
    
    conn_legacy.close()
    conn_main.close()
    
    print("Migración exitosa!")

if __name__ == "__main__":
    migrate()
