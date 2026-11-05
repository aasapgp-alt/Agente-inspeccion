import json
import os
import logging
import re

logger = logging.getLogger(__name__)
MEMORY_FILE = os.path.join("data", "memory_images.json")

def _campaign_key(equipo_id: int, campania: str) -> str:
    return f"{equipo_id}:{campania}"

def guardar_memoria_imagenes(equipo_id: int, image_drive_ids: list, campania: str = "PGP 2026"):
    try:
        os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
        data = {}
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = {}
        
        data[_campaign_key(equipo_id, campania)] = image_drive_ids
        
        with open(MEMORY_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logger.error(f"Error guardando memoria de imágenes: {e}")

def obtener_memoria_imagenes(equipo_id: int, campania: str = "PGP 2026") -> list:
    try:
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r") as f:
                data = json.load(f)
                campaign_images = data.get(_campaign_key(equipo_id, campania))
                if campaign_images is not None:
                    return campaign_images
                # Compatibilidad con la memoria histórica, que no guardaba campaña.
                years = re.findall(r"20\d{2}", campania)
                if years and years[0] == "2026":
                    return data.get(str(equipo_id), [])
    except Exception as e:
        logger.error(f"Error leyendo memoria de imágenes: {e}")
    return []
