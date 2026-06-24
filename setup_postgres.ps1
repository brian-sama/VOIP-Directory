# =============================================================
#  VOIP Directory -- MySQL to PostgreSQL Migration
#  Run as Administrator on the Windows Server:
#    Set-ExecutionPolicy RemoteSigned -Scope Process
#    .\setup_postgres.ps1
# =============================================================

$APP_ROOT = "C:\inetpub\wwwroot\VOIP-Directory"
$BACKEND  = "$APP_ROOT\backend"
$PG_PASS  = "Cityvoip@502"
$DB_NAME  = "bcc_voip_directory"
$PG_SUPER = "postgres"
$APP_USER = "voipapp"

$env:PGPASSWORD = $PG_PASS

function Step { param($n, $msg) Write-Host "`n-- Step $n : $msg" -ForegroundColor Cyan }
function OK   { param($msg)     Write-Host "   [OK]   $msg" -ForegroundColor Green }
function WARN { param($msg)     Write-Host "   [WARN] $msg" -ForegroundColor Yellow }
function FAIL { param($msg)     Write-Host "   [FAIL] $msg" -ForegroundColor Red; exit 1 }
function INFO { param($msg)     Write-Host "          $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "========================================================" -ForegroundColor White
Write-Host "  VOIP Directory -- PostgreSQL Setup and Data Migration  " -ForegroundColor White
Write-Host "========================================================" -ForegroundColor White

# -- Step 1: Find psql ----------------------------------------------------
Step 1 "Locating PostgreSQL (psql)"

$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) {
    $psql = $psqlCmd.Source
} else {
    $psql = $null
    # Search all installed PostgreSQL versions dynamically
    $pgDirs = Get-ChildItem "C:\Program Files\PostgreSQL\" -ErrorAction SilentlyContinue |
              Sort-Object Name -Descending
    foreach ($dir in $pgDirs) {
        $candidate = "$($dir.FullName)\bin\psql.exe"
        if (Test-Path $candidate) { $psql = $candidate; break }
    }
}

if (-not $psql) {
    FAIL "psql not found. Install PostgreSQL from https://www.postgresql.org/download/windows/ then re-run this script."
}
OK "psql found: $psql"

# -- Step 2: Verify PostgreSQL is running ---------------------------------
Step 2 "Checking PostgreSQL service"

$pgSvc = Get-Service | Where-Object { $_.Name -like "postgresql*" -or $_.DisplayName -like "postgresql*" } | Select-Object -First 1
if ($pgSvc -and $pgSvc.Status -ne "Running") {
    WARN "Service not running. Trying to start $($pgSvc.Name)..."
    Start-Service $pgSvc.Name
    Start-Sleep -Seconds 4
}

& $psql -U $PG_SUPER -h 127.0.0.1 -c "SELECT 1" 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    FAIL "Cannot connect to PostgreSQL. Make sure it is installed and running."
}
OK "PostgreSQL is reachable"

# -- Step 3: Create database ----------------------------------------------
Step 3 "Creating database: $DB_NAME"

& $psql -U $PG_SUPER -h 127.0.0.1 -c "CREATE DATABASE $DB_NAME" 2>&1 | Out-Null
OK "Database '$DB_NAME' ready (already existed or just created)"

# -- Step 4: Create application user --------------------------------------
Step 4 "Creating application user: $APP_USER"

$sql1 = "DO `$body`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN CREATE USER $APP_USER WITH PASSWORD '$PG_PASS'; ELSE ALTER USER $APP_USER WITH PASSWORD '$PG_PASS'; END IF; END `$body`$;"
& $psql -U $PG_SUPER -h 127.0.0.1 -c $sql1 2>&1 | Out-Null

$sql2 = "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $APP_USER;"
& $psql -U $PG_SUPER -h 127.0.0.1 -c $sql2 2>&1 | Out-Null
OK "User '$APP_USER' ready"

$sql3 = "GRANT ALL ON SCHEMA public TO $APP_USER; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $APP_USER; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $APP_USER;"
& $psql -U $PG_SUPER -h 127.0.0.1 -d $DB_NAME -c $sql3 2>&1 | Out-Null
OK "Schema permissions granted"

# -- Step 5: Install pg npm package ---------------------------------------
Step 5 "Installing pg npm package"

Set-Location $BACKEND
$npmOut = npm install pg --save 2>&1
if ($LASTEXITCODE -ne 0) {
    FAIL "npm install pg failed: $npmOut"
}
OK "pg package installed"

# -- Step 6: Pull latest code ---------------------------------------------
Step 6 "Pulling latest code from GitHub"

Set-Location $APP_ROOT
$gitOut = git pull origin main 2>&1
if ($LASTEXITCODE -ne 0) {
    WARN "git pull reported issues:`n$gitOut"
} else {
    OK "Code updated"
}

# -- Step 7: Run data migration -------------------------------------------
Step 7 "Migrating data from MySQL to PostgreSQL"

$mysqlSvc = Get-Service -Name "MySQL80" -ErrorAction SilentlyContinue
if ($mysqlSvc -and $mysqlSvc.Status -ne "Running") {
    WARN "MySQL80 not running -- attempting to start for migration..."
    try {
        Start-Service "MySQL80"
        Start-Sleep -Seconds 5
    } catch {
        WARN "Could not start MySQL. If MySQL data is already gone, skip Step 7."
    }
}

Set-Location $BACKEND
INFO "Running: node migrate_to_postgres.js"
node migrate_to_postgres.js
if ($LASTEXITCODE -ne 0) {
    FAIL "Data migration failed. Fix errors above then re-run: node migrate_to_postgres.js"
}
OK "Data migration complete"

# -- Step 8: Write .env ---------------------------------------------------
Step 8 "Writing .env"

$envLines = "DB_HOST=127.0.0.1`r`nDB_PORT=5432`r`nDB_USER=$APP_USER`r`nDB_PASSWORD=$PG_PASS`r`nDB_NAME=$DB_NAME`r`nPORT=5001"
$envPath  = "$BACKEND\.env"
[System.IO.File]::WriteAllText($envPath, $envLines, [System.Text.Encoding]::UTF8)
OK ".env written: $envPath"

# -- Step 9: Restart PM2 --------------------------------------------------
Step 9 "Restarting PM2"

$pm2Out = pm2 list 2>&1
if ($pm2Out -match "bcc-directory-backend") {
    pm2 restart bcc-directory-backend --update-env 2>&1 | Out-Null
    OK "PM2 process restarted"
} else {
    pm2 start "$BACKEND\server.js" --name "bcc-directory-backend" -i max 2>&1 | Out-Null
    OK "PM2 process started"
}
pm2 save 2>&1 | Out-Null

# -- Done -----------------------------------------------------------------
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  Migration complete!                                    " -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Check logs  :  pm2 logs bcc-directory-backend --lines 30 --nostream"
Write-Host "  Diagnostics :  cd $BACKEND ; node diagnose.js"
Write-Host "  Open app    :  http://9.135.112.20"
Write-Host ""
