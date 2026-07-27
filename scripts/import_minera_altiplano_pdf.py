import sqlite3
import os
import re

DB_PATH = 'data/inspecciones.db'

def import_minera_altiplano():
    print("Iniciando volcado completo de datos para Minera del Altiplano S.A. desde PDF...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # 1. Asegurar empresa Minera del Altiplano S.A.
    cursor.execute("SELECT id FROM empresas WHERE nombre LIKE '%Altiplano%' OR nombre LIKE '%Antiplano%'")
    row = cursor.fetchone()
    if row:
        empresa_id = row[0]
        cursor.execute("UPDATE empresas SET nombre = 'Minera del Altiplano S.A.', descripcion = 'Planta Fénix - Arcadium Lithium / Livent' WHERE id = ?", (empresa_id,))
    else:
        cursor.execute("INSERT INTO empresas (nombre, descripcion, activo) VALUES ('Minera del Altiplano S.A.', 'Planta Fénix - Arcadium Lithium / Livent', 1)")
        empresa_id = cursor.lastrowid
        
    print(f"Empresa ID: {empresa_id} ('Minera del Altiplano S.A.')")
    
    # 2. Definir Ubicaciones Técnicas (Áreas)
    ubicaciones_data = [
        ("Planta SA - Servicios Auxiliares", "SA", "Tanques de proceso y almacenamiento de la Planta de Servicios Auxiliares"),
        ("Planta SA - Sector Sorbent", "SA-SORBENT", "Reactores y tanques de preparación de Sorbent / GCLA / CLA"),
        ("Planta SA - Sector Tanques HCl 32%", "SA-HCL", "Recinto de contención secundaria de tanques de Ácido Clorhídrico al 32%"),
        ("Planta SA - Tratamiento de Agua", "SA-AGUA", "Tanques de reacción, clarificados y productos químicos para tratamiento de agua"),
        ("LiCa - Acondicionamiento Salmuera", "LICA-SALMUERA", "Lechos de intercambio iónico, recepción y acondicionamiento de salmuera"),
        ("LiCa - Distribución de Agua", "LICA-AGUA", "Almacenamiento y distribución de agua de proceso LiCa"),
        ("LiCa - Sistema de Vacío", "LICA-VACIO", "Receptores de licor de NaCl bajo vacío"),
        ("LiCa - Agua de Sello", "LICA-SELLO", "Condensadores en cascada para agua de sello")
    ]
    
    # Limpiar ubicación temporal "Equipo 1" si existía
    cursor.execute("DELETE FROM ubicaciones WHERE empresa_id = ? AND nombre = 'Equipo 1'", (empresa_id,))
    
    ubicaciones_map = {}
    for nombre, codigo, desc in ubicaciones_data:
        cursor.execute("INSERT OR IGNORE INTO ubicaciones (empresa_id, nombre, codigo, descripcion, activo) VALUES (?, ?, ?, ?, 1)",
                       (empresa_id, nombre, codigo, desc))
        cursor.execute("SELECT id FROM ubicaciones WHERE empresa_id = ? AND nombre = ?", (empresa_id, nombre))
        u_id = cursor.fetchone()[0]
        ubicaciones_map[nombre] = u_id
        
    print(f"Ubicaciones creadas/verificadas: {len(ubicaciones_map)}")
    for k, v in ubicaciones_map.items():
        print(f"  - {k} (ID: {v})")
        
    # 3. Equipos a insertar
    equipos = [
        # (Codigo/Tag, Nombre, Ubicación, Material, Criticidad, Fluido, Presion, Temp, EstadoActual, Diagnostico, Acciones, Recomendaciones)
        (
            "T-2240", "Treated Water Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "3", "Agua tratada", None, None, "BUENO",
            "Inspección interior y exterior. Buen estado general de conservación del tanque de agua tratada.",
            "Continuar con plan de inspecciones preventivas anuales.",
            "Mantener inspecciones periódicas en PGP 2029 según plan de criticidad 3."
        ),
        (
            "T-2270", "Feed Water Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "3", "Agua litiada", None, None, "BUENO",
            "Inspección exterior. Tanque cerrado. Estado de conservación adecuado para servicio de agua litiada.",
            "Monitoreo exterior visual.",
            "Prever inspección interior completa en PGP 2025."
        ),
        (
            "T-2280", "Water Recycle Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado operando a 82°C con salmuera. Presenta patologías menores en barrera química por temperatura.",
            "Acondicionamiento de acometidas y verificación de revestimiento interior.",
            "Servicio condicional. Inspeccionar nuevamente en PGP 2025."
        ),
        (
            "T-3109", "Ph Adjustment Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado de ajuste de pH operando a altas temperaturas.",
            "Tratamiento anticorrosivo exterior y revisión de sellos bridados.",
            "Servicio condicional. Próxima inspección programada en PGP 2025."
        ),
        (
            "T-3220", "GCLA Water Preparation Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Agua preparación", None, None, "BUENO",
            "Inspección interior y exterior completa. Estructura y laminado en buen estado de conservación.",
            "Limpieza periódica de fondo.",
            "Continuar con programa de inspección en PGP 2026."
        ),
        (
            "T-3224", "LiCl Product Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera / Producto", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado de almacenamiento de producto LiCl.",
            "Reparación localizada de barrera química e inspección de boquillas.",
            "Servicio condicional. Reinspeccionar en PGP 2025."
        ),
        (
            "T-3225", "LiCl Product Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado de salmuera de litio. Muestra incrustaciones y ampollamiento superficial.",
            "Desincrustado y acondicionamiento de cuello de bridas.",
            "Servicio condicional. Próxima revisión en PGP 2025."
        ),
        (
            "T-3230", "Brine Recycle Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera reciclo", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado de reciclo de salmuera.",
            "Sellado de acometidas y reponimiento de protección anticorrosiva.",
            "Servicio condicional. Inspección en PGP 2025."
        ),
        (
            "T-3250", "Hot Spent Brine Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera agotada caliente", None, 82.0, "REGULAR",
            "Inspección interior y exterior. Tanque aislado de salmuera agotada a 82°C.",
            "Control NDT de dureza Barcol y ensayo de curado superficial.",
            "Reinspeccionar en PGP 2026."
        ),
        (
            "T-3318", "Sorbent Lithium Hydroxide Preparation Tank", "Planta SA - Sector Sorbent", "FRP", "2", "Hidróxido de Litio", None, None, "REGULAR",
            "Inspección interior y exterior de tanque de preparación de hidróxido.",
            "Reparación de linning e inspección de agitación.",
            "Programar mantenimiento en PGP 2026."
        ),
        (
            "T-3325", "Sorbent GCLA Backwash Tank", "Planta SA - Sector Sorbent", "FRP", "2", "Agua GCLA", None, None, "REGULAR",
            "Inspección interior y exterior de tanque de retrolavado GCLA.",
            "Ajuste de pernería y juntas bridadas.",
            "Continuar seguimiento en PGP 2026."
        ),
        (
            "T-3326", "Sorbent Spent GCLA Disposal Well", "Planta SA - Sector Sorbent", "PRFV", "2", "Disposición GCLA", None, None, "BUENO",
            "Pozo/tanque de disposición de GCLA agotado en PRFV. Buen estado estructural.",
            "Limpieza de sedimento acumulado.",
            "Inspección en PGP 2026."
        ),
        (
            "T-3350", "Sorbent CLA Storage", "Planta SA - Sector Sorbent", "PRFV", "2", "CLA", None, None, "BUENO",
            "Inspección exterior. Tanque cerrado en PRFV. Sin anomalías detectables.",
            "Limpieza exterior y control de apoyos.",
            "Inspeccionar en PGP 2025."
        ),
        (
            "T-3360", "Sorbent CLA Storage", "Planta SA - Sector Sorbent", "FRP", "2", "CLA", None, None, "BUENO",
            "Inspección interior y exterior completa. Buen estado de conservación del cuerpo y accesorios.",
            "Verificación de válvula de alivio y conexiones.",
            "Reinspección programada para PGP 2026."
        ),
        (
            "R-3317", "Sorbent GCLA Preparation Reactor 2", "Planta SA - Sector Sorbent", "FRP", "2", "Reactor GCLA", None, None, "REGULAR",
            "Inspección interior y exterior. Tanque aislado. Interior presentó alta suciedad acumulada dificultando inspección visual.",
            "Desincrustado profundo e inspección visual completa post-limpieza.",
            "Servicio condicional. Próxima inspección en PGP 2025."
        ),
        (
            "T-3415", "Concentrated LiCl Product Surge Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Producto LiCl Conc.", None, None, "BUENO",
            "Inspección interior y exterior. Excelente conservación de la resina y barrera de corrosión.",
            "Mantenimiento preventivo general.",
            "Próxima inspección en PGP 2026."
        ),
        (
            "T-3418", "Reclaim Caustic Tank", "Planta SA - Servicios Auxiliares", "FRP", "1", "Hidróxido de sodio", None, None, "REGULAR",
            "Tanque de soda cáustica de alta criticidad (Nivel 1). Muestra ataque químico menor en barrera interior.",
            "Reconstitución focalizada de la barrera de corrosión en zona de salpicadura.",
            "Servicio condicional de alta prioridad. Reinspeccionar en PGP 2025."
        ),
        (
            "T-3424", "Acid Storage Tank 1 (HCl 32%)", "Planta SA - Sector Tanques HCl 32%", "FRP", "1", "HCl 32%", None, None, "REGULAR",
            "Tanque 1 de almacenamiento de Ácido Clorhídrico al 32%. Criticidad 1. Incluye Anexo de Recinto de Contención Secundaria.",
            "Reparación de barrera química degradada y reemplazo de elementos de sujeción corroídos.",
            "Servicio condicional. Inspección prioritaria en PGP 2025."
        ),
        (
            "T-3425", "Acid Storage Tank 2 (HCl 32%)", "Planta SA - Sector Tanques HCl 32%", "FRP", "1", "HCl 32%", None, None, "REGULAR",
            "Tanque 2 de Ácido Clorhídrico al 32%. Muestra penetración promedio por ataque químico en paredes.",
            "Tratamiento de laminado de refuerzo exterior y cambio de pernería Hastelloy/Xylan.",
            "Servicio condicional. Inspeccionar en PGP 2025."
        ),
        (
            "T-3426", "Acid Storage Tank 3 (HCl 32%)", "Planta SA - Sector Tanques HCl 32%", "FRP", "1", "HCl 32%", None, None, "REGULAR",
            "Tanque 3 de HCl 32%. Barrera química con craquelado en boquillas de fondo.",
            "Sellado de acometidas y reparación de fisuras superficiales en cuello de bridas.",
            "Servicio condicional. Inspección en PGP 2025."
        ),
        (
            "T-3434", "Acid Storage Tank 4 (HCl 32%)", "Planta SA - Sector Tanques HCl 32%", "FRP", "1", "HCl 32%", None, None, "REGULAR",
            "Tanque 4 de HCl 32% (26 años de servicio). Reducción de rigidez evaluada por strain gages.",
            "Control de espesores por ultrasonsidos NDT y refuerzo de zapatas.",
            "Servicio condicional. Monitoreo semestral en PGP 2025."
        ),
        (
            "T-3460", "Polishing Product Storage Tank", "Planta SA - Servicios Auxiliares", "FRP", "2", "Salmuera pulida", None, None, "BUENO",
            "Inspección interior y exterior. Buen estado general del revestimiento.",
            "Ninguna acción correctiva inmediata requerida.",
            "Continuar plan normal de inspección PGP 2026."
        ),
        (
            "T-3465", "Reclaim Acid Tank", "Planta SA - Servicios Auxiliares", "FRP", "1", "HCl diluido", None, None, "REGULAR",
            "Tanque de recuperación de ácido. Criticidad 1. Presenta ataque químico moderado.",
            "Reposición de revestimiento anticorrosivo en acometida principal.",
            "Servicio condicional. Próxima inspección PGP 2025."
        ),
        (
            "T-3470", "Reclaim Water Tank", "Planta SA - Servicios Auxiliares", "FRP", "3", "Agua recuperada", None, None, "BUENO",
            "Tanque de agua recuperada. Inspección interior y exterior sin hallazgos severos.",
            "Limpieza de fondo de tanque.",
            "Próxima inspección programada en PGP 2029."
        ),
        (
            "T-5000", "Reaction Tank - Sludge Lime", "Planta SA - Tratamiento de Agua", "PRFV", "2", "Cal / Lodos", None, 18.5, "BUENO",
            "Tanque de reacción de lodos de cal. Buen estado de conservación del laminado PRFV.",
            "Inspección de apoyos civiles y pernos de anclaje.",
            "Reinspección en PGP 2026."
        ),
        (
            "T-5001", "Clarified Water Tank", "Planta SA - Tratamiento de Agua", "PRFV", "2", "Agua clarificada", None, 18.5, "BUENO",
            "Tanque de agua clarificada. Inspección exterior. Tanque cerrado en buen estado.",
            "Mantenimiento visual periódico.",
            "Próxima revisión en PGP 2025."
        ),
        (
            "T-5002", "Reaction / Clarified Water Tank 2", "Planta SA - Tratamiento de Agua", "PRFV", "2", "Agua clarificada", None, None, "BUENO",
            "Tanque de reacción/clarificado. Inspección exterior adecuada.",
            "Revisión de válvulas y bridas.",
            "Inspeccionar en PGP 2025."
        ),
        (
            "T-5010", "Chemical Products Tank 1", "Planta SA - Tratamiento de Agua", "PRFV", "2", "Productos Químicos", None, None, "BUENO",
            "Tanque de productos químicos de 4m3. Estructura sana.",
            "Chequeo de sellos exteriores.",
            "Inspección en PGP 2026."
        ),
        (
            "T-5011", "Chemical Products Tank 2", "Planta SA - Tratamiento de Agua", "PRFV", "2", "Productos Químicos", None, None, "BUENO",
            "Tanque de productos químicos. Inspección exterior regular.",
            "Aseo técnico exterior.",
            "Próxima inspección PGP 2025."
        ),
        (
            "T-7000", "LiCl Liquor Surge Tank", "LiCa - Acondicionamiento Salmuera", "FRP", "2", "Salmuera LiCl", None, None, "BUENO",
            "Tanque de amortiguación de licor LiCl en planta LiCa. Volumen 79.2 m3. Buen estado de conservación.",
            "Control visual periódico.",
            "Programar inspección en PGP 2026."
        ),
        (
            "T-7410", "Water Storage Tank (LiCa)", "LiCa - Distribución de Agua", "FRP", "3", "Agua de proceso", None, None, "BUENO",
            "Tanque de almacenamiento de agua LiCa de 65.3 m3. Sin defectos estructurales.",
            "Mantenimiento preventivo de rutinas.",
            "Inspección quinquenal PGP 2029."
        ),
        (
            "T-7005", "As-Removal Ion Exchange Bed 1", "LiCa - Acondicionamiento Salmuera", "FRP", "2", "Resina Intercambio", None, 5.5, "BUENO",
            "Lecho de intercambio iónico 1 para remoción de arsénico. Recipiente a presión de 5.5 bar.",
            "Ensayo NDT Barcol en próxima parada.",
            "Reinspeccionar en PGP 2026."
        ),
        (
            "T-7006", "As-Removal Ion Exchange Bed 2", "LiCa - Acondicionamiento Salmuera", "FRP", "2", "Resina Intercambio", None, 5.5, "BUENO",
            "Lecho de intercambio iónico 2 para remoción de arsénico. Recipiente a presión de 5.5 bar.",
            "Control de estanqueidad en bridas.",
            "Reinspeccionar en PGP 2026."
        ),
        (
            "T-7007", "As-Removal System Regenerant Solution Tank", "LiCa - Acondicionamiento Salmuera", "FRP", "2", "Solución regenerante", None, 5.5, "BUENO",
            "Tanque de solución regenerante del sistema de remoción de As. Capacidad 13.6 m3.",
            "Verificación de manguitos y venteos.",
            "Inspección en PGP 2026."
        ),
        (
            "V-7201", "Strong NaCl Liquor Receiver", "LiCa - Sistema de Vacío", "FRP", "3", "Waste / Licor NaCl", None, None, "BUENO",
            "Receptor de licor fuerte de NaCl bajo sistema de vacío. Volumen 1.2 m3.",
            "Inspección de empaquetaduras de vacío.",
            "Próxima inspección en PGP 2027."
        ),
        (
            "V-7203", "Weak NaCl Liquor Receiver", "LiCa - Sistema de Vacío", "FRP", "3", "Waste / Licor NaCl", None, None, "BUENO",
            "Receptor de licor débil de NaCl operando en vacío.",
            "Control de hermeticidad.",
            "Próxima inspección en PGP 2027."
        ),
        (
            "V-7308", "Cascade Condenser", "LiCa - Agua de Sello", "FRP", "3", "Agua de sello", None, None, "BUENO",
            "Condensador en cascada para agua de sello. Volumen 1.25 m3.",
            "Limpieza de toberas y placas.",
            "Próxima revisión en PGP 2027."
        )
    ]
    
    equipos_insertados = 0
    inspecciones_insertadas = 0
    
    for eq in equipos:
        tag, nombre, ubi_nombre, material, criticidad, fluido, presion, temp, estado, diag, acc, reco = eq
        ubicacion_id = ubicaciones_map[ubi_nombre]
        
        # Insertar o actualizar equipo
        cursor.execute("SELECT id FROM equipos WHERE ubicacion_id = ? AND codigo = ?", (ubicacion_id, tag))
        eq_row = cursor.fetchone()
        
        if eq_row:
            eq_id = eq_row[0]
            cursor.execute("""
                UPDATE equipos SET nombre = ?, tag = ?, material = ?, criticidad = ?, fluido = ?, presion_diseno = ?, temperatura_diseno = ?, estado_actual = ?, activo = 1
                WHERE id = ?
            """, (nombre, tag, material, criticidad, fluido, presion, temp, estado, eq_id))
        else:
            cursor.execute("""
                INSERT INTO equipos (ubicacion_id, codigo, nombre, tag, material, criticidad, fluido, presion_diseno, temperatura_diseno, estado_actual, activo)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """, (ubicacion_id, tag, nombre, tag, material, criticidad, fluido, presion, temp, estado))
            eq_id = cursor.lastrowid
            
        equipos_insertados += 1
        
        # Insertar o actualizar inspección PGP 2024
        cursor.execute("SELECT id FROM inspecciones WHERE equipo_id = ? AND anio = 2024", (eq_id,))
        insp_row = cursor.fetchone()
        
        if insp_row:
            cursor.execute("""
                UPDATE inspecciones SET estado = ?, acciones = ?, diagnostico = ?, recomendaciones = ?, reporte_generado = 1, tipo_reporte = 'SULVY_UNIFICADO_2024', numero_acta = ?
                WHERE id = ?
            """, (estado, acc, diag, reco, f"ARC-MDA-2024-{tag}", insp_row[0]))
        else:
            cursor.execute("""
                INSERT INTO inspecciones (equipo_id, anio, estado, acciones, diagnostico, recomendaciones, created_at, updated_at, reporte_generado, tipo_reporte, numero_acta)
                VALUES (?, 2024, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1, 'SULVY_UNIFICADO_2024', ?)
            """, (eq_id, estado, acc, diag, reco, f"ARC-MDA-2024-{tag}"))
            
        inspecciones_insertadas += 1
        
    conn.commit()
    conn.close()
    
    print("\n¡VOLCADO COMPLETADO EXITOSAMENTE!")
    print(f"Total Ubicaciones Técnicas procesadas: {len(ubicaciones_map)}")
    print(f"Total Equipos procesados: {equipos_insertados}")
    print(f"Total Inspecciones 2024 vinculadas: {inspecciones_insertadas}")

if __name__ == "__main__":
    import_minera_altiplano()
