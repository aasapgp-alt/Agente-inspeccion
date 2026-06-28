import json
import os
import logging

logger = logging.getLogger(__name__)

LEARNING_FILE = "data/few_shot_examples.json"
LESSONS_FILE = "data/lessons_learned.txt"

def _asegurar_directorio():
    os.makedirs(os.path.dirname(LEARNING_FILE), exist_ok=True)
    os.makedirs(os.path.dirname(LESSONS_FILE), exist_ok=True)

def cargar_ejemplos_few_shot() -> list:
    try:
        if os.path.exists(LEARNING_FILE):
            with open(LEARNING_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Error cargando ejemplos few shot: {e}")
        return []

def guardar_ejemplo_few_shot(ejemplo: dict) -> bool:
    try:
        _asegurar_directorio()
        ejemplos = cargar_ejemplos_few_shot()
        ejemplos.append(ejemplo)
        with open(LEARNING_FILE, 'w', encoding='utf-8') as f:
            json.dump(ejemplos, f, indent=4, ensure_ascii=False)
        return True
    except Exception as e:
        logger.error(f"Error guardando ejemplo few shot: {e}")
        return False

def obtener_aprendizaje_texto() -> str:
    try:
        if os.path.exists(LESSONS_FILE):
            with open(LESSONS_FILE, 'r', encoding='utf-8') as f:
                return f.read()
        return ""
    except Exception as e:
        logger.error(f"Error obteniendo texto de aprendizaje: {e}")
        return ""

def guardar_aprendizaje_local(ejemplo: dict) -> bool:
    try:
        _asegurar_directorio()
        with open(LESSONS_FILE, 'a', encoding='utf-8') as f:
            f.write(f"\nFecha: {ejemplo.get('fecha', 'N/A')}\n")
            f.write(f"Contexto: {ejemplo.get('contexto', '')}\n")
            f.write(f"Lección: {ejemplo.get('leccion', '')}\n")
            f.write("-" * 40 + "\n")
        return True
    except Exception as e:
        logger.error(f"Error guardando aprendizaje local: {e}")
        return False

def calcular_diferencias(original: dict, editado: dict) -> dict:
    try:
        diferencias = {}
        all_keys = set(original.keys()).union(set(editado.keys()))
        for key in all_keys:
            val1 = original.get(key)
            val2 = editado.get(key)
            if val1 != val2:
                diferencias[key] = {"antes": val1, "despues": val2}
        return diferencias
    except Exception as e:
        logger.error(f"Error calculando diferencias: {e}")
        return {}

def generar_leccion_aprendida(diferencias: dict) -> str:
    if not diferencias:
        return "No hubo cambios significativos."
    
    leccion = "Se corrigieron los siguientes aspectos:\n"
    for campo, cambios in diferencias.items():
        leccion += f"- {campo}: de '{cambios.get('antes', 'Vacio')}' a '{cambios.get('despues', 'Vacio')}'\n"
    return leccion
