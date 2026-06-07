import streamlit as st
from services.drive_service import navegar_carpetas, obtener_imagenes_carpeta
from services.inspection_service import generar_analisis
from services.pdf_service import generar_pdf
from services.db_service import guardar_inspeccion_db
from utils.image_utils import descargar_imagen
from config.constants import ANIO_ACTUAL, ANIO_SIG, ESTADOS, CARPETA_EQUIPOS_REAL_ID

def render_inspection_tab(drive, equipo_actual, historial_actual, perfil, conocimiento, few_shots, gemini, on_guardar, usar_db=False):
    
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">🔍 INSPECCIÓN EN CURSO</div>', unsafe_allow_html=True)
    
    if equipo_actual is None:
        st.info("👈 Selecciona un equipo en el panel lateral para comenzar")
        return
    
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">🔍 INSPECCIÓN EN CURSO</div>', unsafe_allow_html=True)

    if equipo_actual is None:
        st.info("👈 Selecciona un equipo en el panel lateral para comenzar")
        return

    # Mostrar equipo seleccionado
    st.markdown(f"""
    <div style="background:#1a2236;border-radius:10px;padding:15px;margin-bottom:20px;border:1px solid #2a3f5f;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div>
                <span style="font-size:.6rem;color:#7a8ba8;">EQUIPO SELECCIONADO</span>
                <div style="font-size:1rem;font-weight:600;">{equipo_actual.get('equipo', '—')}</div>
                <div style="font-size:.7rem;color:#7a8ba8;">{equipo_actual.get('area', '—')} | Material: {equipo_actual.get('material', '—')}</div>
            </div>
            <div>
                <span style="font-size:.6rem;color:#7a8ba8;">ESTADO ACTUAL</span>
                <div><span class="badge {'b-critico' if 'CRITICO' in historial_actual.get('estado_actual', '').upper() or 'CRÍTICO' in historial_actual.get('estado_actual', '').upper() else 'b-regular'}">{historial_actual.get('estado_actual', 'Sin datos')}</span></div>
            </div>
        </div>
    </div>
    """, unsafe_allow_html=True)

    # Mostrar historial
    with st.expander("📋 Historial - Diagnóstico PGP 2024", expanded=False):
        diagnostico_2024 = historial_actual.get("diagnostico_2024", "Sin datos")
        if diagnostico_2024 and diagnostico_2024.strip() and diagnostico_2024 != "Sin datos":
            st.markdown(f'<div style="font-size:.75rem; color:#7a8ba8;">{diagnostico_2024[:600]}</div>', unsafe_allow_html=True)
        else:
            st.markdown('<div style="font-size:.75rem; color:#7a8ba8;">📭 No hay diagnóstico registrado para PGP 2024</div>', unsafe_allow_html=True)

    with st.expander("📋 Historial - Recomendaciones PGP 2025", expanded=False):
        recomendaciones_2025 = historial_actual.get("recomendaciones_2025", "Sin datos")
        if recomendaciones_2025 and recomendaciones_2025.strip() and recomendaciones_2025 != "Sin datos":
            st.markdown(f'<div style="font-size:.75rem; color:#7a8ba8;">{recomendaciones_2025[:600]}</div>', unsafe_allow_html=True)
        else:
            st.markdown('<div style="font-size:.75rem; color:#7a8ba8;">📭 No hay recomendaciones registradas para PGP 2025</div>', unsafe_allow_html=True)

    st.markdown("---")

    # ── NAVEGACIÓN DE FOTOS ──
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">📁 NAVEGAR POR FOTOS</div>', unsafe_allow_html=True)

    # ✅ Inicializar camino_fotos de forma segura
    camino = st.session_state.get("camino_fotos")
    if not camino:
        camino = [{"name": "EQUIPOS", "id": CARPETA_EQUIPOS_REAL_ID}]
        st.session_state.camino_fotos = camino

    col_back, col_root, _ = st.columns([1, 1, 6])
    with col_back:
        if len(camino) > 1 and st.button("◀ Atrás", key="btn_atras"):
            camino.pop()
            st.session_state.camino_fotos = camino
            st.rerun()
    with col_root:
        if len(camino) > 1 and st.button("🏠 Inicio", key="btn_inicio"):
            camino = [{"name": "EQUIPOS", "id": CARPETA_EQUIPOS_REAL_ID}]
            st.session_state.camino_fotos = camino
            st.rerun()

    bread = " › ".join([f'📁 {c["name"]}' for c in camino])
    st.markdown(f'<div style="background:#111827;border:1px solid #1e2d45;border-radius:7px;padding:6px 12px;margin-bottom:14px;font-family:monospace;font-size:.68rem;">📍 {bread}</div>', unsafe_allow_html=True)

    current_id = camino[-1]["id"]

    # Subcarpetas
    try:
        carpetas = navegar_carpetas(current_id, drive)
        if carpetas:
            st.markdown('<div style="font-size:.7rem;color:#7a8ba8;margin-bottom:8px;">📂 Subcarpetas:</div>', unsafe_allow_html=True)
            items = list(carpetas.items())
            cols = st.columns(4)
            for i, (nom, fid) in enumerate(items):
                with cols[i % 4]:
                    if st.button(f"📁 {nom}", key=f"folder_{fid}", use_container_width=True):
                        camino.append({"name": nom, "id": fid})
                        st.session_state.camino_fotos = camino
                        st.rerun()
            st.caption(f"📁 Total: {len(carpetas)} subcarpetas")
    except Exception as e:
        st.error(f"Error al navegar carpetas: {e}")

    # Imágenes
    try:
        imagenes = obtener_imagenes_carpeta(current_id, drive)
    except Exception as e:
        st.error(f"Error al cargar imágenes: {e}")
        imagenes = []

    # ✅ imgs_sel se inicializa SIEMPRE
    imgs_sel = []

    if imagenes:
        st.markdown(f'<div style="font-size:.7rem;color:#7a8ba8;margin:10px 0 8px;">📸 Imágenes disponibles ({len(imagenes)}):</div>', unsafe_allow_html=True)
        max_imgs = st.session_state.get("max_imgs", 10)
        todas = [i["name"] for i in imagenes]

        seleccionadas = st.multiselect(
            "Seleccionar imágenes para analizar:",
            options=todas,
            default=[i["name"] for i in st.session_state.get("imgs_sel", []) if i["name"] in todas],
            max_selections=max_imgs,
            key="img_selector",
            label_visibility="collapsed"
        )

        # ✅ GUARDAR en session_state
        imgs_sel = [i for i in imagenes if i["name"] in seleccionadas]
        st.session_state.imgs_sel = imgs_sel

        if imgs_sel:
            st.markdown(f'<div style="font-size:.7rem;color:#00c8d7;">✅ {len(imgs_sel)} imágenes seleccionadas</div>', unsafe_allow_html=True)
            with st.expander("🖼️ Ver miniaturas", expanded=False):
                cols_thumb = st.columns(4)
                for i, img_info in enumerate(imgs_sel[:8]):
                    with cols_thumb[i % 4]:
                        thumb = descargar_imagen(img_info["id"], drive, max_dim=150)
                        if thumb:
                            st.image(thumb, caption=img_info["name"][:20], use_container_width=True)
        else:
            st.markdown(f'<div style="font-size:.7rem;color:#ff4757;">⚠️ No hay imágenes seleccionadas</div>', unsafe_allow_html=True)

        col_clear, _ = st.columns([1, 3])
        with col_clear:
            if st.button("🗑️ Limpiar selección", key="clear_selection", use_container_width=True):
                st.session_state.imgs_sel = []
                st.rerun()
    else:
        st.info("📁 No hay imágenes en esta carpeta. Navega a una subcarpeta que contenga fotos.")

    st.markdown("---")

    # ── ÁREA DE ANÁLISIS ──
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">🤖 ANÁLISIS CON IA</div>', unsafe_allow_html=True)

    comentario = st.text_area(
        "📝 Instrucciones adicionales (opcional):",
        placeholder="Ej: Enfocar en las uniones bridadas, revisar el revestimiento interior...",
        height=80,
        key="comentario_inspeccion"
    )

    # ✅ Leer siempre de session_state
    imgs_sel = st.session_state.get("imgs_sel", [])

    if st.button(
        f"🚀 GENERAR ANÁLISIS ({len(imgs_sel)} imágenes)" if imgs_sel else "🚀 GENERAR ANÁLISIS",
        type="primary",
        width='stretch',
        disabled=len(imgs_sel) == 0
    ):
        with st.spinner("📥 Procesando imágenes y consultando Gemini..."):
            imgs_pil = []
            progress_text = st.empty()

            for i, img_info in enumerate(imgs_sel):
                progress_text.text(f"Descargando imagen {i+1}/{len(imgs_sel)}: {img_info['name']}")
                pil = descargar_imagen(img_info["id"], drive, max_dim=st.session_state.get("img_dim", 1024))
                if pil:
                    imgs_pil.append((img_info["name"], pil))

            if not imgs_pil:
                st.error("❌ No se pudieron procesar las imágenes")
                progress_text.empty()
            else:
                progress_text.text("🔍 Analizando con Gemini...")
                texto, estado_det = generar_analisis(
                    equipo_actual,
                    imgs_pil,
                    comentario,
                    historial_actual,
                    "",
                    perfil,
                    conocimiento,
                    few_shots,
                    ANIO_ACTUAL,
                    ANIO_SIG
                )

                if texto and str(texto).strip() and not texto.startswith("ERROR"):
                    st.markdown("---")
                    if estado_det == "BUENO":
                        bc_display = "🟢 BUENO"
                    elif estado_det == "CRÍTICO":
                        bc_display = "🔴 CRÍTICO"
                    else:
                        bc_display = "🟡 REGULAR"

                    st.markdown(f'<div style="margin-bottom:10px;"><span style="background:#1a2236;padding:4px 12px;border-radius:20px;font-size:.7rem;">Estado sugerido: {bc_display}</span></div>', unsafe_allow_html=True)

                    with st.expander("📋 Análisis completo", expanded=True):
                        st.markdown(f'<div style="background:#080f1a;border:1px solid #1e2d45;border-radius:8px;padding:16px;font-size:.82rem;line-height:1.7;white-space:pre-wrap;max-height:400px;overflow-y:auto;">{texto}</div>', unsafe_allow_html=True)

                    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin:16px 0 12px;">✏️ VALIDACIÓN Y GUARDADO</div>', unsafe_allow_html=True)

                    estado_idx = 1
                    if estado_det in ESTADOS:
                        estado_idx = ESTADOS.index(estado_det)

                    estado_final = st.selectbox("Estado final:", ESTADOS, index=estado_idx, key="estado_final")
                    acciones = st.text_area(f"Acciones PGP {ANIO_ACTUAL}:", height=80, key="acciones_input", placeholder="Ej: - Inspección visual completa\n- Registro fotográfico\n- Medición de espesores")
                    diagnostico = st.text_area(f"Diagnóstico PGP {ANIO_ACTUAL}:", height=150, key="diagnostico_input")
                    recomendaciones = st.text_area(f"Recomendaciones PGP {ANIO_SIG}:", height=150, key="recomendaciones_input")

                    col1, col2, col3 = st.columns(3)
                    with col1:
                        if st.button("💾 GUARDAR INSPECCIÓN", type="primary", width='stretch'):
                            if usar_db:
                                equipo_id = equipo_actual.get("id")
                                if equipo_id and guardar_inspeccion_db(equipo_id, ANIO_ACTUAL, estado_final, acciones, diagnostico, recomendaciones):
                                    st.success(f"✅ {equipo_actual.get('equipo', 'Equipo')} actualizado en DB")
                                    st.balloons()
                                    on_guardar(st.session_state.df)  # ✅ llamar callback
                                else:
                                    st.error("Error al guardar en DB")

                    with col2:
                        pdf_bytes = generar_pdf(
                            equipo_actual.get("equipo", "Equipo"),
                            estado_final,
                            acciones,
                            diagnostico,
                            recomendaciones,
                            texto,
                            imgs_pil,
                            perfil,
                            historial_actual
                        )
                        if pdf_bytes:
                            st.download_button(
                                "📄 DESCARGAR INFORME PDF",
                                data=pdf_bytes,
                                file_name=f"INFORME_{equipo_actual.get('equipo', 'Equipo').replace(' ', '_')}_{ANIO_ACTUAL}.pdf",
                                mime="application/pdf",
                                key="download_pdf",
                                width='stretch'
                            )
                        else:
                            st.error("Error al procesar PDF")

                    with col3:
                        if st.button("🔄 NUEVO ANÁLISIS", width='stretch'):
                            st.rerun()
                else:
                    st.error(f"❌ {texto}")
                progress_text.empty()
