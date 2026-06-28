"""Pruebas de los helpers puros de gemini_service (sin llamar a la API)."""

from app.services.gemini_service import (
    build_annotation_context,
    extraer_diagnostico,
    preparar_prompt_analisis,
    validar_respuesta_gemini,
)


# --- Parseo del diagnóstico devuelto por Gemini ---

def test_extraer_diagnostico_json_plano():
    assert extraer_diagnostico('{"estado": "BUENO"}') == {"estado": "BUENO"}


def test_extraer_diagnostico_con_valla_json():
    respuesta = '```json\n{"estado": "CRITICO"}\n```'
    assert extraer_diagnostico(respuesta) == {"estado": "CRITICO"}


def test_extraer_diagnostico_con_valla_generica():
    respuesta = '```\n{"estado": "REGULAR"}\n```'
    assert extraer_diagnostico(respuesta) == {"estado": "REGULAR"}


def test_extraer_diagnostico_json_invalido_devuelve_raw():
    resultado = extraer_diagnostico("esto no es json")
    assert resultado == {"raw_text": "esto no es json"}


# --- Validación de la estructura de respuesta ---

def test_validar_respuesta_gemini():
    completa = {"diagnostico": "x", "estado": "BUENO", "recomendaciones": []}
    assert validar_respuesta_gemini(completa) is True
    assert validar_respuesta_gemini({"diagnostico": "x"}) is False


# --- Construcción del prompt ---

def test_preparar_prompt_analisis_incluye_datos():
    equipo = {"nombre": "Bomba 1", "id": 7}
    prompt = preparar_prompt_analisis(equipo, [], "Revisar oxidación", "")
    assert "Bomba 1" in prompt
    assert "Revisar oxidación" in prompt
    # Sin historial ni aprendizaje, esas líneas no aparecen.
    assert "Historial previo" not in prompt
    assert "Lecciones aprendidas" not in prompt


def test_preparar_prompt_analisis_con_historial_y_aprendizaje():
    prompt = preparar_prompt_analisis(
        {"nombre": "E", "id": 1}, [{"a": 1}], "ins", "no inferir sin fotos"
    )
    assert "Historial previo" in prompt
    assert "Lecciones aprendidas" in prompt


# --- Contexto espacial de anotaciones ---

def test_build_annotation_context_vacio():
    assert build_annotation_context([]) == ""


def test_build_annotation_context_rectangulo():
    anns = [{
        "geometry": {
            "type": "RECTANGLE",
            "naturalPx": {"x": 10, "y": 20, "width": 30, "height": 40,
                          "imageWidth": 800, "imageHeight": 600},
        },
        "data": {"text": "fuga"},
    }]
    salida = build_annotation_context(anns)
    assert "RECTANGLE 'fuga'" in salida
    assert "(10px, 20px)" in salida
    assert "800x600px" in salida


def test_build_annotation_context_arrow():
    anns = [{
        "geometry": {
            "type": "ARROW",
            "naturalPx": {"x1": 1, "y1": 2, "x2": 3, "y2": 4,
                          "imageWidth": 100, "imageHeight": 100},
        },
        "data": {"text": "grieta"},
    }]
    salida = build_annotation_context(anns)
    assert "ARROW 'grieta'" in salida
    assert "from (1px, 2px)" in salida
    assert "to (3px, 4px)" in salida
