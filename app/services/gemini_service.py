import os
import re
import json
import logging
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
import google.generativeai as genai
from google.generativeai import GenerativeModel

load_dotenv()

logger = logging.getLogger(__name__)

# Caché del modelo por (api_key, nombre_modelo). Evita reconstruir el cliente
# y reconfigurar la librería en cada petición; se invalida solo si cambia la
# API key o el modelo en la configuración (BD o variables de entorno).
_modelo_cache: dict = {}


def sanitizar_nombre_modelo_gemini(modelo_solicitado: Optional[str]) -> str:
    """
    Normaliza y asegura un nombre de modelo válido para la API de Google Gemini.
    Si se solicita un modelo deprecado (ej. 'gemini-1.5-flash'), actualiza a 'gemini-2.5-flash'.
    """
    if not modelo_solicitado or not str(modelo_solicitado).strip():
        return "gemini-2.5-flash"
    
    clean_model = str(modelo_solicitado).strip()
    clean_lower = clean_model.lower()
    if clean_lower in ("gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro"):
        logger.warning(f"Modelo deprecado '{modelo_solicitado}' en Google AI. Normalizando a 'gemini-2.5-flash'.")
        return "gemini-2.5-flash"
    
    return clean_model


def inicializar_gemini() -> GenerativeModel:
    # Import diferido para evitar una dependencia circular con db_service.
    from app.services.db_service import get_config_value_db
    try:
        api_key = get_config_value_db("google_api_key") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        raw_modelo = get_config_value_db("gemini_model") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
        nombre_modelo = sanitizar_nombre_modelo_gemini(raw_modelo)

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


def transcribir_audio_bytes(audio_bytes: bytes, mime_type: str = "audio/wav") -> str:
    """
    Transcribe bytes de audio (WAV, WebM, OGG) a texto en español utilizando Gemini API.
    """
    if not audio_bytes:
        return ""
    try:
        model = inicializar_gemini()
        prompt = (
            "Transcribe este audio de inspección técnica industrial a texto en español. "
            "Devuelve únicamente la transcripción exacta sin saludos, etiquetas ni comentarios adicionales."
        )
        response = model.generate_content(
            [
                {"mime_type": mime_type, "data": audio_bytes},
                prompt,
            ],
            request_options={"timeout": 30},
        )
        return response.text.strip() if response and response.text else ""
    except Exception as e:
        logger.error(f"Error transcribiendo audio con Gemini: {e}")
        return ""


def interpretar_dictado_inspeccion(texto_dictado: str, equipo_info: str = "") -> dict:
    """
    Toma la transcripción bruta de voz de una inspección técnica industrial y
    usa Gemini IA para extraer e interpretar los campos estructurados:
    - diagnostico (hallazgos del estado actual del equipo)
    - acciones (acciones o pruebas realizadas durante la inspección)
    - recomendaciones (tareas preventivas o correctivas sugeridas/seguimiento)
    - estado ("BUENO", "REGULAR", "CRITICO", "FUERA DE RUTA", o None si no se menciona)
    """
    if not texto_dictado or not texto_dictado.strip():
        return {}
    try:
        model = inicializar_gemini()
        prompt = (
            "Eres un asistente experto en ingeniería e inspección de equipos industriales en plantas químicas.\n"
            f"El inspector ha grabado el siguiente dictado de voz sobre un equipo ({equipo_info}):\n"
            f"\"\"\"{texto_dictado}\"\"\"\n\n"
            "Interpreta el dictado y extrae la información organizándola en los campos correspondientes.\n"
            "Responde ÚNICAMENTE en formato JSON válido con la siguiente estructura:\n"
            "{\n"
            '  "diagnostico": "Descripción clara de hallazgos técnicos del estado actual...",\n'
            '  "acciones": "Acciones o inspecciones realizadas...",\n'
            '  "recomendaciones": "Recomendaciones, mantenimientos sugeridos o frecuencia de seguimiento...",\n'
            '  "estado": "BUENO | REGULAR | CRITICO | FUERA DE RUTA" (solo si se menciona o deduce del dictado, o null)\n'
            "}"
        )
        response = model.generate_content([prompt], request_options={"timeout": 30})
        if response and response.text:
            parsed = extraer_diagnostico(response.text)
            if isinstance(parsed, dict):
                return parsed
        return {"diagnostico": texto_dictado}
    except Exception as e:
        logger.error(f"Error interpretando dictado de voz con Gemini: {e}")
        return {"diagnostico": texto_dictado}


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


def consultar_asistente_equipo(
    equipo: dict,
    historial_2024: dict,
    mensaje: str,
    historial_chat: list = None,
    aprendizaje: str = "",
    reglas_negocio: str = "",
    modo: str = "desktop"
) -> str:
    """
    Asistente técnico interactivo especializado en el equipo en inspección.
    Delimita estrictamente las respuestas al contexto del equipo y sus normativas.
    """
    try:
        model = inicializar_gemini()
        
        formato_instruccion = ""
        if modo == "mobile":
            formato_instruccion = (
                "ESTILO PARA DISPOSITIVO MÓVIL EN CAMPO:\n"
                "- Responde de forma muy concisa, telegráfica y directa (máximo 2-3 viñetas breves).\n"
                "- Prioriza la seguridad, acciones inmediatas en terreno y puntos clave a verificar con la vista.\n"
                "- Evita introducciones largas, saludos o rodeos teóricos."
            )
        else:
            formato_instruccion = (
                "ESTILO PARA DASHBOARD DE ESCRITORIO:\n"
                "- Responde con lenguaje técnico de ingeniería industrial de alto nivel.\n"
                "- Utiliza formato Markdown con títulos, listas o tablas si clarifica la explicación.\n"
                "- Si se pide redacción, redacta en tiempo impersonal (diagnóstico en presente, acciones en pasado, recomendaciones en infinitivo)."
            )

        system_instruction = f"""Eres el Copiloto Técnico y Asistente Experto en Inspección Industrial asignado exclusivamente a este equipo:
- Nombre: {equipo.get('nombre', 'Desconocido')}
- Código / Tag: {equipo.get('codigo') or equipo.get('numero') or 'N/A'}
- Área / Ubicación: {equipo.get('area', 'N/A')}
- Material: {equipo.get('material', 'N/A')}
- Criticidad: {equipo.get('criticidad', 'N/A')}

ANTECEDENTES HISTÓRICOS (PGP 2024):
- Estado: {historial_2024.get('estado', 'Sin datos')}
- Diagnóstico previo: {historial_2024.get('diagnostico', 'Sin datos')}
- Acciones previas: {historial_2024.get('acciones', 'Sin datos')}
- Recomendaciones previas: {historial_2024.get('recomendaciones', 'Sin datos')}

LECCIONES APRENDIDAS Y REGLAS DE NEGOCIO:
{reglas_negocio or 'Reglas generales de inspección de recipientes, cañerías y tanques.'}
{f"Lecciones aprendidas: {aprendizaje}" if aprendizaje else ""}

DIRECTIVAS CRÍTICAS DE COMPORTAMIENTO (GUARDRAILS):
1. TU ENFOQUE ES EXCLUSIVO: Solo responde dudas sobre este equipo específico, su material, modos de falla, normativas de inspección y antecedentes históricos.
2. PREGUNTAS FUERA DE ÁMBITO: Si el usuario te pregunta sobre temas ajenos a la inspección o a este equipo, declina amablemente y recuérdale que estás enfocado en la inspección de {equipo.get('nombre')}.
3. MATERIALES PLÁSTICOS (FRP, ACRBA, PP): Recuerda siempre las precauciones de sobreajuste de bulonería, fisuras en bridas y compatibilidad química si aplica.

{formato_instruccion}
"""

        # Preparar historial formateado si viene provisto
        history_formatted = []
        if historial_chat:
            for item in historial_chat:
                role = "user" if item.get("rol") in ("user", "usuario") else "model"
                texto = item.get("texto") or item.get("mensaje") or ""
                if texto:
                    history_formatted.append({"role": role, "parts": [texto]})

        # Iniciar chat con system instruction inyectada en la primera interacción o en el modelo
        # Para compatibilidad con SDK de genai, añadimos el prompt de contexto si es nuevo
        if not history_formatted:
            chat = model.start_chat(history=[
                {"role": "user", "parts": [f"[INSTRUCCIÓN DE SISTEMA Y CONTEXTO DEL EQUIPO]\n{system_instruction}\nPor favor confirma que estás listo."]},
                {"role": "model", "parts": [f"Entendido. Soy el asistente técnico para la inspección del equipo {equipo.get('nombre')} ({equipo.get('codigo') or ''}). ¿En qué puedo ayudarte?"]}
            ])
        else:
            # Insertar system instruction al inicio del historial existente
            full_history = [
                {"role": "user", "parts": [f"[INSTRUCCIÓN DE SISTEMA Y CONTEXTO DEL EQUIPO]\n{system_instruction}"]},
                {"role": "model", "parts": [f"Entendido. Asistente técnico activo para {equipo.get('nombre')}."]}
            ] + history_formatted
            chat = model.start_chat(history=full_history)

        response = chat.send_message(mensaje, request_options={"timeout": 30})
        return response.text.strip() if response and response.text else "No se pudo obtener una respuesta del asistente."
    except Exception as e:
        logger.error(f"Error en consultar_asistente_equipo: {e}", exc_info=True)
        return f"Error consultando el asistente técnico: {str(e)}"

