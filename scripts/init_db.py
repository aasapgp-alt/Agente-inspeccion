import sqlite3
import os
import sys
import secrets

# Añadir el directorio raíz al path para poder importar módulos de app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.security import hash_password

def init_db():
    print(f"Inicializando base de datos en: {settings.DB_PATH}")
    
    # Asegurar que el directorio de la base de datos exista
    db_dir = os.path.dirname(settings.DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
        
    conn = sqlite3.connect(settings.DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Habilitar claves foráneas
        cursor.execute("PRAGMA foreign_keys = ON;")
        
        # Crear tabla usuarios
        print("Creando tabla usuarios...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nombre_completo TEXT NOT NULL,
            rol TEXT DEFAULT 'inspector' CHECK(rol IN ('inspector', 'supervisor', 'admin')),
            empresa TEXT,
            activo BOOLEAN DEFAULT 1,
            ultimo_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """)
        
        # Crear tabla sesiones_activas
        print("Creando tabla sesiones_activas...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sesiones_activas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE CASCADE
        )
        """)
        
        # Crear tabla auditoria
        print("Creando tabla auditoria...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            accion TEXT NOT NULL,
            tabla TEXT,
            registro_id INTEGER,
            detalles TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES usuarios(id) ON DELETE SET NULL
        )
        """)
        
        # Crear tabla libros
        print("Creando tabla libros...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS libros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ubicacion_id INTEGER NOT NULL,
            nombre_ubicacion TEXT NOT NULL,
            empresa_id INTEGER NOT NULL,
            nombre_empresa TEXT NOT NULL,
            fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario_id INTEGER NOT NULL,
            numero_equipos INTEGER,
            ruta_pdf_local TEXT,
            ruta_pdf_drive TEXT,
            drive_file_id TEXT,
            tamanio_pdf INTEGER,
            campania TEXT DEFAULT 'PGP 2026',
            resumen_estados TEXT, -- JSON
            equipos_incluidos TEXT, -- JSON
            FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        );
        """)

        # Crear tabla versiones_reportes
        print("Creando tabla versiones_reportes...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS versiones_reportes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL, -- 'individual' o 'libro'
            reporte_id INTEGER NOT NULL, -- ID del reporte en la tabla 'reportes' o 'libros'
            version INTEGER NOT NULL,
            ruta_pdf_local TEXT,
            ruta_pdf_drive TEXT,
            drive_file_id TEXT,
            fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
            usuario_id INTEGER,
            notas TEXT,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
        );
        """)

        # Crear tabla anotaciones_imagenes
        print("Creando tabla anotaciones_imagenes...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS anotaciones_imagenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER NOT NULL,
            image_id TEXT NOT NULL,
            annotations TEXT NOT NULL, -- JSON string representation
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(equipo_id, image_id)
        );
        """)

        # Crear tabla configuracion con soporte para migración desde esquema viejo
        print("Verificando tabla configuracion...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='configuracion'")
        table_exists = cursor.fetchone()
        
        legacy_drive_folder = None
        if table_exists:
            cursor.execute("PRAGMA table_info(configuracion)")
            columns = {row[1] for row in cursor.fetchall()}
            if "key" in columns:
                print("Detectada tabla configuracion con esquema antiguo. Iniciando migración...")
                try:
                    cursor.execute("SELECT value FROM configuracion WHERE key = 'ROOT_DRIVE_FOLDER'")
                    row = cursor.fetchone()
                    if row:
                        legacy_drive_folder = row[0]
                        print(f"Valor legacy recuperado para ROOT_DRIVE_FOLDER: {legacy_drive_folder}")
                except Exception as e:
                    print(f"Error al recuperar valor legacy: {e}")
                
                cursor.execute("DROP TABLE configuracion")
                print("Tabla configuracion antigua eliminada.")

        print("Creando tabla configuracion...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS configuracion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clave TEXT UNIQUE NOT NULL,
            valor TEXT NOT NULL,
            tipo TEXT DEFAULT 'string', -- 'string', 'number', 'boolean', 'json'
            descripcion TEXT,
            categoria TEXT, -- 'general', 'drive', 'ia', 'pdf', 'reportes', 'notificaciones'
            editable BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)

        print("Creando tabla campanias...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS campanias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            activa BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, nombre)
        );
        """)

        print("Creando tabla drive_folders_cache...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS drive_folders_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drive_id TEXT UNIQUE NOT NULL,
            nombre TEXT NOT NULL,
            parent_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # Crear índices
        print("Creando índices...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_username ON usuarios(username)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones_activas(token)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sesiones_user_id ON sesiones_activas(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_configuracion_clave ON configuracion(clave)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_campanias_empresa ON campanias(empresa_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drive_folders_drive_id ON drive_folders_cache(drive_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_drive_folders_parent_id ON drive_folders_cache(parent_id)")
        
        # Insertar administrador por defecto (sin contraseña predecible)
        print("Creando usuario administrador por defecto...")
        admin_pass = os.getenv("ADMIN_INITIAL_PASSWORD")
        password_generada = not admin_pass
        if password_generada:
            admin_pass = secrets.token_urlsafe(12)
        admin_hash = hash_password(admin_pass)
        cursor.execute("""
            INSERT OR IGNORE INTO usuarios (username, email, password_hash, nombre_completo, rol, activo)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("admin", "admin@empresa.com", admin_hash, "Administrador del Sistema", "admin", 1))
        # Solo se muestra/aplica si el admin se creó ahora (rowcount > 0); no afecta a uno existente.
        if cursor.rowcount > 0 and password_generada:
            print("=" * 60)
            print(f"[SEGURIDAD] Usuario 'admin' creado con contraseña temporal: {admin_pass}")
            print("[SEGURIDAD] Anótela y cámbiela tras el primer inicio de sesión.")
            print("[SEGURIDAD] Para fijarla, defina ADMIN_INITIAL_PASSWORD antes de init_db.")
            print("=" * 60)

        # Crear usuarios solicitados por el usuario
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
            pwd_hash = hash_password(password)
            cursor.execute("""
                INSERT OR IGNORE INTO usuarios (username, email, password_hash, nombre_completo, rol, activo)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (username, email, pwd_hash, nombre, rol, 1))

        # Insertar configuraciones por defecto
        print("Insertando configuraciones por defecto...")
        default_configs = [
            # General (incluye no editables)
            ("app_name", "Asistente de Inspección", "string", "Nombre de la aplicación", "general", 0),
            ("app_version", "1.0.0", "string", "Versión de la aplicación", "general", 0),
            ("max_image_size_mb", "5", "number", "Tamaño máximo de imagen en MB para procesamiento", "general", 1),
            ("max_image_dimension", "1920", "number", "Dimensión máxima (ancho/alto) de las imágenes al redimensionar", "general", 1),
            ("jwt_expiration_hours", "24", "number", "Tiempo de expiración de los tokens de sesión (horas)", "general", 1),
            # Google Drive
            ("google_api_key", "", "string", "API Key de Google Cloud Platform / Gemini API", "drive", 1),
            ("drive_folder_id", legacy_drive_folder if legacy_drive_folder else "", "string", "ID de la carpeta raíz de Google Drive para almacenamiento", "drive", 1),
            # IA
            ("gemini_model", "gemini-3.5-flash", "string", "Modelo de Gemini utilizado para análisis de activos", "ia", 1),
            ("max_tokens", "4096", "number", "Máximo número de tokens de salida en la respuesta de la IA", "ia", 1),
            # PDF
            ("reportes_dir", "data/reportes", "string", "Ruta local del directorio de almacenamiento para reportes individuales", "pdf", 1),
            ("libros_dir", "data/libros", "string", "Ruta local del directorio de almacenamiento para libros de reportes completados", "pdf", 1),
            # Reportes
            ("reporte_campania", "PGP 2026", "string", "Nombre de la campaña de inspección por defecto en los reportes", "reportes", 1),
            # Notificaciones
            ("notificaciones_habilitadas", "true", "boolean", "Habilitar el envío de notificaciones del sistema", "notificaciones", 1),
            ("notificaciones_email", "alertas@empresa.com", "string", "Dirección de correo electrónico para alertas del sistema", "notificaciones", 1)
        ]
        
        for clave, valor, tipo, descripcion, categoria, editable in default_configs:
            cursor.execute("""
                INSERT OR IGNORE INTO configuracion (clave, valor, tipo, descripcion, categoria, editable)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (clave, valor, tipo, descripcion, categoria, editable))
            
        # Insertar campañas iniciales por defecto para Arauco (id = 1)
        print("Insertando campañas por defecto para Arauco...")
        cursor.execute("SELECT id FROM empresas WHERE id = 1")
        if cursor.fetchone():
            default_campanias = [
                (1, "PGP 2023", "Campaña PGP Año 2023", 0),
                (1, "PGP 2024", "Campaña PGP Año 2024", 0),
                (1, "PGP 2026", "Campaña PGP Año 2026", 1)
            ]
            for emp_id, nombre, desc, activa in default_campanias:
                cursor.execute("""
                    INSERT OR IGNORE INTO campanias (empresa_id, nombre, descripcion, activa)
                    VALUES (?, ?, ?, ?)
                """, (emp_id, nombre, desc, activa))
            
        conn.commit()
        print("¡Base de datos inicializada correctamente!")
        
    except Exception as e:
        conn.rollback()
        print(f"Error al inicializar la base de datos: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
