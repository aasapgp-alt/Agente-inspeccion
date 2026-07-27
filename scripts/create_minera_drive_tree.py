import sys
import os
import sqlite3
import logging

sys.path.append(os.path.abspath('.'))

from app.services.drive_service import get_drive_instance, obtener_o_crear_carpeta_drive
from app.services.db_service import get_db_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("drive_tree_minera")

ROOT_DRIVE_FOLDER_ID = "1q8uPD1A6cEjtu79SyYs60Wsiur7sMATT"
EMPRESA_ID = 170

def crear_arbol_drive_minera():
    print(f"Iniciando creación de árbol de carpetas en Google Drive (Raíz: {ROOT_DRIVE_FOLDER_ID})...")
    
    drive = get_drive_instance()
    if not drive:
        print("ERROR: No se pudo autenticar con Google Drive.")
        return

    # 1. Obtener ubicaciones y equipos de Minera del Altiplano S.A.
    conn = sqlite3.connect('data/inspecciones.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, nombre, codigo FROM ubicaciones WHERE empresa_id = ?", (EMPRESA_ID,))
    ubicaciones = [dict(r) for r in cursor.fetchall()]
    
    print(f"Se encontraron {len(ubicaciones)} ubicaciones técnicas para Minera del Altiplano S.A.")
    
    # Campañas iniciales
    campanias = ["PGP 2024", "PGP 2026"]
    subcarpetas_campania = ["Fotos_e_Imagenes", "Documentos_y_Reportes"]
    
    total_carpetas_creadas = 0
    
    for u_idx, u in enumerate(ubicaciones, 1):
        u_id = u['id']
        u_nombre = u['nombre']
        u_codigo = u['codigo']
        
        area_folder_title = f"{str(u_idx).zfill(2)}- {u_nombre}"
        print(f"\n[Área {u_idx}/{len(ubicaciones)}] Creando/verificando carpeta de área: '{area_folder_title}'...")
        
        area_drive_id = obtener_o_crear_carpeta_drive(area_folder_title, ROOT_DRIVE_FOLDER_ID)
        print(f"  -> Área Drive ID: {area_drive_id}")
        
        # Actualizar drive_folder_id en la base de datos
        cursor.execute("UPDATE ubicaciones SET drive_folder_id = ? WHERE id = ?", (area_drive_id, u_id))
        conn.commit()
        total_carpetas_creadas += 1
        
        # Obtener equipos de esta ubicación
        cursor.execute("SELECT id, codigo, nombre FROM equipos WHERE ubicacion_id = ?", (u_id,))
        equipos = [dict(r) for r in cursor.fetchall()]
        
        for eq_idx, eq in enumerate(equipos, 1):
            eq_tag = eq['codigo']
            eq_nombre = eq['nombre']
            
            eq_folder_title = f"{str(eq_idx).zfill(2)}- {eq_tag} {eq_nombre}"
            print(f"    [Equipo {eq_idx}/{len(equipos)}] '{eq_folder_title}'...")
            
            eq_drive_id = obtener_o_crear_carpeta_drive(eq_folder_title, area_drive_id)
            total_carpetas_creadas += 1
            
            # Crear carpetas de Campañas (Paradas Anuales) dentro de cada equipo
            for camp in campanias:
                camp_drive_id = obtener_o_crear_carpeta_drive(camp, eq_drive_id)
                total_carpetas_creadas += 1
                
                # Subcarpetas para imágenes y documentos
                for sub in subcarpetas_campania:
                    sub_id = obtener_o_crear_carpeta_drive(sub, camp_drive_id)
                    total_carpetas_creadas += 1

    conn.close()
    print("\n¡ÁRBOL DE CARPETAS EN GOOGLE DRIVE CREADO EXITOSAMENTE!")
    print(f"Total de carpetas verificadas/creadas: {total_carpetas_creadas}")

if __name__ == "__main__":
    crear_arbol_drive_minera()
