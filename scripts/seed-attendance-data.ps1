# Seed Attendance Test Data
# This script inserts fake attendance data for testing

$ErrorActionPreference = "Stop"

Write-Host "Seeding attendance test data..." -ForegroundColor Cyan

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
$seedPath = Join-Path $projectRoot "app\db\seed_attendance_data.sql"

if (-not (Test-Path $seedPath)) {
    Write-Host "Error: Seed file not found at $seedPath" -ForegroundColor Red
    exit 1
}

Write-Host "Inserting test data..." -ForegroundColor Yellow
Get-Content $seedPath | docker exec -i conductor-postgres psql -U postgres -d conductor

if ($LASTEXITCODE -eq 0) {
    Write-Host "Test data inserted successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test data includes:" -ForegroundColor Cyan
    Write-Host "  - 4 periods: Nov 1-7, Nov 8-15, Nov 16-23, Nov 24-30" -ForegroundColor Gray
    Write-Host "  - 3 users with varying attendance patterns" -ForegroundColor Gray
    Write-Host "  - Some missing submissions (to test 0% calculation)" -ForegroundColor Gray
} else {
    Write-Host "Error: Failed to insert test data. Check the output above for SQL errors." -ForegroundColor Red
    exit 1
}

