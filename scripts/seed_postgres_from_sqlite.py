import sqlite3
import psycopg2
from psycopg2.extras import execute_batch
import os
import sys

def seed_postgres(sqlite_path="app/assets/seed_inspecciones.db", pg_url=None):
    if not pg_url:
        pg_url = os.getenv("DATABASE_URL")
    
    if not pg_url:
        print("DATABASE_URL no especificada.")
        return

    print(f"Conectando a SQLite ({sqlite_path}) y PostgreSQL...")
    s_conn = sqlite3.connect(sqlite_path)
    s_conn.row_factory = sqlite3.Row
    s_cur = s_conn.cursor()

    p_conn = psycopg2.connect(pg_url)
    p_cur = p_conn.cursor()

    TABLES = [
        "empresas",
        "ubicaciones",
        "campanias",
        "equipos",
        "usuarios",
        "configuracion",
        "configuracion_reportes",
        "inspecciones",
        "libros",
        "reportes",
        "versiones_reportes",
        "reportes_versiones",
        "anotaciones_imagenes",
        "drive_folders_cache",
        "aprendizaje",
        "plan_inspeccion_diaria",
        "usuarios_telegram",
        "telegram_otp"
    ]

    for table in TABLES:
        try:
            # Check if table exists in sqlite
            s_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
            if not s_cur.fetchone():
                continue

            s_cur.execute(f"SELECT * FROM {table}")
            rows = s_cur.fetchall()
            if not rows:
                print(f"Tabla {table}: 0 filas en SQLite.")
                continue

            col_names = [d[0] for d in s_cur.description]
            # Convert sqlite rows to list of values
            data_rows = []
            
            # If table references equipos, get list of existing equipos in Postgres
            valid_equipos = set()
            if "equipo_id" in col_names:
                p_cur.execute('SELECT id FROM equipos')
                valid_equipos = {r[0] for r in p_cur.fetchall()}

            for r in rows:
                row_vals = []
                skip_row = False
                for idx, col in enumerate(col_names):
                    val = r[idx]
                    if col == "equipo_id" and val is not None and val not in valid_equipos:
                        skip_row = True
                        break
                    # Handle booleans
                    if col in ('activo', 'activa', 'editable', 'reporte_generado') and val is not None:
                        val = bool(val)
                    row_vals.append(val)
                if not skip_row:
                    data_rows.append(row_vals)

            cols_str = ", ".join([f'"{c}"' for c in col_names])
            placeholders = ", ".join(["%s"] * len(col_names))
            insert_sql = f'INSERT INTO "{table}" ({cols_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

            execute_batch(p_cur, insert_sql, data_rows, page_size=200)
            p_conn.commit()

            # Update serial sequence
            if "id" in [c.lower() for c in col_names]:
                try:
                    p_cur.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), coalesce((SELECT max(id) FROM \"{table}\"), 1));")
                    p_conn.commit()
                except Exception:
                    p_conn.rollback()

            print(f"✔ Tabla '{table}': {len(rows)} filas sincronizadas.")
        except Exception as e:
            p_conn.rollback()
            print(f"❌ Error en tabla '{table}': {e}")

    print("\n--- Verificación en PostgreSQL ---")
    for table in TABLES:
        try:
            p_cur.execute(f'SELECT count(*) FROM "{table}"')
            print(f"  {table}: {p_cur.fetchone()[0]} filas")
        except Exception:
            p_conn.rollback()

    s_conn.close()
    p_conn.close()
    print("\n¡Sembrado de PostgreSQL completado con éxito!")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else os.getenv("DATABASE_URL")
    seed_postgres(pg_url=url)
