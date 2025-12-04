#!/bin/bash
# Database setup script for Conductor App
# This script initializes the PostgreSQL database using Docker

set -e

echo "🚀 Setting up Conductor database..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Error: docker-compose is not installed."
    exit 1
fi

# Start PostgreSQL container
echo "📦 Starting PostgreSQL container..."
if command -v docker-compose &> /dev/null; then
    docker-compose up -d
else
    docker compose up -d
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if container is running
if ! docker ps | grep -q conductor-postgres; then
    echo "❌ Error: PostgreSQL container failed to start."
    exit 1
fi

# Initialize database schema
echo "📝 Initializing database schema..."
SCHEMA_PATH="app/db/schema.sql"

if [ ! -f "$SCHEMA_PATH" ]; then
    echo "❌ Error: Schema file not found at $SCHEMA_PATH"
    exit 1
fi

docker exec -i conductor-postgres psql -U postgres < "$SCHEMA_PATH"

if [ $? -eq 0 ]; then
    echo "✅ Database setup complete!"
    echo ""
    echo "Connection string: postgres://postgres:postgres@localhost:5432/conductor"
    echo ""
    echo "To stop the database: docker-compose down"
    echo "To view logs: docker-compose logs -f postgres"
else
    echo "❌ Error: Failed to initialize database schema."
    exit 1
fi


