"""
Script de Migración y Cálculo de Path Completo Concatenado
==========================================================
1. Agrega la columna `path_completo` a `drive_folders_cache` si no existe.
2. Calcula de forma recursiva la ruta concatenada completa (breadcrumb) para todas las carpetas.
3. Corrige las vinculaciones de equipos padre / sub-secciones (431-433, 431-403, 431-402).
"""

import sys
from app.core.db import get_db_connection

def run_migration():
    print("Iniciando migración de jerarquía multi-nivel y path completo...")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Agregar columna path_completo si no existe
        try:
            cursor.execute("ALTER TABLE drive_folders_cache ADD COLUMN path_completo TEXT")
            conn.commit()
            print("Columna 'path_completo' añadida exitosamente a 'drive_folders_cache'.")
        except Exception as e:
            # En SQLite o Postgres si ya existe puede arrojar error o warning
            print(f"Columna 'path_completo' ya existe o información: {e}")
            
        # 2. Obtener todas las carpetas en memoria para calcular el grafo
        cursor.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache")
        folders = {r['drive_id']: {'nombre': r['nombre'], 'parent_id': r['parent_id']} for r in cursor.fetchall()}
        print(f"Cargadas {len(folders)} carpetas de caché para calcular rutas.")
        
        def calculate_full_path(f_id):
            parts = []
            curr = f_id
            visited = set()
            while curr in folders and curr not in visited:
                visited.add(curr)
                name = folders[curr]['nombre'] or ''
                parts.append(name.strip())
                curr = folders[curr]['parent_id']
            return ' / '.join(reversed(parts))
            
        # 3. Actualizar path_completo para cada carpeta
        updates = []
        for f_id in folders:
            full_path = calculate_full_path(f_id)
            updates.append((full_path, f_id))
            
        print(f"Actualizando {len(updates)} rutas completas en base de datos...")
        cursor.executemany("UPDATE drive_folders_cache SET path_completo = ? WHERE drive_id = ?", updates)
        conn.commit()
        print("Rutas completas actualizadas en caché.")
        
        # 4. Corregir mapeo de equipos específicos
        fixes = [
            (176, '1Bkq6N5R7-kaS7USN1mnPfWRN5bliVVUe', 'IMPULSIÓN BOMBA 431- 433 -> 06-431-433'),
            (177, '1Bkq6N5R7-kaS7USN1mnPfWRN5bliVVUe', 'SUCCIÓN BOMBA 431-433 -> 06-431-433'),
            (165, '1BJLDvHhJBIEMgWEkToADe9MUZ-50-s7p', 'SUCCIÓN BOMBA 431-403 -> 02- 431-403'),
            (166, '1BJLDvHhJBIEMgWEkToADe9MUZ-50-s7p', 'IMPULSIÓN BOMBA 431- 403 -> 02- 431-403'),
            (168, '1BZiZ0Z3I9zb1n8o5b5l5bECAC-XbXsun', 'IMPULSIÓN BOMBA 431- 402 -> 03- 431-402'),
            (169, '1BZiZ0Z3I9zb1n8o5b5l5bECAC-XbXsun', 'SUCCIÓN BOMBA 431- 402 -> 03- 431-402'),
        ]
        
        for eq_id, folder_id, desc in fixes:
            cursor.execute("UPDATE equipos SET drive_folder_id = ? WHERE id = ?", (folder_id, eq_id))
            print(f"  [FIX] Equipo {eq_id}: {desc}")
            
        conn.commit()
        print("\n¡Migración completada exitosamente!")
        
        # Validar
        cursor.execute("SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE id IN (176, 177, 165, 166, 168, 169)")
        print("\nEquipos validados:")
        for r in cursor.fetchall():
            cursor2 = conn.cursor()
            cursor2.execute("SELECT nombre, path_completo FROM drive_folders_cache WHERE drive_id = ?", (r['drive_folder_id'],))
            fc = cursor2.fetchone()
            p = fc['path_completo'] if fc else 'N/A'
            print(f"  ID {r['id']} ({r['nombre']}) -> Folder: {fc['nombre'] if fc else 'N/A'}")
            print(f"     Path: {p}")

if __name__ == "__main__":
    run_migration()
