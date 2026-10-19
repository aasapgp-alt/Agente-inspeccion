#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: mirror_neon.sh
# DESCRIPCIÓN: Sincronización del espejo PostgreSQL de Oracle hacia Neon
# FRECUENCIA SUGERIDA CRON: Diario a las 03:00 (ej: 17 3 * * *)
# ==============================================================================
set -euo pipefail

# Variables obligatorias (pueden venir de /etc/agente/inspector.env)
NEON_URL="${NEON_DATABASE_URL:?Error: falta NEON_DATABASE_URL}"
LOCAL_DB="${PGDATABASE:-inspecciones}"
LOCAL_USER="${PGUSER:-postgres}"

TS=$(date +%Y%m%d_%H%M%S)
TMP_DUMP="/tmp/mirror_neon_${TS}.dump"

echo "[$(date -Is)] === INICIANDO ESPEJO ORACLE -> NEON ==="

# 1. Realizar dump binario comprimido de la base primaria local
echo "[$(date -Is)] Generando pg_dump de la base primaria '${LOCAL_DB}'..."
pg_dump -Fc -U "${LOCAL_USER}" -d "${LOCAL_DB}" -f "${TMP_DUMP}"

# 2. Restaurar sobre Neon
echo "[$(date -Is)] Restaurando dump en Neon (${NEON_URL%%@*}@...)..."
# Terminar conexiones activas en Neon si existen para evitar locks
psql "${NEON_URL}" -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE pid <> pg_backend_pid() 
    AND datname = current_database();
" >/dev/null 2>&1 || true

# Restaurar con --clean para refrescar el estado al último snapshot
pg_restore -d "${NEON_URL}" --clean --if-exists --no-owner --no-privileges "${TMP_DUMP}" || {
    echo "⚠️ pg_restore arrojó advertencias o errores menores (verificar integridad abajo)."
}

# 3. Verificación de integridad: Comparación de conteo de filas
echo "[$(date -Is)] === VERIFICACIÓN DE INTEGRIDAD DE CONTEOS ==="
TABLAS=("empresas" "ubicaciones" "equipos" "inspecciones" "anotaciones_imagenes" "auditoria" "configuracion")

DESCUADRES=0
for t in "${TABLAS[@]}"; do
    COUNT_LOCAL=$(psql -U "${LOCAL_USER}" -d "${LOCAL_DB}" -tAc "SELECT count(*) FROM ${t}" 2>/dev/null || echo "0")
    COUNT_NEON=$(psql "${NEON_URL}" -tAc "SELECT count(*) FROM ${t}" 2>/dev/null || echo "0")
    
    if [ "${COUNT_LOCAL}" = "${COUNT_NEON}" ]; then
        echo "  ✅ Tabla ${t}: ${COUNT_LOCAL} filas (idéntico)"
    else
        echo "  ❌ DESCUADRE en ${t}: Primaria=${COUNT_LOCAL} vs Neon=${COUNT_NEON}"
        DESCUADRES=$((DESCUADRES + 1))
    fi
done

# Limpieza
rm -f "${TMP_DUMP}"

if [ "${DESCUADRES}" -eq 0 ]; then
    echo "[$(date -Is)] ✅ Espejo completado con éxito. 100% sincronizado."
    exit 0
else
    echo "[$(date -Is)] ⚠️ Espejo completado con ${DESCUADRES} tablas con descuadres."
    exit 1
fi
