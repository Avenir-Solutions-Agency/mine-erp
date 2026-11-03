@echo off
rem Elindítja a telepites.ps1 fájlt (a PowerShell alapból nem futtat szkriptet dupla kattintásra).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0telepites.ps1"
