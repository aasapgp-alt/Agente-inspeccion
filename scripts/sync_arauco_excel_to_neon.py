"""
Script de Sincronización y Actualización de Inspecciones Arauco (Excel -> DB Local / Neon)
===========================================================================================
Lee el archivo Excel '00_AASA MINUTA PGP.xlsx', procesa los datos históricos de 2023,
2024 y las inspecciones completadas del 2026, preserva los enlaces y metadatos de
Google Drive (drive_file_id, ruta_pdf_drive, drive_folder_id), y actualiza la base de datos
de forma transaccional y segura.
"""

import os
import sys
import re
import argparse
import sqlite3
import pandas as pd
from typing import Dict, List, Any, Optional

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def clean_text(s: Any) -> str:
    """Limpia cadenas de texto, elimina espacios duplicados y caracteres espurios (\xad)."""
    if s is None or pd.isna(s):
        return ""
    text = str(s).replace('\xad', '').replace('\u200b', '').strip()
    text = re.sub(r'[\r\n]+', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

def normalize_for_match(s: str) -> str:
    """Normaliza para comparación eliminando tildes, puntuación y espacios."""
    if not s:
        return ""
    s = s.lower()
    s = s.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
    s = re.sub(r'[^a-z0-9]', '', s)
    return s

def clean_state(val: Any) -> str:
    """Normaliza los estados a los valores canónicos del sistema."""
    s = clean_text(val).upper()
    if not s:
        return "PENDIENTE"
    if "BUENO" in s:
        return "BUENO"
    if "REGULAR" in s:
        return "REGULAR"
    if "CRIT" in s or "CRÍT" in s:
        return "CRITICO"
    if "FUERA" in s:
        return "FUERA DE RUTA"
    return "PENDIENTE"

def load_excel_data(excel_path: str) -> Dict[str, List[Dict[str, Any]]]:
    """Carga y estructura todas las hojas del archivo Excel de Arauco."""
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Archivo no encontrado: {excel_path}")
        
    xls = pd.ExcelFile(excel_path)
    structured_data = {}
    
    sheet_mappings = [
        ('BLANQUEO', 'Blanque-Digestion'),
        ('QU', 'Quimica'),
        ('SERV', 'Servicios')
    ]
    
    for sheet_name in xls.sheet_names:
        ubi_name = None
        for pattern, mapped_ubi in sheet_mappings:
            if pattern in sheet_name.upper():
                ubi_name = mapped_ubi
                break
        if not ubi_name:
            continue
            
        df = pd.read_excel(excel_path, sheet_name=sheet_name)
        col_eq = [c for c in df.columns if 'nea' in str(c).lower() or 'equipo' in str(c).lower()][0]
        col_crit = [c for c in df.columns if 'criticidad' in str(c).lower()][0] if any('criticidad' in str(c).lower() for c in df.columns) else None
        col_mat = [c for c in df.columns if 'material' in str(c).lower()][0] if any('material' in str(c).lower() for c in df.columns) else None
        
        # Columnas 2023
        c_est_23 = [c for c in df.columns if 'estado' in str(c).lower() and '2023' in str(c)]
        c_act_23 = [c for c in df.columns if 'accion' in str(c).lower() and '2023' in str(c)]
        c_diag_23 = [c for c in df.columns if ('diagn' in str(c).lower() or 'observ' in str(c).lower()) and '2023' in str(c)]
        c_rec_23 = [c for c in df.columns if 'recom' in str(c).lower() and '2024' in str(c)]
        
        # Columnas 2024
        c_est_24 = [c for c in df.columns if 'estado' in str(c).lower() and '2024' in str(c)]
        c_act_24 = [c for c in df.columns if 'accion' in str(c).lower() and '2024' in str(c)]
        c_diag_24 = [c for c in df.columns if 'diagn' in str(c).lower() and '2024' in str(c)]
        c_rec_24 = [c for c in df.columns if 'recom' in str(c).lower() and '2025' in str(c)]
        
        # Columnas 2026
        c_est_26 = [c for c in df.columns if 'estado' in str(c).lower() and '2026' in str(c)]
        c_act_26 = [c for c in df.columns if 'accion' in str(c).lower() and '2026' in str(c)]
        c_diag_26 = [c for c in df.columns if 'diagn' in str(c).lower() and '2026' in str(c)]
        c_rec_26 = [c for c in df.columns if 'recom' in str(c).lower() and '2027' in str(c)]
        
        items = []
        for idx, row in df.iterrows():
            eq_nombre = clean_text(row[col_eq])
            if not eq_nombre:
                continue
                
            criticidad = clean_text(row[col_crit]) if col_crit else ""
            material = clean_text(row[col_mat]) if col_mat else ""
            
            # Datos 2023
            est_23 = clean_state(row[c_est_23[0]]) if c_est_23 else "PENDIENTE"
            act_23 = clean_text(row[c_act_23[0]]) if c_act_23 else ""
            diag_23 = clean_text(row[c_diag_23[0]]) if c_diag_23 else ""
            rec_23 = clean_text(row[c_rec_23[0]]) if c_rec_23 else ""
            
            # Datos 2024
            est_24 = clean_state(row[c_est_24[0]]) if c_est_24 else "PENDIENTE"
            act_24 = clean_text(row[c_act_24[0]]) if c_act_24 else ""
            diag_24 = clean_text(row[c_diag_24[0]]) if c_diag_24 else ""
            rec_24 = clean_text(row[c_rec_24[0]]) if c_rec_24 else ""
            
            # Datos 2026
            est_26 = clean_state(row[c_est_26[0]]) if c_est_26 else "PENDIENTE"
            act_26 = clean_text(row[c_act_26[0]]) if c_act_26 else ""
            diag_26 = clean_text(row[c_diag_26[0]]) if c_diag_26 else ""
            rec_26 = clean_text(row[c_rec_26[0]]) if c_rec_26 else ""
            
            estado_actual = est_26 if est_26 != "PENDIENTE" else (est_24 if est_24 != "PENDIENTE" else est_23)
            
            items.append({
                'row_index': idx + 1,
                'nombre': eq_nombre,
                'criticidad': criticidad,
                'material': material,
                'estado_actual': estado_actual,
                'inspecciones': {
                    2023: {'estado': est_23, 'acciones': act_23, 'diagnostico': diag_23, 'recomendaciones': rec_23},
                    2024: {'estado': est_24, 'acciones': act_24, 'diagnostico': diag_24, 'recomendaciones': rec_24},
                    2026: {'estado': est_26, 'acciones': act_26, 'diagnostico': diag_26, 'recomendaciones': rec_26}
                }
            })
            
        structured_data[ubi_name] = items
        print(f"Hoja '{sheet_name}' -> Ubicación '{ubi_name}': {len(items)} equipos leídos.")
        
    return structured_data

def sync_database(target: str = "dry-run"):
    excel_path = "00_AASA MINUTA PGP.xlsx"
    print(f"\n==================================================================")
    print(f"INICIANDO SINCRONIZACIÓN ARAUCO (Modo: {target.upper()})")
    print(f"==================================================================")
    
    excel_data = load_excel_data(excel_path)
    total_equipos_excel = sum(len(eqs) for eqs in excel_data.values())
    print(f"Total equipos en Excel: {total_equipos_excel}")
    
    if target == "dry-run":
        print("\n[DRY RUN] Verificación completada exitosamente. No se realizaron cambios en la base de datos.")
        return
        
    if target == "local":
        db_paths = ["data/inspecciones.db", "app/assets/seed_inspecciones.db"]
        for db_file in db_paths:
            if not os.path.exists(db_file):
                print(f"Advertencia: {db_file} no existe, omitiendo.")
                continue
            print(f"\nProcesando base de datos SQLite local: {db_file}")
            _sync_sqlite(db_file, excel_data)
            
    elif target == "neon":
        print("\nProcesando base de datos Neon PostgreSQL...")
        _sync_postgres(excel_data)

def _sync_sqlite(db_path: str, excel_data: Dict[str, List[Dict[str, Any]]]):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM empresas WHERE nombre = 'Arauco'")
        emp_row = cursor.fetchone()
        if not emp_row:
            cursor.execute("INSERT INTO empresas (nombre, descripcion) VALUES ('Arauco', 'Empresa Arauco')")
            empresa_id = cursor.lastrowid
        else:
            empresa_id = emp_row['id']
            
        total_equipos_updated = 0
        total_equipos_created = 0
        total_inspecciones_sync = 0
        drive_ids_preserved = 0
        
        code_offsets = {
            'Blanque-Digestion': 1,
            'Quimica': 123,
            'Servicios': 223
        }
        
        for ubi_name, items in excel_data.items():
            cursor.execute("SELECT id, drive_folder_id FROM ubicaciones WHERE empresa_id = ? AND nombre = ?", (empresa_id, ubi_name))
            ubi_row = cursor.fetchone()
            if not ubi_row:
                cursor.execute("INSERT INTO ubicaciones (empresa_id, nombre) VALUES (?, ?)", (empresa_id, ubi_name))
                ubi_id = cursor.lastrowid
            else:
                ubi_id = ubi_row['id']
                
            cursor.execute("UPDATE equipos SET codigo = 'TMP_' || id WHERE ubicacion_id = ?", (ubi_id,))
                
            cursor.execute("SELECT id, codigo, nombre FROM equipos WHERE ubicacion_id = ? ORDER BY id", (ubi_id,))
            existing_equipos = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("""
                SELECT i.equipo_id, i.anio, i.drive_file_id, i.ruta_pdf_drive, i.reporte_generado,
                       i.fecha_generacion_reporte, i.tipo_reporte, i.numero_acta, i.estado_generacion
                FROM inspecciones i
                JOIN equipos eq ON i.equipo_id = eq.id
                WHERE eq.ubicacion_id = ?
            """, (ubi_id,))
            drive_meta_map = {(r['equipo_id'], r['anio']): dict(r) for r in cursor.fetchall()}
            
            base_offset = code_offsets.get(ubi_name, 1)
            used_existing_ids = set()
            
            for idx, item in enumerate(items):
                assigned_code = str(base_offset + idx)
                eq_nombre = item['nombre']
                norm_eq_name = normalize_for_match(eq_nombre)
                
                # 1. Buscar coincidencia exacta o normalizada
                matched_id = None
                for ex_eq in existing_equipos:
                    if ex_eq['id'] in used_existing_ids:
                        continue
                    if normalize_for_match(ex_eq['nombre']) == norm_eq_name:
                        matched_id = ex_eq['id']
                        used_existing_ids.add(matched_id)
                        break
                        
                # 2. Si no coincide exacto, buscar si el nombre existente empieza con el nombre nuevo (caso de nombres concatenados)
                if not matched_id:
                    for ex_eq in existing_equipos:
                        if ex_eq['id'] in used_existing_ids:
                            continue
                        ex_norm = normalize_for_match(ex_eq['nombre'])
                        if ex_norm.startswith(norm_eq_name) or norm_eq_name.startswith(ex_norm):
                            matched_id = ex_eq['id']
                            used_existing_ids.add(matched_id)
                            break
                    
                if matched_id:
                    cursor.execute("""
                        UPDATE equipos 
                        SET nombre = ?, codigo = ?, material = ?, criticidad = ?, estado_actual = ?, activo = 1
                        WHERE id = ?
                    """, (eq_nombre, assigned_code, item['material'], item['criticidad'], item['estado_actual'], matched_id))
                    equipo_id = matched_id
                    total_equipos_updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO equipos (ubicacion_id, codigo, nombre, material, criticidad, estado_actual, activo)
                        VALUES (?, ?, ?, ?, ?, ?, 1)
                    """, (ubi_id, assigned_code, eq_nombre, item['material'], item['criticidad'], item['estado_actual']))
                    equipo_id = cursor.lastrowid
                    total_equipos_created += 1
                    
                # Sincronizar inspecciones (2023, 2024, 2026)
                for anio, insp_data in item['inspecciones'].items():
                    prev_meta = drive_meta_map.get((equipo_id, anio), {})
                    drive_file_id = prev_meta.get('drive_file_id')
                    ruta_pdf_drive = prev_meta.get('ruta_pdf_drive')
                    reporte_generado = prev_meta.get('reporte_generado', 0)
                    fecha_gen = prev_meta.get('fecha_generacion_reporte')
                    tipo_rep = prev_meta.get('tipo_reporte')
                    num_acta = prev_meta.get('numero_acta')
                    est_gen = prev_meta.get('estado_generacion')
                    
                    if drive_file_id:
                        drive_ids_preserved += 1
                        
                    cursor.execute("SELECT id FROM inspecciones WHERE equipo_id = ? AND anio = ?", (equipo_id, anio))
                    insp_row = cursor.fetchone()
                    
                    if insp_row:
                        cursor.execute("""
                            UPDATE inspecciones
                            SET estado = ?, acciones = ?, diagnostico = ?, recomendaciones = ?,
                                drive_file_id = COALESCE(?, drive_file_id),
                                ruta_pdf_drive = COALESCE(?, ruta_pdf_drive),
                                reporte_generado = COALESCE(?, reporte_generado),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = ?
                        """, (
                            insp_data['estado'], insp_data['acciones'], insp_data['diagnostico'], insp_data['recomendaciones'],
                            drive_file_id, ruta_pdf_drive, reporte_generado, insp_row['id']
                        ))
                    else:
                        cursor.execute("""
                            INSERT INTO inspecciones (
                                equipo_id, anio, estado, acciones, diagnostico, recomendaciones,
                                drive_file_id, ruta_pdf_drive, reporte_generado, fecha_generacion_reporte,
                                tipo_reporte, numero_acta, estado_generacion, created_at, updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """, (
                            equipo_id, anio, insp_data['estado'], insp_data['acciones'], insp_data['diagnostico'], insp_data['recomendaciones'],
                            drive_file_id, ruta_pdf_drive, reporte_generado, fecha_gen, tipo_rep, num_acta, est_gen
                        ))
                    total_inspecciones_sync += 1

        # Depurar equipos residuales no sincronizados de Arauco
        cursor.execute("""
            DELETE FROM equipos 
            WHERE ubicacion_id IN (SELECT id FROM ubicaciones WHERE empresa_id = ?)
              AND (nombre = 'Prueba1' OR codigo LIKE 'TMP_%')
        """, (empresa_id,))
        
        conn.commit()
        print(f"-> Base SQLite '{db_path}' sincronizada con éxito:")
        print(f"   * Equipos actualizados: {total_equipos_updated}")
        print(f"   * Equipos creados: {total_equipos_created}")
        print(f"   * Total Equipos Arauco: {total_equipos_updated + total_equipos_created}")
        print(f"   * Inspecciones sincronizadas (2023, 2024, 2026): {total_inspecciones_sync}")
        print(f"   * Enlaces a Google Drive preservados: {drive_ids_preserved}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error durante la sincronización SQLite: {e}")
        raise e
    finally:
        conn.close()

def _sync_postgres(excel_data: Dict[str, List[Dict[str, Any]]]):
    import psycopg2
    from psycopg2.extras import RealDictCursor
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT id FROM empresas WHERE nombre = 'Arauco'")
        emp_row = cursor.fetchone()
        if not emp_row:
            cursor.execute("INSERT INTO empresas (nombre, descripcion) VALUES ('Arauco', 'Empresa Arauco') RETURNING id")
            empresa_id = cursor.fetchone()['id']
        else:
            empresa_id = emp_row['id']
            
        total_equipos_updated = 0
        total_equipos_created = 0
        total_inspecciones_sync = 0
        drive_ids_preserved = 0
        
        code_offsets = {
            'Blanque-Digestion': 1,
            'Quimica': 123,
            'Servicios': 223
        }
        
        for ubi_name, items in excel_data.items():
            cursor.execute("SELECT id, drive_folder_id FROM ubicaciones WHERE empresa_id = %s AND nombre = %s", (empresa_id, ubi_name))
            ubi_row = cursor.fetchone()
            if not ubi_row:
                cursor.execute("INSERT INTO ubicaciones (empresa_id, nombre) VALUES (%s, %s) RETURNING id", (empresa_id, ubi_name))
                ubi_id = cursor.fetchone()['id']
            else:
                ubi_id = ubi_row['id']
                
            cursor.execute("UPDATE equipos SET codigo = 'TMP_' || id WHERE ubicacion_id = %s", (ubi_id,))
                
            cursor.execute("SELECT id, codigo, nombre FROM equipos WHERE ubicacion_id = %s ORDER BY id", (ubi_id,))
            existing_equipos = [dict(r) for r in cursor.fetchall()]
            
            cursor.execute("""
                SELECT i.equipo_id, i.anio, i.drive_file_id, i.ruta_pdf_drive, i.reporte_generado,
                       i.fecha_generacion_reporte, i.tipo_reporte, i.numero_acta, i.estado_generacion
                FROM inspecciones i
                JOIN equipos eq ON i.equipo_id = eq.id
                WHERE eq.ubicacion_id = %s
            """, (ubi_id,))
            drive_meta_map = {(r['equipo_id'], r['anio']): dict(r) for r in cursor.fetchall()}
            
            base_offset = code_offsets.get(ubi_name, 1)
            used_existing_ids = set()
            
            for idx, item in enumerate(items):
                assigned_code = str(base_offset + idx)
                eq_nombre = item['nombre']
                norm_eq_name = normalize_for_match(eq_nombre)
                
                matched_id = None
                for ex_eq in existing_equipos:
                    if ex_eq['id'] in used_existing_ids:
                        continue
                    if normalize_for_match(ex_eq['nombre']) == norm_eq_name:
                        matched_id = ex_eq['id']
                        used_existing_ids.add(matched_id)
                        break
                        
                if not matched_id:
                    for ex_eq in existing_equipos:
                        if ex_eq['id'] in used_existing_ids:
                            continue
                        ex_norm = normalize_for_match(ex_eq['nombre'])
                        if ex_norm.startswith(norm_eq_name) or norm_eq_name.startswith(ex_norm):
                            matched_id = ex_eq['id']
                            used_existing_ids.add(matched_id)
                            break
                    
                if matched_id:
                    cursor.execute("""
                        UPDATE equipos 
                        SET nombre = %s, codigo = %s, material = %s, criticidad = %s, estado_actual = %s, activo = true
                        WHERE id = %s
                    """, (eq_nombre, assigned_code, item['material'], item['criticidad'], item['estado_actual'], matched_id))
                    equipo_id = matched_id
                    total_equipos_updated += 1
                else:
                    cursor.execute("""
                        INSERT INTO equipos (ubicacion_id, codigo, nombre, material, criticidad, estado_actual, activo)
                        VALUES (%s, %s, %s, %s, %s, %s, true)
                        RETURNING id
                    """, (ubi_id, assigned_code, eq_nombre, item['material'], item['criticidad'], item['estado_actual']))
                    equipo_id = cursor.fetchone()['id']
                    total_equipos_created += 1
                    
                for anio, insp_data in item['inspecciones'].items():
                    prev_meta = drive_meta_map.get((equipo_id, anio), {})
                    drive_file_id = prev_meta.get('drive_file_id')
                    ruta_pdf_drive = prev_meta.get('ruta_pdf_drive')
                    reporte_generado = prev_meta.get('reporte_generado', False)
                    fecha_gen = prev_meta.get('fecha_generacion_reporte')
                    tipo_rep = prev_meta.get('tipo_reporte')
                    num_acta = prev_meta.get('numero_acta')
                    est_gen = prev_meta.get('estado_generacion')
                    
                    if drive_file_id:
                        drive_ids_preserved += 1
                        
                    cursor.execute("SELECT id FROM inspecciones WHERE equipo_id = %s AND anio = %s", (equipo_id, anio))
                    insp_row = cursor.fetchone()
                    
                    if insp_row:
                        cursor.execute("""
                            UPDATE inspecciones
                            SET estado = %s, acciones = %s, diagnostico = %s, recomendaciones = %s,
                                drive_file_id = COALESCE(%s, drive_file_id),
                                ruta_pdf_drive = COALESCE(%s, ruta_pdf_drive),
                                reporte_generado = COALESCE(%s, reporte_generado),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = %s
                        """, (
                            insp_data['estado'], insp_data['acciones'], insp_data['diagnostico'], insp_data['recomendaciones'],
                            drive_file_id, ruta_pdf_drive, reporte_generado, insp_row['id']
                        ))
                    else:
                        cursor.execute("""
                            INSERT INTO inspecciones (
                                equipo_id, anio, estado, acciones, diagnostico, recomendaciones,
                                drive_file_id, ruta_pdf_drive, reporte_generado, fecha_generacion_reporte,
                                tipo_reporte, numero_acta, estado_generacion, created_at, updated_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        """, (
                            equipo_id, anio, insp_data['estado'], insp_data['acciones'], insp_data['diagnostico'], insp_data['recomendaciones'],
                            drive_file_id, ruta_pdf_drive, reporte_generado, fecha_gen, tipo_rep, num_acta, est_gen
                        ))
                    total_inspecciones_sync += 1

        cursor.execute("""
            DELETE FROM equipos 
            WHERE ubicacion_id IN (SELECT id FROM ubicaciones WHERE empresa_id = %s)
              AND (nombre = 'Prueba1' OR codigo LIKE 'TMP_%%')
        """, (empresa_id,))
        
        conn.commit()
        print(f"\n-> Base Neon PostgreSQL sincronizada con éxito:")
        print(f"   * Equipos actualizados: {total_equipos_updated}")
        print(f"   * Equipos creados: {total_equipos_created}")
        print(f"   * Total Equipos Arauco: {total_equipos_updated + total_equipos_created}")
        print(f"   * Inspecciones sincronizadas (2023, 2024, 2026): {total_inspecciones_sync}")
        print(f"   * Enlaces a Google Drive preservados: {drive_ids_preserved}")
        
    except Exception as e:
        conn.rollback()
        print(f"Error durante la sincronización Neon: {e}")
        raise e
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sincronizar datos de Arauco desde Excel")
    parser.add_argument("--target", choices=["dry-run", "local", "neon"], default="dry-run", help="Destino de la sincronización")
    args = parser.parse_args()
    
    sync_database(target=args.target)
