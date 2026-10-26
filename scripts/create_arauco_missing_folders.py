"""
Script para generar las carpetas faltantes de Arauco en Google Drive y vincularlas a la base de datos
====================================================================================================
Acciones:
1. [Blanqueo] Crear carpeta '28A- Cañerías asociadas PIPA D0' en '01-Blanqueo y digestion'.
2. [Química]  Mover '32A-Drenaje asociado a la linea de lavado...' desde Servicios a '02-Planta Quimica'.
3. [Química]  Crear carpeta '51- Línea agua de enfriamiento reactores de clorato. Aliment. y retorno' en '02-Planta Quimica'.
4. [Blanqueo] Crear carpeta separada '01 B- Líneas asociadas STD PIPE 421-070' en '01-Blanqueo y digestion' para la UT 2.
5. Actualizar la base de datos (equipos.drive_folder_id y drive_folders_cache).
"""

import sys
import os
import argparse
import sqlite3
import logging

sys.path.insert(0, os.path.abspath('.'))

from app.services.drive_service import (
    get_drive_instance,
    obtener_o_crear_carpeta_drive,
    buscar_carpeta
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("sync_arauco_drive")

PARENT_BLANQUEO_ID = "19T37GdbCkH18rQOWIpBZ59o75M1CaXCS"  # 01-Blanqueo y digestion
PARENT_QUIMICA_ID = "19briA_E3jJSbeWCokFMb40-hEw_Mv5-w"    # 02-Planta Quimica
PARENT_SERVICIOS_ID = "19giUohkY_agX3kGeT844Uj5ISCHl0f43"  # 03-Servicios

def sincronizar_carpetas_drive(dry_run: bool = False):
    print("=" * 80)
    print(f"SINCRONIZACIÓN DE CARPETAS DE DRIVE ARAUCO (Modo: {'SIMULACIÓN / DRY-RUN' if dry_run else 'APLICAR CAMBIOS'})")
    print("=" * 80)

    drive = get_drive_instance()
    if not drive:
        print("ERROR: No se pudo conectar a Google Drive.")
        return

    db_paths = ["data/inspecciones.db", "app/assets/seed_inspecciones.db"]
    
    operaciones = [
        {
            "id": 1,
            "tipo": "CREAR",
            "planta": "Blanque-Digestion",
            "parent_id": PARENT_BLANQUEO_ID,
            "parent_nombre": "01-Blanqueo y digestion",
            "nombre_carpeta": "28A- Cañerías asociadas PIPA D0",
            "equipo_filtro": ("Blanque-Digestion", "CAÑERÍAS ASOCIADAS PIPAS D0."),
            "subcarpetas": ["PGP 2026", "PGP 2027"]
        },
        {
            "id": 2,
            "tipo": "MOVER",
            "planta": "Quimica",
            "drive_id": "1S6IaqrqKQ8vFnfwYxYUxTAFlHvbbJKRz",
            "nuevo_parent_id": PARENT_QUIMICA_ID,
            "nombre_carpeta": "32A- Drenaje asociado a la linea de lavado coneccion a pileta colectora de efluente",
            "equipo_filtro": ("Quimica", "Drenaje asociado a la linea de lavado coneccion a pileta colectora de efluente")
        },
        {
            "id": 3,
            "tipo": "CREAR",
            "planta": "Quimica",
            "parent_id": PARENT_QUIMICA_ID,
            "parent_nombre": "02-Planta Quimica",
            "nombre_carpeta": "51- Línea agua de enfriamiento reactores de clorato. Aliment. y retorno",
            "equipo_filtro": ("Quimica", "Líneas de agua de enfriamiento a reactores de clorato. Alimentación y Retorno."),
            "subcarpetas": ["PGP 2026", "PGP 2027"]
        },
        {
            "id": 4,
            "tipo": "CREAR_SEPARADA",
            "planta": "Blanque-Digestion",
            "parent_id": PARENT_BLANQUEO_ID,
            "parent_nombre": "01-Blanqueo y digestion",
            "nombre_carpeta": "01 B- Líneas asociadas STD PIPE 421-070",
            "equipo_filtro": ("Blanque-Digestion", "LÍNEAS ASOCIADAS STD PIPE 421-070"),
            "subcarpetas": ["PGP 2026", "PGP 2027"]
        }
    ]

    for op in operaciones:
        print(f"\n[{op['id']}/4] Operación: {op['tipo']} -> '{op['nombre_carpeta']}' ({op['planta']})")
        
        folder_id = None
        
        if op['tipo'] in ("CREAR", "CREAR_SEPARADA"):
            if dry_run:
                print(f"  [DRY-RUN] Se crearía en Drive dentro de: '{op['parent_nombre']}' (ID: {op['parent_id']})")
                print(f"  [DRY-RUN] Se crearían subcarpetas: {op.get('subcarpetas', [])}")
                folder_id = f"mock_{op['id']}"
            else:
                folder_id = obtener_o_crear_carpeta_drive(op['nombre_carpeta'], op['parent_id'])
                print(f"  -> Carpeta en Drive verificada/creada con ID: {folder_id}")
                
                # Crear subcarpetas si aplica
                for sub in op.get('subcarpetas', []):
                    sub_id = obtener_o_crear_carpeta_drive(sub, folder_id)
                    print(f"     + Subcarpeta '{sub}' (ID: {sub_id})")
                    
        elif op['tipo'] == "MOVER":
            folder_id = op['drive_id']
            if dry_run:
                print(f"  [DRY-RUN] Se movería carpeta ID {folder_id} al nuevo padre ID {op['nuevo_parent_id']} (02-Planta Quimica)")
            else:
                try:
                    f = drive.CreateFile({'id': folder_id})
                    f.FetchMetadata()
                    # Mover cambiando padres
                    prev_parents = [{'id': p['id']} for p in f.get('parents', [])]
                    f['parents'] = [{'id': op['nuevo_parent_id']}]
                    f.Upload()
                    print(f"  -> Carpeta ID {folder_id} movida exitosamente a 02-Planta Quimica.")
                except Exception as e:
                    print(f"  [ADVERTENCIA] No se pudo cambiar el padre en Drive ({e}). Se conservará su ID para la vinculación.")

        # Vincular en base de datos
        if not dry_run and folder_id:
            ubi_nombre, eq_nombre = op['equipo_filtro']
            for db_p in db_paths:
                if not os.path.exists(db_p):
                    continue
                conn = sqlite3.connect(db_p)
                cur = conn.cursor()
                
                # Buscar ID del equipo
                cur.execute("""
                    SELECT e.id FROM equipos e
                    JOIN ubicaciones u ON e.ubicacion_id = u.id
                    JOIN empresas emp ON u.empresa_id = emp.id
                    WHERE emp.nombre = 'Arauco' AND u.nombre = ? AND e.nombre = ?
                """, (ubi_nombre, eq_nombre))
                eq_row = cur.fetchone()
                
                if eq_row:
                    eq_id = eq_row[0]
                    cur.execute("UPDATE equipos SET drive_folder_id = ? WHERE id = ?", (folder_id, eq_id))
                    
                    # Actualizar drive_folders_cache según columnas existentes
                    cur.execute("PRAGMA table_info(drive_folders_cache)")
                    cols = [c[1] for c in cur.fetchall()]
                    has_path = 'path_completo' in cols
                    
                    if has_path:
                        cur.execute("""
                            INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, path_completo, updated_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT (drive_id) DO UPDATE SET
                                nombre = EXCLUDED.nombre,
                                parent_id = EXCLUDED.parent_id,
                                path_completo = EXCLUDED.path_completo,
                                updated_at = CURRENT_TIMESTAMP
                        """, (
                            folder_id,
                            op['nombre_carpeta'],
                            op.get('parent_id') or op.get('nuevo_parent_id'),
                            f"{op.get('parent_nombre', 'Arauco')} / {op['nombre_carpeta']}"
                        ))
                    else:
                        cur.execute("""
                            INSERT INTO drive_folders_cache (drive_id, nombre, parent_id, updated_at)
                            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT (drive_id) DO UPDATE SET
                                nombre = EXCLUDED.nombre,
                                parent_id = EXCLUDED.parent_id,
                                updated_at = CURRENT_TIMESTAMP
                        """, (
                            folder_id,
                            op['nombre_carpeta'],
                            op.get('parent_id') or op.get('nuevo_parent_id')
                        ))
                    conn.commit()
                    print(f"  -> DB '{db_p}': Equipo ID {eq_id} ('{eq_nombre}') vinculado a carpeta {folder_id}.")
                else:
                    print(f"  [ADVERTENCIA] No se encontró el equipo '{eq_nombre}' en {db_p}")
                conn.close()

    print("\n" + "=" * 80)
    print("PROCESO FINALIZADO CON ÉXITO")
    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generar y vincular carpetas Drive Arauco")
    parser.add_argument("--dry-run", action="store_true", help="Simulación sin cambios")
    args = parser.parse_args()
    
    sincronizar_carpetas_drive(dry_run=args.dry_run)
