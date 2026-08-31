import psycopg2
from psycopg2.extras import execute_batch
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MigrateToSupabase")

import os
from dotenv import load_dotenv

load_dotenv()

NEON_URL = os.getenv("NEON_DATABASE_URL") or os.getenv("SOURCE_DATABASE_URL", "")
SUPABASE_URL = os.getenv("DATABASE_URL") or os.getenv("TARGET_DATABASE_URL", "")

TABLES = [
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
    "plan_inspeccion_diaria"
]

def migrate():
    logger.info("Iniciando migración Neon -> Supabase...")
    n_conn = psycopg2.connect(NEON_URL)
    s_conn = psycopg2.connect(SUPABASE_URL)
    n_cur = n_conn.cursor()
    s_cur = s_conn.cursor()

    # 1. Truncate all tables at once
    tables_list = ", ".join([f'"{t}"' for t in TABLES])
    logger.info(f"Limpiando todas las tablas...")
    s_cur.execute(f"TRUNCATE TABLE {tables_list} CASCADE;")
    s_conn.commit()
    logger.info("Tablas vaciadas correctamente.")

    # 2. Insert rows in order
    total_migrados = 0
    for table in TABLES:
        try:
            n_cur.execute(f'SELECT * FROM "{table}"')
            rows = n_cur.fetchall()
            col_names = [desc[0] for desc in n_cur.description]
            if not rows:
                logger.info(f"Tabla '{table}': 0 filas.")
                continue

            cols_str = ", ".join([f'"{c}"' for c in col_names])
            placeholders = ", ".join(["%s"] * len(col_names))
            insert_sql = f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders})'

            execute_batch(s_cur, insert_sql, rows, page_size=200)
            s_conn.commit()

            # Sincronizar secuencias serial
            if "id" in [c.lower() for c in col_names]:
                try:
                    s_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce((SELECT max(id) FROM \"{table}\"), 1));")
                    s_conn.commit()
                except Exception as seq_err:
                    s_conn.rollback()
                    logger.debug(f"Secuencia en '{table}': {seq_err}")

            logger.info(f"✔ Tabla '{table}': {len(rows)} filas migradas exitosamente.")
            total_migrados += len(rows)
        except Exception as e:
            s_conn.rollback()
            logger.error(f"❌ Error migrando '{table}': {e}")
            raise

    logger.info("=" * 50)
    logger.info("VERIFICACIÓN DE REGISTROS EN SUPABASE:")
    for table in TABLES:
        try:
            s_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
            count = s_cur.fetchone()[0]
            logger.info(f"  - {table}: {count} filas")
        except Exception as e:
            logger.error(f"Error verificando {table}: {e}")

    n_conn.close()
    s_conn.close()
    logger.info(f"¡Migración completada con éxito! Total registros migrados: {total_migrados}")

if __name__ == "__main__":
    migrate()
