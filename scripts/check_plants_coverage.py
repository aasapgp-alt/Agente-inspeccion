import sys
from app.core.db import get_db_connection

def check_coverage():
    with get_db_connection() as conn:
        c = conn.cursor()
        
        # 1. Check ubicaciones by empresa
        c.execute("""
            SELECT COALESCE(emp.nombre, 'Sin Empresa') as empresa, 
                   COUNT(DISTINCT u.id) as total_ubicaciones, 
                   COUNT(DISTINCT e.id) as total_equipos, 
                   COUNT(DISTINCT CASE WHEN e.drive_folder_id IS NOT NULL THEN e.id END) as equipos_con_drive
            FROM ubicaciones u
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            LEFT JOIN equipos e ON e.ubicacion_id = u.id
            GROUP BY emp.nombre
        """)
        print("--- RESUMEN POR EMPRESA / PLANTA ---")
        for r in c.fetchall():
            print(dict(r))
            
        # 2. Check path_completo in drive_folders_cache
        c.execute("""
            SELECT COUNT(*) as total_carpetas, 
                   SUM(CASE WHEN path_completo IS NOT NULL AND path_completo != '' THEN 1 ELSE 0 END) as con_path
            FROM drive_folders_cache
        """)
        print("\n--- RESUMEN EN DRIVE_FOLDERS_CACHE ---")
        print(dict(c.fetchone()))
        
        # 3. Check areas under each empresa
        c.execute("""
            SELECT u.id, COALESCE(emp.nombre, 'Sin Empresa') as empresa, u.nombre, u.drive_folder_id, COUNT(e.id) as num_equipos
            FROM ubicaciones u
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            LEFT JOIN equipos e ON e.ubicacion_id = u.id
            GROUP BY u.id, emp.nombre, u.nombre, u.drive_folder_id
            ORDER BY emp.nombre, u.id
        """)
        print("\n--- AREAS / UBICACIONES REGISTRADAS Y VINCULADAS ---")
        for r in c.fetchall():
            print(f"[{r['empresa']}] ID {r['id']} - {r['nombre']} ({r['num_equipos']} equipos) -> Drive: {r['drive_folder_id']}")

        # 4. Check multi-level subfolders across all areas
        c.execute("""
            SELECT DISTINCT c.path_completo
            FROM drive_folders_cache c
            WHERE c.path_completo IS NOT NULL
            ORDER BY RANDOM()
            LIMIT 15
        """)
        print("\n--- MUESTRA DE RUTAS CONCATENADAS EN DISTINTAS AREAS/PLANTAS ---")
        for r in c.fetchall():
            print(f"Path: {r['path_completo']}")

if __name__ == "__main__":
    check_coverage()
