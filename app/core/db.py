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
        # En Postgres, si no se usó RETURNING, se intenta consultarlastval()
        try:
            with self._conn._raw_conn.cursor() as cur:
                cur.execute("SELECT lastval()")
                row = cur.fetchone()
                return row[0] if row else None
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
