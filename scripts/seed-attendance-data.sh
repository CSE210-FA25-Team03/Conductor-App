#!/bin/bash
# Seed Attendance Test Data
# This script inserts fake attendance data for testing

set -e

echo "🚀 Seeding attendance test data..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if container exists and is running
if ! docker ps | grep -q conductor-postgres; then
    echo "❌ Error: PostgreSQL container is not running."
    echo "Please start the database first using: ./scripts/setup-db.sh"
    exit 1
fi

# Get project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SEED_PATH="$PROJECT_ROOT/app/db/seed_attendance_data.sql"

if [ ! -f "$SEED_PATH" ]; then
    echo "❌ Error: Seed file not found at $SEED_PATH"
    exit 1
fi

echo "📝 Inserting test data..."
docker exec -i conductor-postgres psql -U postgres -d conductor < "$SEED_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Test data inserted successfully!"
    echo ""
    echo "Test data includes:"
    echo "  - 4 periods: Nov 1-7, Nov 8-15, Nov 16-23, Nov 24-30"
    echo "  - 3 users with varying attendance patterns"
    echo "  - Some missing submissions (to test 0% calculation)"
else
    echo "❌ Error: Failed to insert test data. Check the output above for SQL errors."
    exit 1
fi

