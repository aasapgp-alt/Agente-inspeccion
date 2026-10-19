#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: oracle_reclaim_guard.sh
# DESCRIPCIÓN: Protección contra la reclamación por inactividad de Oracle Always Free
# CRITERIO DE ORACLE: Si en 7 días CPU (P95) < 20%, Red < 20% y Memoria < 20%, 
#                     la instancia es marcada como "idle" y puede ser reclamada.
# USO CRON: Ejecutar diario a las 06:00 (ej: 0 6 * * *)
# ==============================================================================
set -euo pipefail

TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

enviar_alerta() {
    local msg="$1"
    echo "[ALERTA] ${msg}"
    if [ -n "${TELEGRAM_BOT_TOKEN}" ] && [ -n "${TELEGRAM_CHAT_ID}" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}&text=⚠️ [Oracle VPS Guard] ${msg}" >/dev/null 2>&1 || true
    fi
}

# 1. Medir memoria en uso
TOTAL_MEM=$(free -m | awk '/^Mem:/{print $2}')
USED_MEM=$(free -m | awk '/^Mem:/{print $3}')
MEM_PERCENT=$((USED_MEM * 100 / TOTAL_MEM))

echo "[$(date -Is)] Chequeo de salud Oracle Always Free: Memoria en uso = ${MEM_PERCENT}% (${USED_MEM}MB / ${TOTAL_MEM}MB)"

# 2. Si la memoria o actividad es muy baja (temporada baja sin campañas activas),
# generar una carga controlada de CPU durante 3 minutos para asegurar métricas activas
if [ "${MEM_PERCENT}" -lt 20 ]; then
    echo "[$(date -Is)] Memoria < 20%. Ejecutando ciclo de preservación de actividad (3 min)..."
    # Carga de CPU controlada y segura que no satura el sistema (nice + timeout)
    nice -n 19 timeout 180 bash -c 'while true; do :; done' || true
    echo "[$(date -Is)] Ciclo de preservación completado."
fi

# 3. Realizar self-healthcheck al backend local
if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/v1/auth/health 2>/dev/null || curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs 2>/dev/null || echo "000")
    if [ "${HTTP_CODE}" != "200" ]; then
        enviar_alerta "El backend local responde código HTTP ${HTTP_CODE} en vez de 200."
    fi
fi
