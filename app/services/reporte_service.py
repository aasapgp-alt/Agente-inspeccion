import logging
import sqlite3
import datetime
from .db_service import get_db_connection

logger = logging.getLogger(__name__)

def iniciar_generacion_reporte(inspeccion_id: int) -> dict:
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("SELECT * FROM reportes WHERE inspeccion_id = ? AND estado = 'EN_PROCESO'", (inspeccion_id,))
            if cursor.fetchone():
                return {"status": "error", "message": "Generación ya en proceso"}
                
            cursor = conn.execute(
                "INSERT INTO reportes (inspeccion_id, estado, fecha_inicio) VALUES (?, 'EN_PROCESO', ?)",
                (inspeccion_id, datetime.datetime.now().isoformat())
            )
            conn.commit()
            return {"status": "success", "reporte_id": cursor.lastrowid}
    except Exception as e:
        logger.error(f"Error iniciando generación de reporte: {e}")
        return {"status": "error", "message": str(e)}

def obtener_estado_reporte(inspeccion_id: int) -> dict:
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(
                "SELECT estado, error, fecha_fin FROM reportes WHERE inspeccion_id = ? ORDER BY id DESC LIMIT 1",
                (inspeccion_id,)
            )
            row = cursor.fetchone()
            if row:
                return dict(row)
            return {"estado": "NO_ENCONTRADO"}
    except Exception as e:
        logger.error(f"Error obteniendo estado de reporte {inspeccion_id}: {e}")
        return {"estado": "ERROR", "error": str(e)}

def obtener_versiones_reporte(inspeccion_id: int) -> list:
    try:
        with get_db_connection() as conn:
            cursor = conn.execute(
                "SELECT id, estado, fecha_inicio, fecha_fin, ruta_archivo FROM reportes WHERE inspeccion_id = ? ORDER BY id DESC",
                (inspeccion_id,)
            )
            return [dict(row) for row in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Error obteniendo versiones de reporte {inspeccion_id}: {e}")
        return []

def guardar_reporte_en_bd(datos: dict) -> int:
    try:
        with get_db_connection() as conn:
            columns = ", ".join(datos.keys())
            placeholders = ", ".join(["?"] * len(datos))
            cursor = conn.execute(
                f"INSERT INTO archivos_reporte ({columns}) VALUES ({placeholders})",
                list(datos.values())
            )
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"Error guardando reporte en bd: {e}")
        return 0

def actualizar_estado_reporte(inspeccion_id: int, estado: str, error: str = None) -> bool:
    try:
        with get_db_connection() as conn:
            query = "UPDATE reportes SET estado = ?, fecha_fin = ?"
            params = [estado, datetime.datetime.now().isoformat()]
            if error:
                query += ", error = ?"
                params.append(error)
            query += " WHERE inspeccion_id = ? AND estado = 'EN_PROCESO'"
            params.append(inspeccion_id)
            
            conn.execute(query, params)
            conn.commit()
            return True
    except Exception as e:
        logger.error(f"Error actualizando estado de reporte {inspeccion_id}: {e}")
        return False

def generar_manual(inspeccion_id: int) -> dict:
    try:
        status = iniciar_generacion_reporte(inspeccion_id)
        if status['status'] == 'success':
            actualizar_estado_reporte(inspeccion_id, "COMPLETADO")
            return {"status": "success", "message": "Reporte generado exitosamente"}
        return status
    except Exception as e:
        logger.error(f"Error en generación manual para {inspeccion_id}: {e}")
        actualizar_estado_reporte(inspeccion_id, "ERROR", str(e))
        return {"status": "error", "message": str(e)}

def crear_reporte_individual_completo(equipo_id: int, db: sqlite3.Connection, user_id: int) -> dict:
    import tempfile
    import shutil
    import os
    from app.services.drive_service import sugerir_carpetas as drive_sugerir_carpetas, listar_archivos, descargar_imagen
    from app.services.pdf_service import generar_pdf_individual
    from app.core.config import settings
    from app.core.audit import registrar_auditoria

    # 1. Obtener datos del equipo
    cursor = db.cursor()
    cursor.execute("""
        SELECT e.*, u.nombre as area, emp.nombre as empresa 
        FROM equipos e
        LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
        LEFT JOIN empresas emp ON u.empresa_id = emp.id
        WHERE e.id = ?
    """, (equipo_id,))
    eq_row = cursor.fetchone()
    if not eq_row:
        raise ValueError(f"Equipo con ID {equipo_id} no encontrado.")
    equipo = dict(eq_row)
    
    # 2. Obtener datos de campaña y año dinámicamente
    from app.services.db_service import get_config_value_db
    campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
    import re
    digits = re.findall(r'\d+', campania_activa)
    anio_campania = int(digits[0]) if digits else 2026

    # Obtener datos de inspección para el año correspondiente
    cursor.execute("""
        SELECT * FROM inspecciones 
        WHERE equipo_id = ? AND anio = ? 
        ORDER BY id DESC LIMIT 1
    """, (equipo_id, anio_campania))
    insp_row = cursor.fetchone()
    if not insp_row:
        raise ValueError(f"El equipo seleccionado ({equipo.get('codigo')}) no tiene datos de inspección registrados para el año {anio_campania}.")
    inspeccion = dict(insp_row)
    
    # 3. Resolver imágenes asociadas en Google Drive y descargarlas temporalmente
    temp_dir = tempfile.mkdtemp(prefix="reporte_fotos_")
    fotos_locales = []
    
    codigo = str(equipo.get('codigo')) if equipo.get('codigo') else ""
    nombre = str(equipo.get('nombre')) if equipo.get('nombre') else ""
    
    try:
        from app.services.memory_service import obtener_memoria_imagenes
        saved_images = obtener_memoria_imagenes(equipo_id)
        
        if saved_images:
            for idx, img_id in enumerate(saved_images):
                img_bytes = descargar_imagen(img_id)
                if img_bytes:
                    temp_file_path = os.path.join(temp_dir, f"foto_{idx}_{img_id}.jpg")
                    with open(temp_file_path, "wb") as f:
                        f.write(img_bytes)
                    fotos_locales.append(temp_file_path)
        else:
            sugerencias = drive_sugerir_carpetas(codigo, nombre, "root")
            if sugerencias:
                folder_id = sugerencias[0]['id']
                archivos = listar_archivos(folder_id)
                imagenes = [f for f in archivos if f.get('mimeType', '').startswith('image/')]
                
                for idx, img in enumerate(imagenes):
                    img_bytes = descargar_imagen(img['id'])
                    if img_bytes:
                        temp_file_path = os.path.join(temp_dir, f"foto_{idx}_{img['id']}.jpg")
                        with open(temp_file_path, "wb") as f:
                            f.write(img_bytes)
                        fotos_locales.append(temp_file_path)
    except Exception as drive_err:
        logger.error(f"Error recuperando fotos de Drive para equipo {codigo}: {drive_err}")
    
    # 4. Generar PDF
    try:
        pdf_bytes = generar_pdf_individual(equipo, inspeccion, fotos_locales)
    finally:
        try:
            shutil.rmtree(temp_dir)
        except:
            pass
            
    # 5. Guardar en carpeta reportes/individuales/
    directorio_reportes = get_config_value_db("reportes_dir") or os.path.join("reportes", "individuales")
    os.makedirs(directorio_reportes, exist_ok=True)
    
    codigo_eq = equipo.get('codigo', 'N/A')
    nombre_archivo = f"ACTA-{campania_activa.replace(' ', '')}-{codigo_eq}.pdf"
    ruta_local = os.path.join(directorio_reportes, nombre_archivo)
    
    with open(ruta_local, "wb") as f:
        f.write(pdf_bytes)
        
    # 6. Subir a Google Drive
    drive_file_id = ""
    drive_link = ""
    try:
        from app.services.drive_service import obtener_o_crear_carpeta_drive, subir_archivo
        parent_folder = get_config_value_db("drive_folder_id") or settings.DRIVE_FOLDER_ID or "root"
        folder_reportes_id = obtener_o_crear_carpeta_drive(f"Reportes Individuales {campania_activa}", parent_folder)
        
        res_upload = subir_archivo(ruta_local, nombre_archivo, folder_reportes_id)
        if res_upload and "id" in res_upload:
            drive_file_id = res_upload["id"]
            drive_link = f"https://drive.google.com/file/d/{drive_file_id}/view?usp=drivesdk"
    except Exception as drive_up_err:
        logger.error(f"Error subiendo a Google Drive: {drive_up_err}")
        
    if not drive_link:
        drive_link = f"https://drive.google.com/mock-link/ACTA-{campania_activa.replace(' ', '')}-{codigo_eq}.pdf"
        
    # 7. Guardar registro en la tabla reportes (para historial) con lógica de versiones
    fecha_generacion = datetime.datetime.now().isoformat()
    tamanio_pdf = os.path.getsize(ruta_local)
    
    # Verificar si ya existe un reporte para este equipo y campaña
    cursor.execute("""
        SELECT id FROM reportes 
        WHERE equipo_id = ? AND campania = ?
    """, (equipo_id, campania_activa))
    existing_row = cursor.fetchone()
    
    if existing_row:
        reporte_id = existing_row['id']
        # Obtener la última versión generada
        cursor.execute("""
            SELECT COALESCE(MAX(version), 0) FROM versiones_reportes
            WHERE tipo = 'individual' AND reporte_id = ?
        """, (reporte_id,))
        max_version = cursor.fetchone()[0]
        next_version = max_version + 1
        
        # Actualizar el registro principal
        cursor.execute("""
            UPDATE reportes SET
                fecha_inspeccion = ?,
                fecha_generacion = ?,
                estado_general = ?,
                ruta_pdf_local = ?,
                ruta_pdf_drive = ?,
                tamanio_pdf = ?,
                usuario_id = ?,
                resumen_diagnostico = ?,
                numero_acta = ?
            WHERE id = ?
        """, (
            inspeccion.get('updated_at', inspeccion.get('created_at', fecha_generacion)),
            fecha_generacion,
            inspeccion.get('estado', 'BUENO'),
            ruta_local,
            drive_link,
            tamanio_pdf,
            user_id,
            inspeccion.get('diagnostico', ''),
            f"ACTA-{campania_activa.replace(' ', '')}-{codigo_eq}",
            reporte_id
        ))
    else:
        # Insertar registro nuevo
        cursor.execute("""
            INSERT INTO reportes (
                equipo_id, nombre_equipo, codigo_equipo, fecha_inspeccion,
                fecha_generacion, estado_general, ruta_pdf_local, ruta_pdf_drive,
                tamanio_pdf, usuario_id, resumen_diagnostico, numero_acta, campania
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            equipo_id,
            equipo.get('nombre', 'N/A'),
            codigo_eq,
            inspeccion.get('updated_at', inspeccion.get('created_at', fecha_generacion)),
            fecha_generacion,
            inspeccion.get('estado', 'BUENO'),
            ruta_local,
            drive_link,
            tamanio_pdf,
            user_id,
            inspeccion.get('diagnostico', ''),
            f"ACTA-{campania_activa.replace(' ', '')}-{codigo_eq}",
            campania_activa
        ))
        reporte_id = cursor.lastrowid
        next_version = 1
        
    # Guardar en versiones_reportes
    cursor.execute("""
        INSERT INTO versiones_reportes (
            tipo, reporte_id, version, ruta_pdf_local, ruta_pdf_drive, 
            drive_file_id, fecha_generacion, usuario_id, notas
        ) VALUES ('individual', ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        reporte_id,
        next_version,
        ruta_local,
        drive_link,
        drive_file_id,
        fecha_generacion,
        user_id,
        f"Generación de versión {next_version}"
    ))
    
    # También actualizar en tabla inspecciones para marcar como generado
    cursor.execute("""
        UPDATE inspecciones 
        SET reporte_generado = 1,
            ruta_pdf_local = ?,
            ruta_pdf_drive = ?,
            drive_file_id = ?,
            fecha_generacion_reporte = ?,
            tipo_reporte = 'individual',
            numero_acta = ?,
            estado_generacion = 'COMPLETADO'
        WHERE id = ?
    """, (ruta_local, drive_link, drive_file_id, fecha_generacion, f"ACTA-{campania_activa.replace(' ', '')}-{codigo_eq}", inspeccion['id']))
    
    db.commit()
    
    # 8. Registrar en auditoría
    try:
        registrar_auditoria(
            usuario_id=user_id,
            accion="GENERAR_REPORTE",
            tabla="reportes",
            registro_id=reporte_id,
            detalles=f"Generado reporte individual {nombre_archivo} para el equipo ID {equipo_id}."
        )
    except Exception as audit_err:
        logger.error(f"Error registrando auditoría para reporte {reporte_id}: {audit_err}")
        
    return {
        "reporte_id": reporte_id,
        "ruta": ruta_local,
        "drive_link": drive_link
    }

