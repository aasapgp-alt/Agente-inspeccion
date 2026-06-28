# app/utils/image_utils.py

import io
from PIL import Image

def comprimir_imagen(imagen_bytes: bytes, calidad: int = 85, max_dimension: int = 2048) -> bytes:
    """Comprime una imagen en bytes y limita sus dimensiones."""
    img = Image.open(io.BytesIO(imagen_bytes))
    img = redimensionar_imagen(img, max_dimension, max_dimension)
    img = convertir_a_jpeg(img)
    
    out_io = io.BytesIO()
    img.save(out_io, format="JPEG", quality=calidad, optimize=True)
    return out_io.getvalue()

def redimensionar_imagen(imagen: Image.Image, max_width: int, max_height: int) -> Image.Image:
    """Redimensiona una imagen manteniendo el ratio de aspecto si excede las dimensiones máximas."""
    width, height = imagen.size
    if width > max_width or height > max_height:
        imagen.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
    return imagen

def convertir_a_jpeg(imagen: Image.Image) -> Image.Image:
    """Convierte una imagen a modo RGB para compatibilidad con JPEG."""
    if imagen.mode in ("RGBA", "P"):
        imagen = imagen.convert("RGB")
    elif imagen.mode != "RGB":
        imagen = imagen.convert("RGB")
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
    img = Image.open(io.BytesIO(imagen_bytes))
    return img.size
