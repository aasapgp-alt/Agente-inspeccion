import os
import sys
import sqlite3
import logging

sys.path.append('.')
from app.services.drive_service import get_drive_instance, subir_archivo

logger = logging.getLogger(__name__)

def sincronizar_fotos_pendientes_drive():
    print("============================================================")
    print("   SINCRONIZANDO FOTOS LOCALES CON CARPETAS DE GOOGLE DRIVE ")
    print("============================================================")
    
    db_path = 'data/inspecciones.db'
    if not os.path.exists(db_path):
        print(f"Error: No existe {db_path}")
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    drive = get_drive_instance()
    if not drive:
        print("[ERROR] No se pudo obtener conexión activa con Google Drive.")
        conn.close()
        return

    # Buscar fotos en anotaciones_imagenes que aún no tienen drive_id o subir fotos de data/fotos/
    fotos_dir = os.path.join('data', 'fotos')
    if not os.path.exists(fotos_dir):
        print("No hay carpeta data/fotos/ local.")
        conn.close()
        return

    subidas = 0
    errores = 0

    for equipo_id_str in os.listdir(fotos_dir):
        equipo_dir = os.path.join(fotos_dir, equipo_id_str)
        if not os.path.isdir(equipo_dir):
            continue
            
        try:
            equipo_id = int(equipo_id_str)
        except ValueError:
            continue

        cursor.execute("SELECT drive_folder_id, codigo, nombre FROM equipos WHERE id = ?", (equipo_id,))
        eq_row = cursor.fetchone()
        if not eq_row or not eq_row['drive_folder_id']:
            print(f"   [WARN] Equipo ID {equipo_id} no tiene carpeta de Drive vinculada. Omitiendo.")
            continue

        drive_folder_id = eq_row['drive_folder_id']
        eq_code = eq_row['codigo'] or str(equipo_id)

        for filename in os.listdir(equipo_dir):
            if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
                
            local_path = os.path.join(equipo_dir, filename)
            
            # Verificar si ya existe en anotaciones_imagenes con un drive_file_id o subida exitosa
            cursor.execute("""
                SELECT id, image_id FROM anotaciones_imagenes 
                WHERE equipo_id = ? AND (image_id = ? OR image_id LIKE '1%')
            """, (equipo_id, filename))
            row_anot = cursor.fetchone()

            # Intentar subir a Drive
            print(f" -> Subiendo {filename} del Equipo {eq_code} a carpeta Drive {drive_folder_id}...")
            res = subir_archivo(local_path, filename, drive_folder_id)
            
            if res and "id" in res:
                drive_file_id = res["id"]
                subidas += 1
                print(f"    [OK] Subido a Drive exitosamente. File ID: {drive_file_id}")
                
                # Actualizar anotaciones_imagenes
                cursor.execute("""
                    UPDATE anotaciones_imagenes 
                    SET image_id = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE equipo_id = ? AND image_id = ?
                """, (drive_file_id, equipo_id, filename))
            else:
                errores += 1
                print(f"    [ERROR] No se pudo subir {filename} a Drive.")

    conn.commit()
    conn.close()
    print(f"\nProceso finalizado. Fotos subidas: {subidas}, Errores: {errores}")
    print("============================================================\n")

if __name__ == '__main__':
    sincronizar_fotos_pendientes_drive()
