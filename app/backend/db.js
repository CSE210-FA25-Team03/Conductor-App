// db.js
// Central Postgres connection helper for the backend.
// All database access should go through this module.

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/conductor';

const isProd = process.env.NODE_ENV === 'production'
const ssl =
  process.env.DB_SSL === 'true' || isProd
    ? { require: true, rejectUnauthorized: false }
    : false;


const pool = new Pool({
  connectionString,
  ssl,
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
