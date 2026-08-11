from tests.conftest import login
from app.services.db_service import get_db_connection

def test_revertir_inspeccion_exitoso(client):
    headers = login(client)

    # 1. Crear equipo e inspección previa en la base de datos
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO empresas (id, nombre) VALUES (1, 'Empresa Test')")
        cursor.execute("INSERT OR IGNORE INTO ubicaciones (id, empresa_id, nombre, codigo) VALUES (88, 1, 'Area Test', 'UB-88')")
        cursor.execute("""
            INSERT INTO equipos (id, ubicacion_id, codigo, nombre, tag, criticidad, estado_actual, activo)
            VALUES (888, 88, 'EQ-TEST-888', 'Bomba Test Revertir', 'P-888', 'ALTA', 'BUENO', 1)
        """)
        cursor.execute("""
            INSERT INTO inspecciones (equipo_id, anio, estado, diagnostico, created_at)
            VALUES (888, 2026, 'BUENO', 'Diagnóstico inicial de prueba', CURRENT_TIMESTAMP)
        """)
        conn.commit()

    # 2. Intentar revertir inspección como admin
    revert_payload = {
        "motivo": "Error de prueba: asignación incorrecta de tag",
        "anio": 2026
    }

    resp = client.post(
        "/api/equipos/888/revertir-inspeccion",
        headers=headers,
        json=revert_payload
    )

    assert resp.status_code == 200, resp.text
    res_data = resp.json()
    assert res_data["estado_actual"] == "PENDIENTE"
    assert res_data["equipo_id"] == 888

    # 3. Verificar estado en la DB
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT estado_actual FROM equipos WHERE id = 888")
        eq_row = cursor.fetchone()
        assert eq_row[0] == "PENDIENTE"

        cursor.execute("SELECT COUNT(*) FROM inspecciones WHERE equipo_id = 888")
        insp_count = cursor.fetchone()[0]
        assert insp_count == 0

        cursor.execute("SELECT detalles FROM auditoria WHERE registro_id = 888 AND accion = 'REVERTIR_INSPECCION'")
        audit_row = cursor.fetchone()
        assert audit_row is not None
        assert "Error de prueba" in audit_row[0]

def test_revertir_inspeccion_sin_motivo(client):
    headers = login(client)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO empresas (id, nombre) VALUES (1, 'Empresa Test')")
        cursor.execute("INSERT OR IGNORE INTO ubicaciones (id, empresa_id, nombre, codigo) VALUES (88, 1, 'Area Test', 'UB-88')")
        cursor.execute("""
            INSERT INTO equipos (id, ubicacion_id, codigo, nombre, tag, criticidad, estado_actual, activo)
            VALUES (888, 88, 'EQ-TEST-888', 'Bomba Test Revertir', 'P-888', 'ALTA', 'BUENO', 1)
        """)
        conn.commit()

    resp = client.post(
        "/api/equipos/888/revertir-inspeccion",
        headers=headers,
        json={"motivo": "   "}
    )
    assert resp.status_code == 400

