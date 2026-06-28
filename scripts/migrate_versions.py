import sqlite3
import os
import re
import sys

# Add root folder to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def migrate():
    db_path = settings.DB_PATH
    print(f"Iniciando migración de versiones en la base de datos: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: La base de datos no existe en {db_path}")
        return
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # 1. Crear la tabla versiones_reportes si no existe
        print("Creando tabla versiones_reportes...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS versiones_reportes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL, -- 'individual' o 'libro'
            reporte_id INTEGER NOT NULL, -- ID del reporte en la tabla 'reportes' o 'libros'
            version INTEGER NOT NULL,
            ruta_pdf_local TEXT,
            ruta_pdf_drive TEXT,
            drive_file_id TEXT,
            fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario_id INTEGER,
            notas TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
        );
        """)
        
        # 2. Comprobar si ya existen registros en versiones_reportes
        cursor.execute("SELECT COUNT(*) FROM versiones_reportes")
        count = cursor.fetchone()[0]
        
        if count > 0:
            print(f"La tabla versiones_reportes ya contiene {count} registros. Omitiendo migración inicial.")
        else:
            print("Migrando reportes individuales existentes...")
            # Obtener reportes
            cursor.execute("SELECT * FROM reportes")
            reportes = cursor.fetchall()
            print(f"Se encontraron {len(reportes)} reportes individuales para migrar.")
            
            for rep in reportes:
                drive_url = rep['ruta_pdf_drive']
                drive_file_id = None
                if drive_url and 'drive.google.com' in drive_url:
                    # Extraer ID del enlace de drive
                    match = re.search(r'/d/([a-zA-Z0-9_-]+)', drive_url)
                    if match:
                        drive_file_id = match.group(1)
                
                cursor.execute("""
                    INSERT INTO versiones_reportes (
                        tipo, reporte_id, version, ruta_pdf_local, ruta_pdf_drive, 
                        drive_file_id, fecha_generacion, usuario_id, notas
                    ) VALUES ('individual', ?, 1, ?, ?, ?, ?, ?, 'Versión inicial migrada')
                """, (
                    rep['id'],
                    rep['ruta_pdf_local'],
                    drive_url,
                    drive_file_id,
                    rep['fecha_generacion'],
                    rep['usuario_id']
                ))
            
            print("Migrando libros por área existentes...")
            # Obtener libros
            cursor.execute("SELECT * FROM libros")
            libros = cursor.fetchall()
            print(f"Se encontraron {len(libros)} libros para migrar.")
            
            for lib in libros:
                cursor.execute("""
                    INSERT INTO versiones_reportes (
                        tipo, reporte_id, version, ruta_pdf_local, ruta_pdf_drive, 
                        drive_file_id, fecha_generacion, usuario_id, notas
                    ) VALUES ('libro', ?, 1, ?, ?, ?, ?, ?, 'Versión inicial migrada')
                """, (
                    lib['id'],
                    lib['ruta_pdf_local'],
                    lib['ruta_pdf_drive'],
                    lib['drive_file_id'],
                    lib['fecha_generacion'],
                    lib['usuario_id']
                ))
                
            conn.commit()
            print("¡Migración inicial completada exitosamente!")
            
    except Exception as e:
        conn.rollback()
        print(f"Error durante la migración: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
