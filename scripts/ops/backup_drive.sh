#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: backup_drive.sh
# DESCRIPCIÓN: Respaldo diario de PostgreSQL hacia Google Drive (vía rclone)
# FRECUENCIA SUGERIDA CRON: Diario a las 03:30 (ej: 30 3 * * *)
# ==============================================================================
set -euo pipefail

DB_NAME="${PGDATABASE:-inspecciones}"
DB_USER="${PGUSER:-postgres}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:SULVY-Backups}"
RETENTION_DAYS=30

TS=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/tmp/backups_pg"
OUT_FILE="${BACKUP_DIR}/${DB_NAME}_${TS}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Is)] Iniciando backup de la base de datos '${DB_NAME}'..."
pg_dump -Fc -U "${DB_USER}" -d "${DB_NAME}" -f "${OUT_FILE}"

FILE_SIZE=$(du -h "${OUT_FILE}" | cut -f1)
echo "[$(date -Is)] Dump generado exitosamente: ${OUT_FILE} (${FILE_SIZE})"

# Verificar si rclone está disponible y configurado
if command -v rclone >/dev/null 2>&1; then
    echo "[$(date -Is)] Subiendo a Google Drive (${RCLONE_REMOTE})..."
    rclone copy "${OUT_FILE}" "${RCLONE_REMOTE}/" --progress
    echo "[$(date -Is)] Subida completada."

    # Limpiar backups locales y remotos antiguos
    find "${BACKUP_DIR}" -type f -name "*.dump" -mtime +7 -delete 2>/dev/null || true
    rclone delete --min-age "${RETENTION_DAYS}d" "${RCLONE_REMOTE}/" 2>/dev/null || true
else
    echo "⚠️ rclone no está instalado o en el PATH. El archivo quedó en ${OUT_FILE}"
fi

echo "[$(date -Is)] Proceso de backup finalizado con éxito."
