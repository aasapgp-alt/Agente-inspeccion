"""
Script ETL de Migración: SQLite -> Neon PostgreSQL
===================================================
Migra todos los datos desde la base SQLite existente hacia Neon (PostgreSQL),
respetando el orden de dependencias de claves foráneas y sincronizando las
secuencias autoincrementales (SERIAL) para evitar colisiones en futuros inserts.

Uso:
    python postgres_migration/migrate_sqlite_to_neon.py
    python postgres_migration/migrate_sqlite_to_neon.py --sqlite-path data/inspecciones.db --database-url "postgresql://..."
"""

import os
import sys
import sqlite3
import argparse
import logging
from typing import Dict, List, Any
import psycopg2
from psycopg2.extras import DictCursor, Json
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("MigrateToNeon")

# Orden estricto de tablas respetando foreign keys
TABLES_ORDER = [
    "empresas",
    "ubicaciones",
    "campanias",
    "equipos",
    "usuarios",
    "sesiones_activas",
    "auditoria",
    "inspecciones",
    "libros",
    "reportes",
    "versiones_reportes",
    "anotaciones_imagenes",
    "configuracion",
    "drive_folders_cache",
    "aprendizaje",
    "plan_inspeccion_diaria",
]

# Columnas que almacenan JSON en SQLite y deben formatearse para Postgres
JSON_COLUMNS = {
    "inspecciones": ["metadata_historica"],
    "libros": ["resumen_estados", "equipos_incluidos"],
    "anotaciones_imagenes": ["annotations"],
}

# Columnas booleanas
BOOLEAN_COLUMNS = {
    "empresas": ["activo"],
    "ubicaciones": ["activo"],
    "campanias": ["activa"],
    "equipos": ["activo"],
    "usuarios": ["activo"],
    "inspecciones": ["reporte_generado"],
    "configuracion": ["editable"],
}


def normalize_database_url(url: str) -> str:
    """Ajusta esquemas de postgres:// a postgresql:// requeridos por psycopg2."""
    if not url:
        return url
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def apply_schema(pg_conn, schema_file: str):
    """Aplica el archivo de esquema DDL en PostgreSQL si no existen las tablas."""
    if not os.path.exists(schema_file):
        logger.warning(f"No se encontró archivo DDL {schema_file}, continuando...")
        return

    logger.info(f"Aplicando esquema DDL desde {schema_file}...")
    with open(schema_file, "r", encoding="utf-8") as f:
        ddl = f.read()

    with pg_conn.cursor() as cur:
        cur.execute(ddl)
    pg_conn.commit()
    logger.info("Esquema DDL aplicado correctamente en Neon.")


def table_exists_in_sqlite(sqlite_conn, table_name: str) -> bool:
    cur = sqlite_conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
    return cur.fetchone() is not None


def migrate_table(sqlite_conn, pg_conn, table_name: str) -> int:
    """Migra una tabla individual desde SQLite a PostgreSQL."""
    if not table_exists_in_sqlite(sqlite_conn, table_name):
        logger.warning(f"Tabla '{table_name}' no existe en SQLite. Saltando...")
        return 0

    sqlite_cur = sqlite_conn.cursor()
    sqlite_cur.execute(f"PRAGMA table_info({table_name})")
    sqlite_cols_info = sqlite_cur.fetchall()
    column_names = [col[1] for col in sqlite_cols_info]

    if not column_names:
        return 0

    # Obtener columnas existentes en PostgreSQL para evitar errores de columnas faltantes
    with pg_conn.cursor() as cur:
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = %s
        """, (table_name.lower(),))
        pg_cols = {row[0].lower() for row in cur.fetchall()}

    valid_columns = [col for col in column_names if col.lower() in pg_cols]
    if not valid_columns:
        logger.warning(f"No hay columnas coincidentes para '{table_name}'.")
        return 0

    # Extraer datos de SQLite
    cols_str = ", ".join([f'"{col}"' for col in valid_columns])
    sqlite_cur.execute(f"SELECT {cols_str} FROM {table_name}")
    rows = sqlite_cur.fetchall()
    
    if not rows:
        logger.info(f"Tabla '{table_name}': 0 registros para migrar.")
        return 0

    logger.info(f"Migrando {len(rows)} registros a '{table_name}'...")

    # Preparar query de inserción en PostgreSQL
    placeholders = ", ".join(["%s"] * len(valid_columns))
    insert_sql = f"""
        INSERT INTO {table_name} ({cols_str})
        VALUES ({placeholders})
        ON CONFLICT (id) DO UPDATE SET
        {", ".join([f'"{col}" = EXCLUDED."{col}"' for col in valid_columns if col.lower() != 'id'])}
    """

    # Si la tabla no tiene columna 'id', hacer ON CONFLICT DO NOTHING
    if "id" not in [c.lower() for c in valid_columns]:
        insert_sql = f"""
            INSERT INTO {table_name} ({cols_str})
            VALUES ({placeholders})
            ON CONFLICT DO NOTHING
        """

    json_cols = JSON_COLUMNS.get(table_name, [])
    bool_cols = BOOLEAN_COLUMNS.get(table_name, [])

    transformed_rows = []
    for row in rows:
        row_dict = dict(row)
        transformed_values = []
        for col in valid_columns:
            val = row_dict[col]
            # Convertir booleanos numéricos (0 / 1) a bool nativo si aplica
            if col in bool_cols and val is not None:
                val = bool(val)
            # Manejo de JSON
            elif col in json_cols and val is not None:
                if isinstance(val, str) and (val.startswith("{") or val.startswith("[")):
                    try:
                        import json
                        val = Json(json.loads(val))
                    except Exception:
                        pass
            transformed_values.append(val)
        transformed_rows.append(tuple(transformed_values))

    with pg_conn.cursor() as pg_cur:
        for val_tuple in transformed_rows:
            try:
                pg_cur.execute(insert_sql, val_tuple)
            except Exception as e:
                logger.error(f"Error insertando en {table_name}: {e} | Datos: {val_tuple}")
                pg_conn.rollback()
                raise

    pg_conn.commit()

    # Sincronizar secuencia SERIAL en PostgreSQL si la tabla tiene columna 'id'
    if "id" in [c.lower() for c in valid_columns]:
        with pg_conn.cursor() as pg_cur:
            pg_cur.execute(f"""
                SELECT setval(
                    pg_get_serial_sequence('{table_name}', 'id'),
                    coalesce((SELECT max(id) FROM {table_name}), 1)
                );
            """)
        pg_conn.commit()

    logger.info(f"✔ Tabla '{table_name}': {len(rows)} registros migrados con éxito.")
    return len(rows)


def verify_migration(sqlite_conn, pg_conn):
    """Compara el conteo de registros entre SQLite y Neon PostgreSQL."""
    logger.info("=" * 60)
    logger.info("REPORTE DE VERIFICACIÓN DE MIGRACIÓN")
    logger.info("=" * 60)
    logger.info(f"{'TABLA':<25} | {'SQLITE':<10} | {'POSTGRES':<10} | {'ESTADO':<10}")
    logger.info("-" * 60)

    total_sqlite = 0
    total_pg = 0
    all_match = True

    for table in TABLES_ORDER:
        sqlite_count = 0
        if table_exists_in_sqlite(sqlite_conn, table):
            cur = sqlite_conn.cursor()
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            sqlite_count = cur.fetchone()[0]

        pg_count = 0
        try:
            with pg_conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table}")
                pg_count = cur.fetchone()[0]
        except Exception:
            pg_conn.rollback()

        status = "OK" if sqlite_count == pg_count else "DIFERENCIA"
        if sqlite_count != pg_count:
            all_match = False

        logger.info(f"{table:<25} | {sqlite_count:<10} | {pg_count:<10} | {status:<10}")
        total_sqlite += sqlite_count
        total_pg += pg_count

    logger.info("-" * 60)
    logger.info(f"{'TOTALES':<25} | {total_sqlite:<10} | {total_pg:<10} | {'LISTO' if all_match else 'REVISAR'}")
    logger.info("=" * 60)


def run_migration(sqlite_path: str, database_url: str, schema_file: str):
    """Ejecuta el proceso completo de migración."""
    if not os.path.exists(sqlite_path):
        logger.error(f"El archivo SQLite especificado no existe: {sqlite_path}")
        sys.exit(1)

    if not database_url:
        logger.error("DATABASE_URL no está configurada ni provista como argumento.")
        logger.error("Define la variable DATABASE_URL o utiliza --database-url.")
        sys.exit(1)

    norm_db_url = normalize_database_url(database_url)

    logger.info(f"Conectando a SQLite: {sqlite_path}")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row

    logger.info("Conectando a Neon PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(norm_db_url)
    except Exception as e:
        logger.error(f"No se pudo conectar a Neon PostgreSQL: {e}")
        sys.exit(1)

    try:
        # 1. Aplicar DDL
        apply_schema(pg_conn, schema_file)

        # 2. Migrar tablas en orden
        for table in TABLES_ORDER:
            migrate_table(sqlite_conn, pg_conn, table)

        # 3. Verificación
        verify_migration(sqlite_conn, pg_conn)

    except Exception as e:
        logger.error(f"Fallo durante el proceso de migración: {e}", exc_info=True)
    finally:
        sqlite_conn.close()
        pg_conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migración de SQLite a Neon PostgreSQL")
    default_sqlite = os.getenv("DB_PATH", os.path.join("data", "inspecciones.db"))
    
    # Fallback si data/inspecciones.db no existe pero seed_inspecciones.db sí
    if not os.path.exists(default_sqlite):
        seed_path = os.path.join("app", "assets", "seed_inspecciones.db")
        if os.path.exists(seed_path):
            default_sqlite = seed_path

    parser.add_argument(
        "--sqlite-path",
        default=default_sqlite,
        help="Ruta al archivo .db de SQLite origen"
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", ""),
        help="Cadena de conexión DATABASE_URL a Neon PostgreSQL"
    )
    parser.add_argument(
        "--schema-file",
        default=os.path.join("postgres_migration", "01_neon_schema.sql"),
        help="Ruta al archivo SQL con el esquema DDL de Neon"
    )

    args = parser.parse_args()
    run_migration(args.sqlite_path, args.database_url, args.schema_file)
