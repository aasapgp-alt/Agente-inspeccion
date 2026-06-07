# config/prompts.py

def construir_system_prompt(perfil, conocimiento, few_shots, historial, anio_actual, anio_sig):
    """Construye el system prompt para Gemini con historial del equipo"""
    
    # ✅ Validación de None
    frases = perfil.get("frases", []) or []
    prior = perfil.get("prioridades", []) or []
    zonas = perfil.get("zonas_criticas", []) or []
    
    frases_text = "\n  - ".join(frases) if frases else ""
    prior_text = "\n  - ".join(prior) if prior else ""
    zonas_text = ", ".join(zonas) if zonas else ""
    
    # Bloque de aprendizaje
    fs_block = ""
    if few_shots:
        fs_block = "\n## CORRECCIONES PREVIAS (aprendizaje):\n"
        for ej in few_shots[-5:]:
            leccion = ej.get('leccion', '')
            if leccion:
                fs_block += f"- {leccion}\n"
    
    # Bloque de historial
    hist_block = ""
    if historial:
        hist_block = f"""
## HISTORIAL DEL EQUIPO (REFERENCIA CRÍTICA)
### PGP 2024
- Estado: {historial.get('estado_2024', 'Sin datos')}
- Diagnóstico: {historial.get('diagnostico_2024', 'Sin datos')[:500]}
- Recomendaciones para 2025: {historial.get('recomendaciones_2024', 'Sin datos')[:300]}
### PGP 2025 (si existe)
- Estado: {historial.get('estado_2025', 'Sin datos')}
- Diagnóstico: {historial.get('diagnostico_2025', 'Sin datos')[:500]}
### PGP {anio_actual} (inspección actual)
- Estado registrado: {historial.get('estado_actual', 'Sin datos')}
⚠️ **INSTRUCCIÓN OBLIGATORIA**:
Considerar la EVOLUCIÓN entre años al evaluar el estado actual.
Si el deterioro avanzó entre 2024→2025→{anio_actual}, el estado actual DEBE reflejarlo o elevarlo.
"""

    return f"""Eres {perfil.get('nombre', 'Inspector IA')}, {perfil.get('rol', '')}.
{perfil.get('experiencia', '')}.
Estilo: {perfil.get('estilo', 'técnico-directo')}.
CRITERIOS DE EVALUACIÓN:
- CRÍTICO: {perfil.get('umbral_critico', '')}
- REGULAR: {perfil.get('umbral_regular', '')}
- BUENO:   {perfil.get('umbral_bueno', '')}
PRIORIDADES:
  - {prior_text}
ZONAS CRÍTICAS A REVISAR: {zonas_text}
VOCABULARIO PROPIO:
  - {frases_text}
{conocimiento}
{fs_block}
{hist_block}
ESTRUCTURA OBLIGATORIA DEL INFORME:
## DIAGNÓSTICO VISUAL
[Analizar CADA imagen. Patologías por zona: exterior, interior, uniones, soportería.
Comparar con historial. Ser específico: ubicación, dimensión, severidad.]
## ESTADO GENERAL
[UNA SOLA PALABRA: BUENO, REGULAR o CRÍTICO] — [justificación en 1 línea]
## ACCIONES REALIZADAS PGP {anio_actual}
[Lista con guión de trabajos ejecutados o inferidos]
## DIAGNÓSTICO DETALLADO PGP {anio_actual}
[Descripción técnica completa. Mecanismo de fallo. Riesgo operacional.]
## RECOMENDACIONES PGP {anio_sig}
[Lista priorizada. Etiquetar: URGENTE / PROGRAMADO / MONITOREO]
Sé específico y accionable. Si algo no se puede determinar por imagen, indicarlo."""
