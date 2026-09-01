# app/utils/image_utils.py

import io
import logging
from typing import Optional, Tuple, Dict, Any
from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

def optimizar_imagen_bytes(
    imagen_bytes: bytes, 
    max_dimension: int = 1280, 
    calidad: int = 80
) -> bytes:
    """
    Optimiza una imagen en memoria para reducir su tamaño y acelerar su transferencia.
    - Corrige la orientación EXIF de fotos de celulares.
    - Convierte a espacio de color RGB (elimina canal alpha innecesario).
    - Redimensiona manteniendo la relación de aspecto si supera max_dimension.
    - Comprime a formato JPEG optimizado con calidad balanceada.
    """
    if not imagen_bytes:
        return imagen_bytes

    try:
        with Image.open(io.BytesIO(imagen_bytes)) as img:
            # 1. Corregir orientación basada en metadatos EXIF
            try:
                img = ImageOps.exif_transpose(img)
            except Exception as exif_err:
                logger.debug(f"No se pudo aplicar exif_transpose: {exif_err}")

            # 2. Convertir a RGB si es necesario (manejar RGBA, P, CMYK, etc.)
            if img.mode in ("RGBA", "LA", "P"):
                # Crear fondo blanco para transparencias
                background = Image.new("RGB", img.size, (255, 255, 255))
                if img.mode == "P":
                    img = img.convert("RGBA")
                background.paste(img, mask=img.split()[-1])
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")

            # 3. Redimensionar si supera la dimensión máxima permitida
            if max_dimension and (img.width > max_dimension or img.height > max_dimension):
                img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            # 4. Guardar en búfer JPEG optimizado
            out_io = io.BytesIO()
            img.save(out_io, format="JPEG", quality=calidad, optimize=True)
            return out_io.getvalue()
    except Exception as e:
        logger.warning(f"Error al optimizar imagen con PIL: {e}. Retornando bytes originales.")
        return imagen_bytes

def comprimir_imagen(imagen_bytes: bytes, calidad: int = 80, max_dimension: int = 1280) -> bytes:
    """Comprime una imagen en bytes y limita sus dimensiones."""
    return optimizar_imagen_bytes(imagen_bytes, max_dimension=max_dimension, calidad=calidad)

def redimensionar_imagen(imagen: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """Redimensiona una imagen manteniendo el ratio de aspecto si excede las dimensiones máximas."""
    width, height = imagen.size
    if width > max_width or height > max_height:
        imagen.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return imagen

def convertir_a_jpeg(imagen: Image.Image) -> Image.Image:
    """Convierte una imagen a modo RGB para compatibilidad con JPEG."""
    if imagen.mode in ("RGBA", "P"):
        background = Image.new("RGB", imagen.size, (255, 255, 255))
        if imagen.mode == "P":
            imagen = imagen.convert("RGBA")
        background.paste(imagen, mask=imagen.split()[-1])
        return background
    elif imagen.mode != "RGB":
        return imagen.convert("RGB")
    return imagen

def extraer_metadatos(imagen: Image.Image) -> dict:
    """Extrae metadatos EXIF básicos de la imagen si existen."""
    metadatos = {}
    if hasattr(imagen, '_getexif') and callable(imagen._getexif):
        exif_info = imagen._getexif()
        if exif_info:
            for tag, value in exif_info.items():
                metadatos[str(tag)] = str(value)
    return {"size": imagen.size, "format": imagen.format, "exif": metadatos}

def generar_thumbnail(imagen: Image.Image, size: tuple = (150, 150)) -> Image.Image:
    """Genera una miniatura de la imagen proporcionada."""
    thumb = imagen.copy()
    thumb.thumbnail(size, Image.Resampling.LANCZOS)
    return thumb

def obtener_tamaño_imagen(imagen_bytes: bytes) -> tuple:
    """Retorna el ancho y alto de una imagen en bytes."""
    with Image.open(io.BytesIO(imagen_bytes)) as img:
        return img.size
