"""
Pruebas de optimización, redimensionamiento y compresión de imágenes.
Valida que las imágenes se reduzcan en resolución y peso de forma eficiente
para proteger los recursos de CPU/RAM del VPS y acelerar el análisis con Gemini.
"""

import io
import pytest
from PIL import Image
from app.utils.image_utils import (
    optimizar_imagen_bytes,
    comprimir_imagen,
    redimensionar_imagen,
    convertir_a_jpeg,
    obtener_tamaño_imagen
)
from app.services.drive_service import descargar_imagen


def _crear_imagen_dummy(width: int, height: int, mode: str = "RGB", color=(200, 100, 50)) -> bytes:
    """Crea una imagen en bytes para propósitos de prueba."""
    img = Image.new(mode, (width, height), color)
    buf = io.BytesIO()
    fmt = "PNG" if mode == "RGBA" else "JPEG"
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_optimizar_imagen_redimensiona_dimensiones_grandes():
    # Crear imagen grande de 3000 x 2000 px
    raw_bytes = _crear_imagen_dummy(3000, 2000, mode="RGB")
    
    # Optimizar a dimensión máxima de 1280 px
    opt_bytes = optimizar_imagen_bytes(raw_bytes, max_dimension=1280, calidad=80)
    
    with Image.open(io.BytesIO(opt_bytes)) as img_opt:
        assert img_opt.width <= 1280
        assert img_opt.height <= 1280
        # Aspect ratio 3000:2000 -> 1.5 -> 1280:853
        assert img_opt.width == 1280
        assert img_opt.height == 853
        assert img_opt.format == "JPEG"


def test_optimizar_imagen_no_agranda_imagenes_pequenas():
    # Crear imagen pequeña de 400 x 300 px
    raw_bytes = _crear_imagen_dummy(400, 300, mode="RGB")
    
    opt_bytes = optimizar_imagen_bytes(raw_bytes, max_dimension=1280, calidad=80)
    
    with Image.open(io.BytesIO(opt_bytes)) as img_opt:
        assert img_opt.width == 400
        assert img_opt.height == 300


def test_optimizar_imagen_convierte_rgba_a_rgb():
    # Crear imagen con canal alpha (RGBA)
    raw_bytes = _crear_imagen_dummy(800, 600, mode="RGBA", color=(100, 150, 200, 128))
    
    opt_bytes = optimizar_imagen_bytes(raw_bytes, max_dimension=1280, calidad=80)
    
    with Image.open(io.BytesIO(opt_bytes)) as img_opt:
        assert img_opt.mode == "RGB"
        assert img_opt.format == "JPEG"


def test_optimizar_imagen_bytes_vacios_o_corruptos():
    assert optimizar_imagen_bytes(b"") == b""
    
    corrupt_bytes = b"no_es_una_imagen_valida"
    res = optimizar_imagen_bytes(corrupt_bytes)
    assert res == corrupt_bytes  # Fallback seguro a bytes originales


def test_descargar_imagen_mock_retorna_bytes_validos():
    # Probar que descargar_imagen en modo mock retorna una imagen válida optimizada
    mock_bytes = descargar_imagen("mock_foto_test_123")
    assert mock_bytes is not None
    assert len(mock_bytes) > 0
    
    with Image.open(io.BytesIO(mock_bytes)) as img:
        assert img.width <= 1280
        assert img.height <= 1280
