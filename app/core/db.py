"""
Módulo de Gestión de Conexiones de Base de Datos
================================================
Provee conectividad unificada y transparente para Neon (PostgreSQL) y SQLite.
Implementa pooling de conexiones con psycopg2 y un cursor adaptativo (DictCursor)
que permite acceso dual por nombre de columna (row['id']) y por índice (row[0]).
"""

import os
import re
import sqlite3
import logging
from typing import Generator, Any, Optional
from contextlib import contextmanager

from app.core.config import settings

logger = logging.getLogger(__name__)

# Globales para el pool de Postgres
_pg_pool = None


def init_pg_pool(minconn: int = 1, maxconn: int = 20):
    """Inicializa el pool de conexiones de Neon PostgreSQL."""
    global _pg_pool
    if not settings.IS_POSTGRES:
        return None

    try:
        import psycopg2.pool
        from psycopg2.extras import DictCursor

        if _pg_pool is None or _pg_pool.closed:
            logger.info(f"Inicializando pool de conexiones Neon PostgreSQL (min={minconn}, max={maxconn})...")
            _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=minconn,
                maxconn=maxconn,
                dsn=settings.DATABASE_URL,
                cursor_factory=DictCursor
            )
            logger.info("Pool de conexiones Neon PostgreSQL inicializado con éxito.")
    except Exception as e:
        logger.error(f"Error al inicializar el pool de conexiones Neon: {e}", exc_info=True)
        _pg_pool = None
    return _pg_pool


def close_pg_pool():
    """Cierra el pool de conexiones al apagar la aplicación."""
    global _pg_pool
    if _pg_pool and not _pg_pool.closed:
        _pg_pool.closeall()
        logger.info("Pool de conexiones Neon cerrado.")


def adapt_sql_for_pg(sql: str) -> str:
    """
    Traduce sintaxis común de SQLite a PostgreSQL para máxima compatibilidad:
    - Reemplaza placeholders '?' por '%s'
    - Traduce funciones de fecha como date('now') o date(col) = date('now')
    - Traduce comparaciones booleanas (e.g. activo = 1 -> activo = TRUE)
    - Traduce SQLite GLOB a Postgres regex
    """
    if not sql:
        return sql

    # Reemplazar placeholders ? por %s (cuidando no reemplazar operadores como ?| o ?&)
    # En consultas estándar, los parámetros son '?' aislados
    adapted = re.sub(r'(?<!\?)\?(?!\?)', '%s', sql)

    # Adaptaciones de fechas SQLite -> PostgreSQL
    adapted = adapted.replace("date('now')", "CURRENT_DATE")
    adapted = adapted.replace("datetime('now')", "CURRENT_TIMESTAMP")
    adapted = re.sub(r"date\(([^)]+)\)\s*=\s*CURRENT_DATE", r"\1::date = CURRENT_DATE", adapted)

    # Adaptaciones booleanas SQLite (= 1 / = 0) -> PostgreSQL (= TRUE / = FALSE)
    adapted = re.sub(r'(\b\w+\.)?(activo|activa|editable|reporte_generado)\s*=\s*1\b', r'\1\2 = TRUE', adapted, flags=re.IGNORECASE)
    adapted = re.sub(r'(\b\w+\.)?(activo|activa|editable|reporte_generado)\s*=\s*0\b', r'\1\2 = FALSE', adapted, flags=re.IGNORECASE)

    # Adaptar GLOB '[0-9]*' -> ~ '^[0-9]'
    adapted = re.sub(r"GLOB\s*'\[0-9\]\*'", r"~ '^[0-9]'", adapted, flags=re.IGNORECASE)

    # Adaptar INSERT OR REPLACE INTO anotaciones_imagenes
    if re.search(r'INSERT\s+OR\s+REPLACE\s+INTO\s+anotaciones_imagenes', adapted, flags=re.IGNORECASE):
        adapted = re.sub(
            r'INSERT\s+OR\s+REPLACE\s+INTO\s+anotaciones_imagenes\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)',
            r'INSERT INTO anotaciones_imagenes (\1) VALUES (\2) ON CONFLICT (equipo_id, image_id) DO UPDATE SET annotations = EXCLUDED.annotations, comentario = EXCLUDED.comentario, updated_at = EXCLUDED.updated_at',
            adapted,
            flags=re.IGNORECASE
        )

    # Adaptar INSERT OR REPLACE INTO drive_folders_cache
    if re.search(r'INSERT\s+OR\s+REPLACE\s+INTO\s+drive_folders_cache', adapted, flags=re.IGNORECASE):
        adapted = re.sub(
            r'INSERT\s+OR\s+REPLACE\s+INTO\s+drive_folders_cache\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)',
            r'INSERT INTO drive_folders_cache (\1) VALUES (\2) ON CONFLICT (drive_id) DO UPDATE SET nombre = EXCLUDED.nombre, parent_id = EXCLUDED.parent_id, updated_at = EXCLUDED.updated_at',
            adapted,
            flags=re.IGNORECASE
        )

    # Adaptar INSERT OR IGNORE INTO
    adapted = re.sub(
        r'INSERT\s+OR\s+IGNORE\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)',
        r'INSERT INTO \1 (\2) VALUES (\3) ON CONFLICT DO NOTHING',
        adapted,
        flags=re.IGNORECASE
    )

    return adapted


class PostgresCursorWrapper:
    """
    Wrapper sobre el cursor de psycopg2 para adaptar automáticamente queries
    diseñadas originalmente con sintaxis ? a %s y proveer atributos compatibles.
    """
    def __init__(self, raw_cursor, conn):
        self._cursor = raw_cursor
        self._conn = conn

    def execute(self, query: str, vars: Any = None):
        pg_query = adapt_sql_for_pg(query)
        if vars is not None:
            # psycopg2 espera tupla o lista
            if isinstance(vars, list):
                vars = tuple(vars)
            elif not isinstance(vars, (tuple, dict)):
                vars = (vars,)
            return self._cursor.execute(pg_query, vars)
        return self._cursor.execute(pg_query)

    def executemany(self, query: str, vars_list: Any):
        pg_query = adapt_sql_for_pg(query)
        return self._cursor.executemany(pg_query, vars_list)

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size) if size else self._cursor.fetchmany()

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def lastrowid(self):
        # En Postgres, si no se usó RETURNING, se intenta consultar lastval() protegido con SAVEPOINT
        try:
            with self._conn._raw_conn.cursor() as cur:
                cur.execute("SAVEPOINT lastrowid_sp")
                try:
                    cur.execute("SELECT lastval()")
                    row = cur.fetchone()
                    cur.execute("RELEASE SAVEPOINT lastrowid_sp")
                    return row[0] if row else None
                except Exception:
                    cur.execute("ROLLBACK TO SAVEPOINT lastrowid_sp")
                    return None
        except Exception:
            return None

    @property
    def description(self):
        return self._cursor.description

    def close(self):
        self._cursor.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __iter__(self):
        return iter(self._cursor)


class PostgresConnectionWrapper:
    """
    Wrapper sobre la conexión de psycopg2 para proveer compatibilidad
    con la API de sqlite3 (.execute(), .commit(), .rollback(), .cursor()).
    """
    def __init__(self, raw_conn, pool=None):
        self._raw_conn = raw_conn
        self._pool = pool

    def cursor(self):
        from psycopg2.extras import DictCursor
        raw_cur = self._raw_conn.cursor(cursor_factory=DictCursor)
        return PostgresCursorWrapper(raw_cur, self)

    def execute(self, query: str, vars: Any = None):
        cur = self.cursor()
        cur.execute(query, vars)
        return cur

    def commit(self):
        return self._raw_conn.commit()

    def rollback(self):
        return self._raw_conn.rollback()

    def close(self):
        if self._pool:
            self._pool.putconn(self._raw_conn)
        else:
            self._raw_conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        else:
            self.commit()
        self.close()


def get_raw_pg_connection():
    """Obtiene una conexión directa desde el pool o abre una nueva si el pool no está disponible, validando que esté viva."""
    global _pg_pool
    import psycopg2
    from psycopg2.extras import DictCursor

    if _pg_pool is None or _pg_pool.closed:
        init_pg_pool()

    if _pg_pool:
        for _ in range(3):
            raw_conn = None
            try:
                raw_conn = _pg_pool.getconn()
                if raw_conn.closed != 0:
                    try:
                        _pg_pool.putconn(raw_conn, close=True)
                    except Exception:
                        pass
                    continue
                with raw_conn.cursor() as test_cur:
                    test_cur.execute("SELECT 1")
                return PostgresConnectionWrapper(raw_conn, pool=_pg_pool)
            except (psycopg2.OperationalError, psycopg2.InterfaceError, Exception) as conn_err:
                logger.warning(f"Conexión de PostgreSQL reciclada por inactividad: {conn_err}")
                if raw_conn:
                    try:
                        _pg_pool.putconn(raw_conn, close=True)
                    except Exception:
                        pass
        # Fallback a conexión directa si el pool está agotado o con errores
        try:
            raw_conn = psycopg2.connect(settings.DATABASE_URL, cursor_factory=DictCursor)
            return PostgresConnectionWrapper(raw_conn, pool=None)
        except Exception as direct_err:
            logger.error(f"Error abriendo conexión directa PostgreSQL: {direct_err}")
            raise
    else:
        raw_conn = psycopg2.connect(settings.DATABASE_URL, cursor_factory=DictCursor)
        return PostgresConnectionWrapper(raw_conn, pool=None)


def get_db_connection():
    """
    Obtiene una conexión a la base de datos configurada (Neon PostgreSQL o SQLite).
    Compatible con 'with get_db_connection() as conn:' y conn.execute().
    """
    if settings.IS_POSTGRES:
        return get_raw_pg_connection()

    # SQLite Fallback
    os.makedirs(os.path.dirname(settings.DB_PATH) if os.path.dirname(settings.DB_PATH) else ".", exist_ok=True)
    conn = sqlite3.connect(settings.DB_PATH, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 30000")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def init_pg_schema():
    """Garantiza de forma idempotente que todas las tablas y columnas necesarias existan en Postgres."""
    if not settings.IS_POSTGRES:
        return
        
    schema_sql = """
    CREATE TABLE IF NOT EXISTS empresas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) UNIQUE NOT NULL,
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ubicaciones (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        codigo VARCHAR(100),
        descripcion TEXT,
        activo BOOLEAN DEFAULT TRUE,
        drive_folder_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_ubicaciones_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
        CONSTRAINT uq_empresa_ubicacion UNIQUE (empresa_id, nombre)
    );

    CREATE TABLE IF NOT EXISTS campanias (
        id SERIAL PRIMARY KEY,
        empresa_id INTEGER NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_campanias_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
        CONSTRAINT uq_empresa_campania UNIQUE (empresa_id, nombre)
    );

    CREATE TABLE IF NOT EXISTS equipos (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL,
        codigo VARCHAR(100) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        tag VARCHAR(100),
        material VARCHAR(100),
        criticidad VARCHAR(50),
        fluido VARCHAR(100),
        presion_diseno NUMERIC(10,2),
        temperatura_diseno NUMERIC(10,2),
        estado_actual VARCHAR(50) DEFAULT 'PENDIENTE',
        activo BOOLEAN DEFAULT TRUE,
        fecha_instalacion DATE,
        fabricante VARCHAR(255),
        modelo VARCHAR(255),
        drive_folder_id VARCHAR(255),
        CONSTRAINT fk_equipos_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id) ON DELETE CASCADE,
        CONSTRAINT uq_ubicacion_codigo UNIQUE (ubicacion_id, codigo)
    );

    CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        nombre_completo VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'inspector' CHECK(rol IN ('inspector', 'supervisor', 'admin')),
        empresa VARCHAR(255),
        activo BOOLEAN DEFAULT TRUE,
        ultimo_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sesiones_activas (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sesiones_usuario FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        accion VARCHAR(100) NOT NULL,
        tabla VARCHAR(100),
        registro_id INTEGER,
        detalles TEXT,
        ip_address VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_auditoria_usuario FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS inspecciones (
        id SERIAL PRIMARY KEY,
        equipo_id INTEGER NOT NULL,
        anio INTEGER,
        estado VARCHAR(50),
        acciones TEXT,
        diagnostico TEXT,
        recomendaciones TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        reporte_generado BOOLEAN DEFAULT FALSE,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        fecha_generacion_reporte TIMESTAMP WITH TIME ZONE,
        tipo_reporte VARCHAR(100),
        numero_acta VARCHAR(100),
        estado_generacion VARCHAR(50),
        error_generacion TEXT,
        metadata_historica JSONB,
        CONSTRAINT fk_inspecciones_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS libros (
        id SERIAL PRIMARY KEY,
        ubicacion_id INTEGER NOT NULL,
        nombre_ubicacion VARCHAR(255) NOT NULL,
        empresa_id INTEGER NOT NULL,
        nombre_empresa VARCHAR(255) NOT NULL,
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER NOT NULL,
        numero_equipos INTEGER,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        tamanio_pdf BIGINT,
        campania VARCHAR(100) DEFAULT 'PGP 2026',
        resumen_estados TEXT,
        equipos_incluidos TEXT,
        CONSTRAINT fk_libros_ubicacion FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id),
        CONSTRAINT fk_libros_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS reportes (
        id SERIAL PRIMARY KEY,
        equipo_id INTEGER NOT NULL,
        nombre_equipo VARCHAR(255) NOT NULL,
        codigo_equipo VARCHAR(100),
        fecha_inspeccion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        estado_general VARCHAR(50),
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        tamanio_pdf BIGINT,
        usuario_id INTEGER,
        resumen_diagnostico TEXT,
        numero_acta VARCHAR(255),
        campania VARCHAR(100) DEFAULT 'PGP 2026',
        CONSTRAINT fk_reportes_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
        CONSTRAINT fk_reportes_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS versiones_reportes (
        id SERIAL PRIMARY KEY,
        tipo VARCHAR(50) NOT NULL,
        reporte_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        notas TEXT,
        CONSTRAINT fk_versiones_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS reportes_versiones (
        id SERIAL PRIMARY KEY,
        inspeccion_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        notas TEXT,
        CONSTRAINT fk_repvers_inspeccion FOREIGN KEY (inspeccion_id) REFERENCES inspecciones(id) ON DELETE CASCADE,
        CONSTRAINT fk_repvers_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS anotaciones_imagenes (
        id SERIAL PRIMARY KEY,
        equipo_id INTEGER NOT NULL,
        image_id VARCHAR(255) NOT NULL,
        annotations TEXT NOT NULL,
        comentario TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_anotaciones_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
        CONSTRAINT uq_equipo_imagen UNIQUE (equipo_id, image_id)
    );

    CREATE TABLE IF NOT EXISTS configuracion (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT NOT NULL,
        tipo VARCHAR(50) DEFAULT 'string',
        descripcion TEXT,
        categoria VARCHAR(50),
        editable BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drive_folders_cache (
        id SERIAL PRIMARY KEY,
        drive_id VARCHAR(255) UNIQUE NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        parent_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS aprendizaje (
        id SERIAL PRIMARY KEY,
        equipo VARCHAR(255),
        ia_dijo TEXT,
        inspector_corrigio TEXT,
        leccion TEXT,
        fecha DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plan_inspeccion_diaria (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        fecha DATE NOT NULL,
        equipo_id INTEGER NOT NULL,
        orden INTEGER NOT NULL,
        estado VARCHAR(50) DEFAULT 'PENDIENTE' CHECK(estado IN ('PENDIENTE', 'COMPLETADO', 'OMITIDO')),
        completado_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_itinerario_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_itinerario_equipo FOREIGN KEY (equipo_id) REFERENCES equipos(id) ON DELETE CASCADE,
        CONSTRAINT uq_itinerario_usuario_fecha_equipo UNIQUE (usuario_id, fecha, equipo_id)
    );

    CREATE TABLE IF NOT EXISTS libros_completos (
        id SERIAL PRIMARY KEY,
        campania VARCHAR(100),
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        usuario_id INTEGER,
        estado VARCHAR(50),
        progreso INTEGER DEFAULT 0,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        tamanio_pdf BIGINT,
        numero_equipos INTEGER,
        resumen_estados TEXT,
        filtros_aplicados TEXT,
        error_mensaje TEXT,
        CONSTRAINT fk_libroscomp_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS libros_completos_versiones (
        id SERIAL PRIMARY KEY,
        libro_id INTEGER NOT NULL,
        version INTEGER NOT NULL,
        ruta_pdf_local TEXT,
        ruta_pdf_drive TEXT,
        drive_file_id VARCHAR(255),
        fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        notas TEXT,
        CONSTRAINT fk_libcompvers_libro FOREIGN KEY (libro_id) REFERENCES libros_completos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS configuracion_reportes (
        id SERIAL PRIMARY KEY,
        clave VARCHAR(100) UNIQUE NOT NULL,
        valor TEXT,
        descripcion TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usuarios_telegram (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        chat_id BIGINT NOT NULL,
        usuario_id INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tele_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS telegram_otp (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER NOT NULL,
        otp VARCHAR(10) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT fk_otp_user FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    );

    -- Columnas adicionales
    ALTER TABLE inspecciones ADD COLUMN IF NOT EXISTS error_generacion TEXT;
    ALTER TABLE equipos ADD COLUMN IF NOT EXISTS drive_folder_id VARCHAR(255);
    ALTER TABLE ubicaciones ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

    -- Indices
    CREATE INDEX IF NOT EXISTS idx_reportes_equipo ON reportes(equipo_id);
    CREATE INDEX IF NOT EXISTS idx_reportes_campania ON reportes(campania);
    CREATE INDEX IF NOT EXISTS idx_reportes_fecha ON reportes(fecha_generacion);
    CREATE INDEX IF NOT EXISTS idx_versiones_reporte ON versiones_reportes(tipo, reporte_id);
    """
    try:
        with get_raw_pg_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(schema_sql)
            conn.commit()
        logger.info("Esquema de PostgreSQL verificado y sincronizado correctamente.")
    except Exception as e:
        logger.error(f"Error al verificar/sincronizar esquema de PostgreSQL: {e}", exc_info=True)

