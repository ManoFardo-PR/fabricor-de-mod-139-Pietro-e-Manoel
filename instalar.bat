@echo off
chcp 65001 >nul
title Instalador - Super Picareta

echo ============================================
echo   INSTALADOR - Super Picareta
echo   Mod para Minecraft Bedrock Edition
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"

:: Tenta encontrar a pasta do Minecraft automaticamente
:: Caminho 1: Novo launcher (AppData\Roaming)
set "MOJANG=%AppData%\Minecraft Bedrock\Users\Shared\games\com.mojang"
if exist "%MOJANG%\development_behavior_packs" goto :found

:: Caminho 2: Microsoft Store (UWP)
set "MOJANG=%LocalAppData%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
if exist "%MOJANG%" goto :found

:: Caminho 3: Microsoft Store (maiusculo)
set "MOJANG=%LocalAppData%\Packages\MICROSOFT.MINECRAFTUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
if exist "%MOJANG%" goto :found

echo [ERRO] Pasta do Minecraft Bedrock nao encontrada!
echo Verifique se o Minecraft esta instalado.
echo.
pause
exit /b 1

:found
set "BP_DEST=%MOJANG%\development_behavior_packs\Super Picareta BP"
set "RP_DEST=%MOJANG%\development_resource_packs\Super Picareta RP"

echo Pasta do Minecraft encontrada!
echo.

:: Remove versao anterior se existir
if exist "%BP_DEST%" (
    echo Removendo versao anterior do Behavior Pack...
    rmdir /s /q "%BP_DEST%"
)
if exist "%RP_DEST%" (
    echo Removendo versao anterior do Resource Pack...
    rmdir /s /q "%RP_DEST%"
)

:: Copia Behavior Pack
echo Instalando Behavior Pack...
xcopy "%SCRIPT_DIR%Super Picareta BP" "%BP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar Behavior Pack!
    pause
    exit /b 1
)
echo   OK!

:: Copia Resource Pack
echo Instalando Resource Pack...
xcopy "%SCRIPT_DIR%Super Picareta RP" "%RP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar Resource Pack!
    pause
    exit /b 1
)
echo   OK!

echo.
echo ============================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ============================================
echo.
echo Agora no Minecraft:
echo   1. Crie um mundo novo (ou edite um existente)
echo   2. Ative os packs "Super Picareta" no mundo
echo   3. Ative "Beta APIs" nas opcoes experimentais
echo   4. Use: /give @s escavadora:super_picareta
echo.
pause
