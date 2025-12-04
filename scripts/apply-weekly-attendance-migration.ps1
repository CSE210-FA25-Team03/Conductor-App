# Apply Weekly Attendance Migration
# This script applies the weekly attendance tables to an existing database

$ErrorActionPreference = "Stop"

Write-Host "Applying weekly attendance migration..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Check if container exists and is running
$containerStatus = docker ps --filter "name=conductor-postgres" --format "{{.Status}}" 2>$null
if (-not $containerStatus -or $containerStatus -match "Exited") {
    Write-Host "Error: PostgreSQL container is not running." -ForegroundColor Red
    Write-Host "Please start the database first using: .\scripts\setup-db.ps1" -ForegroundColor Yellow
    exit 1
}

# Get project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
$migrationPath = Join-Path $projectRoot "app\db\migrations\add_weekly_attendance.sql"

if (-not (Test-Path $migrationPath)) {
    Write-Host "Error: Migration file not found at $migrationPath" -ForegroundColor Red
    exit 1
}

Write-Host "Applying migration..." -ForegroundColor Yellow
Get-Content $migrationPath | docker exec -i conductor-postgres psql -U postgres -d conductor

if ($LASTEXITCODE -eq 0) {
    Write-Host "Migration applied successfully!" -ForegroundColor Green
} else {
    Write-Host "Error: Migration failed. Check the output above for SQL errors." -ForegroundColor Red
    Write-Host "Note: If tables already exist, you may need to drop them first or use schema2.sql which includes these tables." -ForegroundColor Yellow
    exit 1
}

