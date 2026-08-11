import os
import base64
import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
import sqlite3

logger = logging.getLogger(__name__)

FOTOS_DIR = os.getenv("FOTOS_DIR", os.path.join("data", "fotos"))
AUDIOS_DIR = os.getenv("AUDIOS_DIR", os.path.join("data", "audios"))


def procesar_inspecciones_batch(
    db: sqlite3.Connection,
    inspecciones: List[Dict[str, Any]],
    user_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Procesa un lote (batch) de inspecciones capturadas desde la app celular/PWA.
    Sincroniza el estado del equipo, la inspección en SQLite, guarda las fotos y audios
    locales y registra las anotaciones y comentarios correspondientes.
    """
    procesados = 0
    errores = []
    cursor = db.cursor()

    for idx, item in enumerate(inspecciones):
        client_uuid = item.get("client_uuid")
        equipo_id = item.get("id_activo")
        codigo_activo = item.get("codigo_activo")

        # Resolución de equipo_id
        if not equipo_id and codigo_activo:
            cursor.execute("SELECT id FROM equipos WHERE codigo = ?", (codigo_activo,))
            row = cursor.fetchone()
            if row:
                equipo_id = row["id"] if isinstance(row, (sqlite3.Row, dict)) else row[0]

        if not equipo_id:
            msg = f"Item {idx}: No se pudo determinar equipo_id para activo '{codigo_activo or equipo_id}'."
            logger.warning(msg)
            errores.append(msg)
            continue

        estado = item.get("estado") or "Operativo"
        notas = item.get("notas") or ""
        timestamp = item.get("timestamp")

        # Calcular año
        if timestamp:
            try:
                ts_sec = timestamp / 1000.0 if timestamp > 1e11 else timestamp
                anio = datetime.fromtimestamp(ts_sec).year
            except Exception:
                anio = datetime.now().year
        else:
            anio = datetime.now().year

        try:
            # 1. Actualizar o insertar en tabla `inspecciones`
            cursor.execute("SELECT id FROM inspecciones WHERE equipo_id = ? AND anio = ?", (equipo_id, anio))
            row_insp = cursor.fetchone()

            if row_insp:
                insp_id = row_insp["id"] if isinstance(row_insp, (sqlite3.Row, dict)) else row_insp[0]
                cursor.execute("""
                    UPDATE inspecciones 
                    SET estado = ?, diagnostico = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                """, (estado, notas, insp_id))
            else:
                cursor.execute("""
                    INSERT INTO inspecciones (equipo_id, anio, estado, diagnostico, created_at, updated_at, reporte_generado)
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
                """, (equipo_id, anio, estado, notas))
                insp_id = cursor.lastrowid

            # 2. Actualizar estado_actual en tabla `equipos`
            cursor.execute("""
                UPDATE equipos 
                SET estado_actual = ? 
                WHERE id = ?
            """, (estado, equipo_id))

            # 3. Procesar fotos
            fotos = item.get("fotos") or []
            equipo_foto_dir = os.path.join(FOTOS_DIR, str(equipo_id))
            os.makedirs(equipo_foto_dir, exist_ok=True)

            for f_idx, foto in enumerate(fotos):
                data_b64 = foto.get("data", "")
                if not data_b64:
                    continue

                if "," in data_b64:
                    _, data_str = data_b64.split(",", 1)
                else:
                    data_str = data_b64

                try:
                    img_bytes = base64.b64decode(data_str)
                except Exception as b64_err:
                    logger.error(f"Error decodificando imagen en foto {f_idx}: {b64_err}")
                    continue

                foto_ts = foto.get("timestamp") or int(datetime.now().timestamp())
                foto_uuid = str(uuid.uuid4())[:8]
                categoria = foto.get("categoria") or item.get("categoria_foto") or "General"
                filename = f"foto_{foto_ts}_{foto_uuid}.jpg"
                filepath = os.path.join(equipo_foto_dir, filename)

                with open(filepath, "wb") as f_out:
                    f_out.write(img_bytes)

                image_id = filename
                comentario_foto = f"[{categoria}] {notas}".strip() if notas else categoria

                cursor.execute("""
                    INSERT OR REPLACE INTO anotaciones_imagenes (equipo_id, image_id, annotations, comentario, updated_at)
                    VALUES (?, ?, '[]', ?, CURRENT_TIMESTAMP)
                """, (equipo_id, image_id, comentario_foto))

                # Subida opcional a Google Drive si se especificó la carpeta destino
                drive_folder_id = item.get("drive_folder_id")
                if drive_folder_id:
                    try:
                        from app.services.drive_service import subir_archivo
                        res_drive = subir_archivo(filepath, filename, drive_folder_id)
                        if res_drive and "id" in res_drive:
                            logger.info(f"Foto {filename} subida a Drive carpeta {drive_folder_id} (ID: {res_drive['id']})")
                    except Exception as drive_err:
                        logger.error(f"Error subiendo foto a Drive ({drive_folder_id}): {drive_err}")

            # 4. Procesar y transcribir audios
            audios = item.get("audios") or []
            transcripciones = []
            if audios:
                equipo_audio_dir = os.path.join(AUDIOS_DIR, str(equipo_id))
                os.makedirs(equipo_audio_dir, exist_ok=True)
                for a_idx, audio in enumerate(audios):
                    audio_b64 = audio.get("data", "")
                    if not audio_b64:
                        continue
                    if "," in audio_b64:
                        _, a_data = audio_b64.split(",", 1)
                    else:
                        a_data = audio_b64
                    try:
                        audio_bytes = base64.b64decode(a_data)
                        audio_ts = audio.get("timestamp") or int(datetime.now().timestamp())
                        audio_filename = f"audio_{audio_ts}_{str(uuid.uuid4())[:8]}.wav"
                        audio_filepath = os.path.join(equipo_audio_dir, audio_filename)
                        with open(audio_filepath, "wb") as a_out:
                            a_out.write(audio_bytes)

                        # Transcripción inteligente vía Gemini IA
                        try:
                            from app.services.gemini_service import transcribir_audio_bytes
                            txt_trans = transcribir_audio_bytes(audio_bytes, mime_type="audio/wav")
                            if txt_trans:
                                transcripciones.append(txt_trans)
                        except Exception as tr_err:
                            logger.warning(f"No se pudo transcribir audio {a_idx}: {tr_err}")
                    except Exception as audio_err:
                        logger.error(f"Error procesando audio {a_idx}: {audio_err}")

                # Si hubo transcripciones exitosas, interpretar con IA de Gemini
                if transcripciones:
                    txt_unido = "\n".join(transcripciones)
                    cursor.execute("SELECT codigo, nombre FROM equipos WHERE id = ?", (equipo_id,))
                    row_eq_info = cursor.fetchone()
                    eq_desc = f"{row_eq_info['codigo']} - {row_eq_info['nombre']}" if row_eq_info else f"Equipo {equipo_id}"
                    
                    try:
                        from app.services.gemini_service import interpretar_dictado_inspeccion
                        interpretacion = interpretar_dictado_inspeccion(txt_unido, equipo_info=eq_desc)
                        
                        diag_ia = interpretacion.get("diagnostico") or txt_unido
                        acc_ia = interpretacion.get("acciones") or ""
                        rec_ia = interpretacion.get("recomendaciones") or ""
                        est_ia = interpretacion.get("estado")
                        
                        cursor.execute("SELECT diagnostico, acciones, recomendaciones, estado FROM inspecciones WHERE id = ?", (insp_id,))
                        row_curr = cursor.fetchone()
                        
                        curr_diag = (row_curr["diagnostico"] if isinstance(row_curr, (sqlite3.Row, dict)) else row_curr[0]) or ""
                        curr_acc = (row_curr["acciones"] if isinstance(row_curr, (sqlite3.Row, dict)) else row_curr[1]) or ""
                        curr_rec = (row_curr["recomendaciones"] if isinstance(row_curr, (sqlite3.Row, dict)) else row_curr[2]) or ""
                        curr_est = (row_curr["estado"] if isinstance(row_curr, (sqlite3.Row, dict)) else row_curr[3]) or "BUENO"
                        
                        new_diag = f"{curr_diag}\n{diag_ia}".strip() if curr_diag and diag_ia not in curr_diag else (diag_ia or curr_diag)
                        new_acc = f"{curr_acc}\n{acc_ia}".strip() if curr_acc and acc_ia not in curr_acc else (acc_ia or curr_acc)
                        new_rec = f"{curr_rec}\n{rec_ia}".strip() if curr_rec and rec_ia not in curr_rec else (rec_ia or curr_rec)
                        
                        # Si Gemini infirió un estado válido (REGULAR, CRITICO, BUENO, FUERA DE RUTA), actualizarlo
                        new_est = est_ia.upper() if est_ia and str(est_ia).upper() in ["BUENO", "REGULAR", "CRITICO", "FUERA DE RUTA"] else curr_est
                        
                        cursor.execute("""
                            UPDATE inspecciones 
                            SET diagnostico = ?, acciones = ?, recomendaciones = ?, estado = ?, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        """, (new_diag, new_acc, new_rec, new_est, insp_id))
                        
                        cursor.execute("UPDATE equipos SET estado_actual = ? WHERE id = ?", (new_est, equipo_id))
                        logger.info(f"Dictado interpretado con éxito por IA para equipo {equipo_id}. Estado: {new_est}")
                    except Exception as ia_err:
                        logger.error(f"Error interpretando dictado con IA: {ia_err}")
                        txt_unido_fallback = "\n".join(f"[Dictado de Voz]: {t}" for t in transcripciones)
                        cursor.execute("SELECT diagnostico FROM inspecciones WHERE id = ?", (insp_id,))
                        row_diag = cursor.fetchone()
                        diag_actual = (row_diag["diagnostico"] if isinstance(row_diag, (sqlite3.Row, dict)) else row_diag[0]) if row_diag else ""
                        nuevo_diag = f"{diag_actual}\n{txt_unido_fallback}".strip() if diag_actual else txt_unido_fallback
                        cursor.execute("UPDATE inspecciones SET diagnostico = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (nuevo_diag, insp_id))

            # 5. Auditoría
            detalles_audit = f"Sincronización batch desde celular (client_uuid: {client_uuid or 'n/a'}). Fotos: {len(fotos)}, Audios: {len(audios)}"
            cursor.execute("""
                INSERT INTO auditoria (user_id, accion, tabla, registro_id, detalles, created_at)
                VALUES (?, 'INSPECCION_BATCH', 'inspecciones', ?, ?, CURRENT_TIMESTAMP)
            """, (user_id, insp_id, detalles_audit))

            procesados += 1
        except Exception as e:
            logger.error(f"Error procesando inspección para equipo {equipo_id}: {e}", exc_info=True)
            errores.append(f"Equipo {equipo_id}: {str(e)}")

    db.commit()
    return {
        "status": "success",
        "procesados": procesados,
        "total": len(inspecciones),
        "errores": errores
    }
