import streamlit as st
from services.drive_service import navegar_carpetas, obtener_imagenes_carpeta
from services.inspection_service import generar_analisis, iniciar_analisis_chat
from services.gemini_service import enviar_mensaje_chat, extraer_consenso_chat
from services.pdf_service import generar_pdf
from utils.image_utils import descargar_imagen
from config.constants import ANIO_ACTUAL, ANIO_SIG, ESTADOS, CARPETA_EQUIPOS_REAL_ID

def render_inspection_tab(drive, equipo_actual, historial_actual, perfil, conocimiento, few_shots, gemini, on_guardar, usar_db=False):
    

    
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
    st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">🤖 ANÁLISIS Y CHAT CON IA</div>', unsafe_allow_html=True)

    comentario = st.text_area(
        "📝 Instrucciones adicionales iniciales (opcional):",
        placeholder="Ej: Enfocar en las uniones bridadas, revisar el revestimiento interior...",
        height=80,
        key="comentario_inspeccion"
    )

    imgs_sel = st.session_state.get("imgs_sel", [])

    # Inicializar estado del chat
    if "chat_session" not in st.session_state:
        st.session_state.chat_session = None
    if "mensajes_chat" not in st.session_state:
        st.session_state.mensajes_chat = []
    if "draft_diagnostico" not in st.session_state:
        st.session_state.draft_diagnostico = ""
    if "draft_recomendaciones" not in st.session_state:
        st.session_state.draft_recomendaciones = ""
    if "draft_estado" not in st.session_state:
        st.session_state.draft_estado = "REGULAR"

    col_gen, col_clear = st.columns([3, 1])
    with col_gen:
        if st.button(
            f"🚀 INICIAR ANÁLISIS ({len(imgs_sel)} imágenes)" if imgs_sel else "🚀 INICIAR ANÁLISIS",
            type="primary",
            use_container_width=True,
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
                    progress_text.text("🔍 Iniciando conversación con Gemini...")
                    chat_session, texto, estado_det = iniciar_analisis_chat(
                        equipo_actual, imgs_pil, comentario, historial_actual,
                        "", perfil, conocimiento, few_shots, ANIO_ACTUAL, ANIO_SIG
                    )

                    if chat_session and texto and not texto.startswith("ERROR"):
                        st.session_state.chat_session = chat_session
                        st.session_state.mensajes_chat = [{"role": "assistant", "content": texto}]
                        st.session_state.draft_estado = estado_det
                        st.session_state.draft_diagnostico = ""
                        st.session_state.draft_recomendaciones = ""
                    else:
                        st.error(f"❌ {texto}")
                    progress_text.empty()

    with col_clear:
        if st.button("🗑️ Reiniciar Chat", use_container_width=True):
            st.session_state.chat_session = None
            st.session_state.mensajes_chat = []
            st.rerun()

    # Mostrar chat si existe
    if st.session_state.chat_session:
        st.markdown("---")
        st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin-bottom:12px;">💬 CONVERSACIÓN CON EL INSPECTOR IA</div>', unsafe_allow_html=True)
        
        # Historial del chat
        for msg in st.session_state.mensajes_chat:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
        
        # Quick prompts
        st.markdown("<div style='font-size:0.7rem; color:#7a8ba8; margin-top:10px;'>⚡ Preguntas Rápidas:</div>", unsafe_allow_html=True)
        qp1, qp2, qp3 = st.columns(3)
        quick_prompt = None
        if qp1.button("🔍 Enfócate solo en la corrosión", use_container_width=True): quick_prompt = "Por favor, enfócate únicamente en evaluar el nivel de corrosión visible en las imágenes."
        if qp2.button("⚠️ Resume los puntos críticos", use_container_width=True): quick_prompt = "Resume cuáles son los hallazgos más críticos que requieren atención inmediata."
        if qp3.button("🔧 Ignorar defectos de pintura", use_container_width=True): quick_prompt = "Ignora la pintura descascarada superficial, dime si hay daño estructural."

        # Entrada del usuario
        user_input = st.chat_input("Escribe tu pregunta o comentario sobre la inspección...")
        
        # Procesar entrada (manual o quick prompt)
        prompt_a_enviar = user_input or quick_prompt
        
        if prompt_a_enviar:
            st.session_state.mensajes_chat.append({"role": "user", "content": prompt_a_enviar})
            with st.chat_message("user"):
                st.markdown(prompt_a_enviar)
                
            with st.chat_message("assistant"):
                with st.spinner("Pensando..."):
                    respuesta = enviar_mensaje_chat(st.session_state.chat_session, prompt_a_enviar)
                    st.markdown(respuesta)
            st.session_state.mensajes_chat.append({"role": "assistant", "content": respuesta})
            st.rerun()

        st.markdown("---")
        st.markdown('<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:.8rem;font-weight:600;color:#00c8d7;margin:16px 0 12px;">✏️ VALIDACIÓN Y GUARDADO</div>', unsafe_allow_html=True)

        if st.button("🪄 Extraer Borrador Final Automáticamente", type="secondary", use_container_width=True, help="Usa la IA para leer el chat y autocompletar el diagnóstico y las recomendaciones."):
            with st.spinner("Extrayendo consenso del chat..."):
                datos = extraer_consenso_chat(st.session_state.chat_session)
                st.session_state.draft_diagnostico = datos.get("diagnostico", "No se pudo extraer el diagnóstico.")
                st.session_state.draft_recomendaciones = datos.get("recomendaciones", "No se pudieron extraer las recomendaciones.")
                if datos.get("estado") in ESTADOS:
                    st.session_state.draft_estado = datos["estado"]
                st.toast("✅ Formulario autocompletado con éxito.")

        estado_idx = 1
        if st.session_state.draft_estado in ESTADOS:
            estado_idx = ESTADOS.index(st.session_state.draft_estado)

        estado_final = st.selectbox("Estado final:", ESTADOS, index=estado_idx, key="estado_final")
        acciones = st.text_area(f"Acciones PGP {ANIO_ACTUAL}:", height=80, key="acciones_input", placeholder="Ej: - Inspección visual completa\n- Registro fotográfico\n- Medición de espesores")
        diagnostico = st.text_area(f"Diagnóstico PGP {ANIO_ACTUAL}:", value=st.session_state.draft_diagnostico, height=150, key="diagnostico_input")
        recomendaciones = st.text_area(f"Recomendaciones PGP {ANIO_SIG}:", value=st.session_state.draft_recomendaciones, height=150, key="recomendaciones_input")

        col1, col2, col3 = st.columns(3)
        with col1:
            if st.button("💾 GUARDAR INSPECCIÓN", type="primary", use_container_width=True):
                if usar_db:
                    equipo_id = equipo_actual.get("id")
                    if equipo_id and guardar_inspeccion_db(equipo_id, ANIO_ACTUAL, estado_final, acciones, diagnostico, recomendaciones):
                        st.success(f"✅ {equipo_actual.get('equipo', 'Equipo')} actualizado en DB")
                        st.balloons()
                        on_guardar(st.session_state.df)
                    else:
                        st.error("Error al guardar en DB")

        with col2:
            # Para el PDF, usamos el último mensaje de la IA o el chat completo (en este caso enviamos todo como texto)
            texto_pdf = "\n\n".join([f"{'Inspector' if m['role']=='user' else 'IA'}: {m['content']}" for m in st.session_state.mensajes_chat])
            pdf_bytes = generar_pdf(
                equipo_actual.get("equipo", "Equipo"),
                estado_final,
                acciones,
                diagnostico,
                recomendaciones,
                texto_pdf,
                [], # Dummy imgs to save memory
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
                    use_container_width=True
                )
            else:
                st.error("Error al procesar PDF")

        with col3:
            if st.button("🔄 NUEVO ANÁLISIS", use_container_width=True):
                st.session_state.chat_session = None
                st.session_state.mensajes_chat = []
                st.rerun()
