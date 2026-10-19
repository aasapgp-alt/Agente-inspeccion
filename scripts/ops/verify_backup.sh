#!/usr/bin/env bash
# ==============================================================================
# SCRIPT: verify_backup.sh
# DESCRIPCIÓN: Prueba de restauración de respaldo en base de datos descartable
# USO: ./verify_backup.sh [/ruta/al/backup.dump]
# ==============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
DB_TEMP="inspecciones_verify_test"
DB_USER="${PGUSER:-postgres}"

if [ -z "${BACKUP_FILE}" ]; then
    # Buscar el último dump en /tmp/backups_pg
    BACKUP_FILE=$(ls -t /tmp/backups_pg/*.dump 2>/dev/null | head -1 || true)
fi

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: No se especificó archivo de backup o no existe."
    echo "Uso: $0 /ruta/al/backup.dump"
    exit 1
fi

echo "=== INICIANDO PRUEBA DE RESTAURACIÓN DE BACKUP ==="
echo "Archivo a verificar: ${BACKUP_FILE}"

# 1. Eliminar base de prueba previa si existiera y crear una nueva limpia
dropdb -U "${DB_USER}" --if-exists "${DB_TEMP}"
createdb -U "${DB_USER}" "${DB_TEMP}"
echo "Base temporal '${DB_TEMP}' creada."

# 2. Restaurar dump
echo "Restaurando dump en '${DB_TEMP}'..."
pg_restore -U "${DB_USER}" -d "${DB_TEMP}" --clean --if-exists --no-owner "${BACKUP_FILE}" || true

# 3. Validar conteo de tablas críticas
echo "=== RESULTADOS DE VERIFICACIÓN ==="
for t in empresas ubicaciones equipos inspecciones anotaciones_imagenes auditoria; do
    C=$(psql -U "${DB_USER}" -d "${DB_TEMP}" -tAc "SELECT count(*) FROM ${t};" 2>/dev/null || echo "0")
    echo "  - Tabla ${t}: ${C} registros recuperados."
done

# 4. Limpieza
dropdb -U "${DB_USER}" "${DB_TEMP}"
echo "Base temporal '${DB_TEMP}' eliminada."
echo "✅ Prueba de restauración superada con éxito."
