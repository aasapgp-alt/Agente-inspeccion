"""Pruebas de integración de los routers de autenticación con TestClient.

Verifican el flujo completo a través del AuthMiddleware: login, rechazo sin
token, RBAC (require_role) y revocación de sesión del lado del servidor.
"""

from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME, login


# --- Login ---

def test_login_exitoso(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["rol"] == "admin"
    # La respuesta nunca debe exponer el hash de la contraseña.
    assert "password_hash" not in data["user"]


def test_login_credenciales_invalidas(client):
    resp = client.post(
        "/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": "incorrecta"},
    )
    assert resp.status_code == 401


# --- AuthMiddleware: protección de rutas ---

def test_acceso_sin_token_rechazado(client):
    # /api/auth/me no está en EXCLUDED_PATHS: sin token, el middleware corta en 401.
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_token_invalido_rechazado(client):
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer token-falso"})
    assert resp.status_code == 401


def test_me_con_token_valido(client):
    headers = login(client)
    resp = client.get("/api/auth/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["username"] == ADMIN_USERNAME


def test_health_es_publico(client):
    # Ruta excluida del middleware: accesible sin token.
    resp = client.get("/api/health")
    assert resp.status_code == 200


# --- RBAC: require_role('admin') sobre /register ---

def _registrar(client, headers, username, rol="inspector"):
    return client.post(
        "/api/auth/register",
        headers=headers,
        json={
            "username": username,
            "email": f"{username}@empresa.com",
            "password": "clave123",
            "nombre_completo": f"Usuario {username}",
            "rol": rol,
        },
    )


def test_admin_puede_registrar(client):
    headers = login(client)
    resp = _registrar(client, headers, "inspector1")
    assert resp.status_code == 200
    assert resp.json()["rol"] == "inspector"


def test_inspector_no_puede_registrar(client):
    admin_headers = login(client)
    assert _registrar(client, admin_headers, "inspector2").status_code == 200

    # El inspector recién creado tiene sesión válida pero rol insuficiente -> 403.
    inspector_headers = login(client, "inspector2", "clave123")
    resp = _registrar(client, inspector_headers, "intruso")
    assert resp.status_code == 403


# --- Revocación de sesión del lado del servidor ---

def test_logout_revoca_la_sesion(client):
    headers = login(client)
    # El token funciona...
    assert client.get("/api/auth/me", headers=headers).status_code == 200
    # ...hasta que se cierra sesión (se elimina de sesiones_activas)...
    assert client.post("/api/auth/logout", headers=headers).status_code == 200
    # ...tras lo cual el mismo token deja de ser aceptado por el middleware.
    assert client.get("/api/auth/me", headers=headers).status_code == 401
