# services/gemini_service.py

import streamlit as st
from PIL import Image
import io
import google.generativeai as genai
import json
import re

def _preparar_contenido(prompt, imagenes_pil=None):
    """Convierte las imágenes a formato compatible con Gemini"""
    contenido = [prompt]
    if imagenes_pil:
        for nombre, img in imagenes_pil:
            if isinstance(img, bytes):
                img = Image.open(io.BytesIO(img))
            elif isinstance(img, tuple) and len(img) >= 1 and isinstance(img[0], bytes):
                img = Image.open(io.BytesIO(img[0]))
            if hasattr(img, 'mode') and img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            contenido.append(img)
    return contenido

def iniciar_chat_inspeccion(prompt, imagenes_pil):
    """Inicia una sesión de chat con Gemini enviando el contexto inicial y las imágenes"""
    try:
        modelo = st.session_state.get("gemini")
        if modelo is None:
            return None, "Error: Modelo Gemini no inicializado"
        
        # Iniciar chat
        chat = modelo.start_chat(history=[])
        
        contenido = _preparar_contenido(prompt, imagenes_pil)
        
        respuesta = chat.send_message(
            contenido,
            generation_config={"temperature": 0.15, "max_output_tokens": 5000}
        )
        return chat, respuesta.text
    except Exception as e:
        st.error(f"Error en Gemini: {e}")
        return None, f"Error generando análisis inicial: {e}"

def enviar_mensaje_chat(chat, texto):
    """Envía un mensaje a una sesión de chat existente"""
    try:
        respuesta = chat.send_message(
            texto,
            generation_config={"temperature": 0.15, "max_output_tokens": 5000}
        )
        return respuesta.text
    except Exception as e:
        st.error(f"Error en Gemini Chat: {e}")
        return f"Error en la comunicación: {e}"

def analizar_imagenes(prompt, imagenes_pil):
    """Envía prompt e imágenes a Gemini y devuelve la respuesta (sin chat)"""
    try:
        modelo = st.session_state.get("gemini")
        if modelo is None:
            return "Error: Modelo Gemini no inicializado"
        
        contenido = _preparar_contenido(prompt, imagenes_pil)
        
        respuesta = modelo.generate_content(
            contenido,
            generation_config={"temperature": 0.15, "max_output_tokens": 5000}
        )
        return respuesta.text
    except Exception as e:
        st.error(f"Error en Gemini: {e}")
        return f"Error generando análisis: {e}"

def extraer_consenso_chat(chat):
    """Extrae diagnóstico y recomendaciones usando el historial del chat"""
    prompt = "Basándote en nuestra conversación y las imágenes, genera un resumen final en formato JSON con EXACTAMENTE tres claves: 'estado' (BUENO, REGULAR o CRITICO), 'diagnostico' y 'recomendaciones'. Devuelve únicamente el bloque JSON, sin texto adicional."
    res = enviar_mensaje_chat(chat, prompt)
    try:
        # Extraer json usando regex si Gemini devuelve bloques markdown
        match = re.search(r'\{.*\}', res, re.DOTALL)
        if match:
            datos = json.loads(match.group(0))
            return datos
        return json.loads(res)
    except:
        return {"estado": "", "diagnostico": "No se pudo extraer automáticamente.", "recomendaciones": "Revisar chat."}
