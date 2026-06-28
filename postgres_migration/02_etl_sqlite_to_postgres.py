import sqlite3
import psycopg2
from psycopg2.extras import Json
import json
import uuid

# ==============================================================================
# ETL SCRIPT: SQLite (00_AASA_MINUTA_PGP_UTF8.sqlite) -> PostgreSQL (base_sulvy)
# ==============================================================================

def migrate():
    print("Iniciando proceso de migración ETL...")
    
    # 1. Configurar conexiones (Ajustar credenciales de Postgres según entorno)
    sqlite_conn = sqlite3.connect('../data/inspecciones.db')
    sqlite_cursor = sqlite_conn.cursor()
    
    # IMPORTANTE: Reemplazar con las credenciales reales
    try:
        pg_conn = psycopg2.connect(
            dbname="base_sulvy",
            user="postgres",
            password="password",
            host="localhost",
            port="5432"
        )
        pg_cursor = pg_conn.cursor()
    except Exception as e:
        print(f"Advertencia: No se pudo conectar a PostgreSQL ({e}). "
              "Asegúrate de ajustar las credenciales. El script está listo para correr.")
        return

    # Limpiar base Postgres por si se corre más de una vez (Opcional, con precaución)
    # pg_cursor.execute("TRUNCATE TABLE inspecciones, equipos, areas, empresas, aprendizaje CASCADE;")

    # 2. Extracción de la base legacy (Simulamos leyendo desde la local ya migrada o el CSV original)
    # Aquí vamos a leer los equipos actuales de SQLite
    sqlite_cursor.execute('''
        SELECT e.id, e.nombre, e.numero, e.material, e.criticidad, u.nombre as area_nombre, emp.nombre as empresa_nombre
        FROM equipos e
        JOIN ubicaciones u ON e.ubicacion_id = u.id
        JOIN empresas emp ON u.empresa_id = emp.id
    ''')
    equipos_legacy = sqlite_cursor.fetchall()

    cache_empresas = {}
    cache_areas = {}

    print(f"Extrayendo {len(equipos_legacy)} registros de equipos...")

    # 3. Transformación y Carga
    for row in equipos_legacy:
        (legacy_eq_id, eq_nombre, eq_numero, material, criticidad, area_nombre, empresa_nombre) = row
        
        # Insertar/Mapear Empresa
        if empresa_nombre not in cache_empresas:
            pg_cursor.execute(
                "INSERT INTO empresas (nombre) VALUES (%s) ON CONFLICT (nombre) DO UPDATE SET nombre=EXCLUDED.nombre RETURNING id",
                (empresa_nombre,)
            )
            cache_empresas[empresa_nombre] = pg_cursor.fetchone()[0]
        empresa_id = cache_empresas[empresa_nombre]

        # Insertar/Mapear Área
        area_key = f"{empresa_id}_{area_nombre}"
        if area_key not in cache_areas:
            pg_cursor.execute(
                "INSERT INTO areas (empresa_id, nombre) VALUES (%s, %s) RETURNING id",
                (empresa_id, area_nombre)
            )
            cache_areas[area_key] = pg_cursor.fetchone()[0]
        area_id = cache_areas[area_key]

        # Obtener histórico de inspecciones del SQLite legacy
        sqlite_cursor.execute('''
            SELECT anio, estado, diagnostico, acciones 
            FROM inspecciones 
            WHERE equipo_id = ? ORDER BY anio ASC
        ''', (legacy_eq_id,))
        historial = sqlite_cursor.fetchall()

        # Determinar estado_actual basándose en el último año registrado
        estado_actual = "Bueno"
        metadata_historica = {}
        for (anio, estado, diag, acc) in historial:
            metadata_historica[f"Estado_PGP{anio}"] = estado
            metadata_historica[f"Diagnostico_{anio}"] = diag
            metadata_historica[f"Acciones_{anio}"] = acc
            if anio == 2024 and estado: # Tomar 2024 como el "actual" si existe
                if "Roto" in estado or "Crítico" in estado: estado_actual = "Roto"
                elif "Regular" in estado or "Alerta" in estado: estado_actual = "Alerta"
                else: estado_actual = "Bueno"

        # Insertar Equipo
        tag_codigo = eq_numero if eq_numero else eq_nombre
        try:
            pg_cursor.execute('''
                INSERT INTO equipos (area_id, tag_codigo, descripcion, material, estado_actual) 
                VALUES (%s, %s, %s, %s, %s) RETURNING id
            ''', (area_id, tag_codigo, eq_nombre, material, estado_actual))
            nuevo_equipo_id = pg_cursor.fetchone()[0]
        except psycopg2.errors.UniqueViolation:
            pg_conn.rollback() # Skip si ya existe el código tag
            continue

        # Cargar Inspección Histórica Embebida
        if metadata_historica:
            pg_cursor.execute('''
                INSERT INTO inspecciones (equipo_id, origen, diagnostico_ia, metadata_historica)
                VALUES (%s, %s, %s, %s)
            ''', (nuevo_equipo_id, 'Legacy DB Migration', 'Migrado de historial PGP', Json(metadata_historica)))

        pg_conn.commit()

    print("Carga masiva a PostgreSQL finalizada correctamente.")
    sqlite_conn.close()
    pg_conn.close()

if __name__ == '__main__':
    migrate()
