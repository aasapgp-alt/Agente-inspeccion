import pypdf
import os
import sys
import sqlite3
import json
import logging
from datetime import datetime

sys.path.append(os.path.abspath('.'))

from app.services.drive_service import get_drive_instance, subir_archivo

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("split_mda_reports")

PDF_PATH = r"c:\Agente-Inspector\data\Reporte Unificado insp ARC MDA SA 2024.pdf"
LOCAL_REPORTES_DIR = r"c:\Agente-Inspector\data\reportes"
DB_PATH = 'data/inspecciones.db'

def split_and_upload():
    print("Iniciando división y carga de reportes individuales del 2024 para Minera del Altiplano...")
    
    os.makedirs(LOCAL_REPORTES_DIR, exist_ok=True)
    
    # 1. Cargar metadatos de los reportes mapeados
    with open(r"c:\Agente-Inspector\scratch\matched_reports.json", "r", encoding="utf-8") as f:
        matched_reports = json.load(f)
        
    reader = pypdf.PdfReader(PDF_PATH)
    print(f"PDF cargado: {len(reader.pages)} páginas. Se procesarán {len(matched_reports)} reportes individuales.")
    
    drive = get_drive_instance()
    if drive:
        print("Autenticado exitosamente con Google Drive API.")
    else:
        print("ADVERTENCIA: No se pudo conectar a Google Drive. Se guardarán únicamente en local.")
        
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    procesados = 0
    
    for r in matched_reports:
        informe_num = r["informe"] # ej: "ARC MDA-2426"
        tag = r["tag"]            # ej: "T-2240"
        start_p = r["start_page"]  # 1-indexed
        end_p = r["end_page"]      # 1-indexed
        
        pdf_name = f"ACTA-ARC-MDA-2024-{tag}.pdf"
        local_path = os.path.join(LOCAL_REPORTES_DIR, pdf_name)
        
        # 2. Generar el PDF individual recortado
        writer = pypdf.PdfWriter()
        for p_idx in range(start_p - 1, end_p):
            writer.add_page(reader.pages[p_idx])
            
        with open(local_path, "wb") as f_out:
            writer.write(f_out)
            
        print(f"\n[{procesados+1}/{len(matched_reports)}] Creado localmente: '{pdf_name}' ({end_p - start_p + 1} págs) -> {local_path}")
        
        # 3. Buscar la carpeta de Drive del equipo para PGP 2024 / Documentos_y_Reportes
        drive_file_id = ""
        drive_link = ""
        
        cursor.execute("""
            SELECT e.id as equipo_id, u.drive_folder_id as area_drive_id
            FROM equipos e
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            WHERE u.empresa_id = 170 AND (e.codigo = ? OR e.tag = ?)
        """, (tag, tag))
        eq_row = cursor.fetchone()
        
        if eq_row and drive:
            equipo_id = eq_row['equipo_id']
            area_drive_id = eq_row['area_drive_id']
            
            target_folder_id = None
            
            # Buscar en caché la carpeta del equipo
            cursor.execute("SELECT drive_id FROM drive_folders_cache WHERE parent_id = ? AND nombre LIKE ?", (area_drive_id, f"%{tag}%"))
            eq_folder = cursor.fetchone()
            
            if eq_folder:
                eq_drive_id = eq_folder[0]
                # Buscar carpeta PGP 2024
                cursor.execute("SELECT drive_id FROM drive_folders_cache WHERE parent_id = ? AND nombre = 'PGP 2024'", (eq_drive_id,))
                pgp_folder = cursor.fetchone()
                
                if pgp_folder:
                    pgp_drive_id = pgp_folder[0]
                    # Buscar Documentos_y_Reportes
                    cursor.execute("SELECT drive_id FROM drive_folders_cache WHERE parent_id = ? AND nombre = 'Documentos_y_Reportes'", (pgp_drive_id,))
                    doc_folder = cursor.fetchone()
                    if doc_folder:
                        target_folder_id = doc_folder[0]
                    else:
                        target_folder_id = pgp_drive_id
                else:
                    target_folder_id = eq_drive_id
                    
            if target_folder_id:
                try:
                    drive_file = drive.CreateFile({
                        'title': pdf_name,
                        'parents': [{'id': target_folder_id}]
                    })
                    drive_file.SetContentFile(local_path)
                    drive_file.Upload()
                    drive_file_id = drive_file['id']
                    drive_link = drive_file.get('alternateLink', f"https://drive.google.com/file/d/{drive_file_id}/view")
                    print(f"  -> Subido a Google Drive (Folder ID: {target_folder_id}) | Link: {drive_link}")
                except Exception as upload_err:
                    print(f"  -> Error al subir a Google Drive: {upload_err}")
            else:
                print(f"  -> No se encontró carpeta de Drive específica para {tag}")
        else:
            equipo_id = eq_row['equipo_id'] if eq_row else None
            
        # 4. Actualizar tabla inspecciones en SQLite
        if equipo_id:
            cursor.execute("""
                UPDATE inspecciones 
                SET ruta_pdf_local = ?,
                    ruta_pdf_drive = ?,
                    drive_file_id = ?,
                    reporte_generado = 1,
                    estado_generacion = 'COMPLETADO',
                    numero_acta = ?,
                    fecha_generacion_reporte = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE equipo_id = ? AND anio = 2024
            """, (local_path, drive_link, drive_file_id, f"ARC-MDA-2024-{tag}", equipo_id))
            conn.commit()
            
        procesados += 1

    conn.close()
    print(f"\n¡PROCESO COMPLETADO! Se crearon y subieron {procesados} reportes individuales.")

if __name__ == "__main__":
    split_and_upload()
