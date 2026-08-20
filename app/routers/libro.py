from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import Dict, Any, List, Optional
import sqlite3
import os
import json
import datetime
import tempfile
import shutil
import logging

from app.core.dependencies import get_db, get_current_user
from app.services.pdf_service import generar_libro_pdf
from app.services.reporte_service import crear_reporte_individual_completo
from app.core.audit import registrar_auditoria
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/libro", tags=["libro"])

# Dictionary to store the real-time progress of book generation per location
libro_progress: Dict[int, str] = {}
# Dictionary to store cancellation requests per location
libro_cancel: Dict[int, bool] = {}

@router.post("/generar/{ubicacion_id}", response_model=Dict[str, Any])
def generar_libro(
    ubicacion_id: int,
    solo_aprobados: bool = False,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    user_id = current_user.get("id")
    libro_progress[ubicacion_id] = "Generando..."
    libro_cancel[ubicacion_id] = False
    
    temp_dir = tempfile.mkdtemp(prefix="libro_fotos_")
    
    try:
        # 1. Obtener datos de la ubicación y empresa
        cursor = db.cursor()
        cursor.execute("""
            SELECT u.nombre as ubicacion_nombre, u.empresa_id, emp.nombre as empresa_nombre 
            FROM ubicaciones u
            LEFT JOIN empresas emp ON u.empresa_id = emp.id
            WHERE u.id = ?
        """, (ubicacion_id,))
        ubi_row = cursor.fetchone()
        if not ubi_row:
            libro_progress[ubicacion_id] = "Error: Ubicación no encontrada"
            raise HTTPException(status_code=404, detail="Ubicación técnica no encontrada")
        
        nombre_ubicacion = ubi_row["ubicacion_nombre"]
        empresa_id = ubi_row["empresa_id"]
        nombre_empresa = ubi_row["empresa_nombre"]

        # Obtener campaña activa y año dinámicamente
        from app.services.db_service import get_config_value_db
        import re
        campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
        digits = re.findall(r'\d+', campania_activa)
        anio_campania = int(digits[0]) if digits else 2026


        # 2. Obtener todos los equipos activos de la ubicación
        cursor.execute("""
            SELECT * FROM equipos 
            WHERE ubicacion_id = ? AND activo = 1
        """, (ubicacion_id,))
        equipos_all = [dict(row) for row in cursor.fetchall()]
        
        if not equipos_all:
            libro_progress[ubicacion_id] = "Error: No hay equipos activos"
            raise HTTPException(status_code=400, detail="No se encontraron equipos activos en esta ubicación técnica")

        # Ordenar alfabéticamente por código de equipo
        equipos_sorted = sorted(equipos_all, key=lambda e: str(e.get('codigo', '')))

        valid_equipos = []
        valid_inspecciones = []
        fotos_por_equipo = {}
        omitidos_count = 0

        # Filtramos primero cuáles tienen inspección de la campaña activa
        equipos_con_inspeccion = []
        for eq in equipos_sorted:
            eq_id = eq["id"]
            cursor.execute("""
                SELECT * FROM inspecciones 
                WHERE equipo_id = ? AND anio = ? 
                ORDER BY id DESC LIMIT 1
            """, (eq_id, anio_campania))
            insp_row = cursor.fetchone()
            if not insp_row:
                omitidos_count += 1
                logger.info(f"Equipo {eq.get('codigo')} omitido: sin datos de inspección {anio_campania}.")
                continue
            
            equipos_con_inspeccion.append((eq, dict(insp_row)))

        total_inspeccionados = len(equipos_con_inspeccion)
        if total_inspeccionados == 0:
            libro_progress[ubicacion_id] = f"Error: Sin inspecciones {anio_campania}"
            raise HTTPException(status_code=400, detail=f"Ninguno de los equipos de esta ubicación tiene datos de inspección registrados para el año {anio_campania}")

        # 3. Generar o verificar reportes individuales
        from app.services.drive_service import sugerir_carpetas as drive_sugerir_carpetas, listar_archivos, descargar_imagen

        for index, (eq, insp) in enumerate(equipos_con_inspeccion):
            if libro_cancel.get(ubicacion_id, False):
                libro_progress[ubicacion_id] = "Cancelado"
                raise HTTPException(status_code=400, detail="Generación cancelada por el usuario")
                
            eq_id = eq["id"]
            codigo_eq = eq.get("codigo", "N/A")
            nombre_eq = eq.get("nombre", "N/A")
            
            if solo_aprobados:
                estado = str(insp.get("estado", "BUENO")).upper()
                if "REGULAR" in estado or "CRIT" in estado:
                    # Validar recomendaciones
                    recom = (insp.get("recomendaciones") or "").strip()
                    if not recom or len(recom) < 5:
                        logger.info(f"Equipo {codigo_eq} omitido por falta de recomendaciones (modo solo_aprobados).")
                        omitidos_count += 1
                        continue
                    
                    # Validar fotos
                    has_photos = False
                    from app.services.memory_service import obtener_memoria_imagenes
                    saved_images = obtener_memoria_imagenes(eq_id)
                    if saved_images:
                        has_photos = True
                    else:
                        try:
                            sugerencias = drive_sugerir_carpetas(str(codigo_eq), str(nombre_eq), "root")
                            if sugerencias:
                                folder_id = sugerencias[0]['id']
                                archivos = listar_archivos(folder_id)
                                imagenes = [f for f in archivos if f.get('mimeType', '').startswith('image/')]
                                if imagenes:
                                    has_photos = True
                        except Exception as e:
                            logger.error(f"Error comprobando fotos en Drive para {codigo_eq}: {e}")
                    
                    if not has_photos:
                        logger.info(f"Equipo {codigo_eq} omitido por falta de fotos (modo solo_aprobados).")
                        omitidos_count += 1
                        continue
            
            # Mostrar progreso
            progreso_str = f"Generando reporte {index + 1} de {total_inspeccionados}..."
            libro_progress[ubicacion_id] = progreso_str
            logger.info(progreso_str)

            # Verificar si ya existe el reporte individual en reportes
            cursor.execute("""
                SELECT * FROM reportes 
                WHERE equipo_id = ? AND campania = ? 
                ORDER BY id DESC LIMIT 1
            """, (eq_id, campania_activa))
            rep_row = cursor.fetchone()
            
            # Si no existe o no tiene ruta local válida, generarlo
            if not rep_row or not rep_row["ruta_pdf_local"] or not os.path.exists(rep_row["ruta_pdf_local"]):
                try:
                    logger.info(f"Reporte individual faltante para {codigo_eq}. Generando automáticamente...")
                    crear_reporte_individual_completo(eq_id, db, user_id)
                except Exception as gen_err:
                    logger.error(f"Error generando reporte individual automático para {codigo_eq}: {gen_err}")
            
            valid_equipos.append(eq)
            valid_inspecciones.append(insp)

            # Descargar imágenes asociadas en Drive para este equipo
            fotos_locales = []
            try:
                from app.services.memory_service import obtener_memoria_imagenes
                saved_images = obtener_memoria_imagenes(eq_id)
                
                if saved_images:
                    for f_idx, img_id in enumerate(saved_images[:2]):
                        img_bytes = descargar_imagen(img_id)
                        if img_bytes:
                            temp_file_path = os.path.join(temp_dir, f"foto_{eq_id}_{f_idx}_{img_id}.jpg")
                            with open(temp_file_path, "wb") as f:
                                f.write(img_bytes)
                            
                            # Consultar comentario de la imagen si existe
                            cursor.execute("SELECT comentario FROM anotaciones_imagenes WHERE equipo_id = ? AND image_id = ?", (eq_id, img_id))
                            com_row = cursor.fetchone()
                            comentario = com_row[0] if (com_row and com_row[0]) else ""
                            
                            fotos_locales.append({
                                "path": temp_file_path,
                                "caption": comentario
                            })
                else:
                    sugerencias = drive_sugerir_carpetas(str(codigo_eq), str(nombre_eq), "root")
                    if sugerencias:
                        folder_id = sugerencias[0]['id']
                        archivos = listar_archivos(folder_id)
                        imagenes = [f for f in archivos if f.get('mimeType', '').startswith('image/')]
                        
                        for f_idx, img in enumerate(imagenes[:2]):
                            img_id = img['id']
                            img_bytes = descargar_imagen(img_id)
                            if img_bytes:
                                temp_file_path = os.path.join(temp_dir, f"foto_{eq_id}_{f_idx}_{img_id}.jpg")
                                with open(temp_file_path, "wb") as f:
                                    f.write(img_bytes)
                                
                                # Consultar comentario de la imagen si existe
                                cursor.execute("SELECT comentario FROM anotaciones_imagenes WHERE equipo_id = ? AND image_id = ?", (eq_id, img_id))
                                com_row = cursor.fetchone()
                                comentario = com_row[0] if (com_row and com_row[0]) else ""
                                
                                fotos_locales.append({
                                    "path": temp_file_path,
                                    "caption": comentario
                                })
            except Exception as drive_err:
                logger.error(f"Error descargando fotos de Drive para libro en equipo {codigo_eq}: {drive_err}")
                
            fotos_por_equipo[eq_id] = fotos_locales

        if libro_cancel.get(ubicacion_id, False):
            libro_progress[ubicacion_id] = "Cancelado"
            raise HTTPException(status_code=400, detail="Generación cancelada por el usuario")

        # 4. Generar Libro PDF consolidado
        libro_progress[ubicacion_id] = "Consolidando libro..."
        pdf_bytes = generar_libro_pdf(
            nombre_ubicacion=nombre_ubicacion,
            nombre_empresa=nombre_empresa,
            equipos=valid_equipos,
            inspecciones=valid_inspecciones,
            fotos_por_equipo=fotos_por_equipo,
            omitidos_count=omitidos_count
        )

        # 5. Guardar en estructura local organizada por Ubicación y Año/Campaña
        from app.services.db_service import get_config_value_db
        safe_ubicacion = "".join([c if c.isalnum() or c in (' ', '_', '-') else '' for c in nombre_ubicacion]).strip().replace(' ', '_')
        safe_camp = "".join([c if c.isalnum() or c in (' ', '_', '-') else '' for c in campania]).strip().replace(' ', '_')
        
        base_libros = get_config_value_db("libros_dir") or settings.LIBROS_DIR or os.path.join("data", "libros")
        directorio_libros = os.path.join(base_libros, safe_ubicacion, safe_camp)
        os.makedirs(directorio_libros, exist_ok=True)
        
        nombre_archivo = f"LIBRO-{anio_campania}-{safe_ubicacion}.pdf"
        ruta_local = os.path.join(directorio_libros, nombre_archivo)
        
        with open(ruta_local, "wb") as f:
            f.write(pdf_bytes)
            
        tamanio_pdf = os.path.getsize(ruta_local)

        # 6. Subir a Google Drive en la carpeta de la Ubicación y Año/Campaña correspondiente
        drive_file_id = ""
        drive_link = ""
        try:
            from app.services.drive_service import obtener_o_crear_carpeta_drive, subir_archivo
            parent_root = get_config_value_db("drive_folder_id") or settings.DRIVE_FOLDER_ID or "root"
            
            # Obtener o crear carpeta de la Ubicación
            ubicacion_folder_id = None
            if ubicacion_id:
                cursor.execute("SELECT drive_folder_id, nombre FROM ubicaciones WHERE id = ?", (ubicacion_id,))
            else:
                cursor.execute("SELECT drive_folder_id, nombre FROM ubicaciones WHERE nombre = ?", (nombre_ubicacion,))
            u_row = cursor.fetchone()
            if u_row and u_row['drive_folder_id']:
                ubicacion_folder_id = u_row['drive_folder_id']
                
            if not ubicacion_folder_id:
                ubicacion_folder_id = obtener_o_crear_carpeta_drive(nombre_ubicacion, parent_root)
                
            # Dentro de la ubicación, obtener o crear la carpeta de la campaña/año
            folder_campania_id = obtener_o_crear_carpeta_drive(campania, ubicacion_folder_id)
            
            res_upload = subir_archivo(ruta_local, nombre_archivo, folder_campania_id)
            if res_upload and "id" in res_upload:
                drive_file_id = res_upload["id"]
                drive_link = f"https://drive.google.com/file/d/{drive_file_id}/view?usp=drivesdk"
        except Exception as drive_up_err:
            logger.error(f"Error subiendo libro consolidado a Google Drive: {drive_up_err}")
            
        if not drive_link:
            drive_link = f"https://drive.google.com/mock-link/{nombre_archivo}"

        # 7. Guardar registro en la tabla libros
        # Prepare resumen_estados
        resumen_estados = {"BUENO": 0, "REGULAR": 0, "CRITICO": 0, "FUERA DE RUTA": 0}
        for insp in valid_inspecciones:
            est = str(insp.get('estado', 'BUENO')).upper()
            if 'BUENO' in est:
                resumen_estados['BUENO'] += 1
            elif 'REGULAR' in est:
                resumen_estados['REGULAR'] += 1
            elif 'CRIT' in est:
                resumen_estados['CRITICO'] += 1
            elif 'FUERA' in est:
                resumen_estados['FUERA DE RUTA'] += 1
            else:
                resumen_estados['BUENO'] += 1

        # Prepare equipos_incluidos
        equipos_incluidos = [{"id": eq["id"], "codigo": eq.get("codigo"), "nombre": eq.get("nombre")} for eq in valid_equipos]

        # Verificar si ya existe un libro para esta ubicación y campaña
        cursor.execute("""
            SELECT id FROM libros 
            WHERE ubicacion_id = ? AND campania = ?
            LIMIT 1
        """, (ubicacion_id, campania_activa))
        existing_row = cursor.fetchone()
        
        if existing_row:
            libro_id = existing_row['id']
            # Obtener la última versión generada
            cursor.execute("""
                SELECT COALESCE(MAX(version), 0) FROM versiones_reportes
                WHERE tipo = 'libro' AND reporte_id = ?
            """, (libro_id,))
            max_version = cursor.fetchone()[0]
            next_version = max_version + 1
            
            # Actualizar el registro principal
            cursor.execute("""
                UPDATE libros SET
                    nombre_ubicacion = ?,
                    empresa_id = ?,
                    nombre_empresa = ?,
                    usuario_id = ?,
                    numero_equipos = ?,
                    ruta_pdf_local = ?,
                    ruta_pdf_drive = ?,
                    drive_file_id = ?,
                    tamanio_pdf = ?,
                    resumen_estados = ?,
                    equipos_incluidos = ?,
                    fecha_generacion = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                nombre_ubicacion,
                empresa_id,
                nombre_empresa,
                user_id,
                len(valid_equipos),
                ruta_local,
                drive_link,
                drive_file_id,
                tamanio_pdf,
                json.dumps(resumen_estados),
                json.dumps(equipos_incluidos),
                libro_id
            ))
        else:
            # Insertar registro nuevo
            cursor.execute("""
                INSERT INTO libros (
                    ubicacion_id, nombre_ubicacion, empresa_id, nombre_empresa,
                    usuario_id, numero_equipos, ruta_pdf_local, ruta_pdf_drive,
                    drive_file_id, tamanio_pdf, campania, resumen_estados, equipos_incluidos
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                ubicacion_id,
                nombre_ubicacion,
                empresa_id,
                nombre_empresa,
                user_id,
                len(valid_equipos),
                ruta_local,
                drive_link,
                drive_file_id,
                tamanio_pdf,
                campania_activa,
                json.dumps(resumen_estados),
                json.dumps(equipos_incluidos)
            ))
            libro_id = cursor.lastrowid
            next_version = 1
            
        # Guardar en versiones_reportes
        cursor.execute("""
            INSERT INTO versiones_reportes (
                tipo, reporte_id, version, ruta_pdf_local, ruta_pdf_drive, 
                drive_file_id, fecha_generacion, usuario_id, notas
            ) VALUES ('libro', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
        """, (
            libro_id,
            next_version,
            ruta_local,
            drive_link,
            drive_file_id,
            user_id,
            f"Generación de versión {next_version}"
        ))
        db.commit()

        # 8. Registrar en auditoría
        try:
            registrar_auditoria(
                usuario_id=user_id,
                accion="GENERAR_LIBRO_AREA",
                tabla="libros",
                registro_id=libro_id,
                detalles=f"Generado libro consolidado por área '{nombre_ubicacion}' con {len(valid_equipos)} equipos (omitidos {omitidos_count})."
            )
        except Exception as audit_err:
            logger.error(f"Error registrando auditoría para libro {libro_id}: {audit_err}")

        libro_progress[ubicacion_id] = "Completado"
        
        return {
            "libro_id": libro_id,
            "ruta": ruta_local,
            "drive_link": drive_link
        }

    except HTTPException as he:
        db.rollback()
        raise he
    except Exception as e:
        db.rollback()
        libro_progress[ubicacion_id] = f"Error: {str(e)}"
        logger.error(f"Error interno al generar el libro por área: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno al generar el libro por área: {str(e)}")
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

@router.get("/progreso/{ubicacion_id}", response_model=Dict[str, Any])
def get_libro_progreso(ubicacion_id: int):
    status = libro_progress.get(ubicacion_id, "No iniciado")
    return {"status": status}

@router.get("/descargar/{libro_id}")
def descargar_libro(
    libro_id: int, 
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    cursor = db.cursor()
    cursor.execute("SELECT ruta_pdf_local FROM libros WHERE id = ?", (libro_id,))
    libro = cursor.fetchone()
    if not libro or not libro["ruta_pdf_local"] or not os.path.exists(libro["ruta_pdf_local"]):
        raise HTTPException(status_code=404, detail="Archivo de libro no encontrado")
    
    return FileResponse(path=libro["ruta_pdf_local"], filename=os.path.basename(libro["ruta_pdf_local"]))

@router.get("/historial", response_model=List[Dict[str, Any]])
def historial_libros(
    db: sqlite3.Connection = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    cursor = db.cursor()
    cursor.execute("""
        SELECT l.*, u.username as nombre_usuario 
        FROM libros l
        LEFT JOIN usuarios u ON l.usuario_id = u.id
        ORDER BY l.fecha_generacion DESC
    """)
    return [dict(row) for row in cursor.fetchall()]

@router.post("/cancelar/{ubicacion_id}", response_model=Dict[str, Any])
def cancelar_libro(
    ubicacion_id: int,
    current_user: dict = Depends(get_current_user)
):
    libro_cancel[ubicacion_id] = True
    libro_progress[ubicacion_id] = "Cancelado"
    return {"status": "success", "message": "Cancelación solicitada."}

@router.get("/validar/{ubicacion_id}", response_model=Dict[str, Any])
def validar_libro(
    ubicacion_id: int,
    db: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        cursor = db.cursor()
        
        # 1. Obtener datos de campaña y año
        from app.services.db_service import get_config_value_db
        import re
        campania_activa = get_config_value_db("reporte_campania", "PGP 2026")
        digits = re.findall(r'\d+', campania_activa)
        anio_campania = int(digits[0]) if digits else 2026

        # 2. Obtener todos los equipos activos de la ubicación
        cursor.execute("""
            SELECT id, codigo, nombre FROM equipos 
            WHERE ubicacion_id = ? AND activo = 1
        """, (ubicacion_id,))
        equipos = [dict(row) for row in cursor.fetchall()]
        
        if not equipos:
            return {
                "valid": False,
                "alertas": [{
                    "tipo": "critico",
                    "mensaje": "No hay equipos activos en esta ubicación.",
                    "detalles": "Debe agregar al menos un equipo activo antes de generar el libro."
                }],
                "kpis": {
                    "total_equipos": 0,
                    "inspeccionados": 0,
                    "buenos": 0,
                    "regulares": 0,
                    "criticos": 0,
                    "fuera_ruta": 0,
                    "ica": 0.0,
                    "icd": 100.0
                }
            }
        
        alertas = []
        total_equipos = len(equipos)
        inspeccionados_count = 0
        buenos_count = 0
        regulares_count = 0
        criticos_count = 0
        fuera_ruta_count = 0
        
        equipos_con_falla = 0  # CRITICO o REGULAR
        equipos_con_falla_completos = 0  # CRITICO o REGULAR con fotos y recomendaciones válidas
        
        # 3. Validar inspecciones, recomendaciones y fotos
        from app.services.memory_service import obtener_memoria_imagenes
        from app.services.drive_service import sugerir_carpetas as drive_sugerir_carpetas, listar_archivos
        
        for eq in equipos:
            eq_id = eq["id"]
            codigo_eq = eq.get("codigo", "N/A")
            nombre_eq = eq.get("nombre", "N/A")
            
            # 3.1 Inspecciones del año
            cursor.execute("""
                SELECT * FROM inspecciones 
                WHERE equipo_id = ? AND anio = ? 
                ORDER BY id DESC LIMIT 1
            """, (eq_id, anio_campania))
            insp_row = cursor.fetchone()
            if not insp_row:
                alertas.append({
                    "tipo": "sin_inspeccion",
                    "mensaje": f"El equipo {codigo_eq} - {nombre_eq} no tiene inspección registrada para el año {anio_campania}.",
                    "detalles": "Se omitirá del libro consolidado."
                })
                continue
            
            inspeccionados_count += 1
            insp = dict(insp_row)
            estado = str(insp.get("estado", "BUENO")).upper()
            
            is_falla = False
            if "CRIT" in estado:
                criticos_count += 1
                is_falla = True
            elif "REGULAR" in estado:
                regulares_count += 1
                is_falla = True
            elif "FUERA" in estado:
                fuera_ruta_count += 1
            else:
                buenos_count += 1
                
            if is_falla:
                equipos_con_falla += 1
                
                # 3.2 Recomendaciones obligatorias para REGULAR / CRITICO
                recom = (insp.get("recomendaciones") or "").strip()
                has_recom = recom and len(recom) >= 5
                if not has_recom:
                    alertas.append({
                        "tipo": "sin_recomendaciones",
                        "mensaje": f"El equipo {codigo_eq} ({estado}) no tiene recomendaciones o el texto es demasiado corto.",
                        "detalles": "Se requiere detallar las acciones correctivas propuestas."
                    })
                
                # 3.3 Fotos obligatorias para REGULAR / CRITICO
                has_photos = False
                saved_images = obtener_memoria_imagenes(eq_id)
                if saved_images:
                    has_photos = True
                else:
                    try:
                        sugerencias = drive_sugerir_carpetas(str(codigo_eq), str(nombre_eq), "root")
                        if sugerencias:
                            folder_id = sugerencias[0]['id']
                            archivos = listar_archivos(folder_id)
                            imagenes = [f for f in archivos if f.get('mimeType', '').startswith('image/')]
                            if imagenes:
                                has_photos = True
                    except Exception as e:
                        logger.error(f"Error comprobando fotos en Drive para {codigo_eq} durante validación: {e}")
                
                if not has_photos:
                    alertas.append({
                        "tipo": "sin_fotos",
                        "mensaje": f"El equipo {codigo_eq} ({estado}) no tiene fotos asociadas.",
                        "detalles": "Se recomienda subir registro fotográfico de la patología."
                    })
                
                if has_recom and has_photos:
                    equipos_con_falla_completos += 1
        
        ica = round((criticos_count / total_equipos) * 100, 1) if total_equipos > 0 else 0.0
        icd = round((equipos_con_falla_completos / equipos_con_falla) * 100, 1) if equipos_con_falla > 0 else 100.0
        
        kpis = {
            "total_equipos": total_equipos,
            "inspeccionados": inspeccionados_count,
            "buenos": buenos_count,
            "regulares": regulares_count,
            "criticos": criticos_count,
            "fuera_ruta": fuera_ruta_count,
            "ica": ica,
            "icd": icd
        }
        
        has_critico = any(a["tipo"] == "critico" for a in alertas)
        return {
            "valid": not has_critico,
            "alertas": alertas,
            "kpis": kpis
        }
    except Exception as e:
        logger.error(f"Error al validar libro para ubicación {ubicacion_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en la validación: {str(e)}")

