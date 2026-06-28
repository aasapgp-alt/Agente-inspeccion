"""Pruebas del módulo de seguridad: hashing PBKDF2 y tokens JWT/sesión."""

from datetime import timedelta

import pytest
from jose import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_session_token,
    hash_password,
    verify_access_token,
    verify_password,
)


# --- Hashing de contraseñas (PBKDF2) ---

def test_hash_password_formato_y_salt_aleatorio():
    h1 = hash_password("clave-secreta")
    h2 = hash_password("clave-secreta")
    # Cada hash usa un salt aleatorio: misma contraseña, hashes distintos.
    assert h1 != h2
    # Formato esperado: pbkdf2:algoritmo:iteraciones$salt$hash
    assert h1.startswith("pbkdf2:sha256:100000$")
    assert h1.count("$") == 2


def test_verify_password_roundtrip():
    h = hash_password("clave-secreta")
    assert verify_password("clave-secreta", h) is True


def test_verify_password_incorrecta():
    h = hash_password("clave-secreta")
    assert verify_password("clave-equivocada", h) is False


def test_verify_password_hash_malformado_no_lanza():
    # Un hash con formato inválido devuelve False en lugar de propagar la excepción.
    assert verify_password("x", "esto-no-es-un-hash") is False
    assert verify_password("x", "pbkdf2:sha256$solo$dos") is False
    assert verify_password("x", "") is False


# --- Tokens JWT ---

def test_create_y_verify_access_token_roundtrip():
    token = create_access_token({"sub": "usuario1", "rol": "admin"})
    payload = verify_access_token(token)
    assert payload["sub"] == "usuario1"
    assert payload["rol"] == "admin"
    assert "exp" in payload


def test_verify_access_token_expirado():
    token = create_access_token({"sub": "u"}, expires_delta=timedelta(seconds=-10))
    with pytest.raises(ValueError):
        verify_access_token(token)


def test_verify_access_token_firma_invalida():
    # Token firmado con un secreto distinto al de la aplicación.
    falso = jwt.encode({"sub": "u"}, "otro-secreto-distinto", algorithm=settings.JWT_ALGORITHM)
    with pytest.raises(ValueError):
        verify_access_token(falso)


# --- Tokens de sesión ---

def test_generate_session_token_longitud_y_unicidad():
    t1 = generate_session_token()
    t2 = generate_session_token()
    assert len(t1) == 64  # 32 bytes en hexadecimal
    assert t1 != t2
    int(t1, 16)  # debe ser hexadecimal válido
