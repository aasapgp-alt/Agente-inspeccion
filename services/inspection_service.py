# services/inspection_service.py

import streamlit as st
from config.prompts import construir_system_prompt
from services.gemini_service import analizar_imagenes, iniciar_chat_inspeccion

def generar_analisis(
    equipo_seleccionado,
    imagenes_pil,
    comentario,
    historial,
    manuales,
    perfil,
    conocimiento,
    few_shots,
    anio_actual,
    anio_sig
):
    """Genera análisis usando Gemini (Legacy)"""
    chat, texto, estado = iniciar_analisis_chat(
        equipo_seleccionado, imagenes_pil, comentario, historial,
        manuales, perfil, conocimiento, few_shots, anio_actual, anio_sig
    )
    return texto, estado

def iniciar_analisis_chat(
    equipo_seleccionado,
    imagenes_pil,
    comentario,
    historial,
    manuales,
    perfil,
    conocimiento,
    few_shots,
    anio_actual,
    anio_sig
):
    """Inicia la conversación con Gemini y devuelve el chat y la primera respuesta"""
    try:
        if not imagenes_pil:
            return None, "", "REGULAR"

        sys_prompt = construir_system_prompt(perfil, conocimiento, few_shots, historial, anio_actual, anio_sig)

        hist_block = ""
        if historial:
            hist_block = f"""
## HISTORIAL DEL EQUIPO
**PGP 2024**
- Estado: {historial.get('estado_2024', 'Sin datos')}
- Diagnóstico: {historial.get('diagnostico_2024', 'Sin datos')[:500]}

**PGP 2025**
- Estado: {historial.get('estado_2025', 'Sin datos')}
- Diagnóstico: {historial.get('diagnostico_2025', 'Sin datos')[:500]}

Considerar la evolución del deterioro entre años.
"""

        prompt = f"""
{sys_prompt}
# ANÁLISIS DE INSPECCIÓN PGP {anio_actual}

## EQUIPO
- Nombre: {equipo_seleccionado.get('equipo', '—')}
- Área: {equipo_seleccionado.get('area', '—')}
- Número: {equipo_seleccionado.get('numero', '—')}
- Material: {equipo_seleccionado.get('material', '—')}
- Criticidad: {equipo_seleccionado.get('criticidad', '—')}

## INSTRUCCIONES DEL INSPECTOR
{comentario if comentario else "Inspección visual completa"}

{hist_block}

{manuales}

## IMÁGENES ANALIZADAS
Cantidad: {len(imagenes_pil)}
{', '.join([nombre for nombre, _ in imagenes_pil])}

Analiza TODAS las imágenes con máximo detalle técnico e indica el estado final sugerido (BUENO, REGULAR o CRÍTICO).
Además, justifica tus hallazgos refiriendo a números/nombres de imágenes específicas. Preséntate como el asistente IA listo para responder preguntas sobre la inspección.
"""
        chat_session, texto = iniciar_chat_inspeccion(prompt, imagenes_pil)

        if not chat_session:
            return None, texto, "REGULAR"

        texto = str(texto).strip()
        
        estado_det = "REGULAR"
        texto_upper = texto.upper()
        if "CRÍTICO" in texto_upper or "CRITICO" in texto_upper:
            estado_det = "CRÍTICO"
        elif "BUENO" in texto_upper:
            estado_det = "BUENO"

        return chat_session, texto, estado_det

    except Exception as e:
        return None, f"ERROR EN INICIAR_ANALISIS:\n\n{str(e)}", "REGULAR"