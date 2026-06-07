# config/defaults.py
PERFIL_DEFAULT = {
    "nombre": "Inspector IA",
    "rol": "Ingeniero Senior de Inspección",
    "estilo": "técnico-directo",
    "experiencia": "20+ años en plantas químicas y celulosa",
    "umbral_critico": "ampollas >5mm con fibra expuesta, fugas activas, corrosión severa bajo revestimiento, BQ completamente hidrolizada",
    "umbral_regular": "ampollas <5mm sin fibra expuesta, deterioro superficial, corrosión localizada tratable",
    "umbral_bueno": "sin patologías visibles o mínimas superficiales, estructura íntegra",
    "frases": ["el equipo está para cambiar", "presenta ataque severo en BQ", "requiere intervención inmediata"],
    "prioridades": ["interior antes que exterior", "uniones bridadas y acometidas primero", "comparar contra inspección anterior"],
    "materiales_exp": ["FRP", "ACR", "INOX"],
    "zonas_criticas": ["zona de condensación", "pie de equipo", "uniones bridadas"]
}

CONOCIMIENTO_DEFAULT = """CRITERIOS POR MATERIAL:

FRP (Plástico Reforzado con Fibra de Vidrio):
- Ampollas >5mm con fibra expuesta -> CRÍTICO siempre
- BQ hidrolizada/decolorada + ampollas -> REGULAR mínimo
- Lining interior atacado + decoloración -> verificar espesor con UT
- Delaminación visible -> CRÍTICO
- Fisuras transversales -> CRÍTICO

ACR (Acero Revestido):
- Corrosión bajo revestimiento visible -> CRÍTICO
- Pérdida adherencia revestimiento >20% superficie -> REGULAR
- Pérdida total de revestimiento en zona activa -> CRÍTICO
- Picadura activa en sustrato -> CRÍTICO

INOX:
- Picado por cloruros en zona activa -> CRÍTICO
- Corrosión intergranular en soldaduras -> CRÍTICO

GENERAL:
- Fugas activas en cualquier material -> CRÍTICO siempre
- Base civil/grout degradado -> REGULAR
- Elementos de sujeción con corrosión severa -> REGULAR
- Si deterioro avanza respecto a inspección anterior -> elevar estado

# Agregar esta constante
FEW_SHOTS_DEFAULT = []
"""
