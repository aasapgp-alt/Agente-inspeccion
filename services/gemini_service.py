# services/gemini_service.py

import streamlit as st
from PIL import Image
import io
import google.generativeai as genai

def analizar_imagenes(prompt, imagenes_pil):
    """Envía prompt e imágenes a Gemini y devuelve la respuesta"""
    try:
        modelo = st.session_state.get("gemini")
        if modelo is None:
            return "Error: Modelo Gemini no inicializado"
        
        # Construir contenido - Gemini acepta PIL Images directamente
        contenido = [prompt]
        
        for nombre, img in imagenes_pil:
            # Asegurar que img es PIL Image
            if isinstance(img, bytes):
                img = Image.open(io.BytesIO(img))
            elif isinstance(img, tuple) and len(img) >= 1 and isinstance(img[0], bytes):
                img = Image.open(io.BytesIO(img[0]))
            
            # Convertir a RGB si es necesario
            if hasattr(img, 'mode') and img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            contenido.append(img)
        
        respuesta = modelo.generate_content(
            contenido,
            generation_config={
                "temperature": 0.15,
                "max_output_tokens": 5000
            }
        )
        return respuesta.text
    except Exception as e:
        # ✅ Usar st.error en lugar de st.logger
        st.error(f"Error en Gemini: {e}")
        return f"Error generando análisis: {e}"
