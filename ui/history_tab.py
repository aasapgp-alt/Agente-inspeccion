import streamlit as st
import pandas as pd
import io
from config.constants import ANIO_ACTUAL

def render_history_tab(df, anio_actual, usar_db=False):
    """Renderiza la pestaña de historial
    
    Args:
        df: DataFrame CSV (solo si usar_db=False)
        usar_db: True si se está usando SQLite, False si se usa CSV
    """
    
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">📊 HISTÓRICO DE EQUIPOS</div>', unsafe_allow_html=True)
    
    if usar_db:
        from services.db_service import obtener_lista_equipos_db, obtener_historial_equipo_db
        
        equipos = obtener_lista_equipos_db()
        
        if not equipos:
            st.info("No hay equipos cargados en la base de datos")
            return
        
        st.markdown(f'<div style="font-size:.7rem;color:#7a8ba8;margin-bottom:10px;">Total: {len(equipos)} equipos</div>', unsafe_allow_html=True)
        
        # Filtros
        col_f1, col_f2 = st.columns(2)
        with col_f1:
            areas = sorted(list(set([e.get("area", "") for e in equipos if e.get("area")])))
            areas = ["(Todas)"] + areas
            filtro_area = st.selectbox("Área:", areas, key="filtro_area_hist")
        
        with col_f2:
            busqueda = st.text_input("🔍 Buscar equipo:", placeholder="Nombre o número...", key="busqueda_hist")
        
        # Filtrar equipos
        equipos_filtrados = equipos.copy()
        if filtro_area != "(Todas)":
            equipos_filtrados = [e for e in equipos_filtrados if e.get("area") == filtro_area]
        if busqueda:
            equipos_filtrados = [e for e in equipos_filtrados 
                               if busqueda.lower() in e.get("equipo", "").lower() 
                               or busqueda in e.get("numero", "")]
        
        # ✅ CACHE — Evitar 100 queries a DB
        historiales_cache = {}
        data = []
        
        for e in equipos_filtrados[:100]:
            equipo_id = e["id"]
            
            # ✅ Cache hit
            if equipo_id not in historiales_cache:
                historiales_cache[equipo_id] = obtener_historial_equipo_db(equipo_id, anio_actual)
            
            historial = historiales_cache[equipo_id]
            estado = historial.get("estado_actual", "Sin datos") if historial else "Sin datos"
            
            data.append({
                "Número": e.get("numero", ""),
                "Equipo": e.get("equipo", "")[:50],
                "Área": e.get("area", ""),
                "Material": e.get("material", ""),
                f"Estado PGP {anio_actual}": estado
            })
        
        if data:
            df_display = pd.DataFrame(data)
            st.dataframe(df_display, use_container_width=True, height=400)
            st.markdown(f'<div style="font-size:.6rem;color:#3d4f66;margin-top:8px;">Mostrando {len(data)} de {len(equipos)} equipos</div>', unsafe_allow_html=True)
        else:
            st.info("No hay equipos que coincidan con los filtros")
    
    else:
        # Modo CSV
        if df is None or df.empty:
            st.warning("CSV no cargado")
            return
        
        st.markdown(f'<div style="font-size:.7rem;color:#7a8ba8;margin-bottom:10px;">Total: {len(df)} equipos</div>', unsafe_allow_html=True)
        
        # Filtros
        col_f1, col_f2, col_f3 = st.columns(3)
        with col_f1:
            if 'Area' in df.columns:
                areas = ["(Todas)"] + sorted(df['Area'].dropna().unique().tolist())
                filtro_area = st.selectbox("Área:", areas, key="filtro_area_csv")
            else:
                filtro_area = "(Todas)"
        
        with col_f2:
            col_estado = f"Estado_PGP{anio_actual}"
            if col_estado in df.columns:
                estados = ["(Todos)", "BUENO", "REGULAR", "CRÍTICO", "Sin datos"]
                filtro_estado = st.selectbox("Estado:", estados, key="filtro_estado_csv")
            else:
                filtro_estado = "(Todos)"
        
        with col_f3:
            busqueda = st.text_input("🔍 Buscar equipo:", placeholder="Nombre o número...", key="busqueda_csv")
        
        # Aplicar filtros
        df_filtrado = df.copy()
        
        if filtro_area != "(Todas)" and 'Area' in df.columns:
            df_filtrado = df_filtrado[df_filtrado['Area'] == filtro_area]
        
        if filtro_estado != "(Todos)" and col_estado in df.columns:
            if filtro_estado == "Sin datos":
                df_filtrado = df_filtrado[df_filtrado[col_estado].str.strip() == ""]
            else:
                df_filtrado = df_filtrado[df_filtrado[col_estado].str.upper().str.contains(filtro_estado, na=False)]
        
        if busqueda:
            col_equipo = "Línea_Equipo_Instalaciones"
            if col_equipo in df_filtrado.columns:
                df_filtrado = df_filtrado[df_filtrado[col_equipo].str.contains(busqueda, case=False, na=False)]
        
        # Mostrar DataFrame
        columnas_mostrar = ["Numero", "Línea_Equipo_Instalaciones", "Area", "Material", "Criticidad", col_estado] if col_estado in df.columns else ["Numero", "Línea_Equipo_Instalaciones", "Area", "Material", "Criticidad"]
        columnas_existentes = [c for c in columnas_mostrar if c in df_filtrado.columns]
        
        st.dataframe(
            df_filtrado[columnas_existentes].rename(columns={"Línea_Equipo_Instalaciones": "Equipo"}),
            use_container_width=True,
            height=400
        )
        
        st.markdown(f'<div style="font-size:.6rem;color:#3d4f66;margin-top:8px;">Mostrando {len(df_filtrado)} de {len(df)} equipos</div>', unsafe_allow_html=True)
