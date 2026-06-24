@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  CoB Internal Directory — Windows Deployment Script
::  Server path : C:\inetpub\wwwroot\VOIP-Directory
::  Process mgr : PM2 (pm2 reload — zero downtime)
:: ============================================================

set APP_ROOT=C:\inetpub\wwwroot\VOIP-Directory
set BACKEND=%APP_ROOT%\backend
set FRONTEND=%APP_ROOT%\frontend
set PM2_APP=bcc-directory-backend

echo.
echo ============================================================
echo   CoB Internal Directory ^| Deployment
echo   %DATE% %TIME%
echo ============================================================
echo.

:: ── Step 1: Backend dependencies ─────────────────────────────
echo [1/5] Installing backend dependencies...
cd /d "%BACKEND%"
if %ERRORLEVEL% neq 0 ( echo   ERROR: Could not navigate to %BACKEND% & goto :fail )

call npm install --omit=dev 2>&1
if %ERRORLEVEL% neq 0 ( echo   ERROR: Backend npm install failed. & goto :fail )
echo   Done.
echo.

:: ── Step 2: Database schema migration ────────────────────────
echo [2/5] Running database schema check / migration...
call npm run db:ensure 2>&1
if %ERRORLEVEL% neq 0 ( echo   ERROR: Schema migration failed. & goto :fail )
echo   Done.
echo.

:: ── Step 3: Frontend dependencies ────────────────────────────
echo [3/5] Installing frontend dependencies...
cd /d "%FRONTEND%"
if %ERRORLEVEL% neq 0 ( echo   ERROR: Could not navigate to %FRONTEND% & goto :fail )

call npm install 2>&1
if %ERRORLEVEL% neq 0 ( echo   ERROR: Frontend npm install failed. & goto :fail )
echo   Done.
echo.

:: ── Step 4: Build frontend ────────────────────────────────────
echo [4/5] Building frontend (Vite)...
call npm run build 2>&1
if %ERRORLEVEL% neq 0 ( echo   ERROR: Frontend build failed. & goto :fail )
echo   Done.
echo.

:: ── Step 5: Reload PM2 (zero downtime) ───────────────────────
echo [5/5] Reloading PM2 process ^(%PM2_APP%^)...
cd /d "%APP_ROOT%"

:: Try graceful reload first; fall back to restart if the app is not yet registered
call pm2 reload "%PM2_APP%" --update-env 2>&1
if %ERRORLEVEL% neq 0 (
    echo   Reload failed — trying restart...
    call pm2 restart "%PM2_APP%" --update-env 2>&1
    if !ERRORLEVEL! neq 0 (
        echo   Neither reload nor restart succeeded.
        echo   Start the app manually with: pm2 start backend\server.js --name "%PM2_APP%" -i max
        goto :fail
    )
)

:: Persist PM2 process list so it survives a server reboot
call pm2 save 2>&1
echo   Done.
echo.

:: ── Summary ──────────────────────────────────────────────────
echo ============================================================
echo   Deployment complete!
echo ============================================================
echo.
call pm2 list
echo.
goto :end

:fail
echo.
echo ============================================================
echo   DEPLOYMENT FAILED — see errors above.
echo ============================================================
echo.
pause
exit /b 1

:end
echo Press any key to close...
pause > nul
