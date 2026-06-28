import os
import re
import json
import logging
import google.generativeai as genai
from google.generativeai import GenerativeModel

logger = logging.getLogger(__name__)

# Caché del modelo por (api_key, nombre_modelo). Evita reconstruir el cliente
# y reconfigurar la librería en cada petición; se invalida solo si cambia la
# API key o el modelo en la configuración (BD o variables de entorno).
_modelo_cache: dict = {}


def inicializar_gemini() -> GenerativeModel:
    # Import diferido para evitar una dependencia circular con db_service.
    from app.services.db_service import get_config_value_db
    try:
        api_key = get_config_value_db("google_api_key") or os.getenv("GEMINI_API_KEY")
        nombre_modelo = get_config_value_db("gemini_model") or "gemini-3.5-flash"

        if not api_key:
            logger.warning("google_api_key no configurada en BD ni GEMINI_API_KEY en variables de entorno.")

        clave_cache = (api_key, nombre_modelo)
        modelo = _modelo_cache.get(clave_cache)
        if modelo is None:
            genai.configure(api_key=api_key, transport="rest")
            modelo = genai.GenerativeModel(nombre_modelo)
            _modelo_cache[clave_cache] = modelo
        return modelo
    except Exception as e:
        logger.error(f"Error inicializando Gemini: {e}")
        raise


def analizar_imagenes(imagenes_b64: list, historial: str, instrucciones: str) -> dict:
    try:
        model = inicializar_gemini()
        parts = [
            instrucciones,
            f"Historial: {historial}",
            *({"mime_type": "image/jpeg", "data": img} for img in imagenes_b64),
        ]
        response = model.generate_content(parts, request_options={"timeout": 60})
        return extraer_diagnostico(response.text)
    except Exception as e:
        logger.error(f"Error analizando imágenes: {e}")
        return {"error": str(e)}


def chat_inspeccion(mensaje: str, historial_chat: list) -> str:
    try:
        model = inicializar_gemini()
        chat = model.start_chat(history=historial_chat)
        response = chat.send_message(mensaje, request_options={"timeout": 30})
        return response.text
    except Exception as e:
        logger.error(f"Error en chat de inspección: {e}")
        return "Lo siento, ocurrió un error procesando su solicitud."


def extraer_diagnostico(respuesta_json: str) -> dict:
    # Gemini suele envolver el JSON en vallas Markdown (```json ... ```); se eliminan
    # antes de parsear, tanto la variante con etiqueta de lenguaje como la genérica.
    texto = re.sub(r"^\s*```(?:json)?\s*", "", respuesta_json)
    texto = re.sub(r"\s*```\s*$", "", texto).strip()
    try:
        return json.loads(texto)
    except json.JSONDecodeError as e:
        logger.error(f"Error decodificando JSON de Gemini: {e}")
        return {"raw_text": respuesta_json}


def preparar_prompt_analisis(equipo: dict, historial: list, instrucciones: str, aprendizaje: str) -> str:
    lineas = [
        "Analiza la siguiente inspección de equipo.",
        f"Equipo: {equipo.get('nombre', 'Desconocido')} (ID: {equipo.get('id', 'N/A')})",
        f"Instrucciones: {instrucciones}",
    ]
    if historial:
        lineas.append(f"Historial previo: {json.dumps(historial)}")
    if aprendizaje:
        lineas.append(f"Lecciones aprendidas a tener en cuenta: {aprendizaje}")
    lineas.append("Proporciona el resultado en formato JSON estructurado.")
    return "\n".join(lineas)


def validar_respuesta_gemini(respuesta: dict) -> bool:
    required_keys = ("diagnostico", "estado", "recomendaciones")
    return all(key in respuesta for key in required_keys)


def build_annotation_context(annotations: list) -> str:
    """
    Convierte la geometría de las anotaciones (incluidas las coordenadas en píxeles
    naturalPx) en un bloque de referencia espacial estructurado para incluirlo en el
    prompt de Gemini. Degrada con elegancia cuando naturalPx está ausente.
    """
    if not annotations:
        return ""
    lines = ["SPATIAL ANNOTATION REFERENCE (pixel coordinates on original image):"]
    for i, ann in enumerate(annotations, 1):
        geom = ann.get("geometry", {})
        npx = geom.get("naturalPx", {})
        text = ann.get("data", {}).get("text", "")
        ann_type = geom.get("type", "")
        img_w = npx.get("imageWidth", "?")
        img_h = npx.get("imageHeight", "?")
        if ann_type in ("LINE", "ARROW") and "x1" in npx:
            lines.append(
                f"{i}. {ann_type} '{text}': "
                f"from ({npx['x1']}px, {npx['y1']}px) "
                f"to ({npx['x2']}px, {npx['y2']}px) "
                f"on {img_w}x{img_h}px image"
            )
        elif ann_type in ("RECTANGLE", "CIRCLE", "TEXT") and "x" in npx:
            lines.append(
                f"{i}. {ann_type} '{text}': "
                f"at ({npx['x']}px, {npx['y']}px) "
                f"size {npx['width']}x{npx['height']}px "
                f"on {img_w}x{img_h}px image"
            )
        elif ann_type == "FREEHAND" and "points" in npx:
            pts = npx["points"]
            if pts:
                lines.append(
                    f"{i}. FREEHAND '{text}': "
                    f"{len(pts)} points, "
                    f"bbox from ({min(p[0] for p in pts)}px, {min(p[1] for p in pts)}px) "
                    f"to ({max(p[0] for p in pts)}px, {max(p[1] for p in pts)}px) "
                    f"on {img_w}x{img_h}px image"
                )
    return "\n".join(lines)
