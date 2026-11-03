@echo off
rem Elindítja a eltavolitas.ps1 fájlt (a PowerShell alapból nem futtat szkriptet dupla kattintásra).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0eltavolitas.ps1"
