# ANGEL Local Development Startup Script (PowerShell)
# Run: .\start-local.ps1

$ErrorActionPreference = "Continue"

Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║     ANGEL Local Development Startup    ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Green

# Check Node.js
Write-Host "Checking for Node.js..." -ForegroundColor Cyan
$node = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found! Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js $node detected`n" -ForegroundColor Green

# Kill existing processes on ports (optional)
Write-Host "Cleaning up existing processes..." -ForegroundColor Cyan
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"} | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Where-Object {$_.State -eq "Listen"} | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

# Start Backend
Write-Host "`n📦 Starting Backend (http://localhost:3000)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm start"
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "🎨 Starting Frontend (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\web'; npm run dev"
Start-Sleep -Seconds 2

# Success message
Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║         ANGEL STARTED LOCALLY          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "📍 Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "📍 Frontend: http://localhost:5173" -ForegroundColor Cyan

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "  1. Open Dashboard: http://localhost:5173" -ForegroundColor Gray
Write-Host "  2. In Bitburner: run /angel/sync.js" -ForegroundColor Gray
Write-Host "  3. In Bitburner: run /angel/start.js" -ForegroundColor Gray

Write-Host "`nYou can close this window. Backend/Frontend will continue running." -ForegroundColor Green
Write-Host "To stop: Close the Backend and Frontend windows" -ForegroundColor Green
Write-Host "`n"
