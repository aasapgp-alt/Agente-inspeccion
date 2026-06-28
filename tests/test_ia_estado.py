"""Prueba de la validación del estado devuelto por Gemini en el router de IA.

Garantiza la regla de negocio: ante un estado no reconocible, se cae a
'FUERA DE RUTA' (nunca se asume un estado intermedio sin evidencia).
"""

from app.routers.ia import _estado_validado


def test_estado_valido_se_normaliza():
    assert _estado_validado("crítico") == "CRITICO"
    assert _estado_validado("Bueno") == "BUENO"
    assert _estado_validado("Fuera de Ruta") == "FUERA DE RUTA"


def test_estado_invalido_cae_a_fuera_de_ruta():
    # Antes el default inseguro era 'REGULAR'; ahora es 'FUERA DE RUTA'.
    assert _estado_validado("INCIERTO") == "FUERA DE RUTA"
    assert _estado_validado("pendiente") == "FUERA DE RUTA"
    assert _estado_validado("") == "FUERA DE RUTA"
    assert _estado_validado(None) == "FUERA DE RUTA"
