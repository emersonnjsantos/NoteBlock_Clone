@echo off
title Instalador - Bloco de Notas
echo ========================================================
echo   Instalando o Bloco de Notas no seu Windows...
echo ========================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0Instalar.ps1"
echo.
echo Pressione qualquer tecla para sair...
pause >nul
