import pytest
from app.services.drive_service import obtener_evidencia_equipo
from app.core.db import get_db_connection

def test_cruce_equipos_drive_folder_id():
    """Valida que la gran mayoría de los equipos tengan su drive_folder_id vinculado en BD."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*), COUNT(drive_folder_id) FROM equipos")
        row = cursor.fetchone()
        total = row[0]
        vinculados = row[1]
        
        assert total > 0, "No hay equipos en la base de datos"
        porcentaje = (vinculados / total) * 100
        print(f"\n[OK] Equipos vinculados con Drive: {vinculados}/{total} ({porcentaje:.1f}%)")
        assert porcentaje >= 85.0, f"Se esperaba al menos 85% de vinculación, se obtuvo {porcentaje}%"

def test_obtener_evidencia_equipo_valido():
    """Valida que el servicio devuelva la evidencia clasificada correctamente para el equipo 226 (Bomba 621-409/410/411)."""
    resultado = obtener_evidencia_equipo(226, campania_activa="PGP 2026")
    
    assert "error" not in resultado, f"Error en servicio de evidencia: {resultado.get('error')}"
    assert "equipo" in resultado
    assert "resumen" in resultado
    assert "fotos_campania" in resultado
    assert "documentacion_tecnica" in resultado
    assert "fotos_historico" in resultado
    
    resumen = resultado["resumen"]
    print(f"\n[OK] Resumen para equipo {resultado['equipo']['codigo']}: {resumen}")
    assert isinstance(resultado["fotos_campania"], list)
    assert isinstance(resultado["documentacion_tecnica"], list)
    assert isinstance(resultado["fotos_historico"], dict)
    
    # Debe haber detectado planos y documentación técnica
    assert len(resultado["documentacion_tecnica"]) > 0, "Debe detectar los planos existentes en la carpeta de la UT"
    assert "PGP 2024" in resultado["fotos_historico"], "Debe detectar la subcarpeta histórica PGP 2024"

def test_auto_upsert_en_drive_folders_cache():
    """Valida que al invocar el servicio, las carpetas encontradas se registren en drive_folders_cache."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM drive_folders_cache WHERE parent_id = '19nTZpz2l36F3LDwQOuh1WoPSIsMzQOgK'")
        count_antes = cursor.fetchone()[0]
        
    # Llamamos a la función
    obtener_evidencia_equipo(226, campania_activa="PGP 2026")
    
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM drive_folders_cache WHERE parent_id = '19nTZpz2l36F3LDwQOuh1WoPSIsMzQOgK'")
        count_despues = cursor.fetchone()[0]
        
    assert count_despues >= count_antes and count_despues > 0
    print(f"\n[OK] Subcarpetas registradas/actualizadas en caché: {count_despues}")

def test_jerarquia_multinivel_431_433():
    """Valida el mapeo recursivo multi-nivel y ruta concatenada para el equipo 06-431-433."""
    # Equipo 177: Succión Bomba 431-433
    res_177 = obtener_evidencia_equipo(177, campania_activa="PGP 2026")
    assert "error" not in res_177
    assert res_177["path_completo"] == "01-Blanqueo y digestion / 06-431-433"
    assert res_177["resumen"]["total_secciones"] >= 2
    assert res_177["seccion_recomendada"] == "Succión 431-433"
    assert res_177["resumen"]["total_fotos_campania"] > 50
    print(f"\n[OK] Equipo 177 multi-nivel: Recomendada '{res_177['seccion_recomendada']}' con {res_177['resumen']['total_fotos_campania']} fotos.")

    # Equipo 176: Impulsión Bomba 431-433
    res_176 = obtener_evidencia_equipo(176, campania_activa="PGP 2026")
    assert "error" not in res_176
    assert res_176["path_completo"] == "01-Blanqueo y digestion / 06-431-433"
    assert res_176["seccion_recomendada"] == "Impulsión 431-433"
    print(f"[OK] Equipo 176 multi-nivel: Recomendada '{res_176['seccion_recomendada']}'.")

