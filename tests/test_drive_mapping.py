import sqlite3
from contextlib import contextmanager

import pytest

from app.services import db_service, drive_service


@pytest.fixture
def db_mapeo_drive(monkeypatch):
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript("""
        CREATE TABLE equipos (
            id INTEGER PRIMARY KEY,
            codigo TEXT,
            nombre TEXT,
            drive_folder_id TEXT,
            ubicacion_id INTEGER
        );
        CREATE TABLE ubicaciones (
            id INTEGER PRIMARY KEY,
            nombre TEXT,
            drive_folder_id TEXT
        );
        CREATE TABLE drive_folders_cache (
            drive_id TEXT PRIMARY KEY,
            nombre TEXT,
            parent_id TEXT
        );
        CREATE TABLE configuracion (clave TEXT, valor TEXT, tipo TEXT);
    """)

    @contextmanager
    def conectar():
        yield conn

    monkeypatch.setattr(db_service, "get_db_connection", conectar)
    monkeypatch.setattr(drive_service, "get_drive_instance", lambda: None)
    monkeypatch.setattr(drive_service, "listar_carpetas", lambda _parent_id: [])
    monkeypatch.setattr(drive_service, "obtener_carpeta_drive_directa_equipo", lambda **_kwargs: None)
    yield conn
    conn.close()


def test_ubicacion_prioriza_drive_folder_id_guardado(db_mapeo_drive):
    db_mapeo_drive.execute(
        "INSERT INTO ubicaciones (id, nombre, drive_folder_id) VALUES (?, ?, ?)",
        (1, "Área A", "drive-area-a"),
    )

    resultado = drive_service.buscar_carpeta_area_por_nombre("Área A", ubicacion_id=1)

    assert resultado == "drive-area-a"


def test_ubicacion_ambigua_no_elige_una_carpeta_arbitrariamente(db_mapeo_drive):
    db_mapeo_drive.executemany(
        "INSERT INTO drive_folders_cache (drive_id, nombre, parent_id) VALUES (?, ?, ?)",
        [
            ("area-a-1", "01- Área A", "root"),
            ("area-a-2", "02- Area A", "root"),
        ],
    )

    resultado = drive_service.buscar_carpeta_area_por_nombre("Área A")

    assert resultado is None


def test_sugerencias_de_equipo_se_limita_a_su_ubicacion(db_mapeo_drive):
    db_mapeo_drive.execute(
        "INSERT INTO ubicaciones (id, nombre, drive_folder_id) VALUES (?, ?, ?)",
        (1, "Área A", "drive-area-a"),
    )
    db_mapeo_drive.execute(
        "INSERT INTO equipos (id, codigo, nombre, drive_folder_id, ubicacion_id) VALUES (?, ?, ?, ?, ?)",
        (10, "EQ-123", "Bomba Norte 123-456", None, 1),
    )
    db_mapeo_drive.executemany(
        "INSERT INTO drive_folders_cache (drive_id, nombre, parent_id) VALUES (?, ?, ?)",
        [
            ("equipo-correcto", "Bomba Norte 123-456", "drive-area-a"),
            ("equipo-otra-area", "Bomba Norte 123-456", "drive-area-b"),
        ],
    )

    sugerencias = drive_service.sugerir_carpetas(
        "EQ-123", "Bomba Norte 123-456", "root", equipo_id=10
    )

    assert [sugerencia["id"] for sugerencia in sugerencias] == ["equipo-correcto"]


def test_sugerencias_no_busca_en_areas_ajenas_si_no_hay_coincidencia(db_mapeo_drive):
    db_mapeo_drive.execute(
        "INSERT INTO ubicaciones (id, nombre, drive_folder_id) VALUES (?, ?, ?)",
        (1, "Área A", "drive-area-a"),
    )
    db_mapeo_drive.execute(
        "INSERT INTO equipos (id, codigo, nombre, drive_folder_id, ubicacion_id) VALUES (?, ?, ?, ?, ?)",
        (10, "EQ-123", "Bomba Norte 123-456", None, 1),
    )
    db_mapeo_drive.execute(
        "INSERT INTO drive_folders_cache (drive_id, nombre, parent_id) VALUES (?, ?, ?)",
        ("equipo-otra-area", "Bomba Norte 123-456", "drive-area-b"),
    )

    sugerencias = drive_service.sugerir_carpetas(
        "EQ-123", "Bomba Norte 123-456", "root", equipo_id=10
    )

    assert sugerencias == []
