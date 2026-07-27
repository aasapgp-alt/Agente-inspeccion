import os
import sys
import sqlite3
import json
from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

sys.path.append(os.path.abspath('.'))

LOCAL_REPORTES_DIR = r"c:\Agente-Inspector\data\reportes"
DB_PATH = 'data/inspecciones.db'

def get_oauth_drive():
    print("Iniciando autenticación OAuth de usuario con client_secrets.json...")
    gauth = GoogleAuth(settings_file="settings.yaml")
    
    if os.path.exists("mycreds.txt"):
        gauth.LoadCredentialsFile("mycreds.txt")
        
    if gauth.credentials is None:
        print("No se encontraron credenciales previas. Abriendo servidor local de autenticación...")
        gauth.LocalWebserverAuth()
    elif gauth.access_token_expired:
        print("Token expirado. Refrescando token OAuth...")
        gauth.Refresh()
    else:
        gauth.Authorize()
        
    gauth.SaveCredentialsFile("mycreds.txt")
    print("Autenticación OAuth exitosa de usuario. Credenciales guardadas en mycreds.txt.")
    return GoogleDrive(gauth)

def sync_reports():
    print("=== SINCRONIZACIÓN DE REPORTES INDIVIDUALES A GOOGLE DRIVE VÍA OAUTH ===")
    
    drive = get_oauth_drive()
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    with open(r"c:\Agente-Inspector\scratch\matched_reports.json", "r", encoding="utf-8") as f:
        matched_reports = json.load(f)
        
    subidos = 0
    
    for r in matched_reports:
        tag = r["tag"]
        pdf_name = f"ACTA-ARC-MDA-2024-{tag}.pdf"
        local_path = os.path.join(LOCAL_REPORTES_DIR, pdf_name)
        
        if not os.path.exists(local_path):
            print(f"Archivo no encontrado localmente: {local_path}")
            continue
            
        cursor.execute("""
            SELECT e.id as equipo_id, u.drive_folder_id as area_drive_id
            FROM equipos e
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            WHERE u.empresa_id = 170 AND (e.codigo = ? OR e.tag = ?)
        """, (tag, tag))
        eq_row = cursor.fetchone()
        
        if not eq_row:
            print(f"No se encontró equipo para tag {tag}")
            continue
            
        equipo_id = eq_row['equipo_id']
        area_drive_id = eq_row['area_drive_id']
        
        # Buscar carpeta Documentos_y_Reportes en la caché
        cursor.execute("SELECT drive_id FROM drive_folders_cache WHERE parent_id = ? AND nombre LIKE ?", (area_drive_id, f"%{tag}%"))
        eq_folder = cursor.fetchone()
        
        target_folder_id = None
        if eq_folder:
            eq_drive_id = eq_folder[0]
            cursor.execute("SELECT drive_id FROM drive_folders_cache WHERE parent_id = ? AND nombre = 'PGP 2024'", (eq_drive_id,))
            pgp_folder = cursor.fetchone()
            if pgp_folder:
                pgp_drive_id = pgp_folder[0]
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
                # Comprobar si ya existe en Drive
                query = f"'{target_folder_id}' in parents and title='{pdf_name}' and trashed=false"
                file_list = drive.ListFile({'q': query}).GetList()
                if file_list:
                    drive_file = file_list[0]
                    print(f"  [{tag}] Ya existe en Drive: {pdf_name}")
                else:
                    drive_file = drive.CreateFile({
                        'title': pdf_name,
                        'parents': [{'id': target_folder_id}]
                    })
                    drive_file.SetContentFile(local_path)
                    drive_file.Upload(param={'supportsAllDrives': True})
                    print(f"  [{tag}] ¡SUBIDO EXITOSAMENTE! -> {pdf_name}")
                    
                drive_file_id = drive_file['id']
                drive_link = drive_file.get('alternateLink', f"https://drive.google.com/file/d/{drive_file_id}/view")
                
                cursor.execute("""
                    UPDATE inspecciones 
                    SET ruta_pdf_drive = ?,
                        drive_file_id = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE equipo_id = ? AND anio = 2024
                """, (drive_link, drive_file_id, equipo_id))
                conn.commit()
                subidos += 1
            except Exception as e:
                print(f"  [{tag}] Error al subir: {e}")
        else:
            print(f"  [{tag}] No se encontró carpeta de destino en Drive.")
            
    conn.close()
    print(f"\nSincronización completada. Total archivos procesados en Drive: {subidos}")

if __name__ == "__main__":
    sync_reports()
