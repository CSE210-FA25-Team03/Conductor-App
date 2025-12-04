#!/bin/bash
# Apply Weekly Attendance Migration
# This script applies the weekly attendance tables to an existing database

set -e

echo "🚀 Applying weekly attendance migration..."

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
MIGRATION_PATH="$PROJECT_ROOT/app/db/migrations/add_weekly_attendance.sql"

if [ ! -f "$MIGRATION_PATH" ]; then
    echo "❌ Error: Migration file not found at $MIGRATION_PATH"
    exit 1
fi

echo "📝 Applying migration..."
docker exec -i conductor-postgres psql -U postgres -d conductor < "$MIGRATION_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Error: Migration failed. Check the output above for SQL errors."
    echo "Note: If tables already exist, you may need to drop them first or use schema2.sql which includes these tables."
    exit 1
fi

