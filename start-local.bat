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

REM Kill any existing node processes on ports 3000/5173 (optional)
echo Checking for existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000"') do (
    taskkill /PID %%a /F 2>nul
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173"') do (
    taskkill /PID %%a /F 2>nul
)

echo.
echo Starting ANGEL services...
echo.

REM Start Backend
echo 📦 Starting Backend (http://localhost:3000)...
start "ANGEL Backend" cmd /k "title ANGEL Backend && cd server && npm start"
timeout /t 3 /nobreak

REM Start Frontend
echo 🎨 Starting Frontend (http://localhost:5173)...
start "ANGEL Frontend" cmd /k "title ANGEL Frontend && cd web && npm run dev"
timeout /t 3 /nobreak

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
