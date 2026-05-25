@echo off
chcp 65001 >nul
title Instalador - Mods Pietro e Manoel
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"

:: ============================================
:: Detectar pasta do Minecraft Bedrock
:: ============================================
set "MOJANG=%AppData%\Minecraft Bedrock\Users\Shared\games\com.mojang"
if exist "%MOJANG%\development_behavior_packs" goto :found

set "MOJANG=%LocalAppData%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
if exist "%MOJANG%" goto :found

set "MOJANG=%LocalAppData%\Packages\MICROSOFT.MINECRAFTUWP_8wekyb3d8bbwe\LocalState\games\com.mojang"
if exist "%MOJANG%" goto :found

cls
echo ============================================
echo   INSTALADOR - Mods Pietro e Manoel
echo ============================================
echo.
echo [ERRO] Pasta do Minecraft Bedrock nao encontrada!
echo Verifique se o Minecraft Bedrock esta instalado.
echo.
pause
exit /b 1

:found
set "BP_DIR=%MOJANG%\development_behavior_packs"
set "RP_DIR=%MOJANG%\development_resource_packs"

:: ============================================
:: MENU PRINCIPAL
:: ============================================
:menu
cls
echo ============================================
echo   INSTALADOR - Mods Pietro e Manoel
echo   Minecraft Bedrock Edition
echo ============================================
echo.
echo Pasta do Minecraft:
echo   %MOJANG%
echo.
echo Escolha qual pack instalar:
echo.
echo   [1] Super Picareta (modular)
echo   [2] Armadura de Slime (modular)
echo   [3] Multiplicador (modular)
echo   [4] Pistola Laser (modular)
echo   [5] Cactus Zumbi (modular)
echo   [6] Mods Pietro e Manoel (UNIFICADO - todos os 5 acima juntos)
echo.
echo   [7] Instalar TODOS os 5 modulares (1 a 5)
echo   [8] Instalar TUDO (5 modulares + unificado)
echo.
echo   [9] Desinstalar TODOS (limpa todos os 6 packs)
echo   [0] Sair
echo.

set "OPCAO="
set /p "OPCAO=Digite o numero: "

if "%OPCAO%"=="0" goto :sair
if "%OPCAO%"=="1" goto :op_super_picareta
if "%OPCAO%"=="2" goto :op_armadura_slime
if "%OPCAO%"=="3" goto :op_multiplicador
if "%OPCAO%"=="4" goto :op_pistola_laser
if "%OPCAO%"=="5" goto :op_cactus_zumbi
if "%OPCAO%"=="6" goto :op_unificado
if "%OPCAO%"=="7" goto :op_todos_modulares
if "%OPCAO%"=="8" goto :op_tudo
if "%OPCAO%"=="9" goto :op_desinstalar_tudo

echo.
echo [AVISO] Opcao invalida: "%OPCAO%"
timeout /t 2 >nul
goto :menu

:: ============================================
:: OPCAO 1: Super Picareta
:: ============================================
:op_super_picareta
cls
echo ============================================
echo   Instalando: Super Picareta (modular)
echo ============================================
echo.
call :install_pack "Super Picareta"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Super Picareta" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo Se voce ja tem "Mods Pietro e Manoel" ativo, DESATIVE antes - nao ative os dois.
goto :pause_e_volta

:: ============================================
:: OPCAO 2: Armadura de Slime
:: ============================================
:op_armadura_slime
cls
echo ============================================
echo   Instalando: Armadura de Slime (modular)
echo ============================================
echo.
call :install_pack "Armadura de Slime"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Armadura de Slime" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo Se voce ja tem "Mods Pietro e Manoel" ativo, DESATIVE antes - nao ative os dois.
goto :pause_e_volta

:: ============================================
:: OPCAO 3: Multiplicador
:: ============================================
:op_multiplicador
cls
echo ============================================
echo   Instalando: Multiplicador (modular)
echo ============================================
echo.
call :install_pack "Multiplicador"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Multiplicador" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo Se voce ja tem "Mods Pietro e Manoel" ativo, DESATIVE antes - nao ative os dois.
goto :pause_e_volta

:: ============================================
:: OPCAO 4: Pistola Laser
:: ============================================
:op_pistola_laser
cls
echo ============================================
echo   Instalando: Pistola Laser (modular)
echo ============================================
echo.
call :install_pack "Pistola Laser"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Pistola Laser" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo Se voce ja tem "Mods Pietro e Manoel" ativo, DESATIVE antes - nao ative os dois.
goto :pause_e_volta

:: ============================================
:: OPCAO 5: Cactus Zumbi
:: ============================================
:op_cactus_zumbi
cls
echo ============================================
echo   Instalando: Cactus Zumbi (modular)
echo ============================================
echo.
call :install_pack "Cactus Zumbi"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Cactus Zumbi" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo Se voce ja tem "Mods Pietro e Manoel" ativo, DESATIVE antes - nao ative os dois.
goto :pause_e_volta

:: ============================================
:: OPCAO 6: Mods Pietro e Manoel (UNIFICADO)
:: ============================================
:op_unificado
cls
echo ============================================
echo   Instalando: Mods Pietro e Manoel (UNIFICADO)
echo ============================================
echo.
call :install_pack "Mods Pietro e Manoel"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! No Minecraft, ative "Mods Pietro e Manoel" (BP + RP) no mundo.
echo Beta APIs precisam estar ligadas.
echo.
echo Este pack ja contem TUDO dos 5 modulares juntos:
echo   - Super Picareta + TNT + Bomba + Sinalizador + Espada de Fogo
echo   - Armadura de Slime
echo   - Multiplicador x10
echo   - Pistola Laser + Rifle Sniper
echo   - Cactus Zumbi
echo.
echo Se voce tem modulares ativos, DESATIVE-OS - nao ative os dois grupos.
goto :pause_e_volta

:: ============================================
:: OPCAO 7: Todos os 5 modulares
:: ============================================
:op_todos_modulares
cls
echo ============================================
echo   Instalando: TODOS os 5 modulares
echo ============================================
echo.
call :install_pack "Super Picareta"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Armadura de Slime"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Multiplicador"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Pistola Laser"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Cactus Zumbi"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! Os 5 modulares foram instalados.
echo No Minecraft, ative os 5 (BP + RP cada) no mundo.
echo Beta APIs precisam estar ligadas.
echo.
echo NUNCA ative junto com "Mods Pietro e Manoel" (unificado) -
echo isso causa efeitos duplicados e bugs.
goto :pause_e_volta

:: ============================================
:: OPCAO 8: TUDO (5 modulares + unificado)
:: ============================================
:op_tudo
cls
echo ============================================
echo   Instalando: TUDO (5 modulares + unificado)
echo ============================================
echo.
call :install_pack "Super Picareta"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Armadura de Slime"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Multiplicador"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Pistola Laser"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Cactus Zumbi"
if errorlevel 1 goto :pause_e_volta
echo.
call :install_pack "Mods Pietro e Manoel"
if errorlevel 1 goto :pause_e_volta
echo.
echo OK! Todos os 6 packs estao instalados no disco.
echo.
echo IMPORTANTE: No Minecraft, ative APENAS UM grupo:
echo   - OU os 5 packs modulares
echo   - OU o pack unificado "Mods Pietro e Manoel"
echo NUNCA ative ambos - causa efeitos duplicados, light_blocks orfaos, etc.
goto :pause_e_volta

:: ============================================
:: OPCAO 9: Desinstalar TODOS
:: ============================================
:op_desinstalar_tudo
cls
echo ============================================
echo   Desinstalando: TODOS os packs
echo ============================================
echo.
call :uninstall_pack "Super Picareta"
call :uninstall_pack "Armadura de Slime"
call :uninstall_pack "Multiplicador"
call :uninstall_pack "Pistola Laser"
call :uninstall_pack "Cactus Zumbi"
call :uninstall_pack "Mods Pietro e Manoel"
echo.
echo OK! Removidos todos os BPs e RPs do com.mojang.
goto :pause_e_volta

:: ============================================
:: Pausa e volta ao menu
:: ============================================
:pause_e_volta
echo.
pause
goto :menu

:: ============================================
:: Sair
:: ============================================
:sair
cls
echo ============================================
echo   Saindo...
echo ============================================
echo.
exit /b 0

:: ============================================
:: SUB-ROTINA: install_pack
:: %~1 = nome do pack (ex: "Super Picareta")
:: ============================================
:install_pack
set "PACK_NAME=%~1"
set "SRC_BP=%SCRIPT_DIR%%PACK_NAME%\%PACK_NAME% BP"
set "SRC_RP=%SCRIPT_DIR%%PACK_NAME%\%PACK_NAME% RP"
set "BP_DEST=%BP_DIR%\%PACK_NAME% BP"
set "RP_DEST=%RP_DIR%\%PACK_NAME% RP"

if not exist "%SRC_BP%" (
    echo [ERRO] Pasta de origem nao encontrada: %SRC_BP%
    exit /b 1
)
if not exist "%SRC_RP%" (
    echo [ERRO] Pasta de origem nao encontrada: %SRC_RP%
    exit /b 1
)

echo Instalando "%PACK_NAME%"...

if exist "%BP_DEST%" rmdir /s /q "%BP_DEST%"
if exist "%RP_DEST%" rmdir /s /q "%RP_DEST%"

xcopy "%SRC_BP%" "%BP_DEST%" /e /i /q >nul
if errorlevel 1 (
    echo   [ERRO] Falha ao copiar BP de %PACK_NAME%
    exit /b 1
)
echo   BP - OK

xcopy "%SRC_RP%" "%RP_DEST%" /e /i /q >nul
if errorlevel 1 (
    echo   [ERRO] Falha ao copiar RP de %PACK_NAME%
    exit /b 1
)
echo   RP - OK
exit /b 0

:: ============================================
:: SUB-ROTINA: uninstall_pack
:: %~1 = nome do pack
:: ============================================
:uninstall_pack
set "PACK_NAME=%~1"
set "BP_DEST=%BP_DIR%\%PACK_NAME% BP"
set "RP_DEST=%RP_DIR%\%PACK_NAME% RP"

if exist "%BP_DEST%" (
    rmdir /s /q "%BP_DEST%"
    echo Removido BP: %PACK_NAME%
)
if exist "%RP_DEST%" (
    rmdir /s /q "%RP_DEST%"
    echo Removido RP: %PACK_NAME%
)
exit /b 0
