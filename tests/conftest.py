"""Fixtures compartidos para las pruebas que tocan la base de datos.

Aíslan cada prueba en una BD SQLite temporal, sobreescribiendo tanto la global
`DB_PATH` de db_service (usada por get_db_connection) como `settings.DB_PATH`
(usada por init_db). Así nunca se toca la BD real `data/inspecciones.db`.
"""

import pytest

from app.core.config import settings
from app.services import db_service
from scripts.init_db import init_db


def _apuntar_a(monkeypatch, ruta):
    """Redirige ambas referencias a DB_PATH hacia la BD temporal."""
    monkeypatch.setattr(db_service, "DB_PATH", str(ruta))
    monkeypatch.setattr(settings, "DB_PATH", str(ruta))


@pytest.fixture
def db_temporal(tmp_path, monkeypatch):
    """BD temporal con el esquema y las configuraciones por defecto de init_db."""
    ruta = tmp_path / "test.db"
    _apuntar_a(monkeypatch, ruta)
    init_db()
    return ruta


@pytest.fixture
def db_vacia(tmp_path, monkeypatch):
    """BD temporal sin tablas (para verificar la degradación segura)."""
    ruta = tmp_path / "vacia.db"
    _apuntar_a(monkeypatch, ruta)
    return ruta


# Credenciales del admin sembrado por init_db durante las pruebas de API.
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin-test-123"


@pytest.fixture
def client(tmp_path, monkeypatch):
    """TestClient sobre la app real con BD temporal aislada.

    El context manager dispara el evento de startup (init_db), que siembra el
    admin con la contraseña fijada en ADMIN_INITIAL_PASSWORD.
    """
    from fastapi.testclient import TestClient

    ruta = tmp_path / "api.db"
    _apuntar_a(monkeypatch, ruta)
    monkeypatch.setenv("ADMIN_INITIAL_PASSWORD", ADMIN_PASSWORD)

    from app.main import app

    with TestClient(app) as cliente:
        yield cliente


def login(cliente, username=ADMIN_USERNAME, password=ADMIN_PASSWORD):
    """Inicia sesión y devuelve el header Authorization listo para usar."""
    resp = cliente.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}
