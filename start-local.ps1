# ANGEL Local Development Startup Script (PowerShell)
# Run: .\start-local.ps1

$ErrorActionPreference = "Continue"

function Stop-ProcessesByPattern {
    param(
        [string]$Pattern,
        [string]$Label
    )

    $matches = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern }

    if ($matches) {
        Write-Host "Stopping existing $Label process(es)..." -ForegroundColor Yellow
        foreach ($proc in $matches) {
            try {
                Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
            } catch {
                # Ignore failures for already-exited processes
            }
        }
    }
}

function Stop-ProcessByPort {
    param(
        [int]$Port,
        [string]$Label
    )

    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    if ($connections) {
        Write-Host "Freeing port $Port ($Label)..." -ForegroundColor Yellow
        foreach ($processId in $connections) {
            try {
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            } catch {
                # Ignore failures for already-exited processes
            }
        }
    }
}

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

# Stop by known service ports first
Stop-ProcessByPort -Port 3000 -Label "backend"
Stop-ProcessByPort -Port 5173 -Label "frontend"
Stop-ProcessByPort -Port 12525 -Label "filesync"

# Stop ANGEL-specific node processes by command line pattern
Stop-ProcessesByPattern -Pattern [regex]::Escape("$root\\server") -Label "backend"
Stop-ProcessesByPattern -Pattern [regex]::Escape("$root\\web") -Label "frontend"
Stop-ProcessesByPattern -Pattern [regex]::Escape("$root\\discord") -Label "discord bot"
Stop-ProcessesByPattern -Pattern "bitburner-filesync|filesync\.json|filesync" -Label "filesync"

Start-Sleep -Seconds 2

Write-Host "Starting fresh ANGEL services..." -ForegroundColor Cyan

Write-Host "Starting Backend (http://localhost:3000)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\server'; npm start"
Start-Sleep -Seconds 3

Write-Host "Starting Frontend (http://localhost:5173)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\web'; npm run dev"
Start-Sleep -Seconds 2

Write-Host "Starting Discord Bot..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root\discord'; npm start"
Start-Sleep -Seconds 2

Write-Host "Starting File Sync (bitburner-filesync)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell" -ArgumentList "-NoExit", "-Command", "cd '$root'; npm run watch:run"
Start-Sleep -Seconds 1

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ANGEL STARTED LOCALLY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Discord:  Running in separate terminal" -ForegroundColor Cyan
Write-Host "Filesync: Running in separate terminal (port 12525)" -ForegroundColor Cyan
Write-Host ""
