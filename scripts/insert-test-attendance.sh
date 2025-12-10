#!/bin/bash
# Script to insert test attendance data into the Conductor database
# This script runs the migration and inserts test attendance data

set -e

echo "Inserting test attendance data..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if PostgreSQL container is running
if ! docker ps --filter "name=conductor-postgres" --format "{{.Status}}" | grep -q "Up"; then
    echo "Error: PostgreSQL container 'conductor-postgres' is not running."
    echo "Please start the database first using: ./scripts/setup-db.sh"
    exit 1
fi

# Get project root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Paths to SQL files
MIGRATION_PATH="$PROJECT_ROOT/app/db/migrations/add_team_id_to_attendance.sql"
TEST_DATA_PATH="$PROJECT_ROOT/app/db/migrations/insert_test_attendance_data.sql"

# Check if migration file exists
if [ ! -f "$MIGRATION_PATH" ]; then
    echo "Error: Migration file not found: $MIGRATION_PATH"
    exit 1
fi

# Check if test data file exists
if [ ! -f "$TEST_DATA_PATH" ]; then
    echo "Error: Test data file not found: $TEST_DATA_PATH"
    exit 1
fi

# Step 1: Run migration to add team_id column
echo ""
echo "Step 1: Running migration (adding team_id column)..."
docker exec -i conductor-postgres psql -U postgres < "$MIGRATION_PATH" || {
    echo "Warning: Migration may have failed or column already exists."
    echo "This is okay if the migration was already run."
}

# Step 2: Insert test attendance data
echo ""
echo "Step 2: Inserting test attendance data..."
docker exec -i conductor-postgres psql -U postgres < "$TEST_DATA_PATH"

if [ $? -ne 0 ]; then
    echo "Error: Failed to insert test attendance data."
    echo "Check the output above for SQL errors."
    exit 1
fi

echo ""
echo "Test attendance data inserted successfully!"
echo ""
echo "Summary:"
echo "  - Class meeting sessions: 6 sessions across 5 weeks"
echo "  - Team meeting sessions: 5 sessions for Team 1"
echo "  - Date range: Nov 1 - Dec 5, 2024"
echo "  - Attendance rates: 45% to 98% (varies by week)"
echo ""
echo "You can now view attendance plots in the dashboard!"

