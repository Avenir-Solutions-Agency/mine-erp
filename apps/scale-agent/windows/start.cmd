@echo off
chcp 65001 >nul
title Merleg-hid
rem Mészkő-Polgár ERP mérleg-híd: élő súly és PORTAL AI mérések küldése az ERP-be.
rem Rendesen a Windows indításakor fut feladatként (telepites.cmd); kézzel is indítható.
rem ---- Beállítások ----
set "API_BASE_URL=https://erp.94-16-109-232.sslip.io"
set "SCALE_AGENT_TOKEN=IDE_JON_A_KULCS"
rem A PORTAL AI API-kulcsa az élő súlyhoz (portal_erp_...); ha nincs: off
set "PORTAL_API_KEY=off"
set "PORTAL_BASE_URL=http://localhost:8000/api/v1"
set "PORTAL_DB=%LOCALAPPDATA%\HidmerlegPortaprogram\portal.db"
rem Ha a PORTAL AI tonnában tárolja a súlyt: t
set "PORTAL_DB_UNIT=kg"
rem ---------------------
rem A telepítő ide írja a portal.db helyét, mert feladatként más a LOCALAPPDATA.
if exist "%~dp0portal-db.cmd" call "%~dp0portal-db.cmd"
cd /d "%~dp0.."
set "NODE=node"
if exist "%~dp0..\node\node.exe" set "NODE=%~dp0..\node\node.exe"
:run
"%NODE%" src\portal.ts
echo A híd leállt, 30 másodperc múlva újraindul.
rem ping: a timeout parancs feladatként, bemenet nélkül nem vár.
ping -n 31 127.0.0.1 >nul
goto run
