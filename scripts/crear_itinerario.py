import argparse
import sys
import os
import sqlite3
from datetime import date

# Añadir el directorio raíz al path para poder importar módulos de app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

def main():
    parser = argparse.ArgumentParser(description="Crear un plan de inspección diaria (itinerario) para un inspector.")
    parser.add_argument("--usuario", required=True, help="Username del inspector")
    parser.add_argument("--fecha", default=date.today().isoformat(), help="Fecha del itinerario (YYYY-MM-DD)")
    parser.add_argument("--equipos", required=True, help="Lista de códigos de equipos separados por coma")
    
    args = parser.parse_args()
    
    db_path = settings.DB_PATH
    if not os.path.exists(db_path):
        print(f"Error: La base de datos no existe en {db_path}")
        sys.exit(1)
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # 1. Buscar usuario
        cursor.execute("SELECT id, nombre_completo FROM usuarios WHERE username = ?", (args.usuario,))
        user = cursor.fetchone()
        if not user:
            print(f"Error: El usuario '{args.usuario}' no existe.")
            sys.exit(1)
            
        user_id = user["id"]
        user_nombre = user["nombre_completo"]
        
        # 2. Parsear equipos
        codigos = [c.strip() for c in args.equipos.split(",") if c.strip()]
        if not codigos:
            print("Error: Debe proporcionar al menos un código de equipo válido.")
            sys.exit(1)
            
        equipos_db = []
        for cod in codigos:
            cursor.execute("SELECT id, codigo, nombre FROM equipos WHERE codigo = ? AND activo = 1", (cod,))
            eq = cursor.fetchone()
            if not eq:
                print(f"Advertencia: El equipo con código '{cod}' no existe o está inactivo. Se omitirá.")
            else:
                equipos_db.append(dict(eq))
                
        if not equipos_db:
            print("Error: Ninguno de los códigos de equipo proporcionados es válido.")
            sys.exit(1)
            
        # 3. Limpiar itinerario existente para ese usuario y fecha (para evitar duplicados o pisarlo)
        cursor.execute("DELETE FROM plan_inspeccion_diaria WHERE usuario_id = ? AND fecha = ?", (user_id, args.fecha))
        
        # 4. Insertar la nueva ruta
        for orden, eq in enumerate(equipos_db, 1):
            cursor.execute("""
                INSERT INTO plan_inspeccion_diaria (usuario_id, fecha, equipo_id, orden, estado)
                VALUES (?, ?, ?, ?, 'PENDIENTE')
            """, (user_id, args.fecha, eq["id"], orden))
            
        conn.commit()
        print(f"Se creó exitosamente el itinerario para {user_nombre} ({args.usuario}) para el día {args.fecha}:")
        for orden, eq in enumerate(equipos_db, 1):
            print(f"  {orden}. {eq['codigo']} - {eq['nombre']}")
            
    except Exception as e:
        conn.rollback()
        print(f"Error al crear itinerario: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
