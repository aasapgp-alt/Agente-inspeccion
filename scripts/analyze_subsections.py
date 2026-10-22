import sys
from app.core.db import get_db_connection

def analyze():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute("""
            SELECT eq_f.drive_id as eq_id, eq_f.nombre as eq_name, camp_f.nombre as camp_name, sub_f.nombre as sub_name, sub_f.drive_id as sub_id
            FROM drive_folders_cache sub_f
            JOIN drive_folders_cache camp_f ON sub_f.parent_id = camp_f.drive_id
            JOIN drive_folders_cache eq_f ON camp_f.parent_id = eq_f.drive_id
            WHERE camp_f.nombre LIKE '%PGP 2026%' OR camp_f.nombre LIKE '%PGP 2024%'
            ORDER BY eq_f.nombre, camp_f.nombre, sub_f.nombre
        """)
        rows = c.fetchall()
        print(f"Total sub-sections inside campaigns: {len(rows)}")
        
        seen = {}
        for r in rows:
            eq = r['eq_name']
            if eq not in seen:
                seen[eq] = []
            seen[eq].append(f"{r['camp_name']} -> {r['sub_name']}")
        
        print(f"Total distinct parent equipment folders with sub-sections: {len(seen)}")
        for eq, subs in list(seen.items())[:20]:
            print(f"\n[Equipo Folder: {eq}]")
            for s in subs[:6]:
                print(f"   {s}")

if __name__ == "__main__":
    analyze()
