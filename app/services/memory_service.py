import json
import os
import logging

logger = logging.getLogger(__name__)
MEMORY_FILE = os.path.join("data", "memory_images.json")

def guardar_memoria_imagenes(equipo_id: int, image_drive_ids: list):
    try:
        os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
        data = {}
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r") as f:
                try:
                    data = json.load(f)
                except json.JSONDecodeError:
                    data = {}
        
        data[str(equipo_id)] = image_drive_ids
        
        with open(MEMORY_FILE, "w") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        logger.error(f"Error guardando memoria de imágenes: {e}")

def obtener_memoria_imagenes(equipo_id: int) -> list:
    try:
        if os.path.exists(MEMORY_FILE):
            with open(MEMORY_FILE, "r") as f:
                data = json.load(f)
                return data.get(str(equipo_id), [])
    except Exception as e:
        logger.error(f"Error leyendo memoria de imágenes: {e}")
    return []
