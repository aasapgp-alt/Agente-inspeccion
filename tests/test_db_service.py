"""Pruebas de db_service sobre una BD SQLite temporal aislada.

Cubre el casteo por tipos de get_config_value_db (de donde salen claves
críticas como google_api_key y gemini_model) y el roundtrip de inspecciones.
"""

from app.services.db_service import (
    get_config_value_db,
    get_db_connection,
    guardar_inspeccion_db,
    obtener_inspeccion_db,
)


# --- get_config_value_db: casteo por tipo (contra los defaults reales de init_db) ---

def test_config_tipo_number_entero(db_temporal):
    valor = get_config_value_db("max_image_size_mb")
    assert valor == 5
    assert isinstance(valor, int)


def test_config_tipo_boolean(db_temporal):
    # 'notificaciones_habilitadas' por defecto es "true" (tipo boolean).
    assert get_config_value_db("notificaciones_habilitadas") is True


def test_config_tipo_string(db_temporal):
    assert get_config_value_db("app_name") == "Asistente de Inspección"


def test_config_tipo_number_float(db_temporal):
    # Un valor numérico con decimales se castea a float.
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO configuracion (clave, valor, tipo) VALUES (?, ?, ?)",
            ("factor", "1.5", "number"),
        )
        conn.commit()
    valor = get_config_value_db("factor")
    assert valor == 1.5
    assert isinstance(valor, float)


def test_config_tipo_json(db_temporal):
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO configuracion (clave, valor, tipo) VALUES (?, ?, ?)",
            ("opciones", '{"a": 1, "b": [2, 3]}', "json"),
        )
        conn.commit()
    assert get_config_value_db("opciones") == {"a": 1, "b": [2, 3]}


def test_config_clave_inexistente_devuelve_default(db_temporal):
    assert get_config_value_db("no_existe") is None
    assert get_config_value_db("no_existe", default="fallback") == "fallback"


def test_config_tabla_inexistente_degrada_a_default(db_vacia):
    # Sin tabla 'configuracion' (OperationalError) devuelve el default, no excepción.
    assert get_config_value_db("cualquiera", default="seguro") == "seguro"


# --- Inspecciones: roundtrip y "más reciente" ---
# init_db no crea la tabla de dominio 'inspecciones'; se declara aquí un esquema
# mínimo suficiente para verificar el comportamiento de las funciones.

def _crear_tabla_inspecciones():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE inspecciones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                equipo_id INTEGER,
                anio INTEGER,
                diagnostico TEXT
            )
            """
        )
        conn.commit()


def test_guardar_inspeccion_devuelve_id(db_temporal):
    _crear_tabla_inspecciones()
    nuevo_id = guardar_inspeccion_db(
        {"equipo_id": 1, "anio": 2026, "diagnostico": "BUENO"}
    )
    assert nuevo_id == 1


def test_guardar_y_obtener_inspeccion_roundtrip(db_temporal):
    _crear_tabla_inspecciones()
    guardar_inspeccion_db({"equipo_id": 7, "anio": 2026, "diagnostico": "REGULAR"})
    fila = obtener_inspeccion_db(7, 2026)
    assert fila["equipo_id"] == 7
    assert fila["diagnostico"] == "REGULAR"


def test_obtener_inspeccion_devuelve_la_mas_reciente(db_temporal):
    _crear_tabla_inspecciones()
    guardar_inspeccion_db({"equipo_id": 3, "anio": 2026, "diagnostico": "BUENO"})
    guardar_inspeccion_db({"equipo_id": 3, "anio": 2026, "diagnostico": "CRITICO"})
    # ORDER BY id DESC LIMIT 1 -> la última insertada.
    assert obtener_inspeccion_db(3, 2026)["diagnostico"] == "CRITICO"


def test_obtener_inspeccion_inexistente_devuelve_none(db_temporal):
    _crear_tabla_inspecciones()
    assert obtener_inspeccion_db(999, 2026) is None
