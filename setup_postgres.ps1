# =============================================================
#  VOIP Directory — MySQL → PostgreSQL Migration Orchestrator
#  Run as Administrator on the Windows Server:
#    Set-ExecutionPolicy RemoteSigned -Scope Process
#    .\setup_postgres.ps1
# =============================================================

$APP_ROOT  = "C:\inetpub\wwwroot\VOIP-Directory"
$BACKEND   = "$APP_ROOT\backend"
$PG_PASS   = "Cityvoip@502"
$DB_NAME   = "bcc_voip_directory"
$PG_SUPER  = "postgres"
$APP_USER  = "voipapp"

$env:PGPASSWORD = $PG_PASS

function Step  { param($n, $msg) Write-Host "`n── Step $n : $msg" -ForegroundColor Cyan }
function OK    { param($msg)     Write-Host "   [OK]   $msg" -ForegroundColor Green }
function WARN  { param($msg)     Write-Host "   [WARN] $msg" -ForegroundColor Yellow }
function FAIL  { param($msg)     Write-Host "   [FAIL] $msg" -ForegroundColor Red; exit 1 }
function INFO  { param($msg)     Write-Host "          $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor White
Write-Host "║  VOIP Directory — PostgreSQL Setup & Data Migration  ║" -ForegroundColor White
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor White

# ─── Step 1: Find psql ────────────────────────────────────────────────────────
Step 1 "Locating PostgreSQL (psql)"

$psql = (Get-Command psql -ErrorAction SilentlyContinue)?.Source
if (-not $psql) {
    $candidates = @(
        "C:\Program Files\PostgreSQL\17\bin\psql.exe",
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe"
    )
    foreach ($p in $candidates) { if (Test-Path $p) { $psql = $p; break } }
}

if (-not $psql) {
    FAIL "psql not found. Download and install PostgreSQL from https://www.postgresql.org/download/windows/ then re-run this script."
}
OK "psql found: $psql"

# Derive bin directory so we can also call createdb / pg_dump etc.
$pgBin = Split-Path $psql

# ─── Step 2: Verify PostgreSQL service is running ─────────────────────────────
Step 2 "Checking PostgreSQL service"

$pgSvc = Get-Service | Where-Object { $_.Name -like "postgresql*" -or $_.DisplayName -like "postgresql*" } | Select-Object -First 1
if ($pgSvc -and $pgSvc.Status -ne 'Running') {
    WARN "PostgreSQL service '$($pgSvc.Name)' is not running. Attempting to start..."
    Start-Service $pgSvc.Name
    Start-Sleep -Seconds 3
}
$testConn = & $psql -U $PG_SUPER -h 127.0.0.1 -c "SELECT 1" 2>&1
if ($LASTEXITCODE -ne 0) {
    FAIL "Cannot connect to PostgreSQL. Make sure it is installed and running.`nOutput: $testConn"
}
OK "PostgreSQL is running and reachable"

# ─── Step 3: Create database ──────────────────────────────────────────────────
Step 3 "Creating database: $DB_NAME"

& $psql -U $PG_SUPER -h 127.0.0.1 -c "CREATE DATABASE $DB_NAME;" 2>&1 | Out-Null
# Ignore "already exists" error — that's fine
OK "Database '$DB_NAME' is ready"

# ─── Step 4: Create application user ─────────────────────────────────────────
Step 4 "Creating application user: $APP_USER"

$createUserSql = @"
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN
        CREATE USER $APP_USER WITH PASSWORD '$PG_PASS';
    ELSE
        ALTER USER $APP_USER WITH PASSWORD '$PG_PASS';
    END IF;
END
`$`$;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $APP_USER;
"@

& $psql -U $PG_SUPER -h 127.0.0.1 -c $createUserSql 2>&1 | Out-Null
OK "User '$APP_USER' is ready"

# Grant schema-level permissions (required for PostgreSQL 15+)
$grantSchemaSql = "GRANT ALL ON SCHEMA public TO $APP_USER; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $APP_USER; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $APP_USER;"
& $psql -U $PG_SUPER -h 127.0.0.1 -d $DB_NAME -c $grantSchemaSql 2>&1 | Out-Null
OK "Schema permissions granted"

# ─── Step 5: Install pg npm package ──────────────────────────────────────────
Step 5 "Installing pg (PostgreSQL driver) npm package"

Set-Location $BACKEND
$npmOut = npm install pg --save 2>&1
if ($LASTEXITCODE -ne 0) { FAIL "npm install pg failed: $npmOut" }
OK "pg package installed"

# ─── Step 6: Pull latest code ────────────────────────────────────────────────
Step 6 "Pulling latest code from GitHub"

Set-Location $APP_ROOT
$gitOut = git pull origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    WARN "git pull had issues — check output:`n$gitOut"
} else {
    OK "Code updated"
}

# ─── Step 7: Run data migration ──────────────────────────────────────────────
Step 7 "Migrating data: MySQL → PostgreSQL"

$mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
if (-not $mysqlSvc -or $mysqlSvc.Status -ne 'Running') {
    WARN "MySQL80 service is not running. Attempting to start it for the migration..."
    try { Start-Service "MySQL80"; Start-Sleep -Seconds 5 }
    catch { WARN "Could not start MySQL. If MySQL is already gone, skip this — the migration needs it running." }
}

Set-Location $BACKEND
INFO "Running: node migrate_to_postgres.js"
node migrate_to_postgres.js
if ($LASTEXITCODE -ne 0) {
    FAIL "Data migration failed. Fix the errors above and re-run: node migrate_to_postgres.js"
}
OK "Data migration complete"

# ─── Step 8: Update .env on server ───────────────────────────────────────────
Step 8 "Writing .env"

$envContent = @"
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=$APP_USER
DB_PASSWORD=$PG_PASS
DB_NAME=$DB_NAME
PORT=5001
"@

$envContent | Out-File -FilePath "$BACKEND\.env" -Encoding utf8
OK ".env written at $BACKEND\.env"

# ─── Step 9: Restart PM2 ──────────────────────────────────────────────────────
Step 9 "Restarting PM2"

$pm2List = pm2 list 2>&1
if ($pm2List -match "bcc-directory-backend") {
    pm2 restart bcc-directory-backend --update-env 2>&1 | Out-Null
    OK "PM2 process restarted"
} else {
    INFO "PM2 process not found — starting fresh"
    pm2 start "$BACKEND\server.js" --name "bcc-directory-backend" -i max -- 2>&1 | Out-Null
    OK "PM2 process started"
}
pm2 save 2>&1 | Out-Null

# ─── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            Migration complete!                       ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "  1. Check PM2 logs:  pm2 logs bcc-directory-backend --lines 30 --nostream"
Write-Host "  2. Run diagnostics: cd $BACKEND ; node diagnose.js"
Write-Host "  3. Open the app:    http://9.135.112.20"
Write-Host ""
