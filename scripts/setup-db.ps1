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
    $schemaLoaded = $false
    if (Test-Path $schema2Path) {
        Write-Host "Loading schema with seed data (schema2.sql)..." -ForegroundColor Yellow
        # Schema file creates database, so connect to postgres first (it will \connect to conductor)
        # Use -v ON_ERROR_STOP=1 to stop on first error and capture it
        $schemaOutput = Get-Content $schema2Path | docker exec -i conductor-postgres psql -U postgres -v ON_ERROR_STOP=1 2>&1
        $schemaExitCode = $LASTEXITCODE
        
        # Check for errors in output
        $hasErrors = $schemaOutput -match "ERROR:" -or $schemaExitCode -ne 0
        
        if ($hasErrors) {
            Write-Host "Error: Failed to load schema with seed data (schema2.sql)." -ForegroundColor Red
            Write-Host "Exit code: $schemaExitCode" -ForegroundColor Yellow
            Write-Host "`nSQL Errors and relevant output:" -ForegroundColor Yellow
            # Show last 50 lines of output to see what happened
            $schemaOutput | Select-Object -Last 50 | ForEach-Object {
                if ($_ -match "ERROR:") {
                    Write-Host $_ -ForegroundColor Red
                } elseif ($_ -match "LINE|syntax|relation") {
                    Write-Host $_ -ForegroundColor Yellow
                } else {
                    Write-Host $_ -ForegroundColor Gray
                }
            }
            Write-Host "`nCheck the full output above for details." -ForegroundColor Yellow
            exit 1
        }
        $schemaLoaded = $true
    } elseif (Test-Path $schemaPath) {
        Write-Host "Loading base schema (schema.sql)..." -ForegroundColor Yellow
        Write-Host "Note: schema2.sql not found, using schema.sql (no seed data)" -ForegroundColor Yellow
        # For schema.sql, we need to check if it has database creation commands
        # If it does, connect to postgres first, otherwise connect to conductor
        $schemaContent = Get-Content $schemaPath -Raw
        if ($schemaContent -match "CREATE DATABASE|DROP DATABASE") {
            $schemaOutput = Get-Content $schemaPath | docker exec -i conductor-postgres psql -U postgres -v ON_ERROR_STOP=1 2>&1
        } else {
            $schemaOutput = Get-Content $schemaPath | docker exec -i conductor-postgres psql -U postgres -d conductor -v ON_ERROR_STOP=1 2>&1
        }
        $schemaExitCode = $LASTEXITCODE
        
        $hasErrors = $schemaOutput -match "ERROR:" -or $schemaExitCode -ne 0
        
        if ($hasErrors) {
            Write-Host "Error: Failed to load base schema (schema.sql)." -ForegroundColor Red
            Write-Host "Exit code: $schemaExitCode" -ForegroundColor Yellow
            Write-Host "`nSQL Errors and relevant output:" -ForegroundColor Yellow
            $schemaOutput | Select-Object -Last 50 | ForEach-Object {
                if ($_ -match "ERROR:") {
                    Write-Host $_ -ForegroundColor Red
                } elseif ($_ -match "LINE|syntax|relation") {
                    Write-Host $_ -ForegroundColor Yellow
                } else {
                    Write-Host $_ -ForegroundColor Gray
                }
            }
            Write-Host "`nCheck the full output above for details." -ForegroundColor Yellow
            exit 1
        }
        $schemaLoaded = $true
    } else {
        Write-Host "Error: Neither schema.sql nor schema2.sql found in app\db\" -ForegroundColor Red
        exit 1
    }
    
    # Verify schema loaded by checking if a key table exists
    if ($schemaLoaded) {
        Write-Host "Verifying schema was loaded correctly..." -ForegroundColor Yellow
        $tableCheck = docker exec conductor-postgres psql -U postgres -d conductor -t -A -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_sessions');" 2>&1
        $tableExists = ($tableCheck -match "^t$" -or $tableCheck.Trim() -eq "t")
        
        if (-not $tableExists) {
            Write-Host "Error: attendance_sessions table not found after schema load." -ForegroundColor Red
            Write-Host "The schema file may have errors or failed to load completely." -ForegroundColor Yellow
            Write-Host "Table check result: '$tableCheck'" -ForegroundColor Gray
            Write-Host "Please check the schema file for errors and try again." -ForegroundColor Yellow
            exit 1
        } else {
            Write-Host "Schema verification passed." -ForegroundColor Green
        }
    }
    
    # Run migrations if any exist (only if schema loaded and verified successfully)
    if ($schemaLoaded) {
        Write-Host "Running database migrations..." -ForegroundColor Yellow
        $migrationsPath = Join-Path $projectRoot "app\db\migrations"
        if (Test-Path $migrationsPath) {
            $migrationFiles = Get-ChildItem -Path $migrationsPath -Filter "*.sql" | Sort-Object Name
            foreach ($migrationFile in $migrationFiles) {
                Write-Host "  Running migration: $($migrationFile.Name)..." -ForegroundColor Gray
                # Run migration in conductor database
                $migrationOutput = Get-Content $migrationFile.FullName | docker exec -i conductor-postgres psql -U postgres -d conductor -v ON_ERROR_STOP=1 2>&1
                $migrationExitCode = $LASTEXITCODE
                
                # Filter out NOTICE messages (they're informational, not errors)
                $actualErrors = $migrationOutput | Where-Object { $_ -match "ERROR:" -and $_ -notmatch "NOTICE:" }
                
                if ($actualErrors -or ($migrationExitCode -ne 0 -and $migrationOutput -match "ERROR:")) {
                    Write-Host "Warning: Migration $($migrationFile.Name) may have failed." -ForegroundColor Yellow
                    $actualErrors | ForEach-Object { Write-Host $_ -ForegroundColor Red }
                } elseif ($migrationOutput -match "NOTICE:") {
                    # Show NOTICE messages as info (not errors)
                    $migrationOutput | Where-Object { $_ -match "NOTICE:" } | ForEach-Object { 
                        Write-Host "  $_" -ForegroundColor Cyan 
                    }
                }
            }
        } else {
            Write-Host "  No migrations directory found, skipping migrations." -ForegroundColor Gray
        }
    } else {
        Write-Host "Skipping migrations because schema did not load successfully." -ForegroundColor Yellow
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


