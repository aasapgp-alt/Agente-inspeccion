# utils/text_utils.py

import re

def limpiar_texto(texto):
    """Limpia caracteres mal decodificados y espacios"""
    if not isinstance(texto, str):
        return texto
    
    # Reemplazar caracteres mal decodificados
    reemplazos = {
        'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
        'Ã‘': 'Ñ', 'Ã±': 'ñ', 'Â°': '°', 'Ã¼': 'ü', 'Â·': '·',
        'â‚¬': '€', 'Âª': 'ª', 'Âº': 'º', 'Ã€': 'À', 'Ã‰': 'É',
        'Ã“': 'Ó', 'Ã': 'Í', 'Ãš': 'Ú', 'Â¿': '¿', 'Â¡': '¡'
    }
    for mal, bien in reemplazos.items():
        texto = texto.replace(mal, bien)
    
    # Limpiar espacios múltiples
    texto = re.sub(r'\s+', ' ', texto)
    
    return texto.strip()

def extraer_numeros(texto):
    """Extrae todos los números de un texto"""
    return re.findall(r'\d+', texto)

def formatear_fecha(fecha_str):
    """Formatea fecha para mostrar"""
    if not fecha_str:
        return ""
    try:
        from datetime import datetime
        dt = datetime.strptime(fecha_str, "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except:
        return fecha_str