# Script de Instalação do Bloco de Notas para Windows
$WshShell = New-Object -ComObject WScript.Shell

# 1. Definir caminhos relativos ao local onde o script está sendo executado
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = (Get-Location).Path }

$TargetExe = Join-Path $ScriptDir "BlocoDeNotas.exe"
$IconPath = Join-Path $ScriptDir "notepad_icon.ico"
$WorkingDir = $ScriptDir

# 1. Criar Atalho na Área de Trabalho (Desktop)
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
$DesktopShortcutPath = Join-Path $DesktopPath "Bloco de Notas.lnk"
$Shortcut = $WshShell.CreateShortcut($DesktopShortcutPath)
$Shortcut.TargetPath = $TargetExe
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Description = "Bloco de Notas - Clone Fiel Windows"
$Shortcut.Save()
Write-Host "[OK] Atalho criado na Area de Trabalho: $DesktopShortcutPath" -ForegroundColor Green

# 2. Criar Atalho no Menu Iniciar (Start Menu)
$ProgramsPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
$StartShortcutPath = Join-Path $ProgramsPath "Bloco de Notas.lnk"
$StartShortcut = $WshShell.CreateShortcut($StartShortcutPath)
$StartShortcut.TargetPath = $TargetExe
$StartShortcut.WorkingDirectory = $WorkingDir
$StartShortcut.IconLocation = "$IconPath,0"
$StartShortcut.Description = "Bloco de Notas - Clone Fiel Windows"
$StartShortcut.Save()
Write-Host "[OK] Atalho criado no Menu Iniciar: $StartShortcutPath" -ForegroundColor Green

Write-Host "`nInstalacao concluida com sucesso! Voce ja pode abrir o Bloco de Notas pelo atalho da Area de Trabalho ou pelo Menu Iniciar." -ForegroundColor Cyan
