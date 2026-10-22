from app.services.drive_service import obtener_evidencia_equipo

res = obtener_evidencia_equipo(177)
print('Equipo:', res['equipo']['nombre'])
print('Path completo:', res.get('path_completo'))
print('Resumen:', res.get('resumen'))
print('Seccion recomendada:', res.get('seccion_recomendada'))
print('Total secciones:', len(res.get('secciones_campania', [])))
for s in res.get('secciones_campania', []):
    print(f"   - {s['nombre']}: {s['count']} fotos (Path: {s['path_completo']})")
if res.get('fotos_campania'):
    print('Sample foto:', res['fotos_campania'][0])
