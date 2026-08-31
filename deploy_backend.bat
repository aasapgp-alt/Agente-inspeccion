@echo off
echo ========================================================
echo    DESPLIEGUE AUTOMATICO DE BACKEND AL VPS (ORACLE)
echo ========================================================

echo [1/3] Empaquetando backend...
python scripts\pack_for_deploy.py
if errorlevel 1 (
    echo Error al empaquetar backend.
    pause
    exit /b 1
)

echo.
echo [2/3] Subiendo paquete al VPS...
scp -i "ssh-key-2026-08-26 .key" -o StrictHostKeyChecking=no deploy_backend.tar.gz ubuntu@157.151.18.150:~/deploy_backend.tar.gz
if errorlevel 1 (
    echo Error al transferir por SSH/SCP.
    pause
    exit /b 1
)

echo.
echo [3/3] Aplicando cambios y reiniciando contenedor backend...
ssh -i "ssh-key-2026-08-26 .key" -o StrictHostKeyChecking=no ubuntu@157.151.18.150 "tar -xzf ~/deploy_backend.tar.gz -C ~/ && cp -r ~/app ~/agente-inspector/ && docker restart inspector-backend"
if errorlevel 1 (
    echo Error al reiniciar backend en el VPS.
    pause
    exit /b 1
)

echo.
echo ========================================================
echo   BACKEND DESPLEGADO Y ACTUALIZADO CON EXITO!
echo ========================================================
pause
