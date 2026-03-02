@echo off
REM ANGEL Remote Ecosystem - Automated Testing Script (Windows)
REM Validates all components

chcp 65001 >nul

setlocal enabledelayedexpansion

set BACKEND_URL=http://localhost:3000
set DASHBOARD_URL=http://localhost:5173
set TESTS_PASSED=0
set TESTS_FAILED=0

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║   ANGEL Remote Ecosystem - Automated Test Suite   ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM ============================================
REM Phase 1: Backend Connectivity
REM ============================================

echo === Phase 1: Backend Connectivity ===
echo.
echo Checking backend connectivity...

powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host 'ONLINE - OK' -ForegroundColor Green; exit 0 } } catch { Write-Host 'OFFLINE - FAIL' -ForegroundColor Red; exit 1 }"

if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: Backend not running. Start with:
    echo   cd server
    echo   npm start
    echo.
    exit /b 1
)

set /a TESTS_PASSED+=1

REM ============================================
REM Phase 2: API Endpoints
REM ============================================

echo.
echo === Phase 2: API Endpoints ===
echo.

REM Test Health Check
echo Testing Health Check...
powershell -Command "$response = Invoke-WebRequest -Uri 'http://localhost:3000/health' -UseBasicParsing; if ($response.Content -match 'ok') { Write-Host 'PASS' -ForegroundColor Green; exit 0 } else { Write-Host 'FAIL' -ForegroundColor Red; exit 1 }"
if %ERRORLEVEL% equ 0 (
    set /a TESTS_PASSED+=1
) else (
    set /a TESTS_FAILED+=1
)

REM Test Get Status
echo Testing Get Status...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:3000/api/status' -Method GET; if ($response.status -eq 'ok') { Write-Host 'PASS' -ForegroundColor Green; exit 0 } else { Write-Host 'FAIL' -ForegroundColor Red; exit 1 } } catch { Write-Host 'FAIL' -ForegroundColor Red; exit 1 }"
if %ERRORLEVEL% equ 0 (
    set /a TESTS_PASSED+=1
) else (
    set /a TESTS_FAILED+=1
)

REM Test Get Commands
echo Testing Get Commands...
powershell -Command "$response = (Invoke-WebRequest -Uri 'http://localhost:3000/api/commands' -UseBasicParsing).Content; if ($response -match 'commands') { Write-Host 'PASS' -ForegroundColor Green; exit 0 } else { Write-Host 'FAIL' -ForegroundColor Red; exit 1 }"
if %ERRORLEVEL% equ 0 (
    set /a TESTS_PASSED+=1
) else (
    set /a TESTS_FAILED+=1
)

REM Test Queue Command
echo Testing Queue Command...
REM Using curl if available, fallback to powershell
where curl >nul 2>nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('curl -s -X POST http://localhost:3000/api/commands -H "Content-Type: application/json" -d "{\"commandType\":\"pause\"}"') do set CMD_RESPONSE=%%i
) else (
    for /f "tokens=*" %%i in ('powershell -Command "(Invoke-WebRequest -Method POST -Uri 'http://localhost:3000/api/commands' -Headers @{'Content-Type'='application/json'} -Body '{\"commandType\":\"pause\"}' -UseBasicParsing).Content"') do set CMD_RESPONSE=%%i
)

echo !CMD_RESPONSE! | findstr /M "success" >nul
if %ERRORLEVEL% equ 0 (
    echo PASS - OK
    set /a TESTS_PASSED+=1
) else (
    echo FAIL - No success in response
    set /a TESTS_FAILED+=1
)

REM ============================================
REM Phase 3: Telemetry Data
REM ============================================

echo.
echo === Phase 3: Telemetry Data ===
echo.

echo Sending test telemetry...
powershell -Command "$payload = @{ runId='test-run'; timestamp=[int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()); modules=@{ hacking=@{ executions=10; failures=0; status='running' } }; stats=@{ uptime=1000; moneyRate=100000; xpRate=50 }; memory=@{ used=64; total=256 }; money='1000000000'; hackLevel=100 } | ConvertTo-Json -Depth 6 -Compress; try { $response = Invoke-RestMethod -Method POST -Uri 'http://localhost:3000/api/telemetry' -ContentType 'application/json' -Body $payload; if ($response.success -eq $true) { Write-Host 'PASS - Telemetry sent' -ForegroundColor Green; exit 0 } else { Write-Host 'FAIL - Telemetry rejected' -ForegroundColor Red; exit 1 } } catch { Write-Host 'FAIL - Could not send telemetry' -ForegroundColor Red; Write-Host $_.Exception.Message; exit 1 }"
if %ERRORLEVEL% equ 0 (
    set /a TESTS_PASSED+=1
) else (
    set /a TESTS_FAILED+=1
)

REM ============================================
REM Phase 4: Dashboard Connectivity
REM ============================================

echo.
echo === Phase 4: Dashboard Connectivity ===
echo.

echo Checking dashboard...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing | Select-Object -ExpandProperty Content; if ($response -contains 'ANGEL') { Write-Host 'ONLINE - OK' -ForegroundColor Green; exit 0 } } catch { Write-Host 'OFFLINE - Dashboard not started' -ForegroundColor Yellow }"

if %ERRORLEVEL% equ 0 (
    set /a TESTS_PASSED+=1
) else (
    echo Tip: Start with: cd web && npm run dev
)

REM ============================================
REM Phase 5: Database
REM ============================================

echo.
echo === Phase 5: Database ===
echo.

if exist "server\data\data.db" (
    echo Database file exists - OK
    set /a TESTS_PASSED+=1
    
    for %%A in ("server\data\data.db") do (
        echo Database size: %%~zA bytes
    )
) else (
    echo Database file NOT FOUND
    set /a TESTS_FAILED+=1
)

REM ============================================
REM Summary
REM ============================================

echo.
echo ╔════════════════════════════════════════════════════╗
echo ║              TEST RESULTS SUMMARY                  ║
echo ╚════════════════════════════════════════════════════╝
echo.
echo Tests Passed: !TESTS_PASSED!
echo Tests Failed: !TESTS_FAILED!
echo.

if !TESTS_FAILED! equ 0 (
    echo ✅ ALL TESTS PASSED
    echo.
    echo Your ANGEL ecosystem is ready for deployment!
    timeout /t 5
    exit /b 0
) else (
    echo ❌ SOME TESTS FAILED
    echo.
    echo Please check the errors above and troubleshoot.
    timeout /t 5
    exit /b 1
)
