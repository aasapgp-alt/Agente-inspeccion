import streamlit as st
from services.csv_service import obtener_lista_equipos, obtener_historial_equipo, obtener_stats
from services.learning_service import save_json, save_txt
from config.constants import ANIO_ACTUAL
from config.defaults import PERFIL_DEFAULT, CONOCIMIENTO_DEFAULT
from services.db_service import obtener_historial_equipo_db

def render_sidebar(data_source, fid_csv, drive, on_equipo_selected, perfil, fid_perfil, conocimiento, fid_conoc, few_shots, fid_fs, usar_db=False):
    """Renderiza el sidebar con selector de equipo y configuración"""

    with st.sidebar:
        st.markdown("""
        <div style="text-align:center;padding:8px 0 20px;">
            <div style="font-family:'Barlow Condensed',sans-serif;font-size:1.5rem;font-weight:700;letter-spacing:4px;">ARAUCO</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:.58rem;color:#00c8d7;">INSPECTOR IA · v4.0</div>
        </div>
        """, unsafe_allow_html=True)

        # ── SELECTOR DE EQUIPO ──
        st.markdown('<div style="font-family: monospace; font-size: .6rem; color: #3d4f66; margin: 16px 0 6px;">🎯 SELECCIONAR EQUIPO</div>', unsafe_allow_html=True)

        if usar_db:
            equipos = data_source
        else:
            equipos = obtener_lista_equipos(data_source) if data_source is not None else []

        if equipos:
            opciones = {}
            for e in equipos:
                if usar_db:
                    opciones[e["display"]] = e["id"]
                else:
                    opciones[e["display"]] = e["idx"]

            equipo_seleccionado_display = st.selectbox(
                "Equipo a inspeccionar:",
                options=list(opciones.keys()),
                key="equipo_selector"
            )

            if equipo_seleccionado_display:
                valor_seleccionado = opciones[equipo_seleccionado_display]

                if usar_db:
                    historial = obtener_historial_equipo_db(valor_seleccionado, ANIO_ACTUAL)
                else:
                    historial = obtener_historial_equipo(data_source, valor_seleccionado, ANIO_ACTUAL)

                if historial:
                    on_equipo_selected(valor_seleccionado, historial)

                    st.markdown(f"""
                    <div style="background:#1a2236;border-radius:8px;padding:12px;margin:10px 0;">
                        <div style="color:#00c8d7;font-size:.65rem;">📌 EQUIPO SELECCIONADO</div>
                        <div style="font-size:.8rem;font-weight:600;">{historial.get('equipo', '—')[:40]}</div>
                        <div style="font-size:.65rem;color:#7a8ba8;">{historial.get('area', '—')} | #{historial.get('numero', '—')}</div>
                        <div style="font-size:.65rem;">Material: {historial.get('material', '—')}</div>
                        <div style="font-size:.65rem;">Criticidad: {historial.get('criticidad', '—')}</div>
                    </div>
                    """, unsafe_allow_html=True)

                    estado_actual = historial.get('estado_actual', 'Sin datos')
                    if "CRITICO" in estado_actual.upper() or "CRÍTICO" in estado_actual.upper():
                        estado_display = "🔴 CRÍTICO"
                    elif "BUENO" in estado_actual.upper():
                        estado_display = "🟢 BUENO"
                    else:
                        estado_display = "🟡 REGULAR"

                    st.markdown(f'<div style="font-size:.7rem;margin-bottom:10px;">Estado PGP {ANIO_ACTUAL}: <strong>{estado_display}</strong></div>', unsafe_allow_html=True)

                    diag_2024 = historial.get('diagnostico_2024', '')
                    if diag_2024 and len(diag_2024) > 10 and diag_2024 != 'Sin datos':
                        with st.expander("📋 Diagnóstico PGP 2024", expanded=False):
                            st.markdown(f'<div style="font-size:.7rem;color:#7a8ba8;">{diag_2024[:300]}</div>', unsafe_allow_html=True)

                    rec_2025 = historial.get('recomendaciones_2025', '')
                    if rec_2025 and len(rec_2025) > 10 and rec_2025 != 'Sin datos':
                        with st.expander("📋 Recomendaciones PGP 2025", expanded=False):
                            st.markdown(f'<div style="font-size:.7rem;color:#7a8ba8;">{rec_2025[:300]}</div>', unsafe_allow_html=True)

        st.markdown("---")

        # ── CONFIGURACIÓN DEL INSPECTOR ──
        with st.expander("👤 Configurar Inspector", expanded=False):
            # ✅ Leer siempre de session_state
            nombre_inp = st.text_input("Nombre:", value=st.session_state.perfil.get("nombre", ""), key="inspector_nombre")
            rol_inp = st.text_input("Rol:", value=st.session_state.perfil.get("rol", ""), key="inspector_rol")
            exp_inp = st.text_input("Experiencia:", value=st.session_state.perfil.get("experiencia", ""), key="inspector_exp")

            st.markdown("**Criterios de evaluación**:")
            umbral_critico = st.text_area("🔴 CRÍTICO:", value=st.session_state.perfil.get("umbral_critico", ""), height=60, key="umbral_critico")
            umbral_regular = st.text_area("🟡 REGULAR:", value=st.session_state.perfil.get("umbral_regular", ""), height=60, key="umbral_regular")
            umbral_bueno = st.text_area("🟢 BUENO:", value=st.session_state.perfil.get("umbral_bueno", ""), height=60, key="umbral_bueno")

            col_save1, col_save2 = st.columns(2)
            with col_save1:
                if st.button("💾 Guardar Perfil", use_container_width=True, key="save_perfil"):
                    nuevo_perfil = st.session_state.perfil.copy()
                    nuevo_perfil["nombre"] = nombre_inp
                    nuevo_perfil["rol"] = rol_inp
                    nuevo_perfil["experiencia"] = exp_inp
                    nuevo_perfil["umbral_critico"] = umbral_critico
                    nuevo_perfil["umbral_regular"] = umbral_regular
                    nuevo_perfil["umbral_bueno"] = umbral_bueno
                    if st.session_state.fid_perfil and drive:
                        save_json(st.session_state.fid_perfil, nuevo_perfil, drive)
                        st.session_state.perfil = nuevo_perfil
                        st.success("✅ Perfil guardado")
                    else:
                        st.warning("No se pudo guardar en Drive")
            with col_save2:
                if st.button("!aurar Default", use_container_width=True, key="reset_perfil"):
                    st.session_state.perfil = PERFIL_DEFAULT.copy()
                    if st.session_state.fid_perfil and drive:
                        save_json(st.session_state.fid_perfil, PERFIL_DEFAULT, drive)
                    st.success("✅ Perfil restaurado")
                    st.rerun()

        with st.expander("📚 Configurar Conocimiento", expanded=False):
            conoc_inp = st.text_area("Reglas técnicas:", value=st.session_state.conocimiento, height=200, key="conocimiento_input")

            col_save1, col_save2 = st.columns(2)
            with col_save1:
                if st.button("💾 Guardar Conocimiento", use_container_width=True, key="save_conocimiento"):
                    if st.session_state.fid_conoc and drive:
                        save_txt(st.session_state.fid_conoc, conoc_inp, drive)
                        st.session_state.conocimiento = conoc_inp
                        st.success("✅ Conocimiento guardado")
                    else:
                        st.warning("No se pudo guardar en Drive")
            with col_save2:
                if st.button("↺ Restaurar Default", use_container_width=True, key="reset_conocimiento"):
                    st.session_state.conocimiento = CONOCIMIENTO_DEFAULT
                    if st.session_state.fid_conoc and drive:
                        save_txt(st.session_state.fid_conoc, CONOCIMIENTO_DEFAULT, drive)
                    st.success("✅ Conocimiento restaurado")
                    st.rerun()

        st.markdown("---")

        # ── RECURSOS ──
        st.markdown('<div style="font-family: monospace; font-size: .6rem; color: #3d4f66; margin: 0 0 6px;">📁 RECURSOS DRIVE</div>', unsafe_allow_html=True)

        if usar_db:
            recursos = [
                ("🗄️ SQLite", st.session_state.usar_db),
                ("Perfil inspector", st.session_state.fid_perfil is not None),
                ("Base conocimiento", st.session_state.fid_conoc is not None),
                ("Aprendizaje", st.session_state.fid_fs is not None),
            ]
        else:
            recursos = [
                ("📄 CSV histórico", st.session_state.fid_csv is not None),
                ("Perfil inspector", st.session_state.fid_perfil is not None),
                ("Base conocimiento", st.session_state.fid_conoc is not None),
                ("Aprendizaje", st.session_state.fid_fs is not None),
            ]

        for lbl, ok in recursos:
            icono = "🟢" if ok else "🔴"
            st.markdown(f'<div style="font-size:.7rem; margin:2px 0;">{icono} {lbl}</div>', unsafe_allow_html=True)

        # Botón reconectar
        col_rec1, col_rec2 = st.columns([3, 1])
        with col_rec1:
            if st.button("🔄 Reconectar Drive", use_container_width=True, key="reconectar_drive"):
                st.cache_data.clear()
                for key in ["df", "fid_csv", "camino_fotos", "imgs_sel", "usar_db"]:
                    if key in st.session_state:
                        if key == "usar_db":
                            st.session_state[key] = False
                        elif key == "camino_fotos":
                            st.session_state[key] = [{"name": "EQUIPOS", "id": st.session_state.get("fid_csv") or ""}]
                        else:
                            st.session_state[key] = None
                st.rerun()
        with col_rec2:
            if st.button("🗑️", help="Limpiar caché", key="clear_cache"):
                st.cache_data.clear()
                st.success("Caché limpiado")
                st.rerun()

        st.markdown("---")

        # ── ESTADÍSTICAS ──
        if usar_db:
            from services.db_service import obtener_stats_db
            stats = obtener_stats_db(ANIO_ACTUAL) or {"total": 0, "bueno": 0, "regular": 0, "critico": 0, "nd": 0}
        else:
            if data_source is not None:
                stats = obtener_stats(data_source, ANIO_ACTUAL) or {"total": 0, "bueno": 0, "regular": 0, "critico": 0, "nd": 0}
            else:
                stats = {"total": 0, "bueno": 0, "regular": 0, "critico": 0, "nd": 0}

        total_inspeccionados = stats['bueno'] + stats['regular'] + stats['critico']
        porcentaje = int(total_inspeccionados / max(stats['total'], 1) * 100)

        st.markdown(f"""
        <div style="font-family: monospace; font-size: .6rem; color: #3d4f66; margin: 0 0 6px;">📊 ESTADÍSTICAS PGP {ANIO_ACTUAL}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <div style="background:#111827;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:.55rem;">Total</div>
                <div style="font-size:1.2rem;font-weight:700;">{stats['total']}</div>
            </div>
            <div style="background:#111827;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:.55rem;">Inspeccionados</div>
                <div style="font-size:1.2rem;font-weight:700;">{total_inspeccionados}</div>
                <div style="font-size:.5rem;">{porcentaje}%</div>
            </div>
            <div style="background:#111827;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:.55rem;">Críticos</div>
                <div style="font-size:1.2rem;font-weight:700;color:#ff4757;">{stats['critico']}</div>
            </div>
            <div style="background:#111827;border-radius:6px;padding:8px;text-align:center;">
                <div style="font-size:.55rem;">Pendientes</div>
                <div style="font-size:1.2rem;font-weight:700;color:#e8a020;">{stats['nd']}</div>
            </div>
        </div>
        """, unsafe_allow_html=True)

        st.markdown("---")

        # ── CONFIGURACIÓN DE ANÁLISIS ──
        st.markdown('<div style="font-family: monospace; font-size: .6rem; color: #3d4f66; margin: 0 0 6px;">&FIGURACIÓN</div>', unsafe_allow_html=True)

        max_imgs = st.slider("Imágenes máx.", 1, 15, st.session_state.get("max_imgs", 10), 1, key="slider_max_imgs")
        img_dim = st.select_slider("Dimensión (px)", [512, 768, 1024, 1280], st.session_state.get("img_dim", 1024), key="slider_img_dim")

        st.markdown(f'<div style="font-size:.7rem; margin-top:10px;">🧠 {len(st.session_state.few_shots)} correcciones guardadas</div>', unsafe_allow_html=True)

        modo_texto = "🗄️ SQLite" if usar_db else "📄 CSV"
        st.markdown(f'<div style="font-size:.5rem; color:#1e2d45; text-align:center; margin-top:20px;">v4.0 · Gemini 2.5 Flash · {modo_texto}</div>', unsafe_allow_html=True)

    return max_imgs, img_dim
