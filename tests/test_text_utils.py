"""Pruebas de utilidades de texto, incluida la regla de los 4 estados de salud."""

from datetime import datetime

from app.utils.text_utils import (
    es_estado_valido,
    extraer_codigo_equipo,
    formatear_fecha,
    normalizar_texto,
    sanitizar_nombre,
    truncar_texto,
)


def test_sanitizar_nombre_reemplaza_y_colapsa():
    assert sanitizar_nombre("Equipo 001 / Sector #3") == "Equipo_001_Sector_3"
    assert sanitizar_nombre("") == ""
    # A diferencia de normalizar_texto, NO transmuta acentos: todo carácter
    # no ASCII se reemplaza por "_" (y los "_" sobrantes se colapsan/recortan).
    assert sanitizar_nombre("Área") == "rea"


def test_normalizar_texto_quita_acentos_y_mayusculas():
    assert normalizar_texto("crítico") == "CRITICO"
    assert normalizar_texto("Fuera de Ruta") == "FUERA DE RUTA"
    assert normalizar_texto("") == ""


def test_extraer_codigo_equipo():
    assert extraer_codigo_equipo("Bomba 123-456 sector norte") == "123-456"
    assert extraer_codigo_equipo("sin codigo") == ""
    assert extraer_codigo_equipo("") == ""


def test_truncar_texto():
    assert truncar_texto("corto", 100) == "corto"
    largo = "a" * 120
    resultado = truncar_texto(largo, 100)
    assert len(resultado) == 100
    assert resultado.endswith("...")


def test_formatear_fecha():
    fecha = datetime(2026, 6, 28, 14, 30)
    assert formatear_fecha(fecha) == "2026-06-28 14:30"
    # Un valor no-datetime se devuelve como string sin fallar.
    assert formatear_fecha("ya-es-texto") == "ya-es-texto"


def test_es_estado_valido_acepta_los_cuatro_canonicos():
    for estado in ["BUENO", "REGULAR", "CRITICO", "FUERA DE RUTA"]:
        assert es_estado_valido(estado) is True
    # Acepta variantes con acento y minúsculas tras normalizar.
    assert es_estado_valido("crítico") is True
    assert es_estado_valido("Fuera de Ruta") is True


def test_es_estado_valido_rechaza_invalidos():
    assert es_estado_valido("MALO") is False
    assert es_estado_valido("") is False
    assert es_estado_valido(None) is False
