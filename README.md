# Conductor-App
Scalable Course Management Applications

## Prerequisites

- Node.js 18+ (for global fetch support)
- Docker and Docker Compose (recommended for PostgreSQL)
- OR PostgreSQL 12+ installed locally

## Database Setup

### Option 1: Using Docker (Recommended)

**Quick Setup (Automated):**
```bash
# On Windows (PowerShell)
.\scripts\setup-db.ps1

# On macOS/Linux
chmod +x scripts/setup-db.sh
./scripts/setup-db.sh
```

**Manual Setup:**
1. **Start PostgreSQL with Docker Compose:**
   ```bash
   docker-compose up -d
   ```
   This will start a PostgreSQL container on port 5432.

2. **Initialize the database schema:**
   ```bash
   # Using Docker (recommended)
   docker exec -i conductor-postgres psql -U postgres < app/db/schema.sql

   # OR using psql (if installed locally)
   psql -h localhost -U postgres -f app/db/schema.sql
   ```

3. **Configure environment variables:**
   Create a `.env` file in the `app/backend` directory with:
   ```env
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/conductor
   PORT=3000
   ```
   
### Verify Database Connection

After setting up the database, you can verify the connection:
```bash
cd app/backend
npm install
npm start
```

The server should start without database connection errors.

## Running the Application

```bash
cd app/backend
npm install
npm start
```

The server will run on `http://localhost:3000` (or the port specified in your `.env` file).

## Docker Commands Reference

- **Start database:** `docker-compose up -d`
- **Stop database:** `docker-compose down`
- **View logs:** `docker-compose logs -f postgres`
- **Stop and remove volumes (⚠️ deletes data):** `docker-compose down -v`

## pgAdmin

1. http://localhost:5050
2. Credentials
   * Email: admin@example.com
   * Password: admin
3. Right-click “Servers” → “Register” → “Server…”
4. Fill out the “General” tab
   * Name: conductor-postgres
5. Go to the “Connection” tab
6. Fill in the values
   * Host name/address: postgres
   * Port: 5432
   * Maintenance DB: postgres
   * Username: postgres
   * Password: postgres
7. Tables
   * Servers, conductor, postgres, Databases, conductor, Schemas, public, Tables