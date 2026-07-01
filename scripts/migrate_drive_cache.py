import sqlite3
import os
import sys

# Añadir el directorio raíz al path para poder importar módulos de app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def migrate():
    print(f"Iniciando migración de caché de Drive en: {settings.DB_PATH}")
    if not os.path.exists(settings.DB_PATH):
        print("La base de datos no existe.")
        return

    conn = sqlite3.connect(settings.DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("Creando tabla drive_folders_cache...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS drive_folders_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drive_id TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            parent_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        print("Creando índices para drive_folders_cache...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drive_folders_drive_id ON drive_folders_cache(drive_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drive_folders_parent_id ON drive_folders_cache(parent_id)")
        
        conn.commit()
        print("¡Migración de caché de Drive completada con éxito!")
    except Exception as e:
        conn.rollback()
        print(f"Error durante la migración: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
