import sqlite3
import os
import sys

# Añadir el directorio raíz al path para poder importar módulos de app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.security import hash_password

def migrate():
    print(f"Iniciando migración en: {settings.DB_PATH}")
    if not os.path.exists(settings.DB_PATH):
        print("La base de datos no existe. Se creará al arrancar el backend.")
        return

    conn = sqlite3.connect(settings.DB_PATH)
    cursor = conn.cursor()
    
    try:
        # 1. Modificar tabla auditoria
        cursor.execute("PRAGMA table_info(auditoria)")
        cols = {row[1] for row in cursor.fetchall()}
        
        if cols:
            if "tabla" not in cols:
                print("Agregando columna 'tabla' a la tabla 'auditoria'...")
                cursor.execute("ALTER TABLE auditoria ADD COLUMN tabla TEXT")
            if "registro_id" not in cols:
                print("Agregando columna 'registro_id' a la tabla 'auditoria'...")
                cursor.execute("ALTER TABLE auditoria ADD COLUMN registro_id INTEGER")
        else:
            print("La tabla auditoria no existe. Se creará automáticamente.")
            
        # 2. Registrar los nuevos usuarios
        print("Insertando usuarios semilla adicionales...")
        new_users = [
            ("mpaltrinieri", "mpaltrinieri@sulvy.com", "123456", "Marco Paltrinieri", "inspector"),
            ("hpaltrinieri", "hpaltrinieri@sulvy.com", "123456", "Herman Paltrinieri", "inspector"),
            ("eirioni", "eirioni@sulvy.com", "123456", "Esteban Irioni", "inspector"),
            ("gabrielng2005", "gabrielng2005@gmail.com", "123456", "Gabriel Gonzalez", "inspector"),
            ("anahivillalba_06", "anahivillalba_06@hotmail.com", "123456", "Anahi Villalba", "inspector"),
            ("cristaldoiq", "cristaldoiq@gmail.com", "13011081", "Diego A Cristaldo", "admin")
        ]
        
        for username, email, password, nombre, rol in new_users:
            # Verificar si ya existe el usuario
            cursor.execute("SELECT 1 FROM usuarios WHERE username = ? OR email = ?", (username, email))
            if not cursor.fetchone():
                pwd_hash = hash_password(password)
                cursor.execute("""
                    INSERT INTO usuarios (username, email, password_hash, nombre_completo, rol, activo)
                    VALUES (?, ?, ?, ?, ?, 1)
                """, (username, email, pwd_hash, nombre, rol))
                print(f"Usuario '{username}' creado.")
            else:
                print(f"Usuario '{username}' ya existe, omitiendo.")
                
        conn.commit()
        print("¡Migración completada con éxito!")
    except Exception as e:
        conn.rollback()
        print(f"Error durante la migración: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
