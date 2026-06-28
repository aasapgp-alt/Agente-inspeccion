# app/config/defaults.py

# Configuración por defecto para reportes
REPORTES_DEFAULT = {
    "generacion_automatica": True,
    "formato_nombre": "ACTA_{numero}_{fecha}_{equipo}.pdf",
    "incluir_anexos": True
}

# Configuración de compresión de imágenes
COMPRESION_IMG_DEFAULT = {
    "calidad": 85,
    "max_dimension": 2048,
    "formato": "JPEG",
    "habilitado": True
}

# Configuración de Google Drive
DRIVE_DEFAULT = {
    "carpeta_raiz_nombre": "Reportes_Inspeccion",
    "subcarpetas_creadas_por_defecto": True,
    "compartir_automatico": False
}

# Configuración de generación de PDF
PDF_DEFAULT = {
    "orientacion": "portrait",
    "tamano_papel": "A4",
    "margenes": {"top": 20, "right": 20, "bottom": 20, "left": 20}
}

# Estilos por defecto para PDFs
ESTILOS_PDF_DEFAULT = {
    "colores": {
        "primary": "#00c8d7",
        "secondary": "#1a2236",
        "text": "#333333",
        "background": "#ffffff",
        "header_bg": "#0d1117",
        "header_text": "#ffffff"
    },
    "fuentes": {
        "titulo": ("Helvetica-Bold", 16),
        "subtitulo": ("Helvetica-Bold", 14),
        "cuerpo": ("Helvetica", 11),
        "pie": ("Helvetica-Oblique", 9)
    }
}
