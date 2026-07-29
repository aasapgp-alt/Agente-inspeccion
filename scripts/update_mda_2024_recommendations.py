import pypdf
import json
import re
import os
import sys
import sqlite3
import shutil
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PDF_PATH = os.path.join(BASE_DIR, 'data', 'Reporte Unificado insp ARC MDA SA 2024.pdf')
MATCHED_JSON_PATH = os.path.join(BASE_DIR, 'scratch', 'matched_reports.json')
DB_PATH = os.path.join(BASE_DIR, 'data', 'inspecciones.db')

def update_mda_recommendations():
    print(f"Iniciando actualización de recomendaciones 2024 desde '{PDF_PATH}'...")
    
    if not os.path.exists(PDF_PATH):
        print(f"ERROR: No se encontró el archivo PDF en {PDF_PATH}")
        return
        
    if not os.path.exists(DB_PATH):
        print(f"ERROR: No se encontró la base de datos SQLite en {DB_PATH}")
        return
        
    with open(MATCHED_JSON_PATH, 'r', encoding='utf-8') as f:
        matched_reports = json.load(f)
        
    reader = pypdf.PdfReader(PDF_PATH)
    print(f"PDF cargado ({len(reader.pages)} páginas). Procesando {len(matched_reports)} reportes de equipos...")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    actualizados = 0
    no_encontrados = 0
    
    for item in matched_reports:
        informe_num = item["informe"]
        tag = item["tag"]
        start_p = item["start_page"]
        end_p = item["end_page"]
        
        search_tags = [tag]
        if tag.startswith('R-'):
            search_tags.append('T-' + tag[2:])
        elif tag.startswith('T-'):
            search_tags.append('R-' + tag[2:])
            
        full_text = ""
        for p in range(start_p - 1, end_p):
            full_text += reader.pages[p].extract_text() + "\n"
            
        clean_text = re.sub(r'Julio 2024 \d+ \/ \d+', '', full_text)
        
        # Clean multiline footers inside labels
        clean_text = re.sub(r'ACCIONES\s*PREVENTIVAS\s*[\/\-]?\s*(?:N\/A)?\s*CORRECTIVAS\s*:', '[[ACCIONES]]\nN/A\n', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'OBSERVACION\s*ES\s*[\/\-]?\s*HALLAZGOS\s*:', '[[OBSERVACIONES]]', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'ACCIONES\s*(?:PREVENTIVAS)?\s*[\/\-]?\s*(?:CORRECTIVAS)?\s*:', '[[ACCIONES]]', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'CONCLUSIONES\s*[\/\-]?\s*RECOMENDACI\s*ONES\s*:', '[[RECOMENDACIONES]]', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'CONCLUSIONES\s*\n?\s*[\/\-]?\s*\n?\s*RECOMENDACI\s*\n?\s*ONES\s*:', '[[RECOMENDACIONES]]', clean_text, flags=re.IGNORECASE)
        clean_text = re.sub(r'CONCLUSIONES\s*\n?\s*[\/\-]?\s*\n?\s*RECOMENDACI', '[[RECOMENDACIONES]]', clean_text, flags=re.IGNORECASE)

        obs = ""
        acc = ""
        rec = ""
        
        parts_obs = clean_text.split('[[OBSERVACIONES]]')
        if len(parts_obs) > 1:
            rest_obs = parts_obs[1]
            parts_acc = rest_obs.split('[[ACCIONES]]')
            obs = parts_acc[0].strip()
            if len(parts_acc) > 1:
                rest_acc = parts_acc[1]
                parts_rec = rest_acc.split('[[RECOMENDACIONES]]')
                acc = parts_rec[0].strip()
                if len(parts_rec) > 1:
                    rec_raw = parts_rec[1]
                    rec_raw = re.sub(r'^\s*ONES\s*:\s*', '', rec_raw, flags=re.IGNORECASE)
                    rec_clean = re.split(r'Marco Paltrinieri|FOTOS ILUSTRATIVAS|FOTOS|Julio 2024', rec_raw)[0]
                    rec = rec_clean.strip()
                    
        if 'CONCLUSIONES' in acc:
            parts_c = re.split(r'CONCLUSIONES', acc, flags=re.IGNORECASE)
            acc = parts_c[0].strip()
            rec_raw = parts_c[1]
            rec_raw = re.sub(r'^\s*[\/\-]?\s*RECOMENDACI\s*ONES\s*:\s*', '', rec_raw, flags=re.IGNORECASE)
            rec_clean = re.split(r'Marco Paltrinieri|FOTOS ILUSTRATIVAS|FOTOS|Julio 2024', rec_raw)[0]
            rec = rec_clean.strip()

        cursor.execute("""
            SELECT i.id, e.codigo, e.tag, e.nombre
            FROM inspecciones i
            JOIN equipos e ON i.equipo_id = e.id
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            WHERE u.empresa_id = 170 AND i.anio = 2024 AND (e.codigo IN (?, ?) OR e.tag IN (?, ?))
        """, (search_tags[0], search_tags[-1], search_tags[0], search_tags[-1]))
        
        insp_row = cursor.fetchone()
        
        if insp_row:
            insp_id = insp_row['id']
            
            cursor.execute("""
                UPDATE inspecciones
                SET diagnostico = ?,
                    acciones = ?,
                    recomendaciones = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (obs, acc, rec, insp_id))
            
            conn.commit()
            actualizados += 1
            print(f"[{actualizados}] TAG: {tag} (DB Tag: {insp_row['codigo'] or insp_row['tag']}) | ID Insp: {insp_id}")
            print(f"   -> Diagnóstico: {len(obs)} caracteres | Acciones: {len(acc)} caracteres | Recomendaciones: {len(rec)} caracteres")
        else:
            no_encontrados += 1
            print(f"ADVERTENCIA: No se encontró inspección 2024 en DB para TAG '{tag}'")
            
    conn.close()
    print(f"\n¡PROCESO COMPLETADO! Se actualizaron {actualizados} inspecciones de 2024 con la información del PDF.")

if __name__ == "__main__":
    update_mda_recommendations()
