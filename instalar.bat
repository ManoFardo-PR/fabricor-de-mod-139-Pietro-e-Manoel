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
set "BP_DIR=%MOJANG%\development_behavior_packs"
set "RP_DIR=%MOJANG%\development_resource_packs"

echo Pasta do Minecraft encontrada!
echo.

:: ============================================
:: PACK 1: Mods Pietro e Manoel (unificado)
:: ============================================
set "BP_DEST=%BP_DIR%\Mods Pietro e Manoel BP"
set "RP_DEST=%RP_DIR%\Mods Pietro e Manoel RP"

echo [1/2] Instalando Mods Pietro e Manoel...

if exist "%BP_DEST%" rmdir /s /q "%BP_DEST%"
if exist "%RP_DEST%" rmdir /s /q "%RP_DEST%"

xcopy "%SCRIPT_DIR%Mods Pietro e Manoel\Mods Pietro e Manoel BP" "%BP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo   [ERRO] Falha ao copiar BP!
    pause
    exit /b 1
)
echo   BP - OK!

xcopy "%SCRIPT_DIR%Mods Pietro e Manoel\Mods Pietro e Manoel RP" "%RP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo   [ERRO] Falha ao copiar RP!
    pause
    exit /b 1
)
echo   RP - OK!
echo.

:: ============================================
:: PACK 2: Cactus Zumbi
:: ============================================
set "CZ_BP_DEST=%BP_DIR%\Cactus Zumbi BP"
set "CZ_RP_DEST=%RP_DIR%\Cactus Zumbi RP"

echo [2/2] Instalando Cactus Zumbi...

if exist "%CZ_BP_DEST%" rmdir /s /q "%CZ_BP_DEST%"
if exist "%CZ_RP_DEST%" rmdir /s /q "%CZ_RP_DEST%"

xcopy "%SCRIPT_DIR%Cactus Zumbi\Cactus Zumbi BP" "%CZ_BP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo   [ERRO] Falha ao copiar BP!
    pause
    exit /b 1
)
echo   BP - OK!

xcopy "%SCRIPT_DIR%Cactus Zumbi\Cactus Zumbi RP" "%CZ_RP_DEST%" /e /i /q >nul
if %errorlevel% neq 0 (
    echo   [ERRO] Falha ao copiar RP!
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
echo   2. Ative os 4 packs (2 de cada addon):
echo      - "Mods Pietro e Manoel" (BP + RP)
echo      - "Cactus Zumbi" (BP + RP)
echo   3. Ative "Beta APIs" nas opcoes experimentais
echo.
echo Conteudo dos packs:
echo.
echo   Mods Pietro e Manoel:
echo   - Super Picareta (escava tuneis 10x3x6)
echo   - TNT Arremessavel, Bomba Submarina, Pistola Sinalizadora
echo   - Espada de Fogo
echo   - Multiplicador x10 (multiplica itens com diamantes)
echo   - Armadura de Slime (repulsao, saltos, quique!)
echo.
echo   Cactus Zumbi:
echo   - Pocao de Cactus Zumbi (arremessavel)
echo   - Cactus Zumbi Bom (com flor, ataca mobs hostis)
echo   - Cactus Zumbi Mau (sem flor, ataca jogadores)
echo   - Espinhos, regeneracao na areia, dano na agua
echo   - Explosao de espinhos ao morrer, planta cactus ao andar
echo.
pause
