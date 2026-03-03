@echo off
REM ANGEL Local Development Starter
REM Starts backend and frontend in separate windows

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════╗
echo ║     ANGEL Local Development Startup    ║
echo ╚════════════════════════════════════════╝
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

echo ✅ Node.js detected
echo.

echo Checking existing ANGEL services...

echo.
echo Starting ANGEL services...
echo.

REM Start Backend only if not already healthy
powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:3000/health' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"
if errorlevel 1 (
    echo 📦 Starting Backend (http://localhost:3000)...
    start "ANGEL Backend" cmd /k "title ANGEL Backend && cd server && npm start"
    timeout /t 3 /nobreak >nul
) else (
    echo ✅ Backend already healthy on http://localhost:3000
)

REM Start Frontend only if already not reachable
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5173' -TimeoutSec 2; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo 🎨 Starting Frontend (http://localhost:5173)...
    start "ANGEL Frontend" cmd /k "title ANGEL Frontend && cd web && npm run dev"
    timeout /t 3 /nobreak >nul
) else (
    echo ✅ Frontend already reachable on http://localhost:5173
)

REM Success message
echo.
echo ╔════════════════════════════════════════╗
echo ║         ANGEL STARTED LOCALLY          ║
echo ╚════════════════════════════════════════╝
echo.
echo 📍 Backend:  http://localhost:3000
echo 📍 Frontend: http://localhost:5173
echo.
echo Next steps:
echo  1. Open Dashboard: http://localhost:5173
echo  2. In Bitburner: run /angel/sync.js
echo  3. In Bitburner: run /angel/start.js
echo.
echo You can close this window. Backend/Frontend will continue running.
echo To stop: Close the Backend and Frontend windows
echo.
pause
