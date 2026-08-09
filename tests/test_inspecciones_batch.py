import base64
from tests.conftest import login
from app.services.db_service import get_db_connection


def test_inspecciones_batch_exitoso(client, tmp_path, monkeypatch):
    headers = login(client)

    # 1. Crear ubicación y equipo de prueba en la base de datos temporal
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO empresas (id, nombre) VALUES (1, 'Empresa Test')")
        cursor.execute("INSERT OR IGNORE INTO ubicaciones (id, empresa_id, nombre, codigo) VALUES (99, 1, 'Ubicacion Test', 'UB-99')")
        cursor.execute("""
            INSERT INTO equipos (id, ubicacion_id, codigo, nombre, tag, criticidad, estado_actual, activo)
            VALUES (999, 99, 'EQ-TEST-999', 'Bomba Batch Test', 'P-999', 'ALTA', 'PENDIENTE', 1)
        """)
        conn.commit()

    equipo_id = 999
    codigo_activo = "EQ-TEST-999"

    # 2. Preparar imagen en Base64
    fake_img_b64 = "data:image/jpeg;base64," + base64.b64encode(b"FAKE_IMAGE_DATA_12345").decode("utf-8")

    # 3. Enviar batch
    batch_payload = {
        "inspecciones": [
            {
                "client_uuid": "test-uuid-1234",
                "id_activo": equipo_id,
                "codigo_activo": codigo_activo,
                "estado": "En Observación",
                "categoria_foto": "General",
                "notas": "Inspección de prueba con foto y comentario desde mobile",
                "timestamp": 1723123456789,
                "fotos": [
                    {
                        "categoria": "General",
                        "data": fake_img_b64,
                        "timestamp": 1723123456789
                    }
                ],
                "audios": []
            }
        ]
    }

    resp_batch = client.post(
        "/api/inspecciones/batch",
        headers=headers,
        json=batch_payload
    )

    assert resp_batch.status_code == 200, resp_batch.text
    res_json = resp_batch.json()
    assert res_json["status"] == "success"
    assert res_json["procesados"] == 1

    # 4. Verificar que se puede consultar las inspecciones del equipo
    resp_list = client.get(
        f"/api/inspecciones/{equipo_id}",
        headers=headers
    )
    assert resp_list.status_code == 200
    inspecciones_list = resp_list.json()
    assert len(inspecciones_list) >= 1
    assert inspecciones_list[0]["estado"] == "En Observación"
    assert "Inspección de prueba" in inspecciones_list[0]["diagnostico"]

    # 5. Verificar que la anotación/comentario de la imagen fue guardada
    resp_anns = client.get(
        f"/api/anotaciones/{equipo_id}",
        headers=headers
    )
    assert resp_anns.status_code == 200
    anns_json = resp_anns.json()
    assert anns_json["equipo_id"] == equipo_id
    assert len(anns_json["comentarios"]) >= 1
