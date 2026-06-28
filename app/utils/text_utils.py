# app/utils/text_utils.py

import re
import unicodedata
from datetime import datetime

def sanitizar_nombre(nombre: str) -> str:
    """Elimina caracteres especiales de un string para que sea seguro como nombre de archivo."""
    if not nombre:
        return ""
    nombre_limpio = re.sub(r'[^a-zA-Z0-9_\-]', '_', nombre)
    return re.sub(r'_+', '_', nombre_limpio).strip('_')

def normalizar_texto(texto: str) -> str:
    """Quita acentos y convierte a mayúsculas."""
    if not texto:
        return ""
    texto_norm = ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')
    return texto_norm.upper()

def extraer_codigo_equipo(texto: str) -> str:
    """Extrae el código de un equipo usando el patrón \\d{3}-\\d{3}."""
    if not texto:
        return ""
    match = re.search(r'\d{3}-\d{3}', texto)
    if match:
        return match.group(0)
    return ""

def formatear_fecha(fecha: datetime, formato: str = "%Y-%m-%d %H:%M") -> str:
    """Formatea un objeto datetime a string."""
    if not isinstance(fecha, datetime):
        return str(fecha)
    return fecha.strftime(formato)

def truncar_texto(texto: str, max_len: int = 100) -> str:
    """Trunca el texto a la longitud máxima añadiendo '...' si es necesario."""
    if not texto:
        return ""
    if len(texto) <= max_len:
        return texto
    return texto[:max_len-3] + "..."

def es_estado_valido(estado: str) -> bool:
    """Verifica si un estado pertenece a la lista de estados válidos."""
    if not estado:
        return False
    estados_validos = ["BUENO", "REGULAR", "CRITICO", "FUERA DE RUTA"]
    return normalizar_texto(estado) in estados_validos
