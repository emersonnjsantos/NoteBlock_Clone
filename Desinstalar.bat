@echo off
title Desinstalador - Bloco de Notas
echo Removendo atalhos do Bloco de Notas...
powershell -Command "
$Desktop = [System.Environment]::GetFolderPath('Desktop');
$Programs = [System.Environment]::GetFolderPath('Programs');
Remove-Item \"$Desktop\Bloco de Notas.lnk\" -Force -ErrorAction SilentlyContinue;
Remove-Item \"$Programs\Bloco de Notas.lnk\" -Force -ErrorAction SilentlyContinue;
Write-Host 'Atalhos removidos com sucesso!' -ForegroundColor Green;
"
echo.
pause
