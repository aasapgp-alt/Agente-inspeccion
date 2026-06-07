# services/csv_service.py

import pandas as pd
import io
import streamlit as st
from googleapiclient.http import MediaIoBaseDownload
from utils.text_utils import limpiar_texto

def leer_csv(fid, drive):
    """Lee CSV desde Drive con separador punto y coma"""
    # Descargar archivo
    try:
        req = drive.files().get_media(fileId=fid)
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, req)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        fh.seek(0)
        data = fh.getvalue()
    except Exception as e:
        st.error(f"Error descargando CSV: {e}")
        return None
    
    if not data:
        return None
    
    # Decodificar
    try:
        content = data.decode('utf-8-sig')
    except:
        try:
            content = data.decode('utf-8')
        except:
            content = data.decode('latin-1')
    
    # Mostrar primeras líneas para debug
    lines = content.split('\n')
    st.info(f"📄 CSV detectado: {len(lines)} líneas")
    
    try:
        # Intentar con separador punto y coma
        df = pd.read_csv(
            io.StringIO(content),
            sep=';',
            encoding='utf-8',
            quotechar='"',
            on_bad_lines='skip'
        )
        
        # Si no hay columnas, probar con coma
        if len(df.columns) <= 1:
            df = pd.read_csv(
                io.StringIO(content),
                sep=',',
                encoding='utf-8',
                quotechar='"',
                on_bad_lines='skip'
            )
        
        # Limpiar nombres de columnas
        df.columns = [limpiar_texto(col.strip().replace('"', '')) for col in df.columns]
        
        # Limpiar datos
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].astype(str).apply(limpiar_texto)
            df[col] = df[col].str.replace('nan', '').fillna('')
        
        # Debug: mostrar columnas encontradas
        st.success(f"✅ CSV cargado: {len(df)} filas, {len(df.columns)} columnas")
        
        # Mostrar columnas en expander para debug
        with st.expander("🔧 Ver columnas del CSV"):
            st.write("Columnas encontradas:")
            for i, col in enumerate(df.columns):
                st.write(f"{i+1}. '{col}'")
        
        return df
    except Exception as e:
        st.error(f"Error leyendo CSV: {e}")
        return None

def obtener_lista_equipos(df):
    """Obtiene lista de equipos para selector"""
    if df is None:
        return []
    
    # Buscar columna de equipos - probar varias opciones
    col_equipo = None
    posibles = [
        'Línea_Equipo_Instalaciones', 
        'Línea Equipo Instalaciones', 
        'Equipo', 
        'equipo',
        'Línea Equipo Instalaciones',
        'Linea Equipo Instalaciones'
    ]
    
    for p in posibles:
        if p in df.columns:
            col_equipo = p
            break
    
    if col_equipo is None:
        for col in df.columns:
            if 'equipo' in col.lower() or 'instalaciones' in col.lower():
                col_equipo = col
                break
    
    if col_equipo is None:
        st.error(f"Columna de equipos no encontrada. Columnas: {list(df.columns)}")
        return []
    
    st.info(f"📌 Usando columna de equipos: '{col_equipo}'")
    
    equipos = []
    for idx, row in df.iterrows():
        equipo = str(row.get(col_equipo, '')).strip()
        if equipo and equipo not in ['', 'nan', 'None']:
            area = str(row.get('Area', row.get('Área', ''))).strip()
            numero = str(row.get('Numero', '')).strip()
            
            # Crear display name
            if numero and numero != 'nan':
                display = f"{numero} - {equipo}"
            else:
                display = equipo
            
            if area and area != 'nan':
                display = f"[{area}] {display}"
            
            equipos.append({
                "idx": idx,
                "equipo": equipo,
                "area": area if area != 'nan' else '',
                "numero": numero if numero != 'nan' else '',
                "display": display
            })
    
    return sorted(equipos, key=lambda x: x['display'])

def obtener_historial_equipo(df, idx, anio_actual):
    """Obtiene todo el historial del equipo seleccionado"""
    if df is None or idx is None:
        return {"idx": idx} if idx else None
    
    if idx >= len(df):
        return None
    
    row = df.iloc[idx]
    
    # Función helper para obtener valor de columna por nombre flexible
    def get_val(*nombres):
        for nombre in nombres:
            for col in df.columns:
                if col.strip().lower() == nombre.lower():
                    val = str(row.get(col, ''))
                    if val and val != 'nan':
                        return limpiar_texto(val)
        return ''
    
    historial = {
        "idx": idx,
        "equipo": get_val('Línea_Equipo_Instalaciones', 'Línea Equipo Instalaciones', 'Equipo'),
        "area": get_val('Area', 'Área'),
        "numero": get_val('Numero'),
        "criticidad": get_val('Criticidad'),
        "material": get_val('Material'),
        "empresa": get_val('Empresa'),
    }
    
    # PGP 2023
    historial["estado_2023"] = get_val('Estado PGP 2023', 'Estado_PGP2023')[:200]
    historial["acciones_2023"] = get_val('Acciones PGP 2023', 'Acciones_PGP2023')[:300]
    
    # PGP 2024
    historial["estado_2024"] = get_val('Estado PGP2024', 'Estado_PGP2024')[:200]
    historial["acciones_2024"] = get_val('Acciones PGP 2024', 'Acciones_PGP2024')[:300]
    historial["diagnostico_2024"] = get_val('Diagnostico 2024', 'Diagnostico_2024')[:800]
    historial["recomendaciones_2024"] = get_val('Recomendaciones PGP 2024', 'Recomendaciones_PGP2024')[:500]
    
    # PGP 2025
    historial["estado_2025"] = get_val('Estado PGP2025', 'Estado_PGP2025')[:200]
    historial["diagnostico_2025"] = get_val('Diagnostico 2025', 'Diagnostico_2025')[:800]
    historial["recomendaciones_2025"] = get_val('Recomendaciones PGP 2025', 'Recomendaciones_PGP2025')[:500]
    
    # PGP 2026 (actual)
    historial["estado_actual"] = get_val('Estado PGP2026', 'Estado_PGP2026')[:200]
    historial["acciones_actual"] = get_val('Acciones PGP 2026', 'Acciones_PGP2026')[:300]
    historial["diagnostico_actual"] = get_val('Diagnostico 2026', 'Diagnostico_2026')[:800]
    historial["recomendaciones_siguiente"] = get_val('Recomendaciones PGP 2027', 'Recomendaciones_PGP2027')[:500]
    
    return historial

def guardar_inspeccion(df, idx, anio, estado, acciones, diagnostico, recomendaciones):
    """Guarda los resultados de la inspección en el DataFrame"""
    
    # Buscar las columnas correctas
    col_estado = None
    col_acciones = None
    col_diagnostico = None
    col_recomendaciones = None
    
    for col in df.columns:
        col_limpia = col.strip().lower()
        if f'estado pgp{anio}' in col_limpia or f'estado_pgp{anio}' in col_limpia:
            col_estado = col
        elif f'acciones pgp {anio}' in col_limpia or f'acciones_pgp{anio}' in col_limpia:
            col_acciones = col
        elif f'diagnostico {anio}' in col_limpia or f'diagnostico_{anio}' in col_limpia:
            col_diagnostico = col
        elif f'recomendaciones pgp {anio+1}' in col_limpia or f'recomendaciones_pgp{anio+1}' in col_limpia:
            col_recomendaciones = col
    
    # Crear columnas si no existen
    if col_estado is None:
        col_estado = f"Estado PGP{anio}"
        df[col_estado] = ""
    if col_acciones is None:
        col_acciones = f"Acciones PGP {anio}"
        df[col_acciones] = ""
    if col_diagnostico is None:
        col_diagnostico = f"Diagnostico {anio}"
        df[col_diagnostico] = ""
    if col_recomendaciones is None:
        col_recomendaciones = f"Recomendaciones PGP {anio+1}"
        df[col_recomendaciones] = ""
    
    df.at[idx, col_estado] = estado
    df.at[idx, col_acciones] = acciones
    df.at[idx, col_diagnostico] = diagnostico
    df.at[idx, col_recomendaciones] = recomendaciones
    
    return df

def obtener_stats(df, anio_actual):
    """Obtiene estadísticas del CSV"""
    # Buscar columna de estado actual
    col_estado = None
    for col in df.columns:
        col_limpia = col.strip().lower()
        if f'estado pgp{anio_actual}' in col_limpia or f'estado_pgp{anio_actual}' in col_limpia:
            col_estado = col
            break
    
    s = {"total": len(df), "bueno": 0, "regular": 0, "critico": 0, "nd": 0}
    
    if col_estado is None:
        s["nd"] = len(df)
        return s
    
    for _, row in df.iterrows():
        v = limpiar_texto(str(row.get(col_estado, ""))).upper()
        if "BUENO" in v:
            s["bueno"] += 1
        elif "REGULAR" in v:
            s["regular"] += 1
        elif "CRÍTICO" in v or "CRITICO" in v:
            s["critico"] += 1
        else:
            s["nd"] += 1
    return s