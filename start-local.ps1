# ANGEL Local Development Startup Script (PowerShell)
# Run: .\start-local.ps1

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ANGEL Local Development Startup" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Checking for Node.js..." -ForegroundColor Cyan
$node = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js not found. Please install Node.js first." -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $node detected" -ForegroundColor Green
Write-Host ""

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

Write-Host "Killing any existing ANGEL services..." -ForegroundColor Cyan

# Kill any existing Node.js processes
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Terminating existing Node.js processes..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host "Starting fresh ANGEL services..." -ForegroundColor Cyan
Write-Host "Starting Backend (http://localhost:3000)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm start"
Start-Sleep -Seconds 3

Write-Host "Starting Frontend (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\web'; npm run dev"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ANGEL STARTED LOCALLY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
