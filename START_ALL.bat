@echo off
REM ANGEL Remote Ecosystem - Quick Start Script
REM Starts all 3 components in separate windows
REM Windows only

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  ANGEL Remote Ecosystem - Starting All Services   ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0

echo Starting Backend Server...
start "ANGEL Backend" cmd /k "cd server && npm start"
timeout /t 3 /nobreak

echo Starting Web Dashboard...
start "ANGEL Dashboard" cmd /k "cd web && npm run dev"
timeout /t 3 /nobreak

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║  All services started! Checking status...         ║
echo ╚════════════════════════════════════════════════════╝
echo.

timeout /t 5 /nobreak

echo Opening Dashboard in browser...
start http://localhost:5173

echo.
echo ✅ ANGEL Remote Ecosystem is running!
echo.
echo   Backend:  http://localhost:3000
echo   Dashboard: http://localhost:5173
echo.
echo To start Discord bot, run in another terminal:
echo   cd discord && npm start
echo.
pause
