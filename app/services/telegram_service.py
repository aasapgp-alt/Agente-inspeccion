import os
import re
import json
import logging
import asyncio
import tempfile
import httpx
from datetime import date, datetime
from typing import Dict, Any, Optional

from app.services import db_service
from app.services import drive_service
from app.services import gemini_service

logger = logging.getLogger(__name__)

# Almacenamiento en memoria para las sesiones de usuario
user_sessions: Dict[int, Dict[str, Any]] = {}
bot_running = False

# Métodos auxiliares de Telegram API
async def send_telegram_request(token: str, method: str, payload: dict) -> Optional[dict]:
    url = f"https://api.telegram.org/bot{token}/{method}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, json=payload)
            if res.status_code == 200:
                return res.json()
            else:
                logger.error(f"Error en Telegram API ({method}): Status {res.status_code} - {res.text}")
    except Exception as e:
        logger.error(f"Excepción en send_telegram_request ({method}): {e}")
    return None

async def send_message(token: str, chat_id: int, text: str, reply_markup: dict = None):
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    res = await send_telegram_request(token, "sendMessage", payload)
    if not res or not res.get("ok"):
        # Fallback sin parse_mode por si falla debido a sintaxis Markdown desequilibrada (ej: _ o *)
        payload.pop("parse_mode", None)
        await send_telegram_request(token, "sendMessage", payload)

async def download_telegram_file(token: str, file_id: str) -> Optional[bytes]:
    # 1. Obtener file_path
    res = await send_telegram_request(token, "getFile", {"file_id": file_id})
    if not res or not res.get("ok"):
        return None
    file_path = res["result"].get("file_path")
    if not file_path:
        return None
        
    # 2. Descargar archivo
    url = f"https://api.telegram.org/file/bot{token}/{file_path}"
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url)
            if response.status_code == 200:
                return response.content
    except Exception as e:
        logger.error(f"Error descargando archivo de Telegram: {e}")
    return None

# Bucle principal de Long Polling
async def start_telegram_bot():
    global bot_running
    if bot_running:
        logger.info("El bot de Telegram ya está corriendo.")
        return
        
    # Intentar obtener el token de base de datos o env
    token = db_service.get_config_value_db("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        logger.warning("No se pudo iniciar el Bot de Telegram: token no configurado.")
        return
        
    bot_running = True
    logger.info("Iniciando Bot de Telegram en modo Long Polling...")
    
    offset = 0
    async with httpx.AsyncClient(timeout=30.0) as client:
        while bot_running:
            try:
                # Comprobar si el token cambió dinámicamente
                current_token = db_service.get_config_value_db("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
                if current_token and current_token != token:
                    logger.info("Cambio de token detectado. Reiniciando bot...")
                    token = current_token
                    offset = 0
                
                url = f"https://api.telegram.org/bot{token}/getUpdates?offset={offset}&timeout=20"
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        for update in data.get("result", []):
                            offset = update["update_id"] + 1
                            asyncio.create_task(handle_update(token, update))
                elif response.status_code == 401:
                    logger.error("Token de Telegram no es válido. Reintentando en 30s...")
                    await asyncio.sleep(30)
            except Exception as e:
                logger.error(f"Error en bucle de Telegram bot: {e}")
            await asyncio.sleep(1)

def stop_telegram_bot():
    global bot_running
    bot_running = False
    logger.info("Bot de Telegram detenido.")

# Manejo de actualizaciones
async def handle_update(token: str, update: dict):
    message = update.get("message")
    callback_query = update.get("callback_query")
    
    if message:
        chat_id = message["chat"]["id"]
        from_user = message["from"]
        telegram_id = from_user["id"]
        
        # Validar si el usuario está registrado/vinculado
        user_info = db_service.obtener_usuario_telegram(telegram_id)
        
        # Iniciar sesión en memoria si no existe
        if chat_id not in user_sessions:
            user_sessions[chat_id] = {
                "state": "IDLE",
                "user_id": user_info["usuario_id"] if user_info else None,
                "username": user_info["username"] if user_info else None,
                "nombre_completo": user_info["nombre_completo"] if user_info else None,
                "equipo_id": None,
                "equipo_codigo": None,
                "equipo_nombre": None,
                "subfolder": "General",
                "chat_history": [],
                "itinerary": [],
                "itinerary_idx": -1
            }
            
        session = user_sessions[chat_id]
        
        # Procesar mensajes de voz (Audio to Text)
        if "voice" in message:
            voice_file_id = message["voice"]["file_id"]
            await send_message(token, chat_id, "🎙️ _Procesando mensaje de voz..._")
            transcripcion = await transcribir_nota_de_voz(token, voice_file_id)
            if transcripcion:
                await send_message(token, chat_id, f"📝 _Entendido:_ \"{transcripcion}\"")
                message["text"] = transcripcion # Reemplazar con el texto transcrito y continuar flujo normal
            else:
                await send_message(token, chat_id, "❌ No se pudo transcribir el audio. Por favor, intenta de nuevo o escribe tu mensaje.")
                return

        # Comando /start con código de vinculación
        text = message.get("text", "").strip()
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            if len(parts) > 1:
                otp = parts[1].strip()
                await procesar_vinculacion(token, chat_id, telegram_id, otp, session)
                return
            else:
                await procesar_start_sin_otp(token, chat_id, session)
                return
                
        # Verificar vinculación para otros comandos
        if not session["user_id"]:
            if text.startswith("/vincular"):
                parts = text.split(maxsplit=1)
                if len(parts) > 1:
                    otp = parts[1].strip()
                    await procesar_vinculacion(token, chat_id, telegram_id, otp, session)
                else:
                    await send_message(token, chat_id, "⚠️ Uso correcto: `/vincular <codigo-de-6-digitos>`")
            else:
                # Intentar vinculación directa por nombre de usuario o correo
                await procesar_vinculacion_directa(token, chat_id, telegram_id, text, session)
            return

        # Flujo de estados del bot
        if session["state"] == "CHAT_GEMINI":
            if text.lower() in ("/salir", "salir", "/stop", "salir del chat"):
                session["state"] = "IDLE"
                session["chat_history"] = []
                eq_id = session.get("equipo_id")
                if eq_id:
                    equipo = db_service.obtener_equipo_db(eq_id)
                    if equipo:
                        await mostrar_detalle_equipo(token, chat_id, equipo, session)
                        return
                await send_message(token, chat_id, "👋 Saliste del chat técnico.", menu_principal_reply_keyboard())
            else:
                await procesar_chat_gemini(token, chat_id, text, session)
            return

        if session["state"] == "INSPECTION_UPLOAD":
            if "photo" in message:
                photo_file_id = message["photo"][-1]["file_id"] # Usar la resolución más alta
                await procesar_subida_foto(token, chat_id, photo_file_id, session)
            elif text.lower() in ("/salir", "salir", "finalizar", "finalizar carga", "terminar", "/stop"):
                session["state"] = "IDLE"
                # Si venía de un itinerario, marcar como completado
                if session.get("itinerary") and session["itinerary_idx"] >= 0:
                    eq = session["itinerary"][session["itinerary_idx"]]
                    db_service.actualizar_estado_itinerario(session["user_id"], date.today().isoformat(), eq["equipo_id"], "COMPLETADO")
                    await send_message(token, chat_id, f"✅ Inspección finalizada para *{eq['codigo']}*. Estado actualizado en la ruta.")
                    await mostrar_itinerario(token, chat_id, session)
                else:
                    eq_id = session.get("equipo_id")
                    if eq_id:
                        equipo = db_service.obtener_equipo_db(eq_id)
                        if equipo:
                            await send_message(token, chat_id, "✅ Carga de fotos finalizada.")
                            await mostrar_detalle_equipo(token, chat_id, equipo, session)
                            return
                    await send_message(token, chat_id, "✅ Carga de fotos finalizada.", menu_principal_reply_keyboard())
            else:
                await send_message(token, chat_id, "📸 Por favor, envía una o más fotos para el equipo seleccionado.\nCuando termines, escribe `/salir` o presiona el botón para finalizar.", keyboard_finalizar_inspeccion())
            return

        if session["state"] == "SEARCH_WAITING":
            if text.lower() in ("/salir", "salir", "/stop", "cancelar"):
                session["state"] = "IDLE"
                await send_message(token, chat_id, "🔍 Búsqueda cancelada.", menu_principal_reply_keyboard())
            else:
                session["state"] = "IDLE"
                await buscar_equipos(token, chat_id, text)
            return

        # Comandos generales y Reply Keyboard
        text_lower = text.lower()
        if text.startswith("/itinerario") or text_lower in ("itinerario", "📅 mi itinerario de hoy", "itinerario de hoy", "mi itinerario de hoy"):
            await mostrar_itinerario(token, chat_id, session)
        elif text == "🔍 Buscar Equipo" or text_lower in ("buscar equipo", "🔍 buscar equipo") or text == "/buscar":
            session["state"] = "SEARCH_WAITING"
            await send_message(token, chat_id, "🔍 *Búsqueda de Equipos:*\n\nPor favor, escribe el **código** (ej: `621-502`) o **nombre** del equipo que deseas consultar:")
        elif text.startswith("/buscar ") or text_lower.startswith("buscar "):
            parts = text.split(maxsplit=1)
            query = parts[1].strip() if len(parts) > 1 else ""
            await buscar_equipos(token, chat_id, query)
        elif text.startswith("/ayuda") or text_lower in ("ayuda", "❓ ayuda / comandos", "ayuda / comandos") or text.startswith("/help"):
            await mostrar_ayuda(token, chat_id)
        elif text.startswith("/cuenta") or text_lower in ("mi cuenta", "🔑 mi cuenta / vincular", "mi cuenta / vincular") or text == "/vincular":
            await mostrar_info_cuenta(token, chat_id, session)
        elif text.startswith("/salir"):
            session["state"] = "IDLE"
            await send_message(token, chat_id, "Estás en el menú principal.", menu_principal_reply_keyboard())
        else:
            # Si el texto coincide con un código de equipo exacto
            equipo = obtener_equipo_por_codigo(text)
            if equipo:
                await mostrar_detalle_equipo(token, chat_id, equipo, session)
            else:
                await send_message(token, chat_id, "Comando o código no reconocido. ¿Qué deseas hacer?", menu_principal_reply_keyboard())

    elif callback_query:
        chat_id = callback_query["message"]["chat"]["id"]
        data = callback_query["data"]
        callback_id = callback_query["id"]
        
        session = user_sessions.get(chat_id)
        if not session or not session["user_id"]:
            await send_telegram_request(token, "answerCallbackQuery", {"callback_query_id": callback_id, "text": "Sesión no válida"})
            return
            
        await send_telegram_request(token, "answerCallbackQuery", {"callback_query_id": callback_id})
        
        if data.startswith("details_"):
            eq_id = int(data.split("_")[1])
            equipo = db_service.obtener_equipo_db(eq_id)
            if equipo:
                await mostrar_detalle_equipo(token, chat_id, equipo, session)
            else:
                await send_message(token, chat_id, "❌ Equipo no encontrado.")
        elif data.startswith("inspect_"):
            eq_id = int(data.split("_")[1])
            await iniciar_inspeccion_equipo(token, chat_id, eq_id, session)
        elif data.startswith("select_subfolder_"):
            parts = data.split("_")
            eq_id = int(parts[2])
            sub = parts[3]
            await confirmar_subcarpeta_inspeccion(token, chat_id, eq_id, sub, session)
        elif data.startswith("chat_"):
            eq_id = int(data.split("_")[1])
            await iniciar_chat_gemini(token, chat_id, eq_id, session)
        elif data.startswith("historial_"):
            eq_id = int(data.split("_")[1])
            await mostrar_historial_equipo(token, chat_id, eq_id)
        elif data == "menu_principal":
            session["state"] = "IDLE"
            await send_message(token, chat_id, "🏠 *Menú Principal*", menu_principal_reply_keyboard())
        elif data == "ver_itinerario":
            await mostrar_itinerario(token, chat_id, session)
        elif data == "buscar_equipo":
            session["state"] = "SEARCH_WAITING"
            await send_message(token, chat_id, "🔍 *Búsqueda de Equipos:*\n\nPor favor, escribe el **código** (ej: `621-502`) o **nombre** del equipo que deseas consultar:")
        elif data == "siguiente_itinerario":
            # Avanzar en el itinerario
            session["itinerary_idx"] += 1
            if session["itinerary_idx"] < len(session["itinerary"]):
                next_eq = session["itinerary"][session["itinerary_idx"]]
                await iniciar_inspeccion_equipo(token, chat_id, next_eq["equipo_id"], session)
            else:
                await send_message(token, chat_id, "🎉 ¡Has completado todos los equipos de tu itinerario de hoy!", menu_principal_reply_keyboard())

# Lógica del flujo
async def transcribir_nota_de_voz(token: str, file_id: str) -> Optional[str]:
    try:
        audio_bytes = await download_telegram_file(token, file_id)
        if not audio_bytes:
            return None
            
        # Transcribir usando Gemini pasándole los bytes directamente
        # Google Gemini acepta audio/ogg que es el formato de Telegram (.oga/.ogg)
        transcripcion = gemini_service.chat_inspeccion(
            mensaje="Por favor, transcribir este audio a texto de manera exacta. No agregues saludos, explicaciones ni comentarios. Solo escribe la transcripción exacta.",
            historial_chat=[
                {
                    "role": "user",
                    "parts": [
                        {"mime_type": "audio/ogg", "data": audio_bytes},
                        "Transcribe este audio."
                    ]
                }
            ]
        )
        # Limpiar posibles envoltorios
        transcripcion = transcripcion.strip()
        if "error" in transcripcion.lower() or len(transcripcion) == 0:
            return None
        return transcripcion
    except Exception as e:
        logger.error(f"Error en transcripción de audio: {e}")
        return None

async def procesar_vinculacion(token: str, chat_id: int, telegram_id: int, otp: str, session: dict):
    usuario_id = db_service.validar_otp_telegram(otp)
    if usuario_id:
        success = db_service.vincular_usuario_telegram(telegram_id, chat_id, usuario_id)
        if success:
            user_info = db_service.obtener_usuario_telegram(telegram_id)
            session["user_id"] = user_info["usuario_id"]
            session["username"] = user_info["username"]
            session["nombre_completo"] = user_info["nombre_completo"]
            await send_message(token, chat_id, f"🎉 *¡Vinculación Exitosa!*\n\nBienvenido, *{session['nombre_completo']}* al sistema de Agente Inspector.", menu_principal_reply_keyboard())
        else:
            await send_message(token, chat_id, "❌ Ocurrió un error al guardar la vinculación en la base de datos.")
    else:
        await send_message(token, chat_id, "❌ El código de vinculación no es válido o ha expirado. Por favor genera uno nuevo en la web.")

async def procesar_vinculacion_directa(token: str, chat_id: int, telegram_id: int, input_text: str, session: dict):
    from app.services.db_service import get_db_connection
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("""
                SELECT id, username, nombre_completo, email 
                FROM usuarios 
                WHERE (username = ? OR email = ?) AND activo = 1
            """, (input_text, input_text))
            user = cursor.fetchone()
            
            if user:
                # Verificar si ya está vinculado
                cursor_tg = conn.execute("SELECT telegram_id FROM usuarios_telegram WHERE usuario_id = ?", (user["id"],))
                linked = cursor_tg.fetchone()
                if linked:
                    await send_message(token, chat_id, f"⚠️ El usuario *{user['nombre_completo']}* ya está vinculado a otra cuenta de Telegram.")
                else:
                    # Vincular
                    db_service.vincular_usuario_telegram(telegram_id, chat_id, user["id"])
                    session["user_id"] = user["id"]
                    session["username"] = user["username"]
                    session["nombre_completo"] = user["nombre_completo"]
                    await send_message(token, chat_id, f"🎉 *¡Vinculación Directa Exitosa!*\n\nTu Telegram ha sido vinculado al usuario *{user['nombre_completo']}* ({user['username']}).", menu_principal_reply_keyboard())
            else:
                await send_message(
                    token, 
                    chat_id, 
                    f"🔒 *Cuenta no vinculada*\n\n"
                    f"No encontramos ningún usuario activo en el sistema con el nombre de usuario o correo: *{input_text}*.\n\n"
                    f"Por favor, escribe tu nombre de usuario registrado (ej: `admin`) o tu correo (ej: `admin@empresa.com`) para vincularte directamente."
                )
    except Exception as e:
        logger.error(f"Error en procesar_vinculacion_directa: {e}")
        await send_message(token, chat_id, "❌ Ocurrió un error al procesar la vinculación directa.")

async def procesar_start_sin_otp(token: str, chat_id: int, session: dict):
    if session["user_id"]:
        await send_message(token, chat_id, f"Hola de nuevo, *{session['nombre_completo']}*.\n\n¿En qué puedo ayudarte hoy?", menu_principal_reply_keyboard())
    else:
        await send_message(token, chat_id, "👋 *¡Hola!*\n\nBienvenido al bot de **Agente Inspector PGP**.\n\nTu cuenta de Telegram no está vinculada. Por favor, escribe tu nombre de usuario del sistema (ej: `admin`) o tu correo registrado (ej: `admin@empresa.com`) para vincularte directamente de forma rápida.\n\nTambién puedes usar el código de vinculación generado en la web con el comando `/vincular <codigo>`.")

async def mostrar_itinerario(token: str, chat_id: int, session: dict):
    hoy = date.today().isoformat()
    itinerario = db_service.obtener_itinerario_diario(session["user_id"], hoy)
    session["itinerary"] = itinerario
    session["itinerary_idx"] = -1
    
    if not itinerario:
        await send_message(token, chat_id, f"📅 No tienes un itinerario de inspección programado para hoy (*{hoy}*).\n\nUsa `/buscar <código>` para inspeccionar un equipo individualmente.", menu_principal_reply_keyboard())
        return
        
    mensaje = f"📅 *Ruta de Inspección de Hoy ({hoy}):*\n\n"
    botones = []
    
    for idx, eq in enumerate(itinerario, 1):
        estado_icono = "🔴 Pendiente"
        if eq["estado"] == "COMPLETADO":
            estado_icono = "🟢 Completado"
        elif eq["estado"] == "OMITIDO":
            estado_icono = "⚪ Omitido"
            
        mensaje += f"{idx}. *{eq['codigo']}* - {eq['nombre']}\n   Estado: {estado_icono}\n\n"
        
        if eq["estado"] == "PENDIENTE":
            botones.append([{"text": f"▶️ Detalle/Inspeccionar {eq['codigo']}", "callback_data": f"details_{eq['equipo_id']}"}])
            
    # Teclado inline
    reply_markup = {"inline_keyboard": botones} if botones else None
    if not reply_markup:
        await send_message(token, chat_id, mensaje + "🎉 ¡Has completado todo el itinerario de hoy!", menu_principal_keyboard())
    else:
        await send_message(token, chat_id, mensaje + "Selecciona un equipo para comenzar:", reply_markup)

async def buscar_equipos(token: str, chat_id: int, query: str):
    if not query:
        await send_message(token, chat_id, "🔍 Escribe el término de búsqueda.\nEjemplo: `/buscar ventilador` o `/buscar 621-502`")
        return
        
    # Obtener lista de equipos
    from app.services.db_service import get_db_connection
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("""
                SELECT e.id, e.codigo, e.nombre, u.nombre as area
                FROM equipos e
                LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
                WHERE e.activo = 1 AND (e.codigo LIKE ? OR e.nombre LIKE ? OR u.nombre LIKE ?)
                LIMIT 5
            """, (f"%{query}%", f"%{query}%", f"%{query}%"))
            rows = cursor.fetchall()
    except Exception as e:
        logger.error(f"Error buscando equipos: {e}")
        rows = []
        
    if not rows:
        await send_message(token, chat_id, f"🔍 No se encontraron equipos para: *{query}*")
        return
        
    if len(rows) == 1:
        # Mostrar el detalle del equipo directamente
        await mostrar_detalle_equipo(token, chat_id, dict(rows[0]), user_sessions[chat_id])
    else:
        mensaje = "🔍 *Equipos Encontrados:*\nSelecciona uno de la lista:"
        botones = []
        for r in rows:
            botones.append([{"text": f"{r['codigo']} - {r['nombre'][:25]}", "callback_data": f"details_{r['id']}"}])
        await send_message(token, chat_id, mensaje, {"inline_keyboard": botones})

def obtener_equipo_por_codigo(codigo: str) -> Optional[dict]:
    from app.services.db_service import get_db_connection
    try:
        with get_db_connection() as conn:
            cursor = conn.execute("""
                SELECT e.*, u.nombre as area, emp.nombre as empresa
                FROM equipos e
                LEFT JOIN ubicaciones u ON e.ubicacion_id = u.id
                LEFT JOIN empresas emp ON u.empresa_id = emp.id
                WHERE e.activo = 1 AND e.codigo = ?
            """, (codigo,))
            row = cursor.fetchone()
            return dict(row) if row else None
    except Exception as e:
        logger.error(f"Error obteniendo equipo por código: {e}")
        return None

async def mostrar_detalle_equipo(token: str, chat_id: int, equipo: dict, session: dict):
    # Actualizar la sesión con el equipo actual
    session["equipo_id"] = equipo["id"]
    session["equipo_codigo"] = equipo["codigo"]
    session["equipo_nombre"] = equipo["nombre"]
    
    mensaje = (
        f"📋 *Ficha de Equipo:*\n\n"
        f"🔹 *Código*: {equipo['codigo']}\n"
        f"🔹 *Nombre*: {equipo['nombre']}\n"
        f"🔹 *Área*: {equipo.get('area', 'N/A')}\n"
        f"🔹 *Estado PGP*: {equipo.get('estado_actual', 'PENDIENTE')}\n"
        f"🔹 *Material*: {equipo.get('material', 'N/A')}\n"
        f"🔹 *Fluido*: {equipo.get('fluido', 'N/A')}\n"
    )
    
    # Obtener el último diagnóstico
    historial = db_service.obtener_historial_equipo_db(equipo["id"])
    if historial:
        ultimo = historial[0]
        mensaje += f"\n📝 *Último Diagnóstico ({ultimo.get('campania', 'PGP')})*:\n_{ultimo.get('diagnostico', 'Sin diagnóstico registrado')}_"
        
    botones = [
        [
            {"text": "📸 Subir Fotos", "callback_data": f"inspect_{equipo['id']}"},
            {"text": "💬 Consultar IA (Gemini)", "callback_data": f"chat_{equipo['id']}"}
        ],
        [
            {"text": "📜 Historial Completo", "callback_data": f"historial_{equipo['id']}"}
        ],
        [
            {"text": "📅 Itinerario", "callback_data": "ver_itinerario"},
            {"text": "🏠 Menú Principal", "callback_data": "menu_principal"}
        ]
    ]
    await send_message(token, chat_id, mensaje, {"inline_keyboard": botones})

async def iniciar_inspeccion_equipo(token: str, chat_id: int, eq_id: int, session: dict):
    # Cargar datos del equipo
    equipo = db_service.obtener_equipo_db(eq_id)
    if not equipo:
        await send_message(token, chat_id, "❌ Equipo no encontrado.")
        return
        
    session["equipo_id"] = equipo["id"]
    session["equipo_codigo"] = equipo["codigo"]
    session["equipo_nombre"] = equipo["nombre"]
    
    # Si estaba en un itinerario, registrar qué índice es para poder avanzar
    if session.get("itinerary"):
        for i, eq in enumerate(session["itinerary"]):
            if eq["equipo_id"] == eq_id:
                session["itinerary_idx"] = i
                break
                
    # Intentar obtener subcarpetas reales del equipo en Drive
    campania = db_service.get_config_value_db("reporte_campania", "PGP 2026")
    area_folder_id = drive_service.buscar_carpeta_area_por_nombre(equipo.get("area", ""))
    sugeridas = drive_service.sugerir_carpetas(equipo["codigo"], equipo["nombre"], area_folder_id) if area_folder_id else []
    eq_folder_id = sugeridas[0]["id"] if (sugeridas and sugeridas[0].get("match_score", 0) > 1.5) else None
    
    subcarpetas_existentes = []
    if eq_folder_id:
        camp_folder_id = drive_service.buscar_carpeta(campania, eq_folder_id)
        if camp_folder_id:
            subcarpetas_existentes = drive_service.listar_carpetas(camp_folder_id)
            
    mensaje = f"📸 *Subir fotos para {equipo['codigo']} ({campania}):*\nSelecciona en qué subcarpeta deseas cargar las imágenes:"
    
    botones = []
    if subcarpetas_existentes:
        row = []
        for sf in subcarpetas_existentes[:4]:
            t = sf["title"]
            icono = "📥" if "succ" in drive_service._normalizar_texto(t) else ("📤" if "imp" in drive_service._normalizar_texto(t) else "📂")
            row.append({"text": f"{icono} {t[:22]}", "callback_data": f"select_subfolder_{eq_id}_{t}"})
            if len(row) == 2:
                botones.append(row)
                row = []
        if row:
            botones.append(row)
    else:
        botones = [
            [
                {"text": "📥 Succión", "callback_data": f"select_subfolder_{eq_id}_Succión"},
                {"text": "📤 Impulsión", "callback_data": f"select_subfolder_{eq_id}_Impulsión"}
            ]
        ]
    botones.append([{"text": "📂 Carpeta Raíz de Campaña", "callback_data": f"select_subfolder_{eq_id}_General"}])
    await send_message(token, chat_id, mensaje, {"inline_keyboard": botones})

async def confirmar_subcarpeta_inspeccion(token: str, chat_id: int, eq_id: int, sub: str, session: dict):
    session["subfolder"] = sub
    session["state"] = "INSPECTION_UPLOAD"
    
    await send_message(
        token, 
        chat_id, 
        f"📸 *Modo Carga Activo: {session['equipo_codigo']} -> {sub}*\n\n"
        f"Envía las fotos. Puedes enviar múltiples fotos juntas.\n"
        f"Cuando termines, presiona *Finalizar Carga*.",
        keyboard_finalizar_inspeccion()
    )

async def procesar_subida_foto(token: str, chat_id: int, file_id: str, session: dict):
    # 1. Descargar foto de Telegram
    await send_message(token, chat_id, "⏳ Descargando imagen de Telegram...")
    img_data = await download_telegram_file(token, file_id)
    if not img_data:
        await send_message(token, chat_id, "❌ Error al descargar la foto. Intenta de nuevo.")
        return
        
    # 2. Resolver o crear la estructura en Google Drive
    await send_message(token, chat_id, "📂 Buscando/Creando carpeta en Google Drive...")
    
    # Obtener campaña activa configurada
    campania = db_service.get_config_value_db("reporte_campania", "PGP 2026")
    
    # Lógica de resolución de carpeta destino en Drive
    folder_id, path_breadcrumb = await resolver_o_crear_carpeta_destino_drive(
        equipo_id=session["equipo_id"],
        codigo=session["equipo_codigo"],
        nombre=session["equipo_nombre"],
        campania=campania,
        subcarpeta=session["subfolder"]
    )
    
    if not folder_id:
        await send_message(token, chat_id, "❌ No se pudo resolver la carpeta de Google Drive. Se guardará localmente.")
        folder_id = "local"
        path_breadcrumb = "Almacenamiento Local"
        
    # 3. Subir foto
    filename = f"telegram_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(img_data)
        tmp_path = tmp.name
        
    try:
        if folder_id != "local":
            res_upload = drive_service.subir_archivo(tmp_path, filename, folder_id)
            drive_file_id = res_upload.get("id")
        else:
            drive_file_id = "local_mock_id"
            
        # 4. Guardar en memoria de imágenes de la inspección
        from app.services.memory_service import obtener_memoria_imagenes, guardar_memoria_imagenes
        lista_imagenes = obtener_memoria_imagenes(session["equipo_id"])
        if drive_file_id not in lista_imagenes:
            lista_imagenes.append(drive_file_id)
            guardar_memoria_imagenes(session["equipo_id"], lista_imagenes)
            
        mensaje_exito = (
            f"✅ *Foto subida con éxito:*\n`{filename}`\n\n"
            f"📍 *Ubicación en Google Drive:*\n`{path_breadcrumb}`"
        )
        await send_message(token, chat_id, mensaje_exito)
    except Exception as e:
        logger.error(f"Error subiendo foto a Drive: {e}")
        await send_message(token, chat_id, "❌ Error al subir la foto a Google Drive.")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

async def resolver_o_crear_carpeta_destino_drive(equipo_id: int, codigo: str, nombre: str, campania: str, subcarpeta: str) -> tuple[Optional[str], str]:
    # 1. Obtener la carpeta raíz del PGP
    root_folder_id = db_service.get_config_value_db("drive_folder_id") or "root"
    
    # 2. Obtener el área del equipo
    equipo = db_service.obtener_equipo_db(equipo_id)
    if not equipo:
        return None, "Equipo no encontrado"
    area_nombre = equipo.get("area")
    if not area_nombre:
        return root_folder_id, drive_service.obtener_ruta_breadcrumb(root_folder_id)
        
    # 3. Buscar la carpeta del Área
    area_folder_id = drive_service.buscar_carpeta_area_por_nombre(area_nombre)
    if not area_folder_id:
        # Si no existe, crearla en la raíz
        area_folder_id = drive_service.obtener_o_crear_carpeta_drive(area_nombre, root_folder_id)
        
    # 4. Buscar la carpeta del Equipo bajo el área
    eq_folder_id = None
    sugeridas = drive_service.sugerir_carpetas(codigo, nombre, area_folder_id)
    for s in sugeridas:
        if s.get("match_score", 0) > 1.5:
            eq_folder_id = s["id"]
            break
            
    # Si no se encuentra, crear la estructura completa del equipo
    if not eq_folder_id:
        res_drive = drive_service.crear_estructura_equipo(
            parent_id=area_folder_id,
            nombre_equipo=f"{codigo} {nombre}",
            campanias=[campania],
            subcarpetas=["Succión", "Impulsión"]
        )
        eq_folder_id = res_drive.get("id")
        
    # 5. Resolver carpeta de campaña (ej: PGP 2026) bajo el equipo
    camp_folder_id = drive_service.obtener_o_crear_carpeta_drive(campania, eq_folder_id)
    
    # 6. Resolver subcarpeta buscando coincidencias flexibles en carpetas existentes
    final_folder_id = camp_folder_id
    if subcarpeta and subcarpeta != "General":
        sub_existentes = drive_service.listar_carpetas(camp_folder_id)
        sub_target_norm = drive_service._normalizar_texto(subcarpeta)
        match_sub_id = None
        for sf in sub_existentes:
            sf_norm = drive_service._normalizar_texto(sf['title'])
            if sub_target_norm in sf_norm or sf_norm in sub_target_norm:
                match_sub_id = sf['id']
                break
        if match_sub_id:
            final_folder_id = match_sub_id
        else:
            final_folder_id = drive_service.obtener_o_crear_carpeta_drive(subcarpeta, camp_folder_id)
            
    path_breadcrumb = drive_service.obtener_ruta_breadcrumb(final_folder_id)
    return final_folder_id, path_breadcrumb

# Chat con Gemini
async def iniciar_chat_gemini(token: str, chat_id: int, eq_id: int, session: dict):
    equipo = db_service.obtener_equipo_db(eq_id)
    if not equipo:
        await send_message(token, chat_id, "❌ Equipo no encontrado.")
        return
        
    session["equipo_id"] = equipo["id"]
    session["equipo_codigo"] = equipo["codigo"]
    session["equipo_nombre"] = equipo["nombre"]
    session["state"] = "CHAT_GEMINI"
    
    # Obtener historial del equipo
    historial = db_service.obtener_historial_equipo_db(eq_id)
    historial_str = ""
    for h in historial[:3]:
        historial_str += f"- Campaña {h.get('campania')}: Estado {h.get('estado')}. Diagnóstico: {h.get('diagnostico')}\n"
        
    # Prompt de inicialización del chat
    prompt_inicial = (
        f"Contexto del equipo industrial:\n"
        f"Código: {equipo['codigo']}\n"
        f"Nombre: {equipo['nombre']}\n"
        f"Área: {equipo.get('area')}\n"
        f"Material: {equipo.get('material')}\n"
        f"Fluido: {equipo.get('fluido')}\n"
        f"Presión: {equipo.get('presion_diseno')} bar, Temp: {equipo.get('temperatura_diseno')} C\n"
        f"Historial:\n{historial_str}\n"
        f"Instrucción para la IA: El inspector está parado frente al equipo. Responde dudas del inspector acerca de qué fotos representativas tomar y qué zonas buscar posibles daños (fisuras, corrosión, delaminación, etc.). Responde de forma muy técnica, precisa y concisa, en español."
    )
    
    # Guardar contexto inicial en la historia del chat
    session["chat_history"] = [
        {"role": "user", "parts": [prompt_inicial]},
        {"role": "model", "parts": ["Entendido. Estoy listo para guiarte en la inspección de este equipo. ¿Qué dudas tienes o qué estás observando actualmente?"]}
    ]
    
    await send_message(
        token, 
        chat_id, 
        f"💬 *Chat con Gemini para {equipo['codigo']} Activo*\n\n"
        f"Puedes escribirme tus dudas o enviar mensajes de voz.\n"
        f"Ejemplo: _\"¿Qué fotos le tomo a este ventilador?\"_\n\n"
        f"Escribe `/salir` para terminar el chat.",
        {"keyboard": [[{"text": "Salir del Chat"}]], "resize_keyboard": True}
    )

async def procesar_chat_gemini(token: str, chat_id: int, text: str, session: dict):
    if text.lower() in ("salir del chat", "salir", "/salir"):
        session["state"] = "IDLE"
        session["chat_history"] = []
        await send_message(token, chat_id, "👋 Saliste del chat técnico.", menu_principal_keyboard())
        return
        
    # Añadir pregunta del usuario
    session["chat_history"].append({"role": "user", "parts": [text]})
    
    await send_telegram_request(token, "sendChatAction", {"chat_id": chat_id, "action": "typing"})
    
    try:
        # Llamar a la IA
        respuesta = gemini_service.chat_inspeccion(text, session["chat_history"][:-1])
        session["chat_history"].append({"role": "model", "parts": [respuesta]})
        await send_message(token, chat_id, respuesta)
    except Exception as e:
        logger.error(f"Error en chat con Gemini: {e}")
        await send_message(token, chat_id, "❌ Lo siento, ocurrió un error al comunicarme con Gemini.")

async def mostrar_historial_equipo(token: str, chat_id: int, eq_id: int):
    equipo = db_service.obtener_equipo_db(eq_id)
    historial = db_service.obtener_historial_equipo_db(eq_id)
    
    if not equipo:
        await send_message(token, chat_id, "❌ Equipo no encontrado.")
        return
        
    if not historial:
        await send_message(token, chat_id, f"📜 No hay historial registrado para el equipo *{equipo['codigo']}*.")
        return
        
    mensaje = f"📜 *Historial de {equipo['codigo']}:*\n\n"
    for idx, h in enumerate(historial, 1):
        mensaje += (
            f"📅 *Campaña {h.get('campania', 'N/A')}*\n"
            f"   *Estado*: {h.get('estado', 'N/A')}\n"
            f"   *Diagnóstico*: {h.get('diagnostico', 'N/A')}\n"
            f"   *Recomendaciones*: {h.get('recomendaciones', 'N/A')}\n\n"
        )
    
    botones = [
        [
            {"text": "📸 Iniciar Inspección", "callback_data": f"inspect_{eq_id}"},
            {"text": "📋 Ficha de Equipo", "callback_data": f"details_{eq_id}"}
        ]
    ]
    await send_message(token, chat_id, mensaje, {"inline_keyboard": botones})

# Teclados dinámicos
def menu_principal_keyboard() -> dict:
    return {
        "inline_keyboard": [
            [
                {"text": "📅 Itinerario de Hoy", "callback_data": "ver_itinerario"}
            ],
            [
                {"text": "🔍 Buscar Equipo", "callback_data": "buscar_equipo"}
            ]
        ]
    }

def menu_principal_reply_keyboard() -> dict:
    return {
        "keyboard": [
            [
                {"text": "📅 Mi Itinerario de Hoy"},
                {"text": "🔍 Buscar Equipo"}
            ],
            [
                {"text": "❓ Ayuda / Comandos"},
                {"text": "🔑 Mi Cuenta / Vincular"}
            ]
        ],
        "resize_keyboard": True,
        "persistent": True
    }

async def mostrar_ayuda(token: str, chat_id: int):
    ayuda = (
        "❓ *Guía de Uso del Bot de Inspección PGP*\n\n"
        "Este bot está diseñado para ayudarte a realizar inspecciones de equipos en planta y subir fotos directamente a Google Drive.\n\n"
        "📖 *Opciones del Menú Inferior:*\n"
        "• *📅 Mi Itinerario de Hoy*: Muestra tu ruta diaria de equipos asignada por tu supervisor. Desde allí puedes iniciar la inspección de cada uno.\n"
        "• *🔍 Buscar Equipo*: Permite buscar cualquier máquina en el sistema. Escribe `/buscar <nombre/código>` para encontrarlo.\n"
        "• *🔑 Mi Cuenta / Vincular*: Te muestra la información de tu usuario vinculado, o te ayuda a vincular tu Telegram si aún no lo has hecho.\n"
        "• *❓ Ayuda / Comandos*: Muestra esta guía informativa.\n\n"
        "💬 *Chat con IA (Gemini):*\n"
        "Cuando veas la ficha de un equipo, puedes iniciar un chat técnico. Gemini te guiará sobre qué buscar, qué zonas propensas a fallas inspeccionar y qué fotos tomar.\n\n"
        "🎙️ *Notas de Voz (Audio a Texto):*\n"
        "Puedes presionar el micrófono de Telegram y enviarme un audio. Lo transcribiré automáticamente a texto para que no tengas que escribir en planta."
    )
    await send_message(token, chat_id, ayuda)

async def mostrar_info_cuenta(token: str, chat_id: int, session: dict):
    if session["user_id"]:
        mensaje = (
            "👤 *Información de tu Cuenta:*\n\n"
            f"• *Nombre*: {session['nombre_completo']}\n"
            f"• *Usuario*: @{session['username']}\n"
            "• *Estado*: 🟢 Vinculado correctamente\n\n"
            "Ya estás listo para realizar inspecciones."
        )
        await send_message(token, chat_id, mensaje)
    else:
        mensaje = (
            "🔑 *Vinculación de Cuenta*\n\n"
            "Tu cuenta de Telegram no está vinculada al sistema de inspección.\n\n"
            "👉 *¿Cómo vincularte?*\n"
            "Escribe tu nombre de usuario del sistema (ej: `admin`) o tu correo registrado (ej: `admin@empresa.com`) y te vincularé de inmediato."
        )
        await send_message(token, chat_id, mensaje)

def keyboard_finalizar_inspeccion() -> dict:
    return {
        "keyboard": [
            [{"text": "Finalizar Carga"}]
        ],
        "resize_keyboard": True,
        "one_time_keyboard": True
    }
