# Script to insert test attendance data into the Conductor database
# This script runs the migration and inserts test attendance data

$ErrorActionPreference = "Stop"

Write-Host "Inserting test attendance data..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL container is running
$containerStatus = docker ps --filter "name=conductor-postgres" --format "{{.Status}}" 2>$null
if (-not $containerStatus -or $containerStatus -match "Exited") {
    Write-Host "Error: PostgreSQL container 'conductor-postgres' is not running." -ForegroundColor Red
    Write-Host "Please start the database first using: .\scripts\setup-db.ps1" -ForegroundColor Yellow
    exit 1
}

# Get project root directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

# Paths to SQL files
$migrationPath = Join-Path $projectRoot "app\db\migrations\add_team_id_to_attendance.sql"
$testDataPath = Join-Path $projectRoot "app\db\migrations\insert_test_attendance_data.sql"

# Check if migration file exists
if (-not (Test-Path $migrationPath)) {
    Write-Host "Error: Migration file not found: $migrationPath" -ForegroundColor Red
    exit 1
}

# Check if test data file exists
if (-not (Test-Path $testDataPath)) {
    Write-Host "Error: Test data file not found: $testDataPath" -ForegroundColor Red
    exit 1
}

try {
    # Step 1: Run migration to add team_id column (if needed)
    Write-Host "`nStep 1: Running migration (adding team_id column if needed)..." -ForegroundColor Yellow
    $migrationOutput = Get-Content $migrationPath | docker exec -i conductor-postgres psql -U postgres -d conductor -v ON_ERROR_STOP=1 2>&1
    $migrationExitCode = $LASTEXITCODE
    
    if ($migrationExitCode -ne 0 -and $migrationOutput -match "ERROR:") {
        $migrationOutput | Where-Object { $_ -match "ERROR:" } | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        Write-Host "Warning: Migration may have failed, but continuing..." -ForegroundColor Yellow
    } else {
        Write-Host "Migration check completed." -ForegroundColor Green
    }
    
    # Step 2: Insert test attendance data
    Write-Host "`nStep 2: Inserting test attendance data..." -ForegroundColor Yellow
    $testDataOutput = Get-Content $testDataPath | docker exec -i conductor-postgres psql -U postgres -d conductor -v ON_ERROR_STOP=1 2>&1
    $testDataExitCode = $LASTEXITCODE
    
    if ($testDataExitCode -ne 0 -or $testDataOutput -match "ERROR:") {
        Write-Host "Error: Failed to insert test attendance data." -ForegroundColor Red
        $testDataOutput | Where-Object { $_ -match "ERROR:" } | ForEach-Object { Write-Host $_ -ForegroundColor Red }
        Write-Host "Check the output above for SQL errors." -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "`nTest attendance data inserted successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "  - Class meeting sessions: 5 sessions across 5 weeks (Nov 1 - Dec 5, 2024)" -ForegroundColor Gray
    Write-Host "  - Team meeting sessions: 5 sessions for Team 1, 5 sessions for Team 2" -ForegroundColor Gray
    Write-Host "  - Teams: Team Alpha (2 members), Team Beta (1 member)" -ForegroundColor Gray
    Write-Host "  - Class attendance rates: 45% to 98% (matches plot pattern)" -ForegroundColor Gray
    Write-Host "  - Team attendance: Varies by team and week" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now view attendance plots in the dashboard!" -ForegroundColor Green
    
} catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

