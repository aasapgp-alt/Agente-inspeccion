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
        
    seed_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "app", "assets", "seed_inspecciones.db")
    
    # Solo restaurar seed DB en producción/desarrollo real (no en tests unitarios aislados)
    is_testing = bool(os.getenv("PYTEST_CURRENT_TEST"))
    
    # Si la BD no existe y tenemos seed_db, copiarla directamente
    if not is_testing and not os.path.exists(settings.DB_PATH) and os.path.exists(seed_db_path):
        import shutil
        print(f"Copiando base de datos inicial desde {seed_db_path} a {settings.DB_PATH}...")
        shutil.copy2(seed_db_path, settings.DB_PATH)
        print("¡Base de datos inicial restaurada con éxito!")

    conn = sqlite3.connect(settings.DB_PATH)
    cursor = conn.cursor()
    
    # Si la BD existe pero equipos está en 0 y tenemos seed_db, restaurar
    if not is_testing and os.path.exists(seed_db_path):
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='equipos'")
            if cursor.fetchone():
                cursor.execute("SELECT count(*) FROM equipos")
                eq_cnt = cursor.fetchone()[0]
                if eq_cnt == 0:
                    import shutil
                    conn.close()
                    print(f"La base de datos tiene 0 equipos. Restaurando desde {seed_db_path}...")
                    shutil.copy2(seed_db_path, settings.DB_PATH)
                    conn = sqlite3.connect(settings.DB_PATH)
                    cursor = conn.cursor()
        except Exception as seed_err:
            print(f"Error al verificar/restaurar seed: {seed_err}")
    
    try:
        # Habilitar claves foráneas
        cursor.execute("PRAGMA foreign_keys = ON;")

        # Crear tabla empresas
        print("Creando tabla empresas...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS empresas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL,
            descripcion TEXT,
            activo BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        """)
        cursor.execute("INSERT OR IGNORE INTO empresas (id, nombre, descripcion) VALUES (1, 'Arauco', 'Empresa Arauco');")

        # Crear tabla ubicaciones
        print("Creando tabla ubicaciones...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS ubicaciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empresa_id INTEGER NOT NULL,
            nombre TEXT NOT NULL,
            codigo TEXT,
            descripcion TEXT,
            activo BOOLEAN DEFAULT 1,
            drive_folder_id TEXT,
            FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
            UNIQUE(empresa_id, nombre)
        );
        """)

        # Crear tabla equipos
        print("Creando tabla equipos...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS equipos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ubicacion_id INTEGER NOT NULL,
            codigo TEXT NOT NULL,
            nombre TEXT NOT NULL,
            tag TEXT,
            material TEXT,
            criticidad TEXT,
            fluido TEXT,
            presion_diseno REAL,
            temperatura_diseno REAL,
            estado_actual TEXT DEFAULT 'PENDIENTE',
            activo BOOLEAN DEFAULT 1,
            fecha_instalacion DATE,
            fabricante TEXT,
            modelo TEXT,
            FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE CASCADE,
            UNIQUE(ubicacion_id, codigo)
        );
        """)

        # Crear tabla inspecciones
        print("Creando tabla inspecciones...")
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS inspecciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            equipo_id INTEGER,
            anio INTEGER,
            estado TEXT,
            acciones TEXT,
            diagnostico TEXT,
            recomendaciones TEXT,
            created_at TIMESTAMP,
            updated_at TIMESTAMP,
            reporte_generado BOOLEAN,
            ruta_pdf_local TEXT,
            ruta_pdf_drive TEXT,
            drive_file_id TEXT,
            fecha_generacion_reporte DATETIME,
            tipo_reporte TEXT,
            numero_acta TEXT,
            estado_generacion TEXT,
            FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
        );
        """)
        
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
            comentario TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(equipo_id, image_id)
        );
        """)

        # Verificar si la columna comentario existe en anotaciones_imagenes, y si no, agregarla
        cursor.execute("PRAGMA table_info(anotaciones_imagenes)")
        columns = {row[1] for row in cursor.fetchall()}
        if "comentario" not in columns:
            print("Agregando columna 'comentario' a la tabla anotaciones_imagenes...")
            cursor.execute("ALTER TABLE anotaciones_imagenes ADD COLUMN comentario TEXT")

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

        print("Creando tabla aprendizaje...")
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

        print("Creando tabla para Itinerarios...")

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS plan_inspeccion_diaria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            fecha DATE NOT NULL,
            equipo_id INTEGER NOT NULL,
            orden INTEGER NOT NULL,
            estado TEXT DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'COMPLETADO', 'OMITIDO')),
            completado_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
            FOREIGN KEY(equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
            UNIQUE(usuario_id, fecha, equipo_id)
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
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_aprendizaje_equipo ON aprendizaje(equipo)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_plan_inspeccion_diaria_fecha ON plan_inspeccion_diaria(usuario_id, fecha)")
        
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
        
        # Si se definió explícitamente ADMIN_INITIAL_PASSWORD, actualizar su hash
        if not password_generada:
            cursor.execute("UPDATE usuarios SET password_hash = ? WHERE username = 'admin'", (admin_hash,))
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
            ("gemini_model", "gemini-1.5-flash", "string", "Modelo de Gemini utilizado para análisis de activos", "ia", 1),
            ("max_tokens", "4096", "number", "Máximo número de tokens de salida en la respuesta de la IA", "ia", 1),
            ("system_instruction", "Eres un inspector industrial experto en activos mecánicos, piletas y cañerías de proceso (FRP, ACRBA) redactando un informe técnico formal.\nDebes redactar todo de manera estrictamente impersonal y formal.\nEstá completamente prohibido usar la primera persona del singular (\"yo\", \"he verificado\", \"mi inspección\") y verbos en pasado en primera persona (no \"inspeccioné\", \"revisé\").\n- Para el DIAGNÓSTICO: Describe el estado actual o hechos únicamente en tiempo presente impersonal (ej: \"El tramo de cañería presenta...\", \"Se observa desgaste...\"). Compara con el historial PGP 2024 provisto.\n- Para las ACCIONES: Escribe en pasado impersonal, describiendo qué hizo el inspector (ej. \"Se realizó inspección externa\", \"Se realizó apertura de bridas o carreteles\", \"Se realizó inspección visual externa anual\"). Compara con la PGP 2024.\n- Para las RECOMENDACIONES: Escribe siempre las tareas a futuro usando verbos en INFINITIVO (ej: \"Continuar con...\", \"Proceder a...\", \"Informar al área...\", \"Reemplazar...\").\nNo menciones nunca limitaciones de fotos ni digas que \"no se cuenta con imágenes\" o \"no se puede evaluar\". Para cualquier zona o componente no visible, hereda o asume exactamente el diagnóstico del Historial PGP 2024 o no lo nombres.\nDebes responder ÚNICAMENTE en formato JSON con la estructura indicada, respetando las llaves exactas.", "string", "Instrucciones del sistema para la IA (Gemini)", "ia", 1),
            ("reglas_negocio", "REGLAS ESTRICTAS DE ANÁLISIS (obligatorias):\n1. TONO IMPERSONAL Y DIRECTIVO (FORMATO ESTÁNDAR): Redacta todo el informe de forma impersonal y objetiva. Está estrictamente prohibido usar la primera persona del singular (\"yo\", \"he verificado\", \"encuentro\", \"mi inspección\") y verbos en pasado para describir tus acciones (no \"inspeccioné\", \"revisé\", \"encontré\").\n   - Para el DIAGNÓSTICO: Utiliza el tiempo presente para describir el estado actual, hechos o situaciones del activo (ej: \"El tramo de cañería presenta...\", \"Se observa desgaste...\", \"La línea existente presta servicio desde...\").\n   - Para las ACCIONES y RECOMENDACIONES: Utiliza verbos en INFINITIVO como instrucción impersonal directiva (ej: \"Continuar con...\", \"Proceder a...\", \"Informar al área...\", \"Reemplazar elementos...\", \"Solicitar el drenaje...\").\n2. COMPONENTES SIN FOTO O NO VISIBLES: Está estrictamente prohibido redactar disculpas, justificaciones o aclarar que \"no se cuenta con fotos de la válvula\" o \"no se puede evaluar por falta de imágenes\". Si un componente o aspecto (como válvulas, anclajes, soportes, etc.) no es visible en las imágenes adjuntas:\n   - Copia exactamente el diagnóstico y estado correspondiente que figura en el \"Historial del PGP 2024\" para ese componente.\n   - O bien omite completamente cualquier mención del componente si tampoco existe en el historial.\n   - Jamás expongas dudas o limitaciones técnicas por falta de fotos en tu respuesta final.\n3. PROHIBIDO INFERIR DETERIORO INVISIBLE: Analiza ÚNICAMENTE la evidencia visual real. No asumas ni inventes desgastes que no sean claramente visibles.\n4. NORMALIZACIÓN DE ESTADOS: El estado debe ser estrictamente uno de: 'BUENO', 'REGULAR', 'CRITICO' o 'FUERA DE RUTA'.\n5. CRITICIDAD: Cualquier fisura, pérdida de fluido importante o daño estructural evidente y visible debe clasificarse como 'CRITICO'.", "string", "Reglas de negocio e instrucciones detalladas del prompt", "ia", 1),
            ("temperature", "0.2", "number", "Temperatura (creatividad) de la IA (0.0 a 2.0)", "ia", 1),
            ("top_p", "0.95", "number", "Top P (0.0 a 1.0)", "ia", 1),
            ("top_k", "40", "number", "Top K (1 a 40)", "ia", 1),
            # PDF
            ("reportes_dir", "data/reportes", "string", "Ruta local del directorio de almacenamiento para reportes individuales", "pdf", 1),
            ("libros_dir", "data/libros", "string", "Ruta local del directorio de almacenamiento para libros de reportes completados", "pdf", 1),
            # Reportes y Libros
            ("reporte_campania", "PGP 2026", "string", "Nombre de la campaña de inspección por defecto en los reportes", "reportes", 1),
            ("empresa_inspectora_nombre", "SULVY SRL", "string", "Razón social de la empresa inspectora (aparece en encabezados y firmas)", "reportes", 1),
            ("empresa_inspectora_subtitulo", "Sistema de Gestión de Calidad y Ambiental Certificado", "string", "Subtítulo institucional en portadas y encabezados", "reportes", 1),
            ("reporte_contacto_pie", "Miranda 549 (B1686GNA) Hurlingham, Buenos Aires  •  Tel: +54 11 4665-2875 / 4662-2558  •  info@sulvy.com", "string", "Información de contacto, dirección y teléfono al pie de página", "reportes", 1),
            ("reporte_criterios_normas", "• ASTM D 2563-94 Standard Practice for Classifying Visual Defects in Glass-Reinforced Plastic Laminate Parts\n• Manuales específicos Ashland y Reichhold, Lineamientos y criterios específicos.\n• NOGA Guía 055-97 Guía recomendada para ensayos no destructivos (NDT) en tanques y sistemas de tuberías PRFV, Norwegian Oil & Gas Association.\n• Proyecto MTI 129-99 Guía práctica para inspección de campo para equipos y tuberías PRFV, Materials Technology Institute St. Louis MO, USA.\n• ESA/FSA pub. nº 009/98 Guía para la utilización segura de elementos de sellado - Juntas y Bridas", "string", "Criterios y normativas técnicas aplicadas en los reportes (un ítem por línea con viñeta)", "reportes", 1),
            ("reporte_firmante_1_nombre", "Marco G. Paltrinieri", "string", "Nombre del primer firmante técnico (Director / Supervisor)", "reportes", 1),
            ("reporte_firmante_1_cargo", "Director Técnico", "string", "Cargo del primer firmante", "reportes", 1),
            ("reporte_firmante_1_matricula", "Matrícula COPIME Nº 12345", "string", "Matrícula profesional del primer firmante", "reportes", 1),
            ("reporte_firmante_2_nombre", "Ing. Esteban M. Irioni", "string", "Nombre del segundo firmante técnico (Inspector)", "reportes", 1),
            ("reporte_firmante_2_cargo", "Inspector Autorizado", "string", "Cargo del segundo firmante", "reportes", 1),
            ("reporte_firmante_2_matricula", "Matrícula COPIME Nº 67890", "string", "Matrícula profesional del segundo firmante", "reportes", 1),
            ("reporte_max_fotos_individual", "6", "number", "Cantidad máxima de fotografías en el cuerpo del reporte individual", "reportes", 1),
            ("reporte_max_fotos_libro", "2", "number", "Cantidad máxima de fotografías por equipo en el Libro consolidado", "reportes", 1),
            ("libro_objetivo_plantilla", "Consolidar los informes de inspección técnica realizados en la ubicación {ubicacion} de la empresa {empresa} durante la campaña {campania}, detallando los hallazgos técnicos, el estado de conservación de los activos, y las recomendaciones de mantenimiento propuestas para el período {next_camp}.", "string", "Texto del objetivo en la portada del Libro consolidado por área", "reportes", 1),
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
        # Verificar si la columna drive_folder_id existe en ubicaciones, y si no, agregarla
        print("Verificando columna drive_folder_id en la tabla ubicaciones...")
        try:
            cursor.execute("PRAGMA table_info(ubicaciones)")
            columns = {row[1] for row in cursor.fetchall()}
            if columns and "drive_folder_id" not in columns:
                print("Agregando columna 'drive_folder_id' a la tabla ubicaciones...")
                cursor.execute("ALTER TABLE ubicaciones ADD COLUMN drive_folder_id TEXT")
        except Exception as alter_err:
            print(f"Error al verificar/alterar tabla ubicaciones: {alter_err}")

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
