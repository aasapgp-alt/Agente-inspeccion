from app.core.db import get_db_connection

with get_db_connection() as conn:
    c = conn.cursor()
    print('--- EQUIPOS MATCHING 431-433 ---')
    c.execute("SELECT id, codigo, nombre, drive_folder_id FROM equipos WHERE nombre LIKE '%431-433%' OR codigo LIKE '%431-433%'")
    for row in c.fetchall():
        print(dict(row))

    print('\n--- FOLDERS MATCHING 431-433 ---')
    c.execute("SELECT drive_id, nombre, parent_id FROM drive_folders_cache WHERE nombre LIKE '%431-433%'")
    for row in c.fetchall():
        print(dict(row))
