import sqlite3
import os
import re

def sync_md_to_db(db_path='data/inspecciones.db', md_path='docs/CRUCE_EQUIPOS_LOCACIONES_DRIVE.md'):
    print(f"Iniciando migración e ingesta desde {md_path} hacia {db_path}...")
    
    if not os.path.exists(db_path):
        print(f"ERROR: No se encontró la base de datos en {db_path}")
        return False
        
    if not os.path.exists(md_path):
        print(f"ERROR: No se encontró el archivo markdown en {md_path}")
        return False
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # 1. Asegurar la existencia de la columna drive_folder_id en la tabla equipos
    cursor.execute("PRAGMA table_info(equipos)")
    columns = [col[1] for col in cursor.fetchall()]
    if 'drive_folder_id' not in columns:
        print("Añadiendo columna 'drive_folder_id' (TEXT) a la tabla 'equipos'...")
        cursor.execute("ALTER TABLE equipos ADD COLUMN drive_folder_id TEXT")
        conn.commit()
    else:
        print("La columna 'drive_folder_id' ya existe en la tabla 'equipos'.")

    # 2. Leer y parsear el archivo CRUCE_EQUIPOS_LOCACIONES_DRIVE.md
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    ubicaciones_updated = 0
    equipos_updated = 0
    cache_entries = 0

    current_section = None
    current_ubicacion = None

    for line in lines:
        line_str = line.strip()

        # Parsear tabla de Ubicaciones Generales
        # Ejemplo: | `5` | **Arauco** | Quimica | `-` | `19briA_E3jJSbeWCokFMb40-hEw_Mv5-w` | `INSP PGP INFORMES Y MINUTA / 02-Planta Quimica` |
        if line_str.startswith('| `') and '| **' in line_str and '`INSP' in line_str or '`Inspector_IA' in line_str or '`1' in line_str:
            parts = [p.strip().strip('`') for p in line_str.split('|')[1:-1]]
            if len(parts) >= 6:
                try:
                    u_id = int(parts[0])
                    u_empresa = parts[1].replace('*', '').strip()
                    u_nombre = parts[2]
                    u_code = parts[3] if parts[3] != '-' else None
                    u_drive_id = parts[4]
                    u_ruta = parts[5]

                    if u_drive_id and u_drive_id != '?':
                        cursor.execute("UPDATE ubicaciones SET drive_folder_id = ? WHERE id = ?", (u_drive_id, u_id))
                        ubicaciones_updated += 1

                        # Actualizar/Insertar en drive_folders_cache
                        last_folder_name = u_ruta.split('/')[-1].strip()
                        cursor.execute("""
                            INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                        """, (u_drive_id, last_folder_name, None))
                        cache_entries += 1
                except Exception as err:
                    pass

        # Parsear tabla de Equipos Detallada
        # Ejemplo: | `225` | `123` | Impulsión Bomba 621-409/410/411 | ACR | `01-Linea Cl O2. Imp. y suc. Bbas. 621-409-410-411` | `19nTZpz2l36F3LDwQOuh1WoPSIsMzQOgK` | ✅ Vinculado |
        if line_str.startswith('| `') and ('✅ Vinculado' in line_str or '❓' in line_str or '`1' in line_str or '`0' in line_str or '`-' in line_str):
            parts = [p.strip().strip('`') for p in line_str.split('|')[1:-1]]
            if len(parts) >= 7:
                try:
                    eq_id_str = parts[0]
                    if eq_id_str.isdigit():
                        eq_id = int(eq_id_str)
                        eq_code = parts[1]
                        eq_nombre = parts[2]
                        eq_mat = parts[3]
                        eq_folder_title = parts[4]
                        eq_drive_id = parts[5]
                        eq_estado = parts[6]

                        if eq_drive_id and eq_drive_id != '?':
                            cursor.execute("UPDATE equipos SET drive_folder_id = ? WHERE id = ?", (eq_drive_id, eq_id))
                            equipos_updated += 1

                            # Actualizar/Insertar en drive_folders_cache
                            cursor.execute("SELECT ubicacion_id FROM equipos WHERE id = ?", (eq_id,))
                            row = cursor.fetchone()
                            parent_drive_id = None
                            if row:
                                u_id = row['ubicacion_id']
                                cursor.execute("SELECT drive_folder_id FROM ubicaciones WHERE id = ?", (u_id,))
                                u_row = cursor.fetchone()
                                if u_row:
                                    parent_drive_id = u_row['drive_folder_id']

                            cursor.execute("""
                                INSERT OR REPLACE INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            """, (eq_drive_id, eq_folder_title, parent_drive_id))
                            cache_entries += 1
                except Exception as err:
                    pass

    conn.commit()
    conn.close()

    print("\n¡MIGRACIÓN Y MAPPING COMPLETADOS EXITOSAMENTE!")
    print(f"- Ubicaciones actualizadas con drive_folder_id: {ubicaciones_updated}")
    print(f"- Equipos actualizados con drive_folder_id: {equipos_updated}")
    print(f"- Registros sincronizados en drive_folders_cache: {cache_entries}")
    return True

if __name__ == "__main__":
    sync_md_to_db()
