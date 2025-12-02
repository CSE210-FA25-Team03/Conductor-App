// db.js
// Central Postgres connection helper for the backend.
// All database access should go through this module.

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Prefer DATABASE_URL (easy for Docker / AWS / Render / etc.)
// Fallback: local dev connection to "conductor" database.
const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/conductor';

const pool = new Pool({
  connectionString,
  // You can add more config here later if needed:
  // max: 10,
  // idleTimeoutMillis: 30000,
});

/**
 * Run a SQL query.
 * Always use parameterized queries: db.query(text, [params...])
 * so it's easy to grep and update later.
 */
async function query(text, params = []) {
  return pool.query(text, params);
}

module.exports = {
  query,
  pool,
};
