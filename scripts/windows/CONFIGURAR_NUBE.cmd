@echo off
rem FORMA Studio - configurar modo nube en STAGING (Google + Firestore). Ejecuta configurar-nube.ps1 sin cambiar la politica del sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configurar-nube.ps1" %*
echo.
pause
