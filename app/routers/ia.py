from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import sqlite3
import json
import base64
import logging
import uuid
import datetime
import os

from app.core.dependencies import get_db, get_current_user
from app.services.drive_service import descargar_imagen
from app.services.gemini_service import analizar_imagenes, inicializar_gemini, build_annotation_context
from app.services.learning_service import cargar_ejemplos_few_shot, obtener_aprendizaje_texto
from app.config.prompts import REGLAS_NEGOCIO
from app.utils.text_utils import es_estado_valido, normalizar_texto

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ia", tags=["ia"])

# Diccionario global para mantener las sesiones de chat activas de Gemini en memoria
ACTIVE_CHATS = {}


def _estado_validado(valor: Optional[str]) -> str:
    """Normaliza el estado devuelto por Gemini a uno de los 4 válidos. Si el valor
    no es reconocible, devuelve 'FUERA DE RUTA' en lugar de asumir un estado
    intermedio sin evidencia (antes el default inseguro era 'REGULAR')."""
    estado = normalizar_texto(valor or "")
    return estado if es_estado_valido(estado) else "FUERA DE RUTA"

class AnalizarRequest(BaseModel):
    equipo_id: int
    image_drive_ids: List[str]
    indicaciones_previas: Optional[str] = None
    anotaciones: Optional[Dict[str, List[Dict[str, Any]]]] = None

class GuardarRequest(BaseModel):
    equipo_id: int
    session_id: Optional[str] = None
    estado: str
    acciones: str
    diagnostico: str
    recomendaciones: str
    leccion_aprendida: Optional[str] = None
    image_drive_ids: List[str]
    generar_pdf: bool = True
    anotaciones: Optional[Dict[str, List[Dict[str, Any]]]] = None

def describir_anotaciones(anotaciones: Optional[Dict[str, List[Dict[str, Any]]]], image_drive_ids: List[str]) -> str:
    if not anotaciones:
        return ""
    
    descripciones = []
    for idx, file_id in enumerate(image_drive_ids):
        image_annotations = anotaciones.get(file_id, [])
        if not image_annotations:
            continue
        
        descripciones.append(f"Anotaciones en la Imagen {idx + 1} (ID de archivo en Drive: {file_id}):")
        for ann_idx, ann in enumerate(image_annotations):
            geom = ann.get("geometry", {})
            data_field = ann.get("data", {})
            text = data_field.get("text", "").strip()
            
            tipo = geom.get("type", "RECTANGLE").upper()
            color = geom.get("color", "#ff0000")
            
            # Mapear nombres de formas a español
            nombres_formas = {
                "RECTANGLE": "rectángulo",
                "CIRCLE": "círculo",
                "LINE": "línea recta",
                "ARROW": "flecha",
                "TEXT": "área de texto",
                "FREEHAND": "trazo libre (lápiz)"
            }
            forma = nombres_formas.get(tipo, "área marcada")
            
            desc_text = f"  - [{ann_idx + 1}] Un {forma} de color {color}"
            if text:
                desc_text += f" con la nota: \"{text}\""
            else:
                desc_text += " sin nota asociada."
            
            descripciones.append(desc_text)
            
    return "\n".join(descripciones)

class ChatRequest(BaseModel):
    session_id: str
    mensaje: str

@router.post("/analizar", response_model=Dict[str, Any])
def analizar(data: AnalizarRequest, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        # 1. Obtener detalles del equipo
        cursor = db.cursor()
        cursor.execute("SELECT * FROM equipos WHERE id = ?", (data.equipo_id,))
        eq_row = cursor.fetchone()
        if not eq_row:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
        equipo = dict(eq_row)

        # 2. Obtener historial de inspección para 2024
        cursor.execute("SELECT estado, diagnostico FROM inspecciones WHERE equipo_id = ? AND anio = 2024 LIMIT 1", (data.equipo_id,))
        hist_row = cursor.fetchone()
        historial_2024 = dict(hist_row) if hist_row else {"estado": "Sin datos", "diagnostico": "Sin diagnóstico previo."}

        # 3. Descargar y codificar imágenes en base64
        images_b64 = []
        for file_id in data.image_drive_ids:
            try:
                img_bytes = descargar_imagen(file_id)
                if img_bytes:
                    img_b64 = base64.b64encode(img_bytes).decode('utf-8')
                    images_b64.append(img_b64)
            except Exception as drive_err:
                logger.error(f"Error descargando imagen {file_id}: {drive_err}")
                
        if not images_b64:
            raise HTTPException(
                status_code=400, 
                detail="No se pudieron descargar o decodificar las imágenes seleccionadas desde Google Drive. Verifique la conexión."
            )

        # 4. Cargar lecciones aprendidas anteriores
        aprendizaje = obtener_aprendizaje_texto()

        # Generar texto descriptivo de las anotaciones si existen
        anotaciones_texto = describir_anotaciones(data.anotaciones, data.image_drive_ids)

        # Generar referencia espacial en píxeles naturales para Gemini
        all_annotations_flat = []
        if data.anotaciones:
            for anns in data.anotaciones.values():
                all_annotations_flat.extend(anns)
        spatial_context = build_annotation_context(all_annotations_flat)
        
        # 5. Generar prompt estructurado para Gemini
        prompt = f"""
INSTRUCCIÓN DE ESTILO OBLIGATORIA (debe respetarse en TODO el informe):
- PROHIBIDO usar primera persona singular: NO escribas "yo", "he verificado", "encuentro", "mi inspección", "he inspeccionado", "detecto", "constato", "he constatado".
- PROHIBIDO usar tiempo pasado para narrar acciones: NO escribas "inspeccioné", "revisé", "verifiqué", "realicé", "evaluué".
- DIAGNÓSTICO: Escribe siempre en TIEMPO PRESENTE IMPERSONAL. Ejemplos correctos: "El equipo presenta...", "Se observa deterioro...", "La línea muestra...", "Los soportes exhiben...".
- ACCIONES y RECOMENDACIONES: Escribe siempre en INFINITIVO. Ejemplos correctos: "Realizar inspección...", "Proceder a cambio...", "Informar al área...", "Continuar con...", "Reemplazar elementos...".

Redacta el siguiente informe técnico de inspección industrial. Solo describe lo que realmente se observa en las fotos.

{REGLAS_NEGOCIO}

Equipo a analizar:
Nombre: {equipo.get('nombre')}, Área: {equipo.get('area') or ''}, Código/Número: {equipo.get('codigo') or equipo.get('numero') or ''}, Material: {equipo.get('material') or ''}, Criticidad: {equipo.get('criticidad') or ''}.

Historial del PGP 2024 (úsalo como base para componentes no visibles en las fotos):
- Estado: {historial_2024.get('estado')}
- Diagnóstico: {historial_2024.get('diagnostico')}

Indicaciones previas del inspector humano:
{data.indicaciones_previas or 'Ninguna indicación adicional.'}

Lecciones aprendidas a tener en cuenta:
{aprendizaje or 'Ninguna lección previa registrada.'}
"""

        if anotaciones_texto:
            prompt += f"""
Anotaciones y marcas visuales que el inspector realizó sobre las imágenes para destacar áreas de interés:
{anotaciones_texto}
Por favor, analiza con extremo cuidado las zonas señaladas por estas anotaciones y ten en cuenta las notas del inspector en tu diagnóstico técnico.
"""

        if spatial_context:
            prompt += f"""
{spatial_context}
"""

        prompt += """
Devuelve tu respuesta ÚNICAMENTE en formato JSON (sin bloques markdown como ```json):
{
  "estado": "BUENO" | "REGULAR" | "CRITICO" | "FUERA DE RUTA",
  "diagnostico": "TIEMPO PRESENTE IMPERSONAL. Ejemplos: 'El tramo de cañería presenta...', 'Se observa...', 'Los soportes exhiben...'. JAMÁS uses 'yo', 'he', 'detecté', 'encontré', 'verifiqué', 'inspeccioné'.",
  "acciones": "INFINITIVO IMPERSONAL. Ejemplos: 'Realizar inspección visual externa', 'Verificar estado de bridas'. Muy breve.",
  "recomendaciones": {
    "EQUIPO INTERIOR": "INFINITIVO: 'Realizar...', 'Continuar...', 'Solicitar...', o 'Sin comentarios'",
    "EQUIPO EXTERIOR": "INFINITIVO o 'Sin comentarios'",
    "SOPORTES CAÑERÍAS ASOCIADAS": "INFINITIVO o 'Sin comentarios'",
    "VÁLVULAS": "INFINITIVO o 'Sin comentarios'",
    "ELEMENTOS DE SUJECIÓN EN GENERAL": "INFINITIVO o 'Sin comentarios'",
    "ANCLAJES": "INFINITIVO o 'Sin comentarios'",
    "ACOMETIDAS": "INFINITIVO o 'Sin comentarios'"
  }
}

RECORDATORIO FINAL: El diagnóstico debe estar en TIEMPO PRESENTE IMPERSONAL (no primera persona). Las acciones y recomendaciones en INFINITIVO.

*REGLA PREVENTIVA CRÍTICA PARA PLÁSTICOS*: Si el material es plástico (FRP, ACRBA, PP, etc.), en 'ACOMETIDAS' escribe obligatoriamente: 'Como medida preventiva y para evitar recurrir a los golpes para desmontar los espárragos y bulones en todas las acometidas bridadas (incluida la BdH) y sus consecuencias indeseables (roturas y fisuras recurrentes), reemplazar los elementos de sujeción y juntas en un plazo no mayor a 1 año. Aplica para todos los equipos y cañerías plásticas.'
"""


        # 6. Inicializar y llamar a Gemini
        from app.services.db_service import get_config_value_db
        db_api_key = get_config_value_db("google_api_key")
        api_key = db_api_key if db_api_key else os.getenv("GEMINI_API_KEY")
        
        if not api_key:
            raise HTTPException(
                status_code=500, 
                detail="La clave de la API de Gemini (google_api_key o variable de entorno) no está configurada en el servidor. Por favor agréguela en Configuración."
            )

        db_model = get_config_value_db("gemini_model") or "gemini-3.5-flash"

        system_instruction = """
Eres un inspector industrial experto en activos mecánicos, piletas y cañerías de proceso (FRP, ACRBA) redactando un informe técnico formal.
Debes redactar todo de manera estrictamente impersonal y formal.
Está completamente prohibido usar la primera persona del singular ("yo", "he verificado", "mi inspección") y verbos en pasado para narrar tus acciones (no "inspeccioné", "revisé").
- Para el DIAGNÓSTICO: Describe el estado actual o hechos únicamente en tiempo presente impersonal (ej: "El tramo de cañería presenta...", "Se observa desgaste...").
- Para las ACCIONES y RECOMENDACIONES: Escribe siempre las tareas usando verbos en INFINITIVO (ej: "Continuar con...", "Proceder a...", "Informar al área...", "Reemplazar...", "Solicitar...").
No menciones nunca limitaciones de fotos ni digas que "no se cuenta con imágenes" o "no se puede evaluar". Para cualquier zona o componente no visible, hereda o asume exactamente el diagnóstico del Historial PGP 2024 o no lo nombres.
Debes responder ÚNICAMENTE en formato JSON con la estructura indicada, respetando las llaves exactas.
"""

        import google.generativeai as genai
        try:
            genai.configure(api_key=api_key, transport='rest')
            model = genai.GenerativeModel(
                model_name=db_model,
                system_instruction=system_instruction
            )
        except Exception as model_err:
            raise HTTPException(status_code=500, detail=f"Error al configurar Gemini: {model_err}")

        # Estructurar partes del mensaje inicial (Texto + Imágenes inline)
        parts = [prompt]
        for img_b64 in images_b64:
            parts.append({"mime_type": "image/jpeg", "data": img_b64})
            
        try:
            response = model.generate_content(parts, request_options={"timeout": 60})
        except Exception as gem_err:
            raise HTTPException(status_code=502, detail=f"Fallo al comunicarse con Gemini API: {gem_err}")
            
        # Iniciar chat session con el historial inicial para las futuras interacciones
        chat_session = model.start_chat(history=[
            {"role": "user", "parts": [prompt]},
            {"role": "model", "parts": [response.text]}
        ])

        # Parsear respuesta de Gemini
        import json
        import re
        res_text = response.text.strip()
        print(">>> RAW RESP_TEXT:", res_text)
        match = re.search(r'\{.*\}', res_text, re.DOTALL)
        if match:
            analisis_data = json.loads(match.group(0))
        else:
            analisis_data = json.loads(res_text)
        print(">>> PARSED ANALISIS_DATA:", analisis_data)

        recs = analisis_data.get("recomendaciones", "")
        if isinstance(recs, dict):
            recs_lines = []
            for k, v in recs.items():
                recs_lines.append(f"{k}: {v}")
            recs_str = "\n".join(recs_lines)
        else:
            recs_str = str(recs)

        # 7. Registrar sesión en memoria y retornar
        session_id = str(uuid.uuid4())
        ACTIVE_CHATS[session_id] = chat_session

        return {
            "session_id": session_id,
            "analisis": {
                "estado": _estado_validado(analisis_data.get("estado")),
                "diagnostico": analisis_data.get("diagnostico", ""),
                "acciones": analisis_data.get("acciones", ""),
                "recomendaciones": recs_str
            },
            "historial_2024": historial_2024
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error en /analizar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en el análisis de imágenes: {str(e)}")

@router.post("/chat", response_model=Dict[str, Any])
def chat(data: ChatRequest, current_user: dict = Depends(get_current_user)):
    chat_session = ACTIVE_CHATS.get(data.session_id)
    if not chat_session:
        raise HTTPException(status_code=404, detail="Sesión de chat no encontrada o expirada.")
        
    try:
        prompt = f"""
El inspector humano comenta: "{data.mensaje}"

RECUERDA: no infieras daños que no se vean en las fotos. Ajusta el diagnóstico SOLO si el comentario aporta evidencia visual nueva o corrige la interpretación de algo visible; de lo contrario, mantén el diagnóstico previo. No rellenes con elementos no observados.

Devuelve la respuesta de la inspección consolidada en formato JSON con la misma estructura:
{{
  "estado": "BUENO" | "REGULAR" | "CRITICO" | "FUERA DE RUTA",
  "diagnostico": "Diagnóstico actualizado.",
  "acciones": "Actividades de inspección realizadas por el inspector actualizadas, de forma telegráfica. NO acciones a futuro.",
  "recomendaciones": "Recomendaciones actualizadas."
}}
"""
        response = chat_session.send_message(prompt, request_options={"timeout": 30})
        
        import json
        import re
        res_text = response.text.strip()
        match = re.search(r'\{.*\}', res_text, re.DOTALL)
        if match:
            analisis_data = json.loads(match.group(0))
        else:
            analisis_data = json.loads(res_text)

        return {
            "analisis": {
                "estado": _estado_validado(analisis_data.get("estado")),
                "diagnostico": analisis_data.get("diagnostico", ""),
                "acciones": analisis_data.get("acciones", ""),
                "recomendaciones": analisis_data.get("recomendaciones", "")
            }
        }
    except Exception as e:
        logger.error(f"Error en /chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error en la conversación con la IA: {str(e)}")

@router.post("/guardar", response_model=Dict[str, Any])
def guardar(data: GuardarRequest, background_tasks: BackgroundTasks, db: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        cursor = db.cursor()
        
        # 1. Guardar o actualizar la inspección
        cursor.execute("SELECT id FROM inspecciones WHERE equipo_id = ? AND anio = 2026", (data.equipo_id,))
        row = cursor.fetchone()
        
        if row:
            inspeccion_id = row[0]
            # Estado previo para trazabilidad de auditoría de la modificación.
            cursor.execute("SELECT estado, diagnostico, recomendaciones FROM inspecciones WHERE id = ?", (inspeccion_id,))
            prev = cursor.fetchone()
            es_modificacion = True
            cursor.execute("""
                UPDATE inspecciones
                SET estado = ?, acciones = ?, diagnostico = ?, recomendaciones = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (data.estado, data.acciones, data.diagnostico, data.recomendaciones, inspeccion_id))
        else:
            cursor.execute("""
                INSERT INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, created_at, updated_at, estado_generacion)
                VALUES (?, 2026, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'pendiente')
            """, (data.equipo_id, data.estado, data.acciones, data.diagnostico, data.recomendaciones))
            inspeccion_id = cursor.lastrowid
            prev = None
            es_modificacion = False
            
        # 2. Actualizar el estado del equipo en la tabla equipos
        cursor.execute("UPDATE equipos SET estado_actual = ? WHERE id = ?", (data.estado, data.equipo_id))
        
        # Guardar anotaciones si vienen en el request
        if data.anotaciones:
            for img_id, anns in data.anotaciones.items():
                cursor.execute("""
                    INSERT OR REPLACE INTO anotaciones_imagenes (equipo_id, image_id, annotations, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                """, (data.equipo_id, img_id, json.dumps(anns)))
                
        # Guardar en memoria de imagenes seleccionadas
        if data.image_drive_ids:
            from app.services.memory_service import guardar_memoria_imagenes
            guardar_memoria_imagenes(data.equipo_id, data.image_drive_ids)
        
        # 3. Guardar lección aprendida si aplica
        if data.leccion_aprendida:
            # Obtener nombre del equipo para referencia
            cursor.execute("SELECT nombre FROM equipos WHERE id = ?", (data.equipo_id,))
            eq_row = cursor.fetchone()
            eq_name = eq_row[0] if eq_row else "Equipo"
            
            # Registrar en la tabla de aprendizaje local
            cursor.execute("""
                INSERT INTO aprendizaje (equipo, ia_dijo, inspector_corrigio, leccion, fecha, created_at)
                VALUES (?, '', '', ?, DATE('now'), CURRENT_TIMESTAMP)
            """, (eq_name, data.leccion_aprendida))
            
            # Registrar en el archivo de texto lessons_learned.txt para el prompt general
            try:
                from app.services.learning_service import guardar_aprendizaje_local
                guardar_aprendizaje_local({
                    "fecha": datetime.datetime.now().strftime("%Y-%m-%d"),
                    "contexto": f"Corrección del equipo ID {data.equipo_id}",
                    "leccion": data.leccion_aprendida
                })
            except Exception as learn_err:
                logger.error(f"Error al guardar aprendizaje de texto: {learn_err}")
            
        db.commit()

        # 3b. Auditoría: registrar modificación de diagnóstico o alta de inspección.
        try:
            from app.core.audit import log_modificacion, registrar_auditoria
            if es_modificacion and prev is not None:
                log_modificacion(
                    usuario_id=current_user.get("id"),
                    tabla="inspecciones",
                    registro_id=inspeccion_id,
                    cambios={
                        "estado": {"antes": prev["estado"], "ahora": data.estado},
                        "diagnostico": {"antes": prev["diagnostico"], "ahora": data.diagnostico},
                        "recomendaciones": {"antes": prev["recomendaciones"], "ahora": data.recomendaciones},
                    }
                )
            else:
                registrar_auditoria(
                    usuario_id=current_user.get("id"),
                    accion="CREAR_INSPECCION",
                    tabla="inspecciones",
                    registro_id=inspeccion_id,
                    detalles=f"Inspección creada para el equipo ID {data.equipo_id} (estado: {data.estado})."
                )
        except Exception as audit_err:
            logger.error(f"Error registrando auditoría de inspección: {audit_err}")

        # 4. Generación del reporte
        pdf_status = "No solicitado"
        if data.generar_pdf:
            try:
                from app.services.reporte_service import iniciar_generacion_reporte
                iniciar_generacion_reporte(inspeccion_id)
                
                def generar_tarea(eq_id, user_id, ins_id):
                    from app.services.db_service import get_db_connection
                    from app.services.reporte_service import crear_reporte_individual_completo, actualizar_estado_reporte
                    try:
                        with get_db_connection() as db_conn:
                            crear_reporte_individual_completo(eq_id, db_conn, user_id)
                    except Exception as e:
                        logger.error(f"Error en background de reporte individual: {e}")
                        actualizar_estado_reporte(ins_id, "ERROR", str(e))
                        
                background_tasks.add_task(generar_tarea, data.equipo_id, current_user.get("id"), inspeccion_id)
                pdf_status = "Generando..."
            except Exception as rep_err:
                logger.error(f"Error inicializando estado del reporte: {rep_err}")
                pdf_status = "Error"
            
        return {
            "message": "Datos de inspección guardados exitosamente.",
            "inspeccion_id": inspeccion_id,
            "pdf_status": pdf_status
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error en /guardar: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error al guardar la inspección: {str(e)}")
