import sqlite3
import pypdf
import re
import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DB_PATH = os.path.join(BASE_DIR, 'data', 'inspecciones.db')
PDF_PATH = os.path.join(BASE_DIR, 'data', 'Reporte Unificado insp ARC MDA SA 2024.pdf')

def update_pids():
    reader = pypdf.PdfReader(PDF_PATH)
    page11 = reader.pages[10].extract_text()
    page12 = reader.pages[11].extract_text()
    
    full_text = page11 + "\n" + page12
    
    # Regex to match: Description (with optional P&ID) Tag
    # e.g., Treated Water Storage Tank (P&ID # 220-PI-08) T-2240
    matches = re.findall(r'([A-Za-z0-9\s\-\/\(\)\#\.\:\,]+?\b(?:P&ID\s*[\#\:]?\s*[\w\-]+|\bTank\b|\bBed\b|\bReactor\b|\bCondenser\b|\bReceiver\b)[A-Za-z0-9\s\-\/\(\)\#\.\:]*?)\s+(T-[0-9]{4}[A-Z]?|R-[0-9]{4}|V-[0-9]{4})', full_text)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updated = 0
    
    # Explicit mapping dictionary from PDF table
    mapping = {
        "T-2240": "Treated Water Storage Tank (P&ID # 220-PI-08)",
        "T-2270": "Feed Water Storage Tank (P&ID # 220-PI-08)",
        "T-2280": "Water Recycle Tank (P&ID # 210-PI-02)",
        "T-3109": "Ph Adjustment Tank (P&ID # 270-PI-02)",
        "T-3220": "GCLA Water Preparation Tank (P&ID # 250-PI-02)",
        "T-3224": "LiCl Product Storage Tank (P&ID # 200-PI-01)",
        "T-3225": "LiCl Product Storage Tank (P&ID # 200-PI-01)",
        "T-3230": "Brine Recycle Storage Tank (P&ID # 210-PI-02)",
        "T-3250": "Hot Spent Brine Storage Tank (P&ID # 270-PI-01)",
        "T-3318": "Sorbent Lithium Hydroxide Preparation Tank (P&ID # 250-PI-01)",
        "T-3325": "Sorbent GCLA Backwash Tank (P&ID # 250-PI-07)",
        "T-3326": "Sorbent Spent GCLA Disposal Well (P&ID # 250-PI-07)",
        "T-3350": "Sorbent CLA Storage (P&ID # 250-PI-08)",
        "T-3360": "Sorbent CLA Storage (P&ID # 250-PI-08)",
        "T-3415": "Concentrated LiCl Product Surge Tank (P&ID # 240-PI-01)",
        "T-3418": "Reclaim Caustic Tank (P&ID # 240-PI-05)",
        "T-3424": "Acid Storage Tank 1 (P&ID # 130-PI-01)",
        "T-3425": "Acid Storage Tank 2 (P&ID # 130-PI-01)",
        "T-3426": "Acid Storage Tank 3 (P&ID # 130-PI-01)",
        "T-3434": "Acid Storage Tank 4 (P&ID # 130-PI-01)",
        "T-3460": "Polishing Product Storage Tank (P&ID # 240-PI-01)",
        "T-3465": "Reclaim Acid Tank (P&ID # 240-PI-05)",
        "T-3470": "Reclaim Water Tank (P&ID # 240-PI-01)",
        "T-5000": "Reaction Tank - Sludge Lime (P&ID # 280-PI-02)",
        "T-5001": "Clarified Water Tank (P&ID # 280-PI-03)",
        "T-5010": "Chemical Products Tank 1 (P&ID # 280-PI-06)",
        "T-5011": "Chemical Products Tank 2 (P&ID # 280-PI-06)",
        "R-3317": "Sorbent GCLA Preparation Reactor 2 (P&ID # 250-PI-07)",
        "R-3318": "Sorbent Lithium Hydroxide Preparation Tank (P&ID # 250-PI-01)",
        "R-3325": "Sorbent GCLA Backwash Tank (P&ID # 250-PI-07)",
        "T-7000": "LiCl Liquor Surge Tank",
        "T-7410": "Water Storage Tank (LiCa)",
        "T-7005": "As-Removal Ion Exchange Bed 1",
        "T-7006": "As-Removal Ion Exchange Bed 2",
        "T-7007": "As-Removal System Regenerant Solution Tank",
        "V-7201": "Strong NaCl Liquor Receiver",
        "V-7203": "Weak NaCl Liquor Receiver",
        "V-7308": "Cascade Condenser"
    }

    for tag, desc in mapping.items():
        cursor.execute("UPDATE equipos SET nombre = ? WHERE (codigo = ? OR tag = ?) AND ubicacion_id IN (SELECT id FROM ubicaciones WHERE empresa_id = 170)", (desc, tag, tag))
        if cursor.rowcount > 0:
            updated += cursor.rowcount
            print(f"Actualizado TAG {tag} -> {desc}")

    conn.commit()
    conn.close()
    print(f"\n¡Proceso completado! Se actualizaron {updated} nombres de equipos en Minera del Altiplano S.A.")

if __name__ == "__main__":
    update_pids()
