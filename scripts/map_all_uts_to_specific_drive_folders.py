"""
Script de Diagnóstico y Mapeo Masivo de UTs a Carpetas Específicas de Drive
========================================================================
Recorre todos los equipos de la base de datos (Arauco, Minera del Altiplano, etc.),
analiza su jerarquía en drive_folders_cache y verifica que cada activo esté vinculado
a su carpeta más específica (ej: Succión vs Impulsión vs Equipo General).
"""

import sys, os
sys.path.insert(0, os.path.abspath('.'))

from app.core.db import get_db_connection
from app.services.drive_service import obtener_evidencia_equipo

def main():
    print("=" * 80)
    print("INICIANDO ANÁLISIS GLOBAL DE TODAS LAS UTs Y SUS CARPETAS DE DRIVE")
    print("=" * 80)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute("""
            SELECT e.id, e.codigo, e.nombre, e.drive_folder_id, e.ubicacion_id, 
                   u.nombre as ubicacion_nombre, emp.nombre as empresa_nombre
            FROM equipos e
            LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            ORDER BY emp.nombre, u.nombre, e.id
        """)
        equipos = [dict(r) for r in cur.fetchall()]

    print(f"Total de equipos en la base de datos: {len(equipos)}")

    empresas = {}
    for eq in equipos:
        emp = eq.get("empresa_nombre") or "Sin Empresa"
        empresas.setdefault(emp, []).append(eq)

    print("\nDistribución por Planta / Empresa:")
    for emp, lista in empresas.items():
        print(f" - {emp}: {len(lista)} equipos")

    sin_drive = [e for e in equipos if not e.get("drive_folder_id")]
    print(f"\nEquipos sin carpeta vinculada: {len(sin_drive)}")
    if sin_drive:
        for s in sin_drive[:10]:
            print(f"   * [{s['empresa_nombre']}] ID {s['id']} | {s['codigo']} | {s['nombre']}")

    con_drive = [e for e in equipos if e.get("drive_folder_id")]
    print(f"Equipos con carpeta vinculada: {len(con_drive)}")

    # Análisis de subsecciones (Succión / Impulsión / Ventiladores / etc.)
    sub_equipos = [e for e in equipos if any(w in (e.get("nombre") or "").lower() for w in ["succion", "succión", "impulsion", "impulsión"])]
    print(f"\nEquipos con sub-sección identificable (Succión / Impulsión): {len(sub_equipos)}")
    for se in sub_equipos[:10]:
        print(f"   * ID {se['id']} | {se['nombre']} | Drive: {se['drive_folder_id']}")

    print("\n" + "=" * 80)
    print("FIN DEL DIAGNÓSTICO PRELIMINAR")
    print("=" * 80)

if __name__ == '__main__':
    main()
