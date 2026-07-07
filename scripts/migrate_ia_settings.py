import sqlite3
import os
import sys

# Add root folder to python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def migrate():
    db_path = settings.DB_PATH
    print(f"Migrando base de datos en: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 1. Asegurar la tabla de aprendizaje
        print("Asegurando la existencia de la tabla 'aprendizaje'...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS aprendizaje (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo TEXT,
            ia_dijo TEXT,
            inspector_corrigio TEXT,
            leccion TEXT,
            fecha DATE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aprendizaje_equipo ON aprendizaje(equipo)")
        
        # 2. Insertar configuraciones por defecto si no existen
        print("Insertando configuraciones de IA por defecto si no existen...")
        default_configs = [
            ("system_instruction", "Eres un inspector industrial experto en activos mecánicos, piletas y cañerías de proceso (FRP, ACRBA) redactando un informe técnico formal.\nDebes redactar todo de manera estrictamente impersonal y formal.\nEstá completamente prohibido usar la primera persona del singular (\"yo\", \"he verificado\", \"mi inspección\") y verbos en pasado en primera persona (no \"inspeccioné\", \"revisé\").\n- Para el DIAGNÓSTICO: Describe el estado actual o hechos únicamente en tiempo presente impersonal (ej: \"El tramo de cañería presenta...\", \"Se observa desgaste...\"). Compara con el historial PGP 2024 provisto.\n- Para las ACCIONES: Escribe en pasado impersonal, describiendo qué hizo el inspector (ej. \"Se realizó inspección externa\", \"Se realizó apertura de bridas o carreteles\", \"Se realizó inspección visual externa anual\"). Compara con la PGP 2024.\n- Para las RECOMENDACIONES: Escribe siempre las tareas a futuro usando verbos en INFINITIVO (ej: \"Continuar con...\", \"Proceder a...\", \"Informar al área...\", \"Reemplazar...\").\nNo menciones nunca limitaciones de fotos ni digas que \"no se cuenta con imágenes\" o \"no se puede evaluar\". Para cualquier zona o componente no visible, hereda o asume exactamente el diagnóstico del Historial PGP 2024 o no lo nombres.\nDebes responder ÚNICAMENTE en formato JSON con la estructura indicada, respetando las llaves exactas.", "string", "Instrucciones del sistema para la IA (Gemini)", "ia", 1),
            ("reglas_negocio", "REGLAS ESTRICTAS DE ANÁLISIS (obligatorias):\n1. TONO IMPERSONAL Y DIRECTIVO (FORMATO ESTÁNDAR): Redacta todo el informe de forma impersonal y objetiva. Está estrictamente prohibido usar la primera persona del singular (\"yo\", \"he verificado\", \"encuentro\", \"mi inspección\") y verbos en pasado para describir tus acciones (no \"inspeccioné\", \"revisé\", \"encontré\").\n   - Para el DIAGNÓSTICO: Utiliza el tiempo presente para describir el estado actual, hechos o situaciones del activo (ej: \"El tramo de cañería presenta...\", \"Se observa desgaste...\", \"La línea existente presta servicio desde...\").\n   - Para las ACCIONES y RECOMENDACIONES: Utiliza verbos en INFINITIVO como instrucción impersonal directiva (ej: \"Continuar con...\", \"Proceder a...\", \"Informar al área...\", \"Reemplazar elementos...\", \"Solicitar el drenaje...\").\n2. COMPONENTES SIN FOTO O NO VISIBLES: Está estrictamente prohibido redactar disculpas, justificaciones o aclarar que \"no se cuenta con fotos de la válvula\" o \"no se puede evaluar por falta de imágenes\". Si un componente o aspecto (como válvulas, anclajes, soportes, etc.) no es visible en las imágenes adjuntas:\n   - Copia exactamente el diagnóstico y estado correspondiente que figura en el \"Historial del PGP 2024\" para ese componente.\n   - O bien omite completamente cualquier mención del componente si tampoco existe en el historial.\n   - Jamás expongas dudas o limitaciones técnicas por falta de fotos en tu respuesta final.\n3. PROHIBIDO INFERIR DETERIORO INVISIBLE: Analiza ÚNICAMENTE la evidencia visual real. No asumas ni inventes desgastes que no sean claramente visibles.\n4. NORMALIZACIÓN DE ESTADOS: El estado debe ser estrictamente uno de: 'BUENO', 'REGULAR', 'CRITICO' o 'FUERA DE RUTA'.\n5. CRITICIDAD: Cualquier fisura, pérdida de fluido importante o daño estructural evidente y visible debe clasificarse como 'CRITICO'.", "string", "Reglas de negocio e instrucciones detalladas del prompt", "ia", 1),
            ("temperature", "0.2", "number", "Temperatura (creatividad) de la IA (0.0 a 2.0)", "ia", 1),
            ("top_p", "0.95", "number", "Top P (0.0 a 1.0)", "ia", 1),
            ("top_k", "40", "number", "Top K (1 a 40)", "ia", 1)
        ]
        
        for clave, valor, tipo, descripcion, categoria, editable in default_configs:
            cursor.execute("""
                INSERT OR IGNORE INTO configuracion (clave, valor, tipo, descripcion, categoria, editable)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (clave, valor, tipo, descripcion, categoria, editable))
            
        conn.commit()
        print("¡Migración completada exitosamente!")
    except Exception as e:
        conn.rollback()
        print(f"Error durante la migración: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
