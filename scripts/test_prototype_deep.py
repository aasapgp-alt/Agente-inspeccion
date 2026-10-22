import sys
from app.core.db import get_db_connection
from app.services.drive_service import listar_carpetas, listar_archivos

def test_full():
    with get_db_connection() as conn:
        c = conn.cursor()
        c.execute('SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE id = 177')
        eq = dict(c.fetchone())
        
        c.execute('SELECT path_completo FROM drive_folders_cache WHERE drive_id = ?', (eq['drive_folder_id'],))
        row = c.fetchone()
        eq_path = row['path_completo'] if row else 'N/A'

    print('Testing deep traversal for:', eq['nombre'])
    print('Path:', eq_path)

    # 1. Direct subfolders
    subcarpetas = listar_carpetas(eq['drive_folder_id'])
    c_2026 = next((sc for sc in subcarpetas if '2026' in sc['title']), None)
    if c_2026:
        sub_sections = listar_carpetas(c_2026['id'])
        print('Sub sections in PGP 2026:', [s['title'] for s in sub_sections])
        
        eq_norm = eq['nombre'].lower()
        rec = None
        for s in sub_sections:
            s_norm = s['title'].lower()
            if 'succi' in eq_norm and 'succi' in s_norm:
                rec = s
            elif 'impulsi' in eq_norm and 'impulsi' in s_norm:
                rec = s
        print('Recommended section for', eq['nombre'], ':', rec['title'] if rec else 'None')

if __name__ == '__main__':
    test_full()
