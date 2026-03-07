@echo off
chcp 65001 >nul
title Instalador - Mods Pietro e Manoel

echo ============================================
echo   INSTALADOR - Mods Pietro e Manoel
echo   Minecraft Bedrock Edition
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
set "BP_DEST=%MOJANG%\development_behavior_packs\Mods Pietro e Manoel BP"
set "RP_DEST=%MOJANG%\development_resource_packs\Mods Pietro e Manoel RP"

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

:: Instala pack unificado
echo Instalando Behavior Pack...
xcopy "%SCRIPT_DIR%Mods Pietro e Manoel\Mods Pietro e Manoel BP" "%BP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar Behavior Pack!
    pause
    exit /b 1
)
echo   BP - OK!

echo Instalando Resource Pack...
xcopy "%SCRIPT_DIR%Mods Pietro e Manoel\Mods Pietro e Manoel RP" "%RP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao copiar Resource Pack!
    pause
    exit /b 1
)
echo   RP - OK!

echo.
echo ============================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ============================================
echo.
echo Agora no Minecraft:
echo   1. Crie um mundo novo (ou edite um existente)
echo   2. Ative os 2 packs "Mods Pietro e Manoel"
echo   3. Ative "Beta APIs" nas opcoes experimentais
echo.
echo Conteudo do pack:
echo   - Super Picareta (escava tuneis 10x3x6)
echo   - TNT Arremessavel, Bomba Submarina, Pistola Sinalizadora
echo   - Espada de Fogo
echo   - Multiplicador x10 (multiplica itens com diamantes)
echo   - Armadura de Slime (repulsao, saltos, quique!)
echo.
pause
