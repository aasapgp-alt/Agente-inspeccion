# config/constants.py

# IDs de Drive
CARPETA_RAIZ_ID = "1uPkHYst-TQSazAQdran2qFOAaTKS_1it"
CARPETA_EQUIPOS_REAL_ID = "19OdKrn1SLDLSuMj8e73q-8tovcw-CJA_"
NOMBRE_RAIZ = "ARAUCO_Inspector_IA"

# Configuración general
MODELO = "gemini-2.5-flash"
ANIO_ACTUAL = 2026
ANIO_SIG = 2027
NOMBRE_CSV = "00_AASA_MINUTA_PGP_UTF8.csv"

# Carpetas
CARPETA_CONFIG = "00_CONFIG"
CARPETA_INFORMES = "00_INFORMES_PDF"
CARPETA_MANUALES = "00_Manuales_y_Criterios"

# Estados
ESTADOS = ["BUENO", "REGULAR", "CRÍTICO"]

# Años disponibles
ANIOS_DISPONIBLES = [2023, 2024, 2025, 2026, 2027, 2028]

# Columnas del CSV (mapeo exacto según tu archivo)
COLUMNAS_CSV = {
    "empresa": "Empresa",
    "area": "Area",
    "numero": "Numero",
    "equipo": "Línea_Equipo_Instalaciones",
    "criticidad": "Criticidad",
    "material": "Material",
    "estado_2023": "Estado_PGP2023",
    "acciones_2023": "Acciones_PGP2023",
    "recomendaciones_2024": "Recomendaciones_PGP2024",
    "estado_2024": "Estado_PGP2024",
    "acciones_2024": "Acciones_PGP2024",
    "diagnostico_2024": "Diagnostico_2024",
    "recomendaciones_2025": "Recomendaciones_PGP2025",
    "estado_2026": "Estado_PGP2026",
    "acciones_2026": "Acciones_PGP2026",
    "diagnostico_2026": "Diagnostico_2026",
    "recomendaciones_2027": "Recomendaciones_PGP2027",
}
