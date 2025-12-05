@echo off
title GitHub Auto-Updater
color 0A

echo ---------------------------------------------------
echo  STARTING GIT UPDATE
echo ---------------------------------------------------
echo.

:: 1. Sicherstellen, dass wir im richtigen Ordner sind
cd /d "%~dp0"

:: 2. Alle neuen und geänderten Dateien vormerken
echo [1/3] Fuege Dateien hinzu (git add)...
git add .

:: 3. Nach einer Nachricht fragen (optional)
set /p msg="Gib eine Nachricht ein (Enter druecken fuer 'Automatisches Update'): "
if "%msg%"=="" set msg=Automatisches Update

:: 4. Die Änderungen lokal speichern
echo.
echo [2/3] Speichere lokal (git commit)...
git commit -m "%msg%"

:: 5. Auf GitHub hochladen
echo.
echo [3/3] Lade zu GitHub hoch (git push)...
git push

echo.
echo ---------------------------------------------------
echo  FERTIG! Alles ist jetzt auf GitHub.
echo ---------------------------------------------------
pause