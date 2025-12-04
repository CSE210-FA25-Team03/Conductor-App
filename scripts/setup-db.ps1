# Database setup script for Conductor App (PowerShell)
# This script initializes the PostgreSQL database using Docker

$ErrorActionPreference = "Stop"

Write-Host "Setting up Conductor database..." -ForegroundColor Cyan

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "Error: Docker is not running. Please start Docker and try again." -ForegroundColor Red
    exit 1
}

# Detect docker compose command (v2 uses 'docker compose', v1 uses 'docker-compose')
$useDockerComposeV2 = $false
try {
    docker compose version | Out-Null
    $useDockerComposeV2 = $true
    Write-Host "Detected Docker Compose v2" -ForegroundColor Gray
} catch {
    try {
        docker-compose --version | Out-Null
        $useDockerComposeV2 = $false
        Write-Host "Detected Docker Compose v1" -ForegroundColor Gray
    } catch {
        Write-Host "Error: Docker Compose is not installed or not available." -ForegroundColor Red
        exit 1
    }
}

# Ensure we're in the correct directory (where docker-compose.yml is located)
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Push-Location $projectRoot

try {
    # Start PostgreSQL container
    Write-Host "Starting PostgreSQL container..." -ForegroundColor Yellow
    
    if ($useDockerComposeV2) {
        docker compose up -d
    } else {
        docker-compose up -d
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to start PostgreSQL container." -ForegroundColor Red
        Write-Host "Check the output above for details." -ForegroundColor Yellow
        exit 1
    }
    
    # Wait for PostgreSQL to be ready (with retries)
    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    $maxRetries = 12
    $retryCount = 0
    $containerReady = $false
    
    while ($retryCount -lt $maxRetries -and -not $containerReady) {
        Start-Sleep -Seconds 2
        $containerStatus = docker ps --filter "name=conductor-postgres" --format "{{.Status}}" 2>$null
        if ($containerStatus -and $containerStatus -notmatch "Exited") {
            # Check if PostgreSQL is actually ready
            $healthCheck = docker exec conductor-postgres pg_isready -U postgres 2>$null
            if ($LASTEXITCODE -eq 0) {
                $containerReady = $true
            }
        }
        $retryCount++
    }
    
    if (-not $containerReady) {
        Write-Host "Error: PostgreSQL container failed to start or is not ready." -ForegroundColor Red
        Write-Host "Container status:" -ForegroundColor Yellow
        docker ps -a --filter "name=conductor-postgres"
        Write-Host "`nContainer logs:" -ForegroundColor Yellow
        if ($useDockerComposeV2) {
            docker compose logs postgres
        } else {
            docker-compose logs postgres
        }
        exit 1
    }
    
    # Initialize database schema
    Write-Host "Initializing database schema..." -ForegroundColor Yellow
    $schemaPath = Join-Path $projectRoot "app\db\schema.sql"
    $schema2Path = Join-Path $projectRoot "app\db\schema2.sql"
    
    # Prefer schema2.sql if it exists (includes seed data), otherwise fall back to schema.sql
    if (Test-Path $schema2Path) {
        Write-Host "Loading schema with seed data (schema2.sql)..." -ForegroundColor Yellow
        Get-Content $schema2Path | docker exec -i conductor-postgres psql -U postgres
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to load schema with seed data (schema2.sql)." -ForegroundColor Red
            Write-Host "Check the output above for SQL errors." -ForegroundColor Yellow
            exit 1
        }
    } elseif (Test-Path $schemaPath) {
        Write-Host "Loading base schema (schema.sql)..." -ForegroundColor Yellow
        Write-Host "Note: schema2.sql not found, using schema.sql (no seed data)" -ForegroundColor Yellow
        Get-Content $schemaPath | docker exec -i conductor-postgres psql -U postgres
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error: Failed to load base schema (schema.sql)." -ForegroundColor Red
            Write-Host "Check the output above for SQL errors." -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Error: Neither schema.sql nor schema2.sql found in app\db\" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Database setup complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Connection string: postgres://postgres:postgres@localhost:5432/conductor" -ForegroundColor Cyan
    Write-Host ""
    $stopCmd = if ($useDockerComposeV2) { "docker compose down" } else { "docker-compose down" }
    $logsCmd = if ($useDockerComposeV2) { "docker compose logs -f postgres" } else { "docker-compose logs -f postgres" }
    Write-Host "To stop the database: $stopCmd" -ForegroundColor Yellow
    Write-Host "To view logs: $logsCmd" -ForegroundColor Yellow
} finally {
    Pop-Location
}


