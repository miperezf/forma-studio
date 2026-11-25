@echo off
rem FORMA Studio - crear y publicar PRODUCCION (proyecto separado). Ejecuta crear-produccion.ps1 sin cambiar la politica del sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0crear-produccion.ps1" %*
echo.
pause
